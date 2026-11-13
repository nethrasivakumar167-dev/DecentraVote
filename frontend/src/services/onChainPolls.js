import { Contract, JsonRpcProvider } from 'ethers'
import VotingAbi from '../contracts/Voting.json'
import { getNetworkConfig } from '../contracts/contractAddress'

const POLL_BATCH_SIZE = 50
const EVENT_QUERY_BLOCK_RANGE = 2000
const readProviders = new Map()

export function getReadProvider(chainId) {
  const config = getNetworkConfig(chainId)
  if (!config) {
    throw new Error(`Unsupported network (chain ID ${String(chainId)}).`)
  }

  if (!readProviders.has(config.chainId)) {
    readProviders.set(config.chainId, new JsonRpcProvider(config.readRpcUrl, config.chainId))
  }
  return readProviders.get(config.chainId)
}

export const localReadProvider = getReadProvider(31337)
export const ON_CHAIN_ACTIVITY_UPDATED = 'decentravote:on-chain-activity-updated'

export function notifyOnChainActivityUpdated() {
  window.dispatchEvent(new Event(ON_CHAIN_ACTIVITY_UPDATED))
}

function toSafeNumber(value, label) {
  if (typeof value !== 'bigint' || value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is outside the supported numeric range.`)
  }
  return Number(value)
}

async function getProviderConfig(provider) {
  if (!provider || typeof provider.getNetwork !== 'function') {
    throw new Error('A valid RPC provider is required to read on-chain data.')
  }

  let network
  try {
    network = await provider.getNetwork()
  } catch (error) {
    const details = error?.shortMessage || error?.message || 'Unknown RPC error.'
    throw new Error(`Unable to determine the RPC provider network: ${details}`, { cause: error })
  }

  const config = getNetworkConfig(network.chainId)
  if (!config) {
    throw new Error(`Unsupported network (chain ID ${String(network.chainId)}).`)
  }
  return config
}

function getErrorDetails(error) {
  return error?.shortMessage || error?.message || 'Unknown RPC error.'
}

function toIsoDate(seconds) {
  const timestamp = toSafeNumber(seconds, 'Poll end time') * 1000
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) throw new Error('Poll end time is not a valid date.')
  return date.toISOString()
}

function formatPoll(pollData, totalVotes) {
  const id = toSafeNumber(pollData.id, 'Poll ID')
  const voteCounts = Array.from(pollData.voteCounts, (count) => toSafeNumber(count, 'Vote count'))
  const endAt = toIsoDate(pollData.endTime)

  if (pollData.options.length !== voteCounts.length) {
    throw new Error(`Poll ${id} returned a different number of options and vote counts.`)
  }

  return {
    id,
    question: pollData.question,
    options: pollData.options.map((text, index) => ({ text, votes: voteCounts[index] })),
    voteCounts,
    totalVotes: toSafeNumber(totalVotes, 'Total votes'),
    endAt,
    creator: pollData.creator,
    status: new Date(endAt).getTime() > Date.now() ? 'Active' : 'Ended',
  }
}

export async function readOnChainPolls(provider) {
  const config = await getProviderConfig(provider)
  try {
    const contract = new Contract(config.contractAddress, VotingAbi, provider)
    const count = toSafeNumber(await contract.pollCount(), 'Poll count')
    const polls = []

    for (let firstId = 1; firstId <= count; firstId += POLL_BATCH_SIZE) {
      const lastId = Math.min(firstId + POLL_BATCH_SIZE - 1, count)
      const batch = await Promise.all(
        Array.from({ length: lastId - firstId + 1 }, async (_, index) => {
          const id = firstId + index
          const [pollData, totalVotes] = await Promise.all([
            contract.getPoll(id),
            contract.getTotalVotes(id),
          ])
          return formatPoll(pollData, totalVotes)
        }),
      )
      polls.push(...batch)
    }

    return polls
  } catch (error) {
    throw new Error(`Unable to read Voting polls on chain ${config.chainId}: ${getErrorDetails(error)}`, { cause: error })
  }
}

function getActivityPollData(pollData) {
  const id = toSafeNumber(pollData.id, 'Poll ID')
  return {
    id,
    question: pollData.question,
    options: Array.from(pollData.options),
  }
}

function getBlockTimestamp(block) {
  if (!block || !Number.isSafeInteger(block.timestamp) || block.timestamp < 0) {
    throw new Error('The activity log block does not contain a valid timestamp.')
  }
  const date = new Date(block.timestamp * 1000)
  if (!Number.isFinite(date.getTime())) {
    throw new Error('The activity log block timestamp is not a valid date.')
  }
  return date.toISOString()
}

function getLogBlockNumber(log) {
  if (!Number.isSafeInteger(log.blockNumber) || log.blockNumber < 0) {
    throw new Error('The activity log does not contain a valid block number.')
  }
  return log.blockNumber
}

function getLogTransactionHash(log) {
  if (typeof log.transactionHash !== 'string' || !log.transactionHash) {
    throw new Error('The activity log does not contain a transaction hash.')
  }
  return log.transactionHash
}

async function mapInBatches(items, mapItem) {
  const results = []
  for (let first = 0; first < items.length; first += POLL_BATCH_SIZE) {
    const batch = items.slice(first, first + POLL_BATCH_SIZE)
    results.push(...await Promise.all(batch.map(mapItem)))
  }
  return results
}

async function queryFilterInChunks(contract, filter, fromBlock, toBlock) {
  const logs = []
  for (let firstBlock = fromBlock; firstBlock <= toBlock; firstBlock += EVENT_QUERY_BLOCK_RANGE) {
    const lastBlock = Math.min(firstBlock + EVENT_QUERY_BLOCK_RANGE - 1, toBlock)
    try {
      logs.push(...await contract.queryFilter(filter, firstBlock, lastBlock))
    } catch (error) {
      throw new Error(
        `Unable to read event logs for blocks ${firstBlock}-${lastBlock}: ${getErrorDetails(error)}`,
        { cause: error },
      )
    }
  }
  return logs
}

export async function readOnChainActivity(walletAddress, provider = localReadProvider) {
  const config = await getProviderConfig(provider)
  try {
    const contract = new Contract(config.contractAddress, VotingAbi, provider)
    const latestBlock = await provider.getBlockNumber()
    const [createdLogs, voteLogs] = latestBlock < config.deploymentBlock
      ? [[], []]
      : await Promise.all([
        queryFilterInChunks(
          contract,
          contract.filters.PollCreated(null, null, walletAddress),
          config.deploymentBlock,
          latestBlock,
        ),
        queryFilterInChunks(
          contract,
          contract.filters.VoteCast(null, null, walletAddress),
          config.deploymentBlock,
          latestBlock,
        ),
      ])
    const pollCache = new Map()
    const blockCache = new Map()

    const getPoll = (pollId) => {
      const key = pollId.toString()
      if (!pollCache.has(key)) {
        pollCache.set(key, contract.getPoll(pollId).then(getActivityPollData))
      }
      return pollCache.get(key)
    }

    const getTimestamp = (blockNumber) => {
      if (!blockCache.has(blockNumber)) {
        blockCache.set(blockNumber, provider.getBlock(blockNumber).then(getBlockTimestamp))
      }
      return blockCache.get(blockNumber)
    }

    const createdPolls = await mapInBatches(createdLogs, async (log) => {
      const args = log.args
      if (!args) throw new Error('A PollCreated log could not be decoded.')
      const blockNumber = getLogBlockNumber(log)
      const [poll, timestamp] = await Promise.all([
        getPoll(args.pollId),
        getTimestamp(blockNumber),
      ])
      return {
        ...poll,
        pollId: poll.id,
        creator: args.creator,
        transactionHash: getLogTransactionHash(log),
        blockNumber,
        timestamp,
      }
    })

    const votingHistory = await mapInBatches(voteLogs, async (log) => {
      const args = log.args
      if (!args) throw new Error('A VoteCast log could not be decoded.')
      const pollId = toSafeNumber(args.pollId, 'Poll ID')
      const optionIndex = toSafeNumber(args.optionIndex, 'Option index')
      const blockNumber = getLogBlockNumber(log)
      const [poll, timestamp] = await Promise.all([
        getPoll(args.pollId),
        getTimestamp(blockNumber),
      ])
      const optionText = poll.options[optionIndex]
      if (optionText === undefined) {
        throw new Error(`Vote activity for poll ${pollId} refers to an unknown option index.`)
      }
      return {
        ...poll,
        pollId: poll.id,
        voter: args.voter,
        optionIndex,
        optionText,
        transactionHash: getLogTransactionHash(log),
        blockNumber,
        timestamp,
      }
    })

    const newestFirst = (left, right) => right.blockNumber - left.blockNumber

    return {
      createdPolls: createdPolls.sort(newestFirst),
      votingHistory: votingHistory.sort(newestFirst),
    }
  } catch (error) {
    throw new Error(`Unable to read wallet activity on chain ${config.chainId}: ${getErrorDetails(error)}`, { cause: error })
  }
}
