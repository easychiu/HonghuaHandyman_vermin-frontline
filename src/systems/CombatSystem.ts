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
  onRatKilled: (comboCount: number) => void;
}

type DamageSource = 'player' | 'trap' | 'brawl' | 'skill';


export class CombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly onRatKilled: (comboCount: number) => void;
  private comboCount = 0;
  private comboTimer?: Phaser.Time.TimerEvent;
  private comboText?: Phaser.GameObjects.Text;
  private readonly COMBO_TIMEOUT_MS = 2000;

  constructor(config: CombatSystemConfig) {
    this.scene = config.scene;
    this.player = config.player;
    this.onRatKilled = config.onRatKilled;

    // Combo counter display text
    const { width } = this.scene.scale;
    this.comboText = this.scene.add
      .text(width / 2, 80, '', {
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: '40px',
        color: '#ffd166',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(500)
      .setAlpha(0);

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

    // Slash arc visual
    const slash = this.scene.add.graphics().setDepth(50);
    slash.fillStyle(0xffd166, 0.75);
    slash.fillRect(attackX, attackY, playerAttackRange, playerAttackHeight);
    slash.lineStyle(2, 0xffffff, 0.9);
    slash.strokeRect(attackX, attackY, playerAttackRange, playerAttackHeight);
    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 120,
      onComplete: () => slash.destroy(),
    });

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

      this.applyDamage(entity, damage, 'player');
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

    this.applyDamage(rat1, 1, 'brawl');
    this.applyDamage(rat2, 1, 'brawl');
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

      this.applyDamage(rat, damage, 'trap');
      trap.despawn();
    } else if (trap.trapType === 'bait_cheese') {
      if (!rat.isChewing) {
        rat.isChewing = true;
        rat.setVelocity(0, 0);

        this.applyDamage(rat, 0.5, 'trap');
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

  private showFloatingDamage(x: number, y: number, amount: number, source: DamageSource): void {
    const colorMap: Record<DamageSource, string> = {
      player: '#ffd166',
      trap: '#ff9f1c',
      brawl: '#ff6b6b',
      skill: '#a8dadc',
    };
    const label = amount >= 1 ? `-${Math.floor(amount)}` : '-½';
    const txt = this.scene.add
      .text(x + Phaser.Math.Between(-10, 10), y - 12, label, {
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: amount >= 3 ? '22px' : '16px',
        color: colorMap[source],
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(300);

    this.scene.tweens.add({
      targets: txt,
      y: txt.y - 40,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
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

  private registerKill(): void {
    this.comboCount++;
    this.comboTimer?.remove();
    this.comboTimer = this.scene.time.delayedCall(this.COMBO_TIMEOUT_MS, () => {
      this.comboCount = 0;
      this.comboText?.setAlpha(0);
    });

    if (this.comboCount >= 2 && this.comboText) {
      let label = '';
      let color = '#ffffff';
      let scale = 1.0;

      if (this.comboCount >= 8) {
        label = `🔥 FEVER!! ×${this.comboCount}`;
        color = '#ff3333';
        scale = 1.3;
      } else if (this.comboCount >= 5) {
        label = `⚡ HOT!! ×${this.comboCount}`;
        color = '#ff9f1c';
        scale = 1.15;
      } else if (this.comboCount >= 3) {
        label = `✨ COMBO ×${this.comboCount}`;
        color = '#ffd166';
        scale = 1.0;
      } else {
        label = `COMBO ×${this.comboCount}`;
        color = '#eeeeee';
        scale = 0.85;
      }

      this.scene.tweens.killTweensOf(this.comboText);
      this.comboText.setText(label).setColor(color).setAlpha(1).setScale(scale * 1.5);
      this.scene.tweens.add({
        targets: this.comboText,
        scale,
        duration: 200,
        ease: 'Back.Out',
      });
      this.scene.tweens.add({
        targets: this.comboText,
        alpha: 0,
        delay: 1200,
        duration: 400,
        ease: 'Power2',
      });
    }

    this.onRatKilled(this.comboCount);
  }

  private applyDamage(rat: Rat, amount: number, source: DamageSource = 'player'): void {
    const wasActive = rat.active;

    const hitColor = rat.faction === 'green' ? 0x2ec4b6 : 0x00b4d8;
    this.showHitEffect(rat.x, rat.y, hitColor);
    this.showFloatingDamage(rat.x, rat.y, amount, source);

    rat.takeDamage(amount);

    if (wasActive && !rat.active) {
      this.registerKill();
      this.scene.cameras.main.shake(120, 0.005);
    }
  }
}
