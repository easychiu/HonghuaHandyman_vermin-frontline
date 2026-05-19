import Phaser from 'phaser';
import { GAME_BALANCE, RatFaction } from '../config/gameBalance';
import { Rat } from '../entities/Rat';

interface RatSpawnerSystemConfig {
  scene: Phaser.Scene;
  greenRatPool: Phaser.Physics.Arcade.Group;
  blueRatPool: Phaser.Physics.Arcade.Group;
  portalX: number;
  portalY: number;
  surfaceY: number;
}

export class RatSpawnerSystem {
  private autoSpawnTimer?: Phaser.Time.TimerEvent;

  constructor(private readonly config: RatSpawnerSystemConfig) {}

  startAutoSpawn(): void {
    this.autoSpawnTimer = this.config.scene.time.addEvent({
      delay: GAME_BALANCE.rat.spawnIntervalMs,
      callback: () => {
        this.spawn('green', this.config.portalX, this.config.portalY, Phaser.Math.Between(-160, -70));
      },
      callbackScope: this,
      loop: true,
    });
  }

  spawnByPointer(pointer: Phaser.Input.Pointer): void {
    const faction: RatFaction = pointer.y > this.config.surfaceY ? 'blue' : 'green';
    this.spawn(faction, pointer.x, pointer.y, Phaser.Math.Between(-150, 150));
  }

  stop(): void {
    this.autoSpawnTimer?.remove(false);
    this.autoSpawnTimer = undefined;
  }

  private spawn(faction: RatFaction, x: number, y: number, velocityX: number): void {
    const pool = faction === 'green' ? this.config.greenRatPool : this.config.blueRatPool;
    const rat = pool.get() as Rat | null;

    if (!rat) {
      return;
    }

    rat.spawn(x, y, velocityX, faction);
  }
}
