import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('port');
  await app.listen(port);

  logger.log(`Config-service HTTP listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
