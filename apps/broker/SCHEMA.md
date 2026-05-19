# Giwater DEX DB Schema documentation
## Summary

- [Introduction](#introduction)
- [Database Type](#database-type)
- [Table Structure](#table-structure)
	- [spot_tokens](#spot_tokens)
	- [spot_pairs](#spot_pairs)
	- [spot_groups](#spot_groups)
	- [spot_group_tokens](#spot_group_tokens)
	- [spot_group_pairs](#spot_group_pairs)
	- [spot_token_time_buckets](#spot_token_time_buckets)
	- [spot_pair_time_buckets](#spot_pair_time_buckets)
	- [swap_bucket_state](#swap_bucket_state)
	- [swap_liquidity_edges](#swap_liquidity_edges)
	- [ticks](#ticks)
	- [liquidity_histogram_buckets](#liquidity_histogram_buckets)
	- [broker_dynamic_swap_fee_globals](#broker_dynamic_swap_fee_globals)
	- [broker_dynamic_swap_fee_pools](#broker_dynamic_swap_fee_pools)
	- [broker_dynamic_swap_fee_discounts](#broker_dynamic_swap_fee_discounts)
	- [broker_pool_factory_fee_defaults](#broker_pool_factory_fee_defaults)
	- [indexed_events](#indexed_events)
	- [spot_accounts](#spot_accounts)
	- [spot_account_follows](#spot_account_follows)
	- [spot_account_notifications](#spot_account_notifications)
	- [spot_account_liquidity_provisions](#spot_account_liquidity_provisions)
	- [account_balance_time_buckets](#account_balance_time_buckets)
	- [spot_exchanges](#spot_exchanges)
	- [spot_exchange_time_buckets](#spot_exchange_time_buckets)
- [Relationships](#relationships)
- [Database Diagram](#database-diagram)

## Introduction

## Database type

- **Database system:** PostgreSQL
## Table structure

### spot_tokens

| Name                               | Type             | Settings                 | References | Note |
| ---------------------------------- | ---------------- | ------------------------ | ---------- | ---- |
| **id**                             | TEXT             | 🔑 PK, null              |            |      |
| **name**                           | TEXT             | not null                 |            |      |
| **symbol**                         | TEXT             | not null                 |            |      |
| **ticker**                         | TEXT             | not null                 |            |      |
| **totalSupply**                    | DOUBLE PRECISION | not null, default: 0     |            |      |
| **logoURI**                        | TEXT             | not null                 |            |      |
| **decimals**                       | INTEGER          | not null, default: 0     |            |      |
| **listed**                         | BOOLEAN          | not null, default: false |            |      |
| **priceUSD**                       | DOUBLE PRECISION | not null, default: 0     |            |      |
| **priceUSD1HourBF**                | DOUBLE PRECISION | not null, default: 0     |            |      |
| **priceUSD1DayBF**                 | DOUBLE PRECISION | not null, default: 0     |            |      |
| **priceUSD1WeekBF**                | DOUBLE PRECISION | not null, default: 0     |            |      |
| **priceUSD1MonthBF**               | DOUBLE PRECISION | not null, default: 0     |            |      |
| **sparkline7D**                    | JSONB            | not null, default: []    |            |      |
| **cpPrice**                        | DOUBLE PRECISION | not null, default: 0     |            |      |
| **cgId**                           | TEXT             | not null                 |            |      |
| **cmcId**                          | TEXT             | not null                 |            |      |
| **ath**                            | DOUBLE PRECISION | not null, default: 0     |            |      |
| **atl**                            | DOUBLE PRECISION | not null, default: 0     |            |      |
| **listingDate**                    | DOUBLE PRECISION | not null, default: 0     |            |      |
| **metricsDayStartTs**              | DOUBLE PRECISION | not null, default: 0     |            |      |
| **tradesCount**                    | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayHigh**                        | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayLow**                         | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayPriceDifference**             | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayPriceDifferencePercentage**   | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayTvl**                         | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayVolume**                      | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayTvlUSD**                      | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayVolumeUSD**                   | DOUBLE PRECISION | not null, default: 0     |            |      |
| **hourPriceDifference**            | DOUBLE PRECISION | not null, default: 0     |            |      |
| **hourPriceDifferencePercentage**  | DOUBLE PRECISION | not null, default: 0     |            |      |
| **weekPriceDifference**            | DOUBLE PRECISION | not null, default: 0     |            |      |
| **weekPriceDifferencePercentage**  | DOUBLE PRECISION | not null, default: 0     |            |      |
| **monthPriceDifference**           | DOUBLE PRECISION | not null, default: 0     |            |      |
| **monthPriceDifferencePercentage** | DOUBLE PRECISION | not null, default: 0     |            |      |
| **creator**                        | TEXT             | not null                 |            |      |
| **totalMinBuckets**                | DOUBLE PRECISION | not null, default: 0     |            |      |
| **totalHourBuckets**               | DOUBLE PRECISION | not null, default: 0     |            |      |
| **totalDayBuckets**                | DOUBLE PRECISION | not null, default: 0     |            |      |
| **totalWeekBuckets**               | DOUBLE PRECISION | not null, default: 0     |            |      |
| **totalMonthBuckets**              | DOUBLE PRECISION | not null, default: 0     |            |      | 


### spot_pairs

| Name                             | Type             | Settings                 | References | Note |
| -------------------------------- | ---------------- | ------------------------ | ---------- | ---- |
| **id**                           | TEXT             | 🔑 PK, null              |            |      |
| **token0**                       | TEXT             | not null                 |            |      |
| **token1**                       | TEXT             | not null                 |            |      |
| **base**                         | TEXT             | not null                 |            |      |
| **quote**                        | TEXT             | not null                 |            |      |
| **baseSymbol**                   | TEXT             | not null                 |            |      |
| **baseName**                     | TEXT             | not null                 |            |      |
| **quoteSymbol**                  | TEXT             | not null                 |            |      |
| **quoteName**                    | TEXT             | not null                 |            |      |
| **bDecimal**                     | INTEGER          | not null, default: 0     |            |      |
| **qDecimal**                     | INTEGER          | not null, default: 0     |            |      |
| **symbol**                       | TEXT             | not null                 |            |      |
| **ticker**                       | TEXT             | not null                 |            |      |
| **description**                  | TEXT             | not null                 |            |      |
| **type**                         | TEXT             | not null                 |            |      |
| **exchange**                     | TEXT             | not null                 |            |      |
| **isConcentratedLiquidity**      | BOOLEAN          | not null, default: false |            |      |
| **dynamicFee**                   | BOOLEAN          | not null, default: false |            |      |
| **effectiveFeeBps**              | DOUBLE PRECISION | not null                 |            |      |
| **feeSource**                    | TEXT             | not null                 |            |      |
| **listed**                       | BOOLEAN          | not null, default: false |            |      |
| **price**                        | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayOpen**                      | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayHigh**                      | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayLow**                       | DOUBLE PRECISION | not null, default: 0     |            |      |
| **scales**                       | JSONB            | not null, default: []    |            |      |
| **sparkline7D**                  | JSONB            | not null, default: []    |            |      |
| **ath**                          | DOUBLE PRECISION | not null, default: 0     |            |      |
| **atl**                          | DOUBLE PRECISION | not null, default: 0     |            |      |
| **listingDate**                  | DOUBLE PRECISION | not null, default: 0     |            |      |
| **metricsDayStartTs**            | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayPriceDifference**           | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayPriceDifferencePercentage** | DOUBLE PRECISION | not null, default: 0     |            |      |
| **baseTvl** (`baseLiquidity`)    | DOUBLE PRECISION | not null, default: 0     |            |      |
| **quoteTvl** (`quoteLiquidity`)  | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayBaseTvl**                   | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayQuoteTvl**                  | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayBaseVolume**                | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayQuoteVolume**               | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayBaseTvlUSD**                | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayQuoteTvlUSD**               | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayBaseVolumeUSD**             | DOUBLE PRECISION | not null, default: 0     |            |      |
| **dayQuoteVolumeUSD**            | DOUBLE PRECISION | not null, default: 0     |            |      |
| **totalSwapFeesUsd**             | DOUBLE PRECISION | not null, default: 0     |            | Lifetime swap fees (USD) when fee token is priced |
| **daySwapFeesUsd**               | DOUBLE PRECISION | not null, default: 0     |            | UTC-day swap fees (USD); resets with day window |
| **totalMinBuckets**              | DOUBLE PRECISION | not null, default: 0     |            |      |
| **totalHourBuckets**             | DOUBLE PRECISION | not null, default: 0     |            |      |
| **totalDayBuckets**              | DOUBLE PRECISION | not null, default: 0     |            |      |
| **totalWeekBuckets**             | DOUBLE PRECISION | not null, default: 0     |            |      |
| **totalMonthBuckets**            | DOUBLE PRECISION | not null, default: 0     |            |      | 


### spot_groups

| Name            | Type | Settings    | References | Note |
| --------------- | ---- | ----------- | ---------- | ---- |
| **id**          | TEXT | 🔑 PK, null |            |      |
| **name**        | TEXT | not null    |            |      |
| **description** | TEXT | not null    |            |      | 


### spot_group_tokens

| Name        | Type | Settings        | References | Note |
| ----------- | ---- | --------------- | ---------- | ---- |
| **groupId** | TEXT | 🔑 PK, not null |            |      |
| **tokenId** | TEXT | 🔑 PK, not null |            |      |
| **symbol**  | TEXT | not null        |            |      | 


### spot_group_pairs

| Name        | Type | Settings        | References | Note |
| ----------- | ---- | --------------- | ---------- | ---- |
| **pairId**  | TEXT | 🔑 PK, not null |            |      |
| **groupId** | TEXT | 🔑 PK, not null |            |      |
| **symbol**  | TEXT | not null        |            |      |
| **base**    | TEXT | not null        |            |      |
| **quote**   | TEXT | not null        |            |      | 


### spot_token_time_buckets

| Name                     | Type             | Settings             | References | Note |
| ------------------------ | ---------------- | -------------------- | ---------- | ---- |
| **token**                | TEXT             | 🔑 PK, not null      |            |      |
| **resolution**           | TEXT             | 🔑 PK, not null      |            |      |
| **bucketIndex**          | INTEGER          | 🔑 PK, not null      |            |      |
| **bucketStartTs**        | DOUBLE PRECISION | not null             |            |      |
| **bucketEndTs**          | DOUBLE PRECISION | not null, default: 0 |            |      |
| **symbol**               | TEXT             | not null             |            |      |
| **open**                 | DOUBLE PRECISION | not null, default: 0 |            |      |
| **high**                 | DOUBLE PRECISION | not null, default: 0 |            |      |
| **low**                  | DOUBLE PRECISION | not null, default: 0 |            |      |
| **close**                | DOUBLE PRECISION | not null, default: 0 |            |      |
| **average**              | DOUBLE PRECISION | not null, default: 0 |            |      |
| **difference**           | DOUBLE PRECISION | not null, default: 0 |            |      |
| **differencePercentage** | DOUBLE PRECISION | not null, default: 0 |            |      |
| **tvl**                  | DOUBLE PRECISION | not null, default: 0 |            |      |
| **tvlUSD**               | DOUBLE PRECISION | not null, default: 0 |            |      |
| **volume**               | DOUBLE PRECISION | not null, default: 0 |            |      |
| **volumeUSD**            | DOUBLE PRECISION | not null, default: 0 |            |      |
| **count**                | DOUBLE PRECISION | not null, default: 0 |            |      | 


#### Indexes
| Name                                    | Unique | Fields                           |
| --------------------------------------- | ------ | -------------------------------- |
| spot_token_time_buckets_token_res_start | ✅      | token, resolution, bucketStartTs |
### spot_pair_time_buckets

| Name                     | Type             | Settings             | References | Note |
| ------------------------ | ---------------- | -------------------- | ---------- | ---- |
| **pair**                 | TEXT             | 🔑 PK, not null      |            |      |
| **resolution**           | TEXT             | 🔑 PK, not null      |            |      |
| **bucketIndex**          | INTEGER          | 🔑 PK, not null      |            |      |
| **bucketStartTs**        | DOUBLE PRECISION | not null             |            |      |
| **bucketEndTs**          | DOUBLE PRECISION | not null, default: 0 |            |      |
| **base**                 | TEXT             | not null             |            |      |
| **quote**                | TEXT             | not null             |            |      |
| **symbol**               | TEXT             | not null             |            |      |
| **open**                 | DOUBLE PRECISION | not null, default: 0 |            |      |
| **high**                 | DOUBLE PRECISION | not null, default: 0 |            |      |
| **low**                  | DOUBLE PRECISION | not null, default: 0 |            |      |
| **close**                | DOUBLE PRECISION | not null, default: 0 |            |      |
| **average**              | DOUBLE PRECISION | not null, default: 0 |            |      |
| **difference**           | DOUBLE PRECISION | not null, default: 0 |            |      |
| **differencePercentage** | DOUBLE PRECISION | not null, default: 0 |            |      |
| **baseVolume**           | DOUBLE PRECISION | not null, default: 0 |            |      |
| **quoteVolume**          | DOUBLE PRECISION | not null, default: 0 |            |      |
| **baseVolumeUSD**        | DOUBLE PRECISION | not null, default: 0 |            |      |
| **quoteVolumeUSD**       | DOUBLE PRECISION | not null, default: 0 |            |      |
| **baseTvl** (`baseLiquidity`) | DOUBLE PRECISION | not null, default: 0 |            |      |
| **quoteTvl** (`quoteLiquidity`) | DOUBLE PRECISION | not null, default: 0 |            |      |
| **baseTvlUSD** (`baseLiquidityUSD`) | DOUBLE PRECISION | not null, default: 0 |            |      |
| **quoteTvlUSD** (`quoteLiquidityUSD`) | DOUBLE PRECISION | not null, default: 0 |            |      |
| **count**                | DOUBLE PRECISION | not null, default: 0 |            |      | 


#### Indexes
| Name                                  | Unique | Fields                          |
| ------------------------------------- | ------ | ------------------------------- |
| spot_pair_time_buckets_pair_res_start | ✅      | pair, resolution, bucketStartTs |
### swap_bucket_state

| Name                  | Type             | Settings        | References | Note |
| --------------------- | ---------------- | --------------- | ---------- | ---- |
| **kind**              | TEXT             | 🔑 PK, not null |            |      |
| **entityId**          | TEXT             | 🔑 PK, not null |            |      |
| **resolution**        | TEXT             | 🔑 PK, not null |            |      |
| **lastBucketIndex**   | INTEGER          | not null        |            |      |
| **lastBucketStartTs** | DOUBLE PRECISION | not null        |            |      | 


### swap_liquidity_edges

| Name                        | Type    | Settings                 | References | Note |
| --------------------------- | ------- | ------------------------ | ---------- | ---- |
| **poolAddress**             | TEXT    | 🔑 PK, null              |            |      |
| **token0**                  | TEXT    | not null                 |            |      |
| **token1**                  | TEXT    | not null                 |            |      |
| **stable**                  | BOOLEAN | not null, default: false |            |      |
| **isConcentratedLiquidity** | BOOLEAN | not null, default: false |            |      |
| **clTickSpacing**           | INTEGER | not null                 |            |      | 


### ticks

| Name                      | Type        | Settings                                | References | Note |
| ------------------------- | ----------- | --------------------------------------- | ---------- | ---- |
| **id**                    | UUID        | 🔑 PK, null, default: gen_random_uuid() |            |      |
| **poolId**                | TEXT        | not null                                |            |      |
| **tickIndex**             | INTEGER     | not null                                |            |      |
| **liquidityGross**        | NUMERIC(40) | not null, default: 0                    |            |      |
| **liquidityNet**          | NUMERIC(40) | not null, default: 0                    |            |      |
| **feeGrowthOutside0X128** | NUMERIC(78) | not null, default: 0                    |            |      |
| **feeGrowthOutside1X128** | NUMERIC(78) | not null, default: 0                    |            |      |
| **createdAt**             | TIMESTAMPTZ | not null, default: now()                |            |      |
| **updatedAt**             | TIMESTAMPTZ | not null, default: now()                |            |      | 


#### Indexes
| Name                     | Unique | Fields            |
| ------------------------ | ------ | ----------------- |
| ticks_pool_id_tick_index | ✅      | poolId, tickIndex |
### liquidity_histogram_buckets

| Name                      | Type             | Settings                                | References | Note |
| ------------------------- | ---------------- | --------------------------------------- | ---------- | ---- |
| **id**                    | UUID             | 🔑 PK, null, default: gen_random_uuid() |            |      |
| **poolId**                | TEXT             | not null                                |            |      |
| **bucketType**            | TEXT             | not null                                |            |      |
| **bucketStartTick**       | INTEGER          | not null                                |            |      |
| **bucketEndTick**         | INTEGER          | not null                                |            |      |
| **priceLower**            | DOUBLE PRECISION | not null, default: 0                    |            |      |
| **priceUpper**            | DOUBLE PRECISION | not null, default: 0                    |            |      |
| **liquidityAmount**       | NUMERIC(40)      | not null, default: 0                    |            |      |
| **activeLiquidityAmount** | NUMERIC(40)      | not null, default: 0                    |            |      |
| **positionCount**         | INTEGER          | not null, default: 0                    |            |      |
| **snapshotBlockNumber**   | BIGINT           | not null, default: 0                    |            |      |
| **snapshotTime**          | TIMESTAMPTZ      | not null                                |            |      |
| **createdAt**             | TIMESTAMPTZ      | not null, default: now()                |            |      | 


#### Indexes
| Name                                | Unique | Fields                                             |
| ----------------------------------- | ------ | -------------------------------------------------- |
| liquidity_hist_pool_type_tick_range | ✅      | poolId, bucketType, bucketStartTick, bucketEndTick |
### broker_dynamic_swap_fee_globals

| Name                         | Type | Settings    | References | Note |
| ---------------------------- | ---- | ----------- | ---------- | ---- |
| **id**                       | TEXT | 🔑 PK, null |            |      |
| **defaultFeeCapWire**        | TEXT | not null    |            |      |
| **defaultScalingFactorWire** | TEXT | not null    |            |      |
| **secondsAgoWire**           | TEXT | not null    |            |      | 


### broker_dynamic_swap_fee_pools

| Name                  | Type | Settings    | References | Note |
| --------------------- | ---- | ----------- | ---------- | ---- |
| **poolId**            | TEXT | 🔑 PK, null |            |      |
| **baseFeeWire**       | TEXT | not null    |            |      |
| **feeCapWire**        | TEXT | not null    |            |      |
| **scalingFactorWire** | TEXT | not null    |            |      | 


### broker_dynamic_swap_fee_discounts

| Name             | Type | Settings    | References | Note |
| ---------------- | ---- | ----------- | ---------- | ---- |
| **address**      | TEXT | 🔑 PK, null |            |      |
| **discountWire** | TEXT | not null    |            |      | 


### broker_pool_factory_fee_defaults

| Name               | Type             | Settings    | References | Note |
| ------------------ | ---------------- | ----------- | ---------- | ---- |
| **id**             | TEXT             | 🔑 PK, null |            |      |
| **volatileFeeBps** | DOUBLE PRECISION | not null    |            |      |
| **stableFeeBps**   | DOUBLE PRECISION | not null    |            |      | 


### indexed_events

| Name          | Type        | Settings                 | References | Note |
| ------------- | ----------- | ------------------------ | ---------- | ---- |
| **id**        | TEXT        | 🔑 PK, null              |            |      |
| **payload**   | JSONB       | not null                 |            |      |
| **createdAt** | TIMESTAMPTZ | not null, default: now() |            |      | 


### spot_accounts

| Name                   | Type             | Settings             | References | Note |
| ---------------------- | ---------------- | -------------------- | ---------- | ---- |
| **id**                 | TEXT             | 🔑 PK, null          |            |      |
| **tvlUSD**             | DOUBLE PRECISION | not null, default: 0 |            |      |
| **lastTraded**         | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalOrders**        | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalOrderHistory**  | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalTradeHistory**  | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalVolumeUSD**     | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalCreatedTokens** | DOUBLE PRECISION | not null, default: 0 |            |      |
| **apiKey**             | TEXT             | not null             |            |      |
| **email**              | TEXT             | not null             |            |      | 


### spot_account_follows

| Name          | Type | Settings        | References | Note |
| ------------- | ---- | --------------- | ---------- | ---- |
| **follower**  | TEXT | 🔑 PK, not null |            |      |
| **following** | TEXT | 🔑 PK, not null |            |      | 


### spot_account_notifications

| Name                  | Type             | Settings                                | References | Note |
| --------------------- | ---------------- | --------------------------------------- | ---------- | ---- |
| **id**                | UUID             | 🔑 PK, null, default: gen_random_uuid() |            |      |
| **accountId**         | TEXT             | not null                                |            |      |
| **eventType**         | TEXT             | not null                                |            |      |
| **indexerEventId**    | TEXT             | not null                                |            |      |
| **payload**           | JSONB            | not null, default: {}                   |            |      |
| **blockTimestampSec** | DOUBLE PRECISION | not null, default: 0                    |            |      |
| **readAt**            | TIMESTAMPTZ      | not null                                |            |      |
| **createdAt**         | TIMESTAMPTZ      | not null, default: now()                |            |      | 


#### Indexes
| Name                                       | Unique | Fields                               |
| ------------------------------------------ | ------ | ------------------------------------ |
| spot_account_notifications_account_created |        | accountId, createdAt                 |
| spot_account_notifications_dedupe          | ✅      | accountId, indexerEventId, eventType |
### spot_account_liquidity_provisions

| Name                  | Type             | Settings                                | References | Note |
| --------------------- | ---------------- | --------------------------------------- | ---------- | ---- |
| **id**                | UUID             | 🔑 PK, null, default: gen_random_uuid() |            |      |
| **accountId**         | TEXT             | not null                                |            |      |
| **poolAddress**       | TEXT             | not null                                |            |      |
| **eventType**         | TEXT             | not null                                |            |      |
| **indexerEventId**    | TEXT             | not null                                |            |      |
| **token0**            | TEXT             | not null                                |            |      |
| **token1**            | TEXT             | not null                                |            |      |
| **amount0**           | TEXT             | not null                                |            |      |
| **amount1**           | TEXT             | not null                                |            |      |
| **stable**            | BOOLEAN          | not null                                |            |      |
| **clTickSpacing**     | INTEGER          | not null                                |            |      |
| **tickLower**         | TEXT             | not null                                |            |      |
| **tickUpper**         | TEXT             | not null                                |            |      |
| **liquidity**         | TEXT             | not null                                |            |      |
| **blockNumber**       | TEXT             | not null                                |            |      |
| **blockTimestampSec** | DOUBLE PRECISION | not null, default: 0                    |            |      |
| **transactionHash**   | TEXT             | not null                                |            |      |
| **logIndex**          | TEXT             | not null                                |            |      |
| **createdAt**         | TIMESTAMPTZ      | not null, default: now()                |            |      | 


#### Indexes
| Name                                  | Unique | Fields                               |
| ------------------------------------- | ------ | ------------------------------------ |
| spot_account_liq_prov_account_created |        | accountId, createdAt                 |
| spot_account_liq_prov_dedupe          | ✅      | accountId, indexerEventId, eventType |
### account_balance_time_buckets

| Name                  | Type             | Settings             | References | Note |
| --------------------- | ---------------- | -------------------- | ---------- | ---- |
| **account**           | TEXT             | 🔑 PK, not null      |            |      |
| **index**             | INTEGER          | 🔑 PK, not null      |            |      |
| **totalBalanceInUSD** | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalTokens**       | DOUBLE PRECISION | not null, default: 0 |            |      | 


### spot_exchanges

| Name                  | Type             | Settings             | References | Note |
| --------------------- | ---------------- | -------------------- | ---------- | ---- |
| **id**                | TEXT             | 🔑 PK, null          |            |      |
| **networkName**       | TEXT             | not null             |            |      |
| **bytecode**          | TEXT             | not null             |            |      |
| **deployer**          | TEXT             | not null             |            |      |
| **totalDayBuckets**   | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalWeekBuckets**  | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalMonthBuckets** | DOUBLE PRECISION | not null, default: 0 |            |      | 


### spot_exchange_time_buckets

| Name                   | Type             | Settings             | References | Note |
| ---------------------- | ---------------- | -------------------- | ---------- | ---- |
| **index**              | INTEGER          | 🔑 PK, not null      |            |      |
| **protocolId**         | TEXT             | 🔑 PK, not null      |            |      |
| **timestamp**          | DOUBLE PRECISION | 🔑 PK, not null      |            |      |
| **networkName**        | TEXT             | not null             |            |      |
| **totalVolume**        | DOUBLE PRECISION | not null, default: 0 |            |      |
| **tvl**                | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalGlobalTrades**  | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalGlobalPairs**   | DOUBLE PRECISION | not null, default: 0 |            |      |
| **totalGlobalTraders** | DOUBLE PRECISION | not null, default: 0 |            |      | 


## Relationships


## Database Diagram

```mermaid
erDiagram
	spot_tokens {
		TEXT id
		TEXT name
		TEXT symbol
		TEXT ticker
		DOUBLE PRECISION totalSupply
		TEXT logoURI
		INTEGER decimals
		BOOLEAN listed
		DOUBLE PRECISION priceUSD
		DOUBLE PRECISION priceUSD1HourBF
		DOUBLE PRECISION priceUSD1DayBF
		DOUBLE PRECISION priceUSD1WeekBF
		DOUBLE PRECISION priceUSD1MonthBF
		JSONB sparkline7D
		DOUBLE PRECISION cpPrice
		TEXT cgId
		TEXT cmcId
		DOUBLE PRECISION ath
		DOUBLE PRECISION atl
		DOUBLE PRECISION listingDate
		DOUBLE PRECISION metricsDayStartTs
		DOUBLE PRECISION tradesCount
		DOUBLE PRECISION dayHigh
		DOUBLE PRECISION dayLow
		DOUBLE PRECISION dayPriceDifference
		DOUBLE PRECISION dayPriceDifferencePercentage
		DOUBLE PRECISION dayTvl
		DOUBLE PRECISION dayVolume
		DOUBLE PRECISION dayTvlUSD
		DOUBLE PRECISION dayVolumeUSD
		DOUBLE PRECISION hourPriceDifference
		DOUBLE PRECISION hourPriceDifferencePercentage
		DOUBLE PRECISION weekPriceDifference
		DOUBLE PRECISION weekPriceDifferencePercentage
		DOUBLE PRECISION monthPriceDifference
		DOUBLE PRECISION monthPriceDifferencePercentage
		TEXT creator
		DOUBLE PRECISION totalMinBuckets
		DOUBLE PRECISION totalHourBuckets
		DOUBLE PRECISION totalDayBuckets
		DOUBLE PRECISION totalWeekBuckets
		DOUBLE PRECISION totalMonthBuckets
	}

	spot_pairs {
		TEXT id
		TEXT token0
		TEXT token1
		TEXT base
		TEXT quote
		TEXT baseSymbol
		TEXT baseName
		TEXT quoteSymbol
		TEXT quoteName
		INTEGER bDecimal
		INTEGER qDecimal
		TEXT symbol
		TEXT ticker
		TEXT description
		TEXT type
		TEXT exchange
		BOOLEAN isConcentratedLiquidity
		BOOLEAN dynamicFee
		DOUBLE PRECISION effectiveFeeBps
		TEXT feeSource
		BOOLEAN listed
		DOUBLE PRECISION price
		DOUBLE PRECISION dayOpen
		DOUBLE PRECISION dayHigh
		DOUBLE PRECISION dayLow
		JSONB scales
		JSONB sparkline7D
		DOUBLE PRECISION ath
		DOUBLE PRECISION atl
		DOUBLE PRECISION listingDate
		DOUBLE PRECISION metricsDayStartTs
		DOUBLE PRECISION dayPriceDifference
		DOUBLE PRECISION dayPriceDifferencePercentage
		DOUBLE PRECISION baseTvl
		DOUBLE PRECISION quoteTvl
		DOUBLE PRECISION dayBaseTvl
		DOUBLE PRECISION dayQuoteTvl
		DOUBLE PRECISION dayBaseVolume
		DOUBLE PRECISION dayQuoteVolume
		DOUBLE PRECISION dayBaseTvlUSD
		DOUBLE PRECISION dayQuoteTvlUSD
		DOUBLE PRECISION dayBaseVolumeUSD
		DOUBLE PRECISION dayQuoteVolumeUSD
		DOUBLE PRECISION totalSwapFeesUsd
		DOUBLE PRECISION daySwapFeesUsd
		DOUBLE PRECISION totalMinBuckets
		DOUBLE PRECISION totalHourBuckets
		DOUBLE PRECISION totalDayBuckets
		DOUBLE PRECISION totalWeekBuckets
		DOUBLE PRECISION totalMonthBuckets
	}

	spot_groups {
		TEXT id
		TEXT name
		TEXT description
	}

	spot_group_tokens {
		TEXT groupId
		TEXT tokenId
		TEXT symbol
	}

	spot_group_pairs {
		TEXT pairId
		TEXT groupId
		TEXT symbol
		TEXT base
		TEXT quote
	}

	spot_token_time_buckets {
		TEXT token
		TEXT resolution
		INTEGER bucketIndex
		DOUBLE PRECISION bucketStartTs
		DOUBLE PRECISION bucketEndTs
		TEXT symbol
		DOUBLE PRECISION open
		DOUBLE PRECISION high
		DOUBLE PRECISION low
		DOUBLE PRECISION close
		DOUBLE PRECISION average
		DOUBLE PRECISION difference
		DOUBLE PRECISION differencePercentage
		DOUBLE PRECISION tvl
		DOUBLE PRECISION tvlUSD
		DOUBLE PRECISION volume
		DOUBLE PRECISION volumeUSD
		DOUBLE PRECISION count
	}

	spot_pair_time_buckets {
		TEXT pair
		TEXT resolution
		INTEGER bucketIndex
		DOUBLE PRECISION bucketStartTs
		DOUBLE PRECISION bucketEndTs
		TEXT base
		TEXT quote
		TEXT symbol
		DOUBLE PRECISION open
		DOUBLE PRECISION high
		DOUBLE PRECISION low
		DOUBLE PRECISION close
		DOUBLE PRECISION average
		DOUBLE PRECISION difference
		DOUBLE PRECISION differencePercentage
		DOUBLE PRECISION baseVolume
		DOUBLE PRECISION quoteVolume
		DOUBLE PRECISION baseVolumeUSD
		DOUBLE PRECISION quoteVolumeUSD
		DOUBLE PRECISION baseTvl
		DOUBLE PRECISION quoteTvl
		DOUBLE PRECISION baseTvlUSD
		DOUBLE PRECISION quoteTvlUSD
		DOUBLE PRECISION count
	}

	swap_bucket_state {
		TEXT kind
		TEXT entityId
		TEXT resolution
		INTEGER lastBucketIndex
		DOUBLE PRECISION lastBucketStartTs
	}

	swap_liquidity_edges {
		TEXT poolAddress
		TEXT token0
		TEXT token1
		BOOLEAN stable
		BOOLEAN isConcentratedLiquidity
		INTEGER clTickSpacing
	}

	ticks {
		UUID id
		TEXT poolId
		INTEGER tickIndex
		NUMERIC(40) liquidityGross
		NUMERIC(40) liquidityNet
		NUMERIC(78) feeGrowthOutside0X128
		NUMERIC(78) feeGrowthOutside1X128
		TIMESTAMPTZ createdAt
		TIMESTAMPTZ updatedAt
	}

	liquidity_histogram_buckets {
		UUID id
		TEXT poolId
		TEXT bucketType
		INTEGER bucketStartTick
		INTEGER bucketEndTick
		DOUBLE PRECISION priceLower
		DOUBLE PRECISION priceUpper
		NUMERIC(40) liquidityAmount
		NUMERIC(40) activeLiquidityAmount
		INTEGER positionCount
		BIGINT snapshotBlockNumber
		TIMESTAMPTZ snapshotTime
		TIMESTAMPTZ createdAt
	}

	broker_dynamic_swap_fee_globals {
		TEXT id
		TEXT defaultFeeCapWire
		TEXT defaultScalingFactorWire
		TEXT secondsAgoWire
	}

	broker_dynamic_swap_fee_pools {
		TEXT poolId
		TEXT baseFeeWire
		TEXT feeCapWire
		TEXT scalingFactorWire
	}

	broker_dynamic_swap_fee_discounts {
		TEXT address
		TEXT discountWire
	}

	broker_pool_factory_fee_defaults {
		TEXT id
		DOUBLE PRECISION volatileFeeBps
		DOUBLE PRECISION stableFeeBps
	}

	indexed_events {
		TEXT id
		JSONB payload
		TIMESTAMPTZ createdAt
	}

	spot_accounts {
		TEXT id
		DOUBLE PRECISION tvlUSD
		DOUBLE PRECISION lastTraded
		DOUBLE PRECISION totalOrders
		DOUBLE PRECISION totalOrderHistory
		DOUBLE PRECISION totalTradeHistory
		DOUBLE PRECISION totalVolumeUSD
		DOUBLE PRECISION totalCreatedTokens
		TEXT apiKey
		TEXT email
	}

	spot_account_follows {
		TEXT follower
		TEXT following
	}

	spot_account_notifications {
		UUID id
		TEXT accountId
		TEXT eventType
		TEXT indexerEventId
		JSONB payload
		DOUBLE PRECISION blockTimestampSec
		TIMESTAMPTZ readAt
		TIMESTAMPTZ createdAt
	}

	spot_account_liquidity_provisions {
		UUID id
		TEXT accountId
		TEXT poolAddress
		TEXT eventType
		TEXT indexerEventId
		TEXT token0
		TEXT token1
		TEXT amount0
		TEXT amount1
		BOOLEAN stable
		INTEGER clTickSpacing
		TEXT tickLower
		TEXT tickUpper
		TEXT liquidity
		TEXT blockNumber
		DOUBLE PRECISION blockTimestampSec
		TEXT transactionHash
		TEXT logIndex
		TIMESTAMPTZ createdAt
	}

	account_balance_time_buckets {
		TEXT account
		INTEGER index
		DOUBLE PRECISION totalBalanceInUSD
		DOUBLE PRECISION totalTokens
	}

	spot_exchanges {
		TEXT id
		TEXT networkName
		TEXT bytecode
		TEXT deployer
		DOUBLE PRECISION totalDayBuckets
		DOUBLE PRECISION totalWeekBuckets
		DOUBLE PRECISION totalMonthBuckets
	}

	spot_exchange_time_buckets {
		INTEGER index
		TEXT protocolId
		DOUBLE PRECISION timestamp
		TEXT networkName
		DOUBLE PRECISION totalVolume
		DOUBLE PRECISION tvl
		DOUBLE PRECISION totalGlobalTrades
		DOUBLE PRECISION totalGlobalPairs
		DOUBLE PRECISION totalGlobalTraders
	}
```