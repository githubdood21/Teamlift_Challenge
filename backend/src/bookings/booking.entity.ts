import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Slot } from '../slots/slot.entity.js';

@Entity('bookings')
@Unique('bookings_slot_id_unique', ['slotId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'slot_id', type: 'uuid' })
  slotId: string;

  @ManyToOne(() => Slot, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'slot_id' })
  slot: Slot;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  email: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'confirmation_message', type: 'text', nullable: true })
  confirmationMessage: string | null;

  @Column({ name: 'confirmation_source', type: 'text', nullable: true })
  confirmationSource: 'ai' | 'standard' | null;
}
