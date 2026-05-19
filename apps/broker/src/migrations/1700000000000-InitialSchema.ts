import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Legacy table rename (safe on fresh DB — IF EXISTS guards)
    await queryRunner.query(`ALTER TABLE IF EXISTS broker_swap_hops RENAME TO swap_hops`);
    await queryRunner.query(`ALTER INDEX IF EXISTS broker_swap_hops_tx_hop_idx RENAME TO swap_hops_tx_hop_idx`);
    await queryRunner.query(`ALTER INDEX IF EXISTS broker_swap_hops_sender_idx RENAME TO swap_hops_sender_idx`);
    await queryRunner.query(`ALTER INDEX IF EXISTS broker_swap_hops_recipient_idx RENAME TO swap_hops_recipient_idx`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS indexed_events (
        id text PRIMARY KEY,
        payload jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_tokens (
        id text PRIMARY KEY,
        name text NOT NULL DEFAULT '',
        symbol text NOT NULL DEFAULT '',
        ticker text NOT NULL DEFAULT '',
        "totalSupply" double precision NOT NULL DEFAULT 0,
        "logoURI" text NOT NULL DEFAULT '',
        decimals integer NOT NULL DEFAULT 0,
        listed boolean NOT NULL DEFAULT false,
        "priceUSD" double precision NOT NULL DEFAULT 0,
        "priceUSD1HourBF" double precision NOT NULL DEFAULT 0,
        "priceUSD1DayBF" double precision NOT NULL DEFAULT 0,
        "priceUSD1WeekBF" double precision NOT NULL DEFAULT 0,
        "priceUSD1MonthBF" double precision NOT NULL DEFAULT 0,
        "sparkline7D" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "cpPrice" double precision NOT NULL DEFAULT 0,
        "cgId" text NOT NULL DEFAULT '',
        "cmcId" text NOT NULL DEFAULT '',
        ath double precision NOT NULL DEFAULT 0,
        atl double precision NOT NULL DEFAULT 0,
        "listingDate" double precision NOT NULL DEFAULT 0,
        "metricsDayStartTs" double precision NOT NULL DEFAULT 0,
        "tradesCount" double precision NOT NULL DEFAULT 0,
        "dayHigh" double precision NOT NULL DEFAULT 0,
        "dayLow" double precision NOT NULL DEFAULT 0,
        "dayPriceDifference" double precision NOT NULL DEFAULT 0,
        "dayPriceDifferencePercentage" double precision NOT NULL DEFAULT 0,
        "dayTvl" double precision NOT NULL DEFAULT 0,
        "dayVolume" double precision NOT NULL DEFAULT 0,
        "dayTvlUSD" double precision NOT NULL DEFAULT 0,
        "dayVolumeUSD" double precision NOT NULL DEFAULT 0,
        "hourPriceDifference" double precision NOT NULL DEFAULT 0,
        "hourPriceDifferencePercentage" double precision NOT NULL DEFAULT 0,
        "weekPriceDifference" double precision NOT NULL DEFAULT 0,
        "weekPriceDifferencePercentage" double precision NOT NULL DEFAULT 0,
        "monthPriceDifference" double precision NOT NULL DEFAULT 0,
        "monthPriceDifferencePercentage" double precision NOT NULL DEFAULT 0,
        creator text NOT NULL DEFAULT '',
        "totalMinBuckets" double precision NOT NULL DEFAULT 0,
        "totalHourBuckets" double precision NOT NULL DEFAULT 0,
        "totalDayBuckets" double precision NOT NULL DEFAULT 0,
        "totalWeekBuckets" double precision NOT NULL DEFAULT 0,
        "totalMonthBuckets" double precision NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_pairs (
        id text PRIMARY KEY,
        token0 text NOT NULL DEFAULT '',
        token1 text NOT NULL DEFAULT '',
        base text NOT NULL DEFAULT '',
        quote text NOT NULL DEFAULT '',
        "baseSymbol" text NOT NULL DEFAULT '',
        "baseName" text NOT NULL DEFAULT '',
        "quoteSymbol" text NOT NULL DEFAULT '',
        "quoteName" text NOT NULL DEFAULT '',
        "bDecimal" integer NOT NULL DEFAULT 0,
        "qDecimal" integer NOT NULL DEFAULT 0,
        symbol text NOT NULL DEFAULT '',
        ticker text NOT NULL DEFAULT '',
        description text NOT NULL DEFAULT '',
        type text NOT NULL DEFAULT '',
        exchange text NOT NULL DEFAULT '',
        "isConcentratedLiquidity" boolean NOT NULL DEFAULT false,
        "dynamicFee" boolean NOT NULL DEFAULT false,
        "effectiveFeeBps" double precision NULL,
        "feeSource" text NOT NULL DEFAULT '',
        listed boolean NOT NULL DEFAULT false,
        "gaugeWhitelisted" boolean NOT NULL DEFAULT false,
        price double precision NOT NULL DEFAULT 0,
        "dayOpen" double precision NOT NULL DEFAULT 0,
        "dayHigh" double precision NOT NULL DEFAULT 0,
        "dayLow" double precision NOT NULL DEFAULT 0,
        scales jsonb NOT NULL DEFAULT '[]'::jsonb,
        "sparkline7D" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ath double precision NOT NULL DEFAULT 0,
        atl double precision NOT NULL DEFAULT 0,
        "listingDate" double precision NOT NULL DEFAULT 0,
        "metricsDayStartTs" double precision NOT NULL DEFAULT 0,
        "dayPriceDifference" double precision NOT NULL DEFAULT 0,
        "dayPriceDifferencePercentage" double precision NOT NULL DEFAULT 0,
        "baseTvl" double precision NOT NULL DEFAULT 0,
        "quoteTvl" double precision NOT NULL DEFAULT 0,
        "dayBaseTvl" double precision NOT NULL DEFAULT 0,
        "dayQuoteTvl" double precision NOT NULL DEFAULT 0,
        "dayBaseVolume" double precision NOT NULL DEFAULT 0,
        "dayQuoteVolume" double precision NOT NULL DEFAULT 0,
        "dayBaseTvlUSD" double precision NOT NULL DEFAULT 0,
        "dayQuoteTvlUSD" double precision NOT NULL DEFAULT 0,
        "dayBaseVolumeUSD" double precision NOT NULL DEFAULT 0,
        "dayQuoteVolumeUSD" double precision NOT NULL DEFAULT 0,
        "totalSwapFeesUsd" double precision NOT NULL DEFAULT 0,
        "daySwapFeesUsd" double precision NOT NULL DEFAULT 0,
        "totalMinBuckets" double precision NOT NULL DEFAULT 0,
        "totalHourBuckets" double precision NOT NULL DEFAULT 0,
        "totalDayBuckets" double precision NOT NULL DEFAULT 0,
        "totalWeekBuckets" double precision NOT NULL DEFAULT 0,
        "totalMonthBuckets" double precision NOT NULL DEFAULT 0,
        "nftAddress" text NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_pair_time_buckets (
        pair text NOT NULL,
        resolution text NOT NULL,
        "bucketIndex" integer NOT NULL,
        "bucketStartTs" double precision NOT NULL,
        "bucketEndTs" double precision NOT NULL DEFAULT 0,
        base text NOT NULL DEFAULT '',
        quote text NOT NULL DEFAULT '',
        symbol text NOT NULL DEFAULT '',
        open double precision NOT NULL DEFAULT 0,
        high double precision NOT NULL DEFAULT 0,
        low double precision NOT NULL DEFAULT 0,
        close double precision NOT NULL DEFAULT 0,
        average double precision NOT NULL DEFAULT 0,
        difference double precision NOT NULL DEFAULT 0,
        "differencePercentage" double precision NOT NULL DEFAULT 0,
        "baseVolume" double precision NOT NULL DEFAULT 0,
        "quoteVolume" double precision NOT NULL DEFAULT 0,
        "baseVolumeUSD" double precision NOT NULL DEFAULT 0,
        "quoteVolumeUSD" double precision NOT NULL DEFAULT 0,
        "totalBaseVolumeUSD" double precision NOT NULL DEFAULT 0,
        "totalQuoteVolumeUSD" double precision NOT NULL DEFAULT 0,
        "totalFeesUsd" double precision NOT NULL DEFAULT 0,
        "totalTrades" double precision NOT NULL DEFAULT 0,
        "baseTvl" double precision NOT NULL DEFAULT 0,
        "quoteTvl" double precision NOT NULL DEFAULT 0,
        "baseTvlUSD" double precision NOT NULL DEFAULT 0,
        "quoteTvlUSD" double precision NOT NULL DEFAULT 0,
        count double precision NOT NULL DEFAULT 0,
        PRIMARY KEY (pair, resolution, "bucketIndex")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS spot_pair_time_buckets_pair_res_start ON spot_pair_time_buckets (pair, resolution, "bucketStartTs")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_token_time_buckets (
        token text NOT NULL,
        resolution text NOT NULL,
        "bucketIndex" integer NOT NULL,
        "bucketStartTs" double precision NOT NULL,
        "bucketEndTs" double precision NOT NULL DEFAULT 0,
        symbol text NOT NULL DEFAULT '',
        open double precision NOT NULL DEFAULT 0,
        high double precision NOT NULL DEFAULT 0,
        low double precision NOT NULL DEFAULT 0,
        close double precision NOT NULL DEFAULT 0,
        average double precision NOT NULL DEFAULT 0,
        difference double precision NOT NULL DEFAULT 0,
        "differencePercentage" double precision NOT NULL DEFAULT 0,
        tvl double precision NOT NULL DEFAULT 0,
        "tvlUSD" double precision NOT NULL DEFAULT 0,
        volume double precision NOT NULL DEFAULT 0,
        "volumeUSD" double precision NOT NULL DEFAULT 0,
        "totalVolumeUSD" double precision NOT NULL DEFAULT 0,
        "totalFeesUsd" double precision NOT NULL DEFAULT 0,
        "totalTrades" double precision NOT NULL DEFAULT 0,
        count double precision NOT NULL DEFAULT 0,
        PRIMARY KEY (token, resolution, "bucketIndex")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS spot_token_time_buckets_token_res_start ON spot_token_time_buckets (token, resolution, "bucketStartTs")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_accounts (
        id text PRIMARY KEY,
        "tvlUSD" double precision NOT NULL DEFAULT 0,
        "lastTraded" double precision NOT NULL DEFAULT 0,
        "totalOrders" double precision NOT NULL DEFAULT 0,
        "totalOrderHistory" double precision NOT NULL DEFAULT 0,
        "totalTradeHistory" double precision NOT NULL DEFAULT 0,
        "totalVolumeUSD" double precision NOT NULL DEFAULT 0,
        "totalCreatedTokens" double precision NOT NULL DEFAULT 0,
        "apiKey" text NOT NULL DEFAULT '',
        email text NOT NULL DEFAULT ''
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_exchanges (
        id text PRIMARY KEY,
        "networkName" text NOT NULL DEFAULT '',
        bytecode text NOT NULL DEFAULT '',
        deployer text NOT NULL DEFAULT '',
        "totalDayBuckets" double precision NOT NULL DEFAULT 0,
        "totalWeekBuckets" double precision NOT NULL DEFAULT 0,
        "totalMonthBuckets" double precision NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_exchange_time_buckets (
        "index" integer NOT NULL,
        "protocolId" text NOT NULL,
        "timestamp" double precision NOT NULL,
        "networkName" text NOT NULL DEFAULT '',
        "totalVolume" double precision NOT NULL DEFAULT 0,
        "totalFeesUsd" double precision NOT NULL DEFAULT 0,
        tvl double precision NOT NULL DEFAULT 0,
        "totalGlobalTrades" double precision NOT NULL DEFAULT 0,
        "totalGlobalPairs" double precision NOT NULL DEFAULT 0,
        "totalGlobalTraders" double precision NOT NULL DEFAULT 0,
        PRIMARY KEY ("index", "protocolId", "timestamp")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_groups (
        id text PRIMARY KEY,
        name text NOT NULL DEFAULT '',
        description text NOT NULL DEFAULT ''
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_group_pairs (
        "pairId" text NOT NULL,
        "groupId" text NOT NULL,
        symbol text NOT NULL DEFAULT '',
        base text NOT NULL DEFAULT '',
        quote text NOT NULL DEFAULT '',
        PRIMARY KEY ("pairId", "groupId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_pair_admin_meta (
        "pairId" text PRIMARY KEY,
        grade integer NOT NULL DEFAULT 3,
        "isGradeManualOverride" boolean NOT NULL DEFAULT false,
        "isVotingEnabled" boolean NOT NULL DEFAULT false
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_group_tokens (
        "groupId" text NOT NULL,
        "tokenId" text NOT NULL,
        symbol text NOT NULL DEFAULT '',
        PRIMARY KEY ("groupId", "tokenId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS account_balance_time_buckets (
        account text NOT NULL,
        "index" integer NOT NULL,
        "totalBalanceInUSD" double precision NOT NULL DEFAULT 0,
        "totalTokens" double precision NOT NULL DEFAULT 0,
        PRIMARY KEY (account, "index")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_account_follows (
        follower text NOT NULL,
        following text NOT NULL,
        PRIMARY KEY (follower, following)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_account_notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" text NOT NULL,
        "eventType" text NOT NULL,
        "indexerEventId" text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        "blockTimestampSec" double precision NOT NULL DEFAULT 0,
        "readAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS spot_account_notifications_account_created ON spot_account_notifications ("accountId", "createdAt")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS spot_account_notifications_dedupe ON spot_account_notifications ("accountId", "indexerEventId", "eventType")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_account_liquidity_provisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" text NOT NULL,
        "poolAddress" text NOT NULL,
        "eventType" text NOT NULL,
        "indexerEventId" text NOT NULL,
        token0 text NOT NULL,
        token1 text NOT NULL,
        amount0 text NOT NULL,
        amount1 text NOT NULL,
        stable boolean NULL,
        "clTickSpacing" integer NULL,
        "tickLower" text NULL,
        "tickUpper" text NULL,
        liquidity text NULL,
        "blockNumber" text NOT NULL,
        "blockTimestampSec" double precision NOT NULL DEFAULT 0,
        "transactionHash" text NOT NULL,
        "logIndex" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS spot_account_liq_prov_account_created ON spot_account_liquidity_provisions ("accountId", "createdAt")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS spot_account_liq_prov_dedupe ON spot_account_liquidity_provisions ("accountId", "indexerEventId", "eventType")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS broker_pool_factory_fee_defaults (
        id text PRIMARY KEY,
        "volatileFeeBps" double precision NULL,
        "stableFeeBps" double precision NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS broker_dynamic_swap_fee_globals (
        id text PRIMARY KEY,
        "defaultFeeCapWire" text NULL,
        "defaultScalingFactorWire" text NULL,
        "secondsAgoWire" text NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS broker_dynamic_swap_fee_pools (
        "poolId" text PRIMARY KEY,
        "baseFeeWire" text NULL,
        "feeCapWire" text NULL,
        "scalingFactorWire" text NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS broker_dynamic_swap_fee_discounts (
        address text PRIMARY KEY,
        "discountWire" text NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS swap_hops (
        id text PRIMARY KEY,
        transaction_hash varchar(66) NOT NULL,
        hop_index integer NOT NULL,
        log_index integer NOT NULL,
        sender varchar(42) NOT NULL,
        recipient varchar(42) NOT NULL,
        token_in varchar(42) NOT NULL,
        token_out varchar(42) NOT NULL,
        is_cl boolean NOT NULL,
        stable boolean NOT NULL,
        amount_in varchar(96) NOT NULL,
        amount_out varchar(96) NOT NULL,
        fee_amount varchar(96) NOT NULL,
        fee_token varchar(42) NOT NULL,
        block_number varchar(96) NOT NULL,
        block_timestamp varchar(96) NOT NULL,
        materialized_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS swap_hops_tx_hop_idx ON swap_hops (transaction_hash, hop_index)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS swap_hops_sender_idx ON swap_hops (sender)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS swap_hops_recipient_idx ON swap_hops (recipient)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS swap_bucket_state (
        kind text NOT NULL,
        "entityId" text NOT NULL,
        resolution text NOT NULL,
        "lastBucketIndex" integer NOT NULL,
        "lastBucketStartTs" double precision NOT NULL,
        PRIMARY KEY (kind, "entityId", resolution)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS swap_liquidity_edges (
        "poolAddress" text PRIMARY KEY,
        token0 text NOT NULL,
        token1 text NOT NULL,
        stable boolean NOT NULL DEFAULT false,
        "isConcentratedLiquidity" boolean NOT NULL DEFAULT false,
        "clTickSpacing" integer NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ticks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "poolId" text NOT NULL,
        "tickIndex" integer NOT NULL,
        "liquidityGross" numeric(40, 0) NOT NULL DEFAULT 0,
        "liquidityNet" numeric(40, 0) NOT NULL DEFAULT 0,
        "feeGrowthOutside0X128" numeric(78, 0) NOT NULL DEFAULT 0,
        "feeGrowthOutside1X128" numeric(78, 0) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ticks_pool_id_tick_index ON ticks ("poolId", "tickIndex")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS liquidity_histogram_buckets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "poolId" text NOT NULL,
        "bucketType" text NOT NULL,
        "bucketStartTick" integer NOT NULL,
        "bucketEndTick" integer NOT NULL,
        "priceLower" double precision NOT NULL DEFAULT 0,
        "priceUpper" double precision NOT NULL DEFAULT 0,
        "liquidityAmount" numeric(40, 0) NOT NULL DEFAULT 0,
        "activeLiquidityAmount" numeric(40, 0) NOT NULL DEFAULT 0,
        "positionCount" integer NOT NULL DEFAULT 0,
        "snapshotBlockNumber" bigint NOT NULL DEFAULT 0,
        "snapshotTime" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS liquidity_hist_pool_type_tick_range ON liquidity_histogram_buckets ("poolId", "bucketType", "bucketStartTick", "bucketEndTick")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_account_stake_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "walletAddress" text NOT NULL,
        "gaugeAddress" text NOT NULL,
        "poolAddress" text NOT NULL,
        "isCL" boolean NOT NULL DEFAULT false,
        "eventType" text NOT NULL,
        amount numeric(78, 0) NOT NULL DEFAULT 0,
        "tokenId" numeric(78, 0) NULL,
        "blockNumber" bigint NOT NULL DEFAULT 0,
        "blockTimestampSec" integer NOT NULL DEFAULT 0,
        "transactionHash" text NOT NULL DEFAULT '',
        "logIndex" integer NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS stake_events_tx_log ON spot_account_stake_events ("transactionHash", "logIndex")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS stake_events_wallet ON spot_account_stake_events ("walletAddress")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS stake_events_pool ON spot_account_stake_events ("poolAddress")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS stake_events_gauge ON spot_account_stake_events ("gaugeAddress")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ve_lock_positions (
        "tokenId" text PRIMARY KEY,
        owner text NOT NULL,
        amount text NOT NULL DEFAULT '0',
        "lockEnd" text NULL,
        "isPermanent" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ve_lock_positions_owner_active ON ve_lock_positions (owner, "isActive")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ve_lock_positions_owner ON ve_lock_positions (owner)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ve_lock_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tokenId" text NOT NULL,
        owner text NOT NULL,
        "eventType" text NOT NULL,
        "depositType" text NULL,
        value text NOT NULL DEFAULT '0',
        "lockEnd" text NULL,
        "fromTokenId" text NULL,
        "toTokenId" text NULL,
        "indexerEventId" text NOT NULL UNIQUE,
        "blockNumber" text NOT NULL,
        "blockTimestamp" text NOT NULL,
        "transactionHash" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ve_lock_events_token_id_created ON ve_lock_events ("tokenId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ve_lock_events_owner_created ON ve_lock_events (owner, "createdAt")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS voter_vote_positions (
        "tokenId" text NOT NULL,
        pool text NOT NULL,
        owner text NOT NULL,
        weight text NOT NULL DEFAULT '0',
        "totalWeight" text NOT NULL DEFAULT '0',
        "epochTimestamp" text NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("tokenId", pool)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS voter_vote_positions_owner_active ON voter_vote_positions (owner, "isActive")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS voter_vote_positions_owner ON voter_vote_positions (owner)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS voter_vote_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tokenId" text NOT NULL,
        pool text NOT NULL,
        owner text NOT NULL,
        "eventType" text NOT NULL,
        weight text NOT NULL DEFAULT '0',
        "totalWeight" text NOT NULL DEFAULT '0',
        "epochTimestamp" text NULL,
        "indexerEventId" text NOT NULL UNIQUE,
        "blockNumber" text NOT NULL,
        "blockTimestamp" text NOT NULL,
        "transactionHash" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS voter_vote_events_owner_created ON voter_vote_events (owner, "createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS voter_vote_events_token_pool ON voter_vote_events ("tokenId", pool)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS voter_reward_claims (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "claimType" text NOT NULL,
        "rewardContract" text NOT NULL,
        "rewardToken" text NOT NULL,
        "from" text NOT NULL,
        amount text NOT NULL DEFAULT '0',
        pool text NULL,
        "indexerEventId" text NOT NULL UNIQUE,
        "blockNumber" text NOT NULL,
        "blockTimestamp" text NOT NULL,
        "transactionHash" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS voter_reward_claims_from_created ON voter_reward_claims ("from", "createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS voter_reward_claims_contract ON voter_reward_claims ("rewardContract")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_swaps (
        "swapId" text NOT NULL,
        pair text NOT NULL,
        "orderId" integer NOT NULL DEFAULT 0,
        base text NOT NULL DEFAULT '',
        quote text NOT NULL DEFAULT '',
        "baseSymbol" text NOT NULL DEFAULT '',
        "baseLogoURI" text NOT NULL DEFAULT '',
        "quoteSymbol" text NOT NULL DEFAULT '',
        "quoteLogoURI" text NOT NULL DEFAULT '',
        "pairSymbol" text NOT NULL DEFAULT '',
        "isBid" boolean NOT NULL DEFAULT false,
        price double precision NOT NULL DEFAULT 0,
        account text NOT NULL DEFAULT '',
        asset text NOT NULL DEFAULT '',
        "assetSymbol" text NOT NULL DEFAULT '',
        "assetDecimals" integer NOT NULL DEFAULT 0,
        amount double precision NOT NULL DEFAULT 0,
        "valueUSD" double precision NOT NULL DEFAULT 0,
        "baseAmount" double precision NOT NULL DEFAULT 0,
        "quoteAmount" double precision NOT NULL DEFAULT 0,
        "baseReserveAfter" double precision NOT NULL DEFAULT 0,
        "quoteReserveAfter" double precision NOT NULL DEFAULT 0,
        "timestamp" integer NOT NULL DEFAULT 0,
        recipient text NOT NULL DEFAULT '',
        "assetFee" double precision NOT NULL DEFAULT 0,
        "isCL" boolean NOT NULL DEFAULT false,
        stable boolean NOT NULL DEFAULT false,
        "hopIndex" integer NOT NULL DEFAULT 0,
        "feeAmount" double precision NOT NULL DEFAULT 0,
        "feeToken" text NOT NULL DEFAULT '',
        "blockNumber" integer NOT NULL DEFAULT 0,
        "txHash" text NOT NULL DEFAULT '',
        "txIndex" integer NOT NULL DEFAULT 0,
        "eventIndex" integer NOT NULL DEFAULT 0,
        PRIMARY KEY ("swapId", pair)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "baseIndex" ON spot_swaps (base)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "quoteIndex" ON spot_swaps (quote)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "timestamp" ON spot_swaps ("timestamp")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "accountIndex" ON spot_swaps (account)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "assetIndex" ON spot_swaps ("assetSymbol", asset)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "blockNumberIndex" ON spot_swaps ("blockNumber")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS token_faucets (
        faucet_address varchar(42) PRIMARY KEY,
        token_address varchar(42) NOT NULL,
        token_name varchar(100) NOT NULL,
        token_symbol varchar(20) NOT NULL,
        token_decimals integer NOT NULL DEFAULT 18,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Column upgrades for pre-existing DBs
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pair_time_buckets ADD COLUMN IF NOT EXISTS "totalBaseVolumeUSD" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pair_time_buckets ADD COLUMN IF NOT EXISTS "totalQuoteVolumeUSD" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pair_time_buckets ADD COLUMN IF NOT EXISTS "totalFeesUsd" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pair_time_buckets ADD COLUMN IF NOT EXISTS "totalTrades" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_token_time_buckets ADD COLUMN IF NOT EXISTS "totalVolumeUSD" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_token_time_buckets ADD COLUMN IF NOT EXISTS "totalFeesUsd" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_token_time_buckets ADD COLUMN IF NOT EXISTS "totalTrades" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "effectiveFeeBps" double precision NULL`);
    await queryRunner.query(`ALTER TABLE IF EXISTS spot_pairs ADD COLUMN IF NOT EXISTS "feeSource" text NOT NULL DEFAULT ''`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS token_faucets`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_swaps`);
    await queryRunner.query(`DROP TABLE IF EXISTS voter_reward_claims`);
    await queryRunner.query(`DROP TABLE IF EXISTS voter_vote_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS voter_vote_positions`);
    await queryRunner.query(`DROP TABLE IF EXISTS ve_lock_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS ve_lock_positions`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_account_stake_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS liquidity_histogram_buckets`);
    await queryRunner.query(`DROP TABLE IF EXISTS ticks`);
    await queryRunner.query(`DROP TABLE IF EXISTS swap_liquidity_edges`);
    await queryRunner.query(`DROP TABLE IF EXISTS swap_bucket_state`);
    await queryRunner.query(`DROP TABLE IF EXISTS swap_hops`);
    await queryRunner.query(`DROP TABLE IF EXISTS broker_dynamic_swap_fee_discounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS broker_dynamic_swap_fee_pools`);
    await queryRunner.query(`DROP TABLE IF EXISTS broker_dynamic_swap_fee_globals`);
    await queryRunner.query(`DROP TABLE IF EXISTS broker_pool_factory_fee_defaults`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_account_liquidity_provisions`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_account_notifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_account_follows`);
    await queryRunner.query(`DROP TABLE IF EXISTS account_balance_time_buckets`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_group_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_pair_admin_meta`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_group_pairs`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_groups`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_exchange_time_buckets`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_exchanges`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_accounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_token_time_buckets`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_pair_time_buckets`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_pairs`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS indexed_events`);
  }
}
