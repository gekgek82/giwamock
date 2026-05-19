import { index, onchainTable } from "ponder";

/** One row per `PoolCreated` log (volatile / stable basic pool). */
export const poolCreatedEvent = onchainTable(
  "pool_created_event",
  (p) => ({
    id: p.text().primaryKey(),
    token0: p.hex().notNull(),
    token1: p.hex().notNull(),
    stable: p.boolean().notNull(),
    pool: p.hex().notNull(),
    /** Base / quote pricing orientation (not on-chain order). */
    base: p.hex().notNull(),
    quote: p.hex().notNull(),
    pairPriceAxis: p.text().notNull(),
    /** From event `TokenInfo.decimals` when present (GiwaUniversalRouter); null for legacy PoolFactory logs. */
    token0Decimals: p.integer(),
    token1Decimals: p.integer(),
    /** `TokenInfo.totalSupply` when struct is logged. */
    token0TotalSupply: p.bigint(),
    token1TotalSupply: p.bigint(),
    token0Name: p.text(),
    token1Name: p.text(),
    token0Symbol: p.text(),
    token1Symbol: p.text(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    poolIdx: index().on(t.pool),
    pairIdx: index().on(t.token0, t.token1),
  }),
);

/** One row per `CLPoolCreated` log. */
export const clPoolCreatedEvent = onchainTable(
  "cl_pool_created_event",
  (p) => ({
    id: p.text().primaryKey(),
    token0: p.hex().notNull(),
    token1: p.hex().notNull(),
    tickSpacing: p.bigint().notNull(),
    pool: p.hex().notNull(),
    base: p.hex().notNull(),
    quote: p.hex().notNull(),
    pairPriceAxis: p.text().notNull(),
    token0Decimals: p.integer(),
    token1Decimals: p.integer(),
    token0TotalSupply: p.bigint(),
    token1TotalSupply: p.bigint(),
    token0Name: p.text(),
    token1Name: p.text(),
    token0Symbol: p.text(),
    token1Symbol: p.text(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    poolIdx: index().on(t.pool),
    pairIdx: index().on(t.token0, t.token1),
  }),
);

/** One row per DynamicSwapFeeModule fee-mode change event. */
export const dynamicSwapFeeEvent = onchainTable(
  "dynamic_swap_fee_event",
  (p) => ({
    id: p.text().primaryKey(),
    pool: p.hex().notNull(),
    dynamicFee: p.boolean().notNull(),
    fee: p.bigint(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    poolIdx: index().on(t.pool),
  }),
);

/** One row per `LiquidityAdded` log (basic pool). */
export const liquidityAddedEvent = onchainTable(
  "liquidity_added_event",
  (p) => ({
    id: p.text().primaryKey(),
    sender: p.hex().notNull(),
    token0: p.hex().notNull(),
    token1: p.hex().notNull(),
    stable: p.boolean().notNull(),
    amount0: p.bigint().notNull(),
    amount1: p.bigint().notNull(),
    liquidity: p.bigint().notNull(),
    to: p.hex().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    pairIdx: index().on(t.token0, t.token1),
    recipientIdx: index().on(t.to),
  }),
);

/** One row per `CLLiquidityAdded` log. */
export const clLiquidityAddedEvent = onchainTable(
  "cl_liquidity_added_event",
  (p) => ({
    id: p.text().primaryKey(),
    sender: p.hex().notNull(),
    token0: p.hex().notNull(),
    token1: p.hex().notNull(),
    tickSpacing: p.bigint().notNull(),
    tickLower: p.bigint().notNull(),
    tickUpper: p.bigint().notNull(),
    liquidity: p.bigint().notNull(),
    amount0: p.bigint().notNull(),
    amount1: p.bigint().notNull(),
    to: p.hex().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    pairIdx: index().on(t.token0, t.token1),
    recipientIdx: index().on(t.to),
  }),
);

/** One row per `Swap` log. */
export const swapEvent = onchainTable(
  "swap_event",
  (p) => ({
    id: p.text().primaryKey(),
    sender: p.hex().notNull(),
    tokenIn: p.hex().notNull(),
    tokenOut: p.hex().notNull(),
    isCL: p.boolean().notNull(),
    stable: p.boolean().notNull(),
    hopIndex: p.bigint().notNull(),
    amountIn: p.bigint().notNull(),
    amountOut: p.bigint().notNull(),
    feeAmount: p.bigint().notNull(),
    feeToken: p.hex().notNull(),
    to: p.hex().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    tokenInIdx: index().on(t.tokenIn),
    tokenOutIdx: index().on(t.tokenOut),
    recipientIdx: index().on(t.to),
    transactionHashIdx: index().on(t.transactionHash),
  }),
);

/** One row per `PoolRewardRegistry.PoolRegistered` log. */
export const poolRegisteredDiscoveryEvent = onchainTable(
  "pool_registered_discovery_event",
  (p) => ({
    id: p.text().primaryKey(),
    registry: p.hex().notNull(),
    index: p.bigint().notNull(),
    pool: p.hex().notNull(),
    poolFactory: p.hex().notNull(),
    kind: p.integer().notNull(),
    token0: p.hex().notNull(),
    token1: p.hex().notNull(),
    metadata: p.text().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    poolIdx: index().on(t.pool),
    registryIdx: index().on(t.registry),
  }),
);

/** One row per `Voter.WhitelistToken` log — tracks token whitelist state changes. */
export const voterWhitelistTokenEvent = onchainTable(
  "voter_whitelist_token_event",
  (p) => ({
    id: p.text().primaryKey(),
    whitelister: p.hex().notNull(),
    token: p.hex().notNull(),
    whitelisted: p.boolean().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    tokenIdx: index().on(t.token),
  }),
);

/** One row per `Voter.GaugeCreated` log (post-TGE). */
export const voterGaugeCreatedEvent = onchainTable(
  "voter_gauge_created_event",
  (p) => ({
    id: p.text().primaryKey(),
    poolFactory: p.hex().notNull(),
    votingRewardsFactory: p.hex().notNull(),
    gaugeFactory: p.hex().notNull(),
    pool: p.hex().notNull(),
    bribeVotingReward: p.hex().notNull(),
    feeVotingReward: p.hex().notNull(),
    gauge: p.hex().notNull(),
    creator: p.hex().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    poolIdx: index().on(t.pool),
    gaugeIdx: index().on(t.gauge),
  }),
);

/** One row per `Gauge.Deposit` log (basic AMM gauge stake, post-TGE). */
export const gaugeDepositEvent = onchainTable(
  "gauge_deposit_event",
  (p) => ({
    id: p.text().primaryKey(),
    gauge: p.hex().notNull(),
    pool: p.hex().notNull(),
    from: p.hex().notNull(),
    to: p.hex().notNull(),
    amount: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    gaugeIdx: index().on(t.gauge),
    fromIdx: index().on(t.from),
    poolIdx: index().on(t.pool),
  }),
);

/** One row per `Gauge.Withdraw` log (basic AMM gauge stake, post-TGE). */
export const gaugeWithdrawEvent = onchainTable(
  "gauge_withdraw_event",
  (p) => ({
    id: p.text().primaryKey(),
    gauge: p.hex().notNull(),
    pool: p.hex().notNull(),
    from: p.hex().notNull(),
    amount: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    gaugeIdx: index().on(t.gauge),
    fromIdx: index().on(t.from),
    poolIdx: index().on(t.pool),
  }),
);

/** One row per `CLGauge.Deposit` log (CL gauge stake, post-TGE). */
export const clGaugeDepositEvent = onchainTable(
  "cl_gauge_deposit_event",
  (p) => ({
    id: p.text().primaryKey(),
    gauge: p.hex().notNull(),
    pool: p.hex().notNull(),
    user: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    liquidityToStake: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    gaugeIdx: index().on(t.gauge),
    userIdx: index().on(t.user),
    poolIdx: index().on(t.pool),
  }),
);

/** One row per `CLGauge.Withdraw` log (CL gauge stake, post-TGE). */
export const clGaugeWithdrawEvent = onchainTable(
  "cl_gauge_withdraw_event",
  (p) => ({
    id: p.text().primaryKey(),
    gauge: p.hex().notNull(),
    pool: p.hex().notNull(),
    user: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    liquidityToStake: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    gaugeIdx: index().on(t.gauge),
    userIdx: index().on(t.user),
    poolIdx: index().on(t.pool),
  }),
);

/** One row per `VotingEscrow.Deposit` log. */
export const veDepositEvent = onchainTable(
  "ve_deposit_event",
  (p) => ({
    id: p.text().primaryKey(),
    provider: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    depositType: p.text().notNull(),
    value: p.bigint().notNull(),
    locktime: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    providerIdx: index().on(t.provider),
    tokenIdIdx: index().on(t.tokenId),
  }),
);

/** One row per `VotingEscrow.Withdraw` log. */
export const veWithdrawEvent = onchainTable(
  "ve_withdraw_event",
  (p) => ({
    id: p.text().primaryKey(),
    provider: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    value: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    providerIdx: index().on(t.provider),
    tokenIdIdx: index().on(t.tokenId),
  }),
);

/** One row per `VotingEscrow.LockPermanent` log. */
export const veLockPermanentEvent = onchainTable(
  "ve_lock_permanent_event",
  (p) => ({
    id: p.text().primaryKey(),
    owner: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    amount: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    ownerIdx: index().on(t.owner),
    tokenIdIdx: index().on(t.tokenId),
  }),
);

/** One row per `VotingEscrow.UnlockPermanent` log. */
export const veUnlockPermanentEvent = onchainTable(
  "ve_unlock_permanent_event",
  (p) => ({
    id: p.text().primaryKey(),
    owner: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    amount: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    ownerIdx: index().on(t.owner),
    tokenIdIdx: index().on(t.tokenId),
  }),
);

/** One row per `VotingEscrow.Merge` log. */
export const veMergeEvent = onchainTable(
  "ve_merge_event",
  (p) => ({
    id: p.text().primaryKey(),
    sender: p.hex().notNull(),
    from: p.bigint().notNull(),
    to: p.bigint().notNull(),
    amountFrom: p.bigint().notNull(),
    amountTo: p.bigint().notNull(),
    amountFinal: p.bigint().notNull(),
    locktime: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    senderIdx: index().on(t.sender),
    fromIdx: index().on(t.from),
  }),
);

/** One row per `VotingEscrow.Split` log. */
export const veSplitEvent = onchainTable(
  "ve_split_event",
  (p) => ({
    id: p.text().primaryKey(),
    from: p.bigint().notNull(),
    tokenId1: p.bigint().notNull(),
    tokenId2: p.bigint().notNull(),
    sender: p.hex().notNull(),
    splitAmount1: p.bigint().notNull(),
    splitAmount2: p.bigint().notNull(),
    locktime: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    senderIdx: index().on(t.sender),
    fromIdx: index().on(t.from),
  }),
);

/** One row per `Voter.Voted` log. */
export const voterVotedEvent = onchainTable(
  "voter_voted_event",
  (p) => ({
    id: p.text().primaryKey(),
    voter: p.hex().notNull(),
    pool: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    weight: p.bigint().notNull(),
    totalWeight: p.bigint().notNull(),
    epochTimestamp: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    voterIdx: index().on(t.voter),
    tokenIdIdx: index().on(t.tokenId),
    poolIdx: index().on(t.pool),
  }),
);

/** One row per `Voter.Abstained` log. */
export const voterAbstainedEvent = onchainTable(
  "voter_abstained_event",
  (p) => ({
    id: p.text().primaryKey(),
    voter: p.hex().notNull(),
    pool: p.hex().notNull(),
    tokenId: p.bigint().notNull(),
    weight: p.bigint().notNull(),
    totalWeight: p.bigint().notNull(),
    epochTimestamp: p.bigint().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    voterIdx: index().on(t.voter),
    tokenIdIdx: index().on(t.tokenId),
  }),
);

/** One row per `FeesVotingReward.ClaimRewards` log. */
export const feeVotingRewardClaimEvent = onchainTable(
  "fee_voting_reward_claim_event",
  (p) => ({
    id: p.text().primaryKey(),
    from: p.hex().notNull(),
    reward: p.hex().notNull(),
    amount: p.bigint().notNull(),
    rewardContract: p.hex().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    fromIdx: index().on(t.from),
    rewardContractIdx: index().on(t.rewardContract),
  }),
);

/** One row per `BribeVotingReward.ClaimRewards` log. */
export const bribeVotingRewardClaimEvent = onchainTable(
  "bribe_voting_reward_claim_event",
  (p) => ({
    id: p.text().primaryKey(),
    from: p.hex().notNull(),
    reward: p.hex().notNull(),
    amount: p.bigint().notNull(),
    rewardContract: p.hex().notNull(),
    blockNumber: p.bigint().notNull(),
    blockTimestamp: p.bigint().notNull(),
    transactionHash: p.hex().notNull(),
    logIndex: p.bigint().notNull(),
  }),
  (t) => ({
    fromIdx: index().on(t.from),
    rewardContractIdx: index().on(t.rewardContract),
  }),
);
