import Phaser from 'phaser';
import { GAME_BALANCE, RatFaction } from '../config/gameBalance';
import { Rat } from '../entities/Rat';

interface RatSpawnerSystemConfig {
  scene: Phaser.Scene;
  greenRatPool: Phaser.Physics.Arcade.Group;
  blueRatPool: Phaser.Physics.Arcade.Group;
  portalX: number;
  portalY: number;
  pipeX: number;
  surfaceY: number;
}

export class RatSpawnerSystem {
  private autoSpawnTimerGreen?: Phaser.Time.TimerEvent;
  private autoSpawnTimerBlue?: Phaser.Time.TimerEvent;

  constructor(private readonly config: RatSpawnerSystemConfig) {}

  startAutoSpawn(): void {
    const selectedMission = this.config.scene.registry.get('selectedMission') as { spawnRateMult?: number } | undefined;
    const mult = selectedMission?.spawnRateMult ?? 1.0;

    // 綠、紅、黃、白、橘老鼠：從右側傳送門生成，往左跑
    this.autoSpawnTimerGreen = this.config.scene.time.addEvent({
      delay: GAME_BALANCE.rat.spawnIntervalMs / mult,
      callback: () => {
        const roll = Math.random();
        let faction: RatFaction = 'green';
        if (roll < 0.60) {
          faction = 'green';
        } else if (roll < 0.80) {
          faction = 'red';
        } else if (roll < 0.90) {
          faction = 'yellow';
        } else if (roll < 0.95) {
          faction = 'white';
        } else {
          faction = 'orange';
        }
        this.spawn(faction, this.config.portalX, this.config.portalY, Phaser.Math.Between(-160, -70));
      },
      callbackScope: this,
      loop: true,
    });

    // 藍、紫、黑、青、橘老鼠：從地下左側生成，往右跑
    this.autoSpawnTimerBlue = this.config.scene.time.addEvent({
      delay: GAME_BALANCE.rat.blueSpawnIntervalMs / mult,
      callback: () => {
        const roll = Math.random();
        let faction: RatFaction = 'blue';
        if (roll < 0.50) {
          faction = 'blue';
        } else if (roll < 0.70) {
          faction = 'purple';
        } else if (roll < 0.85) {
          faction = 'black';
        } else if (roll < 0.95) {
          faction = 'cyan';
        } else {
          faction = 'orange';
        }
        this.spawn(faction, 40, this.config.portalY, Phaser.Math.Between(70, 160));
      },
      callbackScope: this,
      loop: true,
    });
  }

  spawnByPointer(pointer: Phaser.Input.Pointer): void {
    const isSewer = pointer.y > this.config.surfaceY;
    let faction: RatFaction = 'green';
    if (isSewer) {
      const roll = Math.random();
      if (roll < 0.50) {
        faction = 'blue';
      } else if (roll < 0.70) {
        faction = 'purple';
      } else if (roll < 0.85) {
        faction = 'black';
      } else if (roll < 0.95) {
        faction = 'cyan';
      } else {
        faction = 'orange';
      }
    } else {
      const roll = Math.random();
      if (roll < 0.60) {
        faction = 'green';
      } else if (roll < 0.80) {
        faction = 'red';
      } else if (roll < 0.90) {
        faction = 'yellow';
      } else if (roll < 0.95) {
        faction = 'white';
      } else {
        faction = 'orange';
      }
    }
    this.spawn(faction, pointer.x, pointer.y, Phaser.Math.Between(-150, 150));
  }

  stop(): void {
    this.autoSpawnTimerGreen?.remove(false);
    this.autoSpawnTimerGreen = undefined;
    this.autoSpawnTimerBlue?.remove(false);
    this.autoSpawnTimerBlue = undefined;
  }

  public spawn(faction: RatFaction, x: number, y: number, velocityX: number): void {
    const isSurface = faction === 'green' || faction === 'red' || faction === 'yellow' || faction === 'white' || (faction === 'orange' && y <= this.config.surfaceY);
    const pool = isSurface ? this.config.greenRatPool : this.config.blueRatPool;
    const rat = pool.get() as Rat | null;

    if (!rat) {
      return;
    }

    rat.spawn(x, y, velocityX, faction);
    rat.configureEscapeRoute(this.config.pipeX, this.config.surfaceY);
  }
}
