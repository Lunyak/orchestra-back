import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Разрешаем более крупные тела запросов (например, /sync/push со списками шагов/сущностей)
  app.use(
    json({
      limit: '10mb',
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      limit: '10mb',
    }),
  );

  app.enableCors({
    origin: true, // временно разрешаем все источники (включая http://localhost:5173)
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    // ВАЖНО: если указать allowedHeaders явно, нужно перечислить и кастомные заголовки.
    // Иначе preflight (OPTIONS) для запросов с ними будет падать "CORS".
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'x-orchestra-client-id',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start application:', err);
  process.exit(1);
});
