import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.useWebSocketAdapter(new IoAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin:
      process.env.DEV_MODE === 'true'
        ? true
        : /^https?:\/\/([a-z0-9-]+\.)?giwater\.finance(:\d+)?$/,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('GiWater Gateway')
    .setDescription(
      'Edge HTTP API (Redis cache + RabbitMQ broker RPC). Real-time: Socket.IO on the same port.',
    )
    .setVersion('0.1')
    .addTag('health')
    .addTag('broker')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('port');
  await app.listen(port);

  logger.log(`Gateway listening on http://localhost:${port}`);
  logger.log(`Swagger: http://localhost:${port}/api/docs`);
  logger.log(`Socket.IO: same origin, default namespace`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
