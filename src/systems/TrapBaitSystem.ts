import Phaser from 'phaser';
import { Rat } from '../entities/Rat';
import { Trap } from '../entities/Trap';

export class TrapBaitSystem {
  static readonly ATTRACT_RADIUS = 200;

  static update(rats: Rat[], traps: Trap[]): void {
    const cheeseBaits = traps.filter((t) => t.active && t.trapType === 'bait_cheese');
    if (cheeseBaits.length === 0) {
      return;
    }

    rats.forEach((rat) => {
      // Only attract rats that are active, on the floor, and in wander/panic states
      if (!rat.active || rat.isClimbing || rat.state === 'dead' || (rat as any).isChewing) {
        return;
      }

      // Check distance
      const closeCheeses = cheeseBaits.filter((cheese) => {
        return Phaser.Math.Distance.Between(rat.x, rat.y, cheese.x, cheese.y) <= TrapBaitSystem.ATTRACT_RADIUS;
      });

      if (closeCheeses.length === 0) {
        return;
      }

      // Find closest cheese
      let closestCheese = closeCheeses[0];
      let minDist = Phaser.Math.Distance.Between(rat.x, rat.y, closestCheese.x, closestCheese.y);

      for (let i = 1; i < closeCheeses.length; i++) {
        const dist = Phaser.Math.Distance.Between(rat.x, rat.y, closeCheeses[i].x, closeCheeses[i].y);
        if (dist < minDist) {
          minDist = dist;
          closestCheese = closeCheeses[i];
        }
      }

      // Guide rat towards cheese X position
      if (rat.x < closestCheese.x - 4) {
        rat.currentDirection = 1;
      } else if (rat.x > closestCheese.x + 4) {
        rat.currentDirection = -1;
      }
    });
  }
}
