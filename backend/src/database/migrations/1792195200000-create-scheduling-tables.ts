import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchedulingTables1792195200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE slots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        starts_at timestamptz NOT NULL,
        duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX slots_starts_at_idx ON slots (starts_at)');
    await queryRunner.query(`
      CREATE TABLE bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slot_id uuid NOT NULL REFERENCES slots(id),
        name text NOT NULL CHECK (length(trim(name)) > 0),
        email text NOT NULL CHECK (length(trim(email)) > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT bookings_slot_id_unique UNIQUE (slot_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE bookings');
    await queryRunner.query('DROP TABLE slots');
  }
}
