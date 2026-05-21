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

      const closeRats = activeRats.filter((rat) => Phaser.Math.Distance.Between(human.x, human.y, rat.x, rat.y) < this.config.panicRadius);
      if (closeRats.length === 0) {
        return;
      }

      // Find closest rat
      let closestRat = closeRats[0];
      let minDist = Phaser.Math.Distance.Between(human.x, human.y, closestRat.x, closestRat.y);
      for (let i = 1; i < closeRats.length; i++) {
        const dist = Phaser.Math.Distance.Between(human.x, human.y, closeRats[i].x, closeRats[i].y);
        if (dist < minDist) {
          minDist = dist;
          closestRat = closeRats[i];
        }
      }

      human.panic(closestRat.x);
      this.config.onHumanSawRat();
    });
  }
}
