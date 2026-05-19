export interface ConfigServiceConfig {
  port: number;
  configDb: {
    url: string;
  };
  rabbitmq: {
    url: string;
    rpcQueue: string;
  };
}

export default (): ConfigServiceConfig => ({
  port: parseInt(process.env.PORT ?? '3047', 10),
  configDb: {
    url:
      process.env.CONFIG_DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/giwater_config',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    rpcQueue: process.env.RABBITMQ_RPC_QUEUE ?? 'config-service.rpc',
  },
});
