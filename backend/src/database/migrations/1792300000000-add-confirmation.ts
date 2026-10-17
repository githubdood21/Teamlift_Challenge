import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConfirmation1792300000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE bookings
      ADD COLUMN confirmation_message text,
      ADD COLUMN confirmation_source text,
      ADD CONSTRAINT bookings_confirmation_valid CHECK (
        (confirmation_message IS NULL AND confirmation_source IS NULL) OR
        (confirmation_message IS NOT NULL AND confirmation_source IS NOT NULL AND confirmation_source IN ('ai', 'standard'))
      )`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE bookings DROP CONSTRAINT bookings_confirmation_valid, DROP COLUMN confirmation_source, DROP COLUMN confirmation_message');
  }
}
