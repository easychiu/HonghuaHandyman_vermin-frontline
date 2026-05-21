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
    // Add physics collider for barricades (so rats cannot pass through them)
    this.scene.physics.add.collider(config.greenRatPool, config.trapPool, this.handleRatCollideTrap, this.shouldCollideWithTrap, this);
    this.scene.physics.add.collider(config.blueRatPool, config.trapPool, this.handleRatCollideTrap, this.shouldCollideWithTrap, this);

    // Add overlaps for bear_trap and bait_cheese
    this.scene.physics.add.overlap(config.greenRatPool, config.trapPool, this.handleRatOverlapTrap, this.shouldOverlapWithTrap, this);
    this.scene.physics.add.overlap(config.blueRatPool, config.trapPool, this.handleRatOverlapTrap, this.shouldOverlapWithTrap, this);
  }

  handlePlayerAttack(): void {
    const { playerAttackRange, playerAttackHeight } = GAME_BALANCE.combat;
    this.player.playAttackAnimation();

    const attackX =
      this.player.facingDirection === 1
        ? this.player.x + 16
        : this.player.x - 16 - playerAttackRange;

    const attackY = this.player.y - 24;

    const slash = this.scene.add.graphics();
    slash.fillStyle(0xffd166, 0.8);
    slash.fillRect(attackX, attackY, playerAttackRange, playerAttackHeight);
    this.scene.time.delayedCall(80, () => slash.destroy());

    const upgrades = this.scene.registry.get('upgrades') as { broomDamage?: number } | undefined;
    const level = upgrades?.broomDamage ?? 1;
    const broomValues = [1.0, 1.5, 2.2];
    const damage = broomValues[Math.min(Math.max(1, level), broomValues.length) - 1];

    const hits = this.scene.physics.overlapRect(attackX, attackY, playerAttackRange, playerAttackHeight);

    hits.forEach((body) => {
      const entity = body.gameObject;
      if (!(entity instanceof Rat)) {
        return;
      }

      this.applyDamage(entity, damage);
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

  private shouldCollideWithTrap(
    ratObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    trapObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): boolean {
    const trap = trapObj as Trap;
    return trap.active && trap.trapType === 'barricade';
  }

  private shouldOverlapWithTrap(
    ratObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    trapObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): boolean {
    const trap = trapObj as Trap;
    return trap.active && (trap.trapType === 'bear_trap' || trap.trapType === 'bait_cheese');
  }

  private handleRatCollideTrap(
    ratObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    trapObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    const rat = ratObj as Rat;
    const trap = trapObj as Trap;

    if (!rat.active || !trap.active) {
      return;
    }

    if (trap.trapType === 'barricade') {
      // Turn around
      if (rat.body.touching.right || rat.body.blocked.right) {
        rat.currentDirection = -1;
      } else if (rat.body.touching.left || rat.body.blocked.left) {
        rat.currentDirection = 1;
      } else {
        rat.currentDirection *= -1;
      }
      rat.setVelocityX(rat.currentDirection * rat.moveSpeed * rat.externalSpeedMultiplier);

      // If blocked on both sides (nowhere to go), chew the barricade
      const isBlockedLeft = rat.body.blocked.left || rat.body.touching.left;
      const isBlockedRight = rat.body.blocked.right || rat.body.touching.right;
      if (isBlockedLeft && isBlockedRight) {
        const now = this.scene.time.now;
        if (!trap.lastBiteTime || now - trap.lastBiteTime >= 1000) {
          trap.lastBiteTime = now;
          trap.takeDamage(1);
        }
      }
    }
  }

  private handleRatOverlapTrap(
    ratObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    trapObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    const rat = ratObj as Rat;
    const trap = trapObj as Trap;

    if (!rat.active || !trap.active) {
      return;
    }

    if (trap.trapType === 'bear_trap') {
      const upgrades = this.scene.registry.get('upgrades') as { bearTrapDamage?: number } | undefined;
      const level = upgrades?.bearTrapDamage ?? 1;
      const trapValues = [2.0, 3.5, 5.0];
      const damage = trapValues[Math.min(Math.max(1, level), trapValues.length) - 1];

      this.applyDamage(rat, damage);
      trap.despawn();
    } else if (trap.trapType === 'bait_cheese') {
      if (!rat.isChewing) {
        rat.isChewing = true;
        rat.setVelocity(0, 0);

        this.applyDamage(rat, 0.5); // bait_cheese poison damage: 0.5
        trap.takeDamage(1);

        // Chew stun duration: 1.2s
        this.scene.time.delayedCall(1200, () => {
          if (rat.active) {
            rat.isChewing = false;
          }
        });
      }
    }
  }

  private showHitEffect(x: number, y: number, color: number): void {
    const particles = this.scene.add.graphics().setDepth(100);
    particles.fillStyle(color, 0.85);

    const dots: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < 6; i++) {
      dots.push({
        x,
        y,
        vx: Phaser.Math.Between(-120, 120),
        vy: Phaser.Math.Between(-150, -50),
      });
    }

    const timer = this.scene.time.addEvent({
      delay: 16,
      repeat: 15,
      callback: () => {
        particles.clear();
        particles.fillStyle(color, 0.85);
        dots.forEach((dot) => {
          dot.x += dot.vx * 0.016;
          dot.y += dot.vy * 0.016;
          dot.vy += 300 * 0.016; // gravity
          particles.fillCircle(dot.x, dot.y, 3);
        });
      },
      callbackScope: this,
    });

    this.scene.time.delayedCall(250, () => {
      timer.remove();
      particles.destroy();
    });
  }

  private applyDamage(rat: Rat, amount: number): void {
    const wasActive = rat.active;

    const hitColor = rat.faction === 'green' ? 0x2ec4b6 : 0x00b4d8;
    this.showHitEffect(rat.x, rat.y, hitColor);

    rat.takeDamage(amount);

    if (wasActive && !rat.active) {
      this.onRatKilled();
      this.scene.cameras.main.shake(120, 0.005);
    }
  }
}
