import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, CirclePlus, Clock3, LoaderCircle, Sparkles, Trash2, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrowserProvider, Contract } from 'ethers'
import { ConfirmationModal } from '../components/common'
import WalletButton from '../components/WalletButton'
import { useWallet } from '../context/useWallet'
import { useOnChainPolls } from '../hooks/useOnChainPolls'
import { notifyOnChainActivityUpdated } from '../services/onChainPolls'
import VotingAbi from '../contracts/Voting.json'
import { getNetworkConfig } from '../contracts/contractAddress'
import { categories } from '../data/demoPolls'
import { sendOnLiveTransactionNetwork } from '../utils/transactionNetwork'
import { utf8Bytes, validatePoll } from '../utils/validation'

function getNetworkName(chainId) {
  const config = getNetworkConfig(chainId)
  if (!config) return null
  return config.chainId === 31337 ? 'Hardhat Local' : 'Sepolia'
}

function getUnsupportedNetworkMessage(chainId) {
  return `Unsupported network (chain ID ${String(chainId)}). Switch MetaMask to Hardhat Local (chain ID 31337) or Sepolia (chain ID 11155111).`
}

function getTransactionNetwork(walletChainId, providerChainId) {
  const selectedNetwork = getNetworkConfig(walletChainId)
  if (!selectedNetwork) {
    throw new Error(getUnsupportedNetworkMessage(walletChainId))
  }

  const providerNetwork = getNetworkConfig(providerChainId)
  if (!providerNetwork) {
    throw new Error(getUnsupportedNetworkMessage(providerChainId))
  }

  if (selectedNetwork.chainId !== providerNetwork.chainId) {
    const selectedName = getNetworkName(selectedNetwork.chainId)
    const providerName = getNetworkName(providerNetwork.chainId)
    throw new Error(
      `MetaMask's selected network (${selectedName}, chain ID ${selectedNetwork.chainId}) does not match the provider network (${providerName}, chain ID ${providerNetwork.chainId}). Reconnect your wallet and try again.`,
    )
  }

  return selectedNetwork
}

function isPollCreatedEvent(log, contractAddress, topicHash) {
  return log.address.toLowerCase() === contractAddress.toLowerCase()
    && log.topics[0] === topicHash
}

const durationOptions = [
  { label: '1 minute', value: 60 },
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 21600 },
  { label: '1 day', value: 86400 },
  { label: '3 days', value: 259200 },
  { label: '7 days', value: 604800 },
  { label: '30 days', value: 2592000 },
]

