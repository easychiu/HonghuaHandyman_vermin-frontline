import Phaser from 'phaser';
import { Human } from '../entities/Human';
import { Rat } from '../entities/Rat';

interface HumanSightSystemConfig {
  humanPool: Phaser.Physics.Arcade.Group;
  getActiveRats: () => Rat[];
  panicRadius: number;
  onHumanSawRat: () => void;
}

export class HumanSightSystem {
  constructor(private readonly config: HumanSightSystemConfig) {}

  update(): void {
    const activeHumans = this.config.humanPool.getChildren().filter((h) => h.active) as Human[];
    const activeRats = this.config.getActiveRats();

    activeHumans.forEach((human) => {
      if (human.isPanicking) {
        return;
      }

      const spottedRat = activeRats.find((rat) => Phaser.Math.Distance.Between(human.x, human.y, rat.x, rat.y) < this.config.panicRadius);

      if (!spottedRat) {
        return;
      }

      human.panic();
      this.config.onHumanSawRat();
    });
  }
}
