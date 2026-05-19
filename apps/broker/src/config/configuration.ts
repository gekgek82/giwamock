import {
  DEX_USD_QUOTE_ADDRESS_CONFIG_DEFAULT,
  PAIR_DISPLAY_CONFIG_DEFAULT,
} from '@giwater/shared';

export interface BrokerConfig {
  port: number;
  /** Optional USDT/WETH addresses for `resolveDexTokenUsdPrice` (`@giwater/shared`). */
  dexUsdQuote: {
    usdtToken: string;
    wethToken: string;
  };
  /**
   * Resolve UI BASE/QUOTE from on-chain token0/token1 (see `inferDisplayBaseQuote` in `@giwater/shared`).
   */
  pairDisplay: {
    stableQuoteAddresses: string[];
    wrappedNativeAddress: string;
    wrappedNativeIsQuoteWhenNoStable: boolean;
  };
  brokerDb: {
    url: string;
  };
  rabbitmq: {
    url: string;
    /** Queue fed by amm-indexer (and similar producers). */
    indexerQueue: string;
    /** Topic exchange; gateway replicas consume via their own bindings. */
    gatewayExchange: string;
    /** Request queue for gateway → broker RPC (reply via AMQP replyTo + correlationId). */
    rpcQueue: string;
    /** Routing key used when fanning indexer-shaped events to the gateway exchange. */
    gatewayIndexerRoutingKey: string;
    /** Routing key for structured per-channel Socket.IO emits (see `BrokerGatewayWsEmitV1`). */
    gatewayWsEmitRoutingKey: string;
  };
}

export default (): BrokerConfig => {
  const pairDisplay = PAIR_DISPLAY_CONFIG_DEFAULT;
  const usdQuote = DEX_USD_QUOTE_ADDRESS_CONFIG_DEFAULT;

  return {
    port: parseInt(process.env.PORT ?? '3045', 10),
    dexUsdQuote: {
      usdtToken: usdQuote.usdtToken,
      wethToken: usdQuote.wethToken,
    },
    pairDisplay,
    brokerDb: {
      url:
        process.env.BROKER_DATABASE_URL ??
        'postgres://postgres:postgres@localhost:5432/giwater_broker',
    },
    rabbitmq: {
      url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
      indexerQueue: process.env.RABBITMQ_INDEXER_QUEUE ?? 'amm-indexer.events',
      gatewayExchange:
        process.env.RABBITMQ_GATEWAY_EXCHANGE ?? 'giwater.gateway',
      rpcQueue: process.env.RABBITMQ_BROKER_RPC_QUEUE ?? 'broker.rpc',
      gatewayIndexerRoutingKey:
        process.env.RABBITMQ_GATEWAY_INDEXER_ROUTING_KEY ?? 'indexer.event',
      gatewayWsEmitRoutingKey:
        process.env.RABBITMQ_GATEWAY_WS_EMIT_ROUTING_KEY ?? 'broker.ws.emit',
    },
  };
};
