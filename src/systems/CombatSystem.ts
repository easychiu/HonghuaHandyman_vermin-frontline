import Phaser from 'phaser';
import { GAME_BALANCE } from '../config/gameBalance';
import { Player } from '../entities/Player';
import { Rat } from '../entities/Rat';
import { Trap } from '../entities/Trap';

interface CombatSystemConfig {
  scene: Phaser.Scene;
  player: Player;
  greenRatPool: Phaser.Physics.Arcade.Group;
  blueRatPool: Phaser.Physics.Arcade.Group;
  trapPool: Phaser.Physics.Arcade.Group;
  onRatKilled: () => void;
}

export class CombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly onRatKilled: () => void;

  constructor(config: CombatSystemConfig) {
    this.scene = config.scene;
    this.player = config.player;
    this.onRatKilled = config.onRatKilled;

    this.scene.physics.add.overlap(config.greenRatPool, config.blueRatPool, this.handleRatBrawl, undefined, this);
    this.scene.physics.add.overlap(config.greenRatPool, config.trapPool, this.handleRatHitTrap, undefined, this);
    this.scene.physics.add.overlap(config.blueRatPool, config.trapPool, this.handleRatHitTrap, undefined, this);
  }

  handlePlayerAttack(): void {
    const { playerAttackRange, playerAttackHeight, playerAttackDamage } = GAME_BALANCE.combat;

    const attackX =
      this.player.facingDirection === 1
        ? this.player.x + 16
        : this.player.x - 16 - playerAttackRange;

    const attackY = this.player.y - 24;

    const slash = this.scene.add.graphics();
    slash.fillStyle(0xffd166, 0.8);
    slash.fillRect(attackX, attackY, playerAttackRange, playerAttackHeight);
    this.scene.time.delayedCall(80, () => slash.destroy());

    const hits = this.scene.physics.overlapRect(attackX, attackY, playerAttackRange, playerAttackHeight);

    hits.forEach((body) => {
      const entity = body.gameObject;
      if (!(entity instanceof Rat)) {
        return;
      }

      this.applyDamage(entity, playerAttackDamage);
    });
  }

  private handleRatBrawl(
    rat1Obj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    rat2Obj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    const rat1 = rat1Obj as Rat;
    const rat2 = rat2Obj as Rat;

    if (!rat1.active || !rat2.active) {
      return;
    }

    if (rat1.faction === rat2.faction || rat1.isPanicking || rat2.isPanicking) {
      return;
    }

    this.applyDamage(rat1, 1);
    this.applyDamage(rat2, 1);
  }

  private handleRatHitTrap(
    ratObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    trapObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    const rat = ratObj as Rat;
    const trap = trapObj as Trap;

    if (!rat.active || !trap.active) {
      return;
    }

    this.applyDamage(rat, GAME_BALANCE.combat.trapDamage);
    trap.despawn();
  }

  private applyDamage(rat: Rat, amount: number): void {
    const wasActive = rat.active;
    rat.takeDamage(amount);

    if (wasActive && !rat.active) {
      this.onRatKilled();
    }
  }
}
