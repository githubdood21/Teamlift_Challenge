import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCalendar1792260000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE calendar_connection (
      id integer PRIMARY KEY CHECK (id = 1),
      refresh_token_cipher text NOT NULL,
      connected_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(`CREATE TABLE calendar_oauth_attempts (
      state_hash text PRIMARY KEY,
      verifier_cipher text NOT NULL,
      expires_at timestamptz NOT NULL
    )`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE calendar_oauth_attempts');
    await runner.query('DROP TABLE calendar_connection');
  }
}
