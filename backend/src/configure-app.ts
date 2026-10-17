import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';

// Shared by production startup and HTTP tests so validation stays consistent.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
}
