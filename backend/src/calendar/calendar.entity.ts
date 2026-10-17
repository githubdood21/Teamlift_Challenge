import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('calendar_connection')
export class CalendarConnection {
  @PrimaryColumn({ type: 'integer' }) id: number;
  @Column({ name: 'refresh_token_cipher', type: 'text' })
  refreshTokenCipher: string;
  @CreateDateColumn({ name: 'connected_at', type: 'timestamptz' })
  connectedAt: Date;
}

@Entity('calendar_oauth_attempts')
export class CalendarOAuthAttempt {
  @PrimaryColumn({ name: 'state_hash', type: 'text' }) stateHash: string;
  @Column({ name: 'verifier_cipher', type: 'text' }) verifierCipher: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
}
