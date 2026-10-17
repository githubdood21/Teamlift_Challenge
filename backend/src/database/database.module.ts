import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseOptions } from './database-options.js';

@Module({
  imports: [TypeOrmModule.forRootAsync({
    useFactory: () => ({ ...databaseOptions(), retryAttempts: 1 }),
  })],
})
export class DatabaseModule {}
