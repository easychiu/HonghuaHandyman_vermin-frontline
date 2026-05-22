import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Trap, TrapType } from '../entities/Trap';
import { AudioSystem } from './AudioSystem';

export class TrapSystem {
  public currentTrapType: TrapType = 'bear_trap';
  private lastPlaceTime = 0;
  private readonly cooldownMs = 500; // 0.5s placement cooldown

  private readonly limits: Record<TrapType, number> = {
    bear_trap: 5,
    bait_cheese: 3,
    barricade: 3,
  };

  private readonly trapOrder: TrapType[] = ['bear_trap', 'bait_cheese', 'barricade'];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly trapPool: Phaser.Physics.Arcade.Group,
    private readonly player: Player,
  ) {
    this.scene.registry.set('currentTrapType', this.currentTrapType);
  }

  cycleTrap(): void {
    const currentIndex = this.trapOrder.indexOf(this.currentTrapType);
    const nextIndex = (currentIndex + 1) % this.trapOrder.length;
    this.currentTrapType = this.trapOrder[nextIndex];
    this.scene.registry.set('currentTrapType', this.currentTrapType);
    AudioSystem.playClick();
  }

  placeTrap(): void {
    const now = this.scene.time.now;
    if (now - this.lastPlaceTime < this.cooldownMs) {
      return;
    }

    // Check active traps of this type to enforce limits
    const activeTrapsOfType = this.trapPool.getChildren().filter(
      (t) => t.active && (t as Trap).trapType === this.currentTrapType
    ) as Trap[];

    const limit = this.limits[this.currentTrapType];
    if (activeTrapsOfType.length >= limit) {
      // Find the oldest active trap of this type and fade it out
      const oldest = activeTrapsOfType[0];
      if (oldest) {
        this.scene.tweens.add({
          targets: oldest,
          alpha: 0,
          duration: 200,
          onComplete: () => oldest.despawn()
        });
      }
    }

    const trap = this.trapPool.get() as Trap | null;
    if (!trap) {
      return;
    }

    // Place slightly in front of the player based on facing direction
    const offsetDirection = this.player.facingDirection >= 0 ? 1 : -1;
    const placeX = this.player.x + offsetDirection * 24;

    // Use feet-alignment formula to place trap perfectly flat on the ground/surface
    // player feet Y is player.y + player.displayHeight / 2
    // trap center Y is feet Y - trap.displayHeight / 2
    const trapHeight = this.currentTrapType === 'barricade' ? 28 : (this.currentTrapType === 'bait_cheese' ? 14 : 10);
    const placeY = this.player.y + (this.player.displayHeight / 2) - (trapHeight / 2);

    trap.spawn(placeX, placeY, this.currentTrapType);
    AudioSystem.playPlaceTrap();
    this.lastPlaceTime = now;
  }
}
