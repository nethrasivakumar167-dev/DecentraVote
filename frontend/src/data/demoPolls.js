const hoursFromNow = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

export const demoPolls = [
  {
    id: 'demo-1',
    question: 'Which layer 2 should we integrate with next?',
    description: 'Help shape our roadmap. We are exploring the next ecosystem to bring to the community.',
    category: 'Technology',
    options: [{ text: 'Arbitrum', votes: 128 }, { text: 'Optimism', votes: 96 }, { text: 'Base', votes: 184 }, { text: 'zkSync', votes: 57 }],
    createdAt: daysAgo(1),
    endAt: hoursFromNow(46),
    creator: null,
    creatorLabel: 'Demo community',
    demo: true,
    voterIds: [],
  },
  {
    id: 'demo-2',
    question: 'What should the community fund this quarter?',
    description: 'Choose the initiative that would create the most value for everyone in the DecentraVote ecosystem.',
    category: 'Community',
    options: [{ text: 'Builder grants', votes: 214 }, { text: 'Education & onboarding', votes: 169 }, { text: 'Community events', votes: 92 }],
    createdAt: daysAgo(2),
    endAt: hoursFromNow(90),
    creator: null,
    creatorLabel: 'Demo community',
    demo: true,
    voterIds: [],
  },
  {
    id: 'demo-3',
    question: 'Which governance format feels most inclusive?',
    description: 'We want governance to be easy to join and representative of the whole community.',
    category: 'Governance',
    options: [{ text: 'On-chain voting', votes: 142 }, { text: 'Snapshot + forum', votes: 203 }, { text: 'Delegated voting', votes: 87 }],
    createdAt: daysAgo(4),
    endAt: hoursFromNow(22),
    creator: null,
    creatorLabel: 'Demo community',
    demo: true,
    voterIds: [],
  },
  {
    id: 'demo-4',
    question: 'Pick a theme for our next community meetup',
    description: 'A quick pulse check before we start planning the next gathering.',
    category: 'Community',
    options: [{ text: 'Building in public', votes: 178 }, { text: 'DAO design', votes: 121 }, { text: 'Web3 for everyone', votes: 94 }],
    createdAt: daysAgo(9),
    endAt: daysAgo(2),
    creator: null,
    creatorLabel: 'Demo community',
    demo: true,
    voterIds: [],
  },
  {
    id: 'demo-5',
    question: 'Should proposals include a public discussion period?',
    description: 'A longer discussion window could make proposals more thoughtful and accessible.',
    category: 'Governance',
    options: [{ text: 'Yes, at least 3 days', votes: 237 }, { text: 'Keep it optional', votes: 119 }, { text: 'No, keep voting fast', votes: 63 }],
    createdAt: daysAgo(12),
    endAt: daysAgo(5),
    creator: null,
    creatorLabel: 'Demo community',
    demo: true,
    voterIds: [],
  },
]

export const categories = ['All categories', 'Governance', 'Community', 'Technology', 'Treasury', 'Product']

export function getSeedPolls() {
  return demoPolls.map((poll) => ({
    ...poll,
    options: poll.options.map((option) => ({ ...option })),
    voterIds: [],
  }))
}
