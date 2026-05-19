import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('GiwaTer Broker API')
    .setDescription('Broker service endpoints for indexed event ingestion')
    .setVersion('1.0')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDoc);

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('port');
  await app.listen(port);

  logger.log(`Broker HTTP listening on port ${port}`);
  logger.log(`Swagger docs available at /api/docs`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
