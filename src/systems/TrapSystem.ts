import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Trap } from '../entities/Trap';

export class TrapSystem {
  constructor(
    private readonly trapPool: Phaser.Physics.Arcade.Group,
    private readonly player: Player,
  ) {}

  placeTrap(): void {
    const trap = this.trapPool.get() as Trap | null;
    if (!trap) {
      return;
    }

    trap.spawn(this.player.x, this.player.y + 20);
  }
}