export default function CreatePoll() {
  const { account, chainId, provider, status: walletStatus } = useWallet()
  const { refresh } = useOnChainPolls()
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Governance')
  const [options, setOptions] = useState(['', ''])
  const [duration, setDuration] = useState(86400)
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)
  const [transaction, setTransaction] = useState({ phase: 'ready' })
  const preview = useMemo(() => options.map((text) => text.trim()).filter(Boolean), [options])

  const updateOption = (index, value) => setOptions((current) => current.map((option, itemIndex) => itemIndex === index ? value : option))
  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validatePoll({ question, options, duration })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (walletStatus !== 'connected' || !account || !provider) {
      setTransaction({ phase: 'failed', message: 'Connect MetaMask before creating an on-chain poll.' })
      return
    }
    if (chainId === null) {
      setTransaction({ phase: 'failed', message: 'Unable to determine the connected network. Check MetaMask and try again.' })
      return
    }
    if (!getNetworkConfig(chainId)) {
      setTransaction({ phase: 'failed', message: getUnsupportedNetworkMessage(chainId) })
      return
    }
    setConfirming(true)
  }

  const confirmCreate = async () => {
    const pollInput = {
      question: question.trim(),
      options: options.map((option) => option.trim()),
      duration: Number(duration),
    }
    setConfirming(false)
    setTransaction({ phase: 'awaiting' })

    let sentTransaction
    let receipt
    let voting
    let selectedNetwork
    try {
      if (!provider || !account || !window.ethereum?.request) {
        throw new Error('Connect MetaMask before creating an on-chain poll.')
      }
      const ethereum = window.ethereum
      const transactionProvider = new BrowserProvider(ethereum, 'any')
      const network = await transactionProvider.getNetwork()
      selectedNetwork = getTransactionNetwork(chainId, network.chainId)

      const signer = await transactionProvider.getSigner()
      const signerAccount = await signer.getAddress()
      if (signerAccount.toLowerCase() !== account.toLowerCase()) {
        throw new Error('The active MetaMask account changed. Reconnect your wallet and try again.')
      }

      voting = new Contract(selectedNetwork.contractAddress, VotingAbi, signer)
      sentTransaction = await sendOnLiveTransactionNetwork({
        expectedChainId: selectedNetwork.chainId,
        ethereum,
        provider: transactionProvider,
        signer,
        contract: voting,
        send: () => voting.createPoll(pollInput.question, pollInput.options, pollInput.duration),
      })
      setTransaction({
        phase: 'pending',
        hash: sentTransaction.hash,
        networkName: getNetworkName(selectedNetwork.chainId),
      })
      receipt = await sentTransaction.wait()
      if (!receipt || receipt.status !== 1) {
        throw new Error('The transaction was not confirmed successfully.')
      }
    } catch (error) {
      const code = error?.code ?? error?.info?.error?.code ?? error?.error?.code
      const message = code === 4001
        ? 'The transaction was rejected in MetaMask.'
        : error?.shortMessage || error?.reason || error?.info?.error?.message || error?.message || 'The transaction failed.'
      if (code !== 4001) console.error('Unable to create the on-chain poll:', error)
      setTransaction({
        phase: 'failed',
        message,
        hash: sentTransaction?.hash,
      })
      return
    }

    notifyOnChainActivityUpdated()
    let pollId = null
    try {
      const pollCreatedEvent = voting.interface.getEvent('PollCreated')
      const createdEvent = receipt.logs.find((log) => (
        isPollCreatedEvent(log, selectedNetwork.contractAddress, pollCreatedEvent.topicHash)
      ))
      const rawPollId = createdEvent ? voting.interface.parseLog(createdEvent)?.args.pollId : null
      if (typeof rawPollId === 'bigint' && rawPollId <= BigInt(Number.MAX_SAFE_INTEGER)) {
        pollId = Number(rawPollId)
      }
    } catch (error) {
      console.error('The transaction succeeded, but its PollCreated event could not be read:', error)
    }
    const confirmedPoll = {
      id: pollId,
      question: pollInput.question,
      options: pollInput.options.map((text) => ({ text, votes: 0 })),
      endAt: new Date(Date.now() + pollInput.duration * 1000).toISOString(),
    }

    setTransaction({
      phase: 'success',
      hash: sentTransaction.hash,
      blockNumber: receipt.blockNumber,
      networkName: getNetworkName(selectedNetwork.chainId),
      poll: confirmedPoll,
      refreshing: true,
    })

    try {
      const refreshedPolls = await refresh()
      const refreshedPoll = pollId === null
        ? null
        : refreshedPolls?.find((poll) => poll.id === pollId)
      setTransaction((current) => ({
        ...current,
        poll: refreshedPoll || current.poll,
        refreshing: false,
        refreshFailed: refreshedPolls === null,
      }))
    } catch (error) {
      console.error('The transaction succeeded, but on-chain polls could not be refreshed:', error)
      setTransaction((current) => ({ ...current, refreshing: false, refreshFailed: true }))
    }
  }

  return (
    <>
      <div className="demo-banner"><span className="demo-banner-icon"><Sparkles size={16} /></span><span><strong>On-chain poll creation.</strong> This submits a transaction to the Voting contract on Hardhat Local or Sepolia; it will not be added to demo polls.</span></div>
      <div className="create-layout">
        <form className="form-panel" onSubmit={handleSubmit} noValidate>
          <div className="form-section-title"><span className="step-number">01</span><div><h2>Set the scene</h2><p>Give your community a clear, thoughtful question.</p></div></div>
          <div className="form-field"><label htmlFor="question">Poll question <span className="required">*</span></label><input id="question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={200} placeholder="e.g. Which ecosystem should we explore next?" aria-describedby={errors.question ? 'question-error' : 'question-count'} aria-invalid={Boolean(errors.question)} /><div className={`field-meta ${errors.question ? 'field-error' : ''}`} id={errors.question ? 'question-error' : 'question-count'}>{errors.question || `${utf8Bytes(question)} / 200 UTF-8 bytes`}</div></div>
          <div className="form-field"><label htmlFor="description">Description <span className="optional">(preview only)</span></label><textarea id="description" rows="3" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add context to help people make an informed choice..." aria-describedby="description-count" /><div className="field-meta" id="description-count">{utf8Bytes(description)} UTF-8 bytes · not stored by the contract</div></div>
          <div className="form-field"><label htmlFor="category">Category <span className="optional">(preview only)</span></label><select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.filter((item) => item !== 'All categories').map((item) => <option key={item}>{item}</option>)}</select></div>

          <div className="form-section-title options-title"><span className="step-number">02</span><div><h2>Voting options <span className="required">*</span></h2><p>Add 2–10 options. Keep each one clear and distinct.</p></div></div>
          <div className="option-fields">{options.map((option, index) => <div className="option-input-row" key={`option-${index}`}><span className="option-index">{String(index + 1).padStart(2, '0')}</span><input aria-label={`Option ${index + 1}`} value={option} maxLength={80} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Option ${index + 1}`} /><span className="option-byte-count">{utf8Bytes(option)}/80</span>{options.length > 2 && <button className="icon-button remove-option" type="button" onClick={() => setOptions((current) => current.filter((_, itemIndex) => index !== itemIndex))} aria-label={`Remove option ${index + 1}`}><Trash2 size={16} /></button>}</div>)}</div>
          {errors.options && <p className="field-meta field-error" role="alert">{errors.options}</p>}
          <button type="button" className="add-option-button" disabled={options.length >= 10} onClick={() => setOptions((current) => [...current, ''])}><CirclePlus size={16} /> Add option <span>{options.length}/10</span></button>

          <div className="form-section-title duration-title"><span className="step-number">03</span><div><h2>Set a duration</h2><p>Voting stays open for a maximum of 30 days.</p></div></div>
          <div className="form-field"><label htmlFor="duration">Poll closes in</label><div className="select-with-icon"><Clock3 size={16} /><select id="duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{durationOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>{errors.duration && <p className="field-meta field-error">{errors.duration}</p>}</div>
          <div className="transaction-status" role={transaction.phase === 'failed' ? 'alert' : 'status'} aria-live="polite">
            <span className={`transaction-status-icon transaction-status-${transaction.phase}`}>
              {transaction.phase === 'awaiting' || transaction.phase === 'pending'
                ? <LoaderCircle size={17} className="wallet-spinner" />
                : transaction.phase === 'success' ? <CheckCircle2 size={17} /> : <Wallet size={17} />}
            </span>
            <div className="transaction-status-copy">
              <strong>
                {transaction.phase === 'ready' && 'Ready to submit.'}
                {transaction.phase === 'awaiting' && 'Waiting for MetaMask confirmation.'}
                {transaction.phase === 'pending' && 'Transaction submitted / pending.'}
                {transaction.phase === 'success' && 'Transaction successful.'}
                {transaction.phase === 'failed' && 'Transaction failed or rejected.'}
              </strong>
              {transaction.phase === 'ready' && walletStatus !== 'connected' && <p>Connect MetaMask to create a poll on-chain.</p>}
              {transaction.phase === 'ready' && walletStatus === 'connected' && chainId !== null && !getNetworkConfig(chainId) && <p>{getUnsupportedNetworkMessage(chainId)}</p>}
              {transaction.phase === 'ready' && walletStatus === 'connected' && chainId === null && <p>Checking the connected network…</p>}
              {transaction.phase === 'ready' && walletStatus === 'connected' && getNetworkConfig(chainId) && <p>Connected to {getNetworkName(chainId)}. The contract stores the question, options, and duration.</p>}
              {transaction.phase === 'awaiting' && <p>Confirm the poll creation transaction in MetaMask.</p>}
              {transaction.phase === 'pending' && <p>Waiting for the {transaction.networkName} blockchain to confirm this transaction.</p>}
              {transaction.phase === 'failed' && <p>{transaction.message}</p>}
              {transaction.phase === 'success' && transaction.poll && (
                <div className="created-on-chain-poll">
                  <p>{transaction.poll.id === null ? `Poll created on ${transaction.networkName}.` : `On-chain poll #${transaction.poll.id} created on ${transaction.networkName} in block ${transaction.blockNumber}.`}</p>
                  <strong className="created-poll-question">{transaction.poll.question}</strong>
                  <ul>{transaction.poll.options.map((option, index) => <li key={`${index}-${option.text}`}>{option.text}</li>)}</ul>
                  {transaction.refreshing && <p>Refreshing on-chain poll data…</p>}
                  {transaction.refreshFailed && <p>Poll data could not be refreshed. Open Explore and use Refresh to load it from the contract.</p>}
                  {!transaction.refreshing && !transaction.refreshFailed && <p>Confirmed poll data refreshed from the Voting contract.</p>}
                  <Link to="/explore">View on-chain polls <ArrowRight size={14} /></Link>
                </div>
              )}
              {transaction.hash && <div className="transaction-hash"><span>Transaction hash</span><code>{transaction.hash}</code></div>}
              {transaction.phase === 'success' && <p className="confirmation-note">Confirmed on {transaction.networkName}. No external block explorer is required.</p>}
            </div>
            {transaction.phase === 'ready' && walletStatus !== 'connected' && <WalletButton className="button button-secondary transaction-wallet" />}
          </div>
          <div className="form-actions"><Link to="/" className="button button-quiet"><ArrowLeft size={16} /> Cancel</Link><button type="submit" className="button button-primary" disabled={transaction.phase === 'awaiting' || transaction.phase === 'pending'}>{transaction.phase === 'awaiting' || transaction.phase === 'pending' ? 'Transaction in progress' : 'Review poll'} <ArrowRight size={16} /></button></div>
        </form>

        <aside className="preview-panel">
          <div className="preview-head"><div><span className="section-kicker">LIVE PREVIEW</span><h2>Your poll</h2></div><span className="preview-live"><i /> PREVIEW</span></div>
          <article className="poll-card preview-card"><div className="poll-card-meta"><span className="category-chip">{category}</span><span className="status-badge status-live"><span className="status-dot" />Active</span></div><h3>{question || 'Your question will appear here'}</h3><p className="poll-description">{description || 'Add a little context to help your community decide.'}</p><div className="preview-options">{(preview.length ? preview : ['Your first option', 'Your second option']).map((item, index) => <div className="preview-option" key={`${index}-${item}`}><span className="vote-radio" />{item}</div>)}</div><div className="poll-card-footer"><span className="poll-metric"><span className="muted">0 votes</span></span><span className="countdown"><Clock3 size={14} />{durationOptions.find((item) => item.value === duration)?.label || '1 day'}</span></div></article>
          <div className="preview-note"><span className="preview-note-mark">✦</span><p><strong>Contract-backed creation.</strong> The transaction includes the question, options, and duration. Description and category are preview-only. Demo polls stay separate.</p></div>
        </aside>
      </div>
      {confirming && <ConfirmationModal title="Create this on-chain poll?" onCancel={() => setConfirming(false)} onConfirm={confirmCreate} confirmLabel="Send transaction"><p>This will ask MetaMask to send a transaction to the Voting contract on {getNetworkName(chainId)}.</p><p className="modal-question">“{question.trim()}”</p><p>Duration: <strong>{durationOptions.find((item) => item.value === duration)?.label}</strong> ({duration.toLocaleString()} seconds).</p></ConfirmationModal>}
    </>
  )
}
