import Phaser from 'phaser';
import { GAME_BALANCE } from '../config/gameBalance';
import { Player } from '../entities/Player';
import { Rat } from '../entities/Rat';
import { Trap } from '../entities/Trap';
import { AudioSystem } from './AudioSystem';

interface CombatSystemConfig {
  scene: Phaser.Scene;
  player: Player;
  greenRatPool: Phaser.Physics.Arcade.Group;
  blueRatPool: Phaser.Physics.Arcade.Group;
  trapPool: Phaser.Physics.Arcade.Group;
  onRatKilled: (rat: Rat, comboCount: number) => void;
}

type DamageSource = 'player' | 'trap' | 'brawl' | 'skill';


export class CombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly onRatKilled: (rat: Rat, comboCount: number) => void;
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
    AudioSystem.playSwipe();

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

    // Only allow brawling if both are wandering and not already in another special state
    if (
      rat1.state !== 'wander' ||
      rat2.state !== 'wander' ||
      rat1.faction === rat2.faction ||
      rat1.isPanicking ||
      rat2.isPanicking
    ) {
      return;
    }

    // Start a brawl!
    rat1.state = 'brawl';
    rat2.state = 'brawl';

    // Stop their movement and physics gravity
    rat1.setVelocity(0, 0);
    rat2.setVelocity(0, 0);
    if (rat1.body) (rat1.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    if (rat2.body) (rat2.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    // Bring them together
    const midX = (rat1.x + rat2.x) / 2;
    const midY = (rat1.y + rat2.y) / 2;
    rat1.x = midX - 6;
    rat2.x = midX + 6;
    rat1.y = midY;
    rat2.y = midY;

    // Create a visual cartoon fight cloud container at midpoint
    const fightContainer = this.scene.add.container(midX, midY).setDepth(25);

    // Smoke graphics
    const smoke = this.scene.add.graphics();
    fightContainer.add(smoke);

    // Stars/scratches graphics
    const sparks = this.scene.add.graphics();
    fightContainer.add(sparks);

    // Text "啪啪！砰！💥" (Brawl text bubble) above the fight
    const fightText = this.scene.add.text(0, -22, '💥 啪啪！砰！吱吱！', {
      fontFamily: '"Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif',
      fontSize: '13px',
      fontWeight: 'bold',
      color: '#ff3333',
      stroke: '#ffffff',
      strokeThickness: 3
    }).setOrigin(0.5);
    fightContainer.add(fightText);

    // Play periodic squeaks
    const soundTimer = this.scene.time.addEvent({
      delay: 350,
      loop: true,
      callback: () => {
        if (Math.random() > 0.3) {
          AudioSystem.playRatSqueak();
        }
      }
    });

    // Animation loop for drawing gray cartoon clouds and yellow/red sparks
    const animTimer = this.scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (!fightContainer.scene) return;
        
        smoke.clear();
        const t = this.scene.time.now * 0.02;
        // Wiggling smoke puffs
        smoke.fillStyle(0xd1d5db, 0.7); // Light gray smoke
        smoke.fillCircle(Math.sin(t) * 6, Math.cos(t) * 4, 11 + Math.sin(t * 1.5) * 2);
        smoke.fillCircle(Math.cos(t * 1.2) * 8, Math.sin(t * 0.8) * 6, 13 + Math.cos(t) * 2);
        smoke.fillStyle(0x9ca3af, 0.55); // Darker gray smoke
        smoke.fillCircle(Math.sin(t * 0.7) * 9, Math.cos(t * 1.3) * 8, 9 + Math.sin(t) * 2);

        sparks.clear();
        // Yellow stars
        sparks.fillStyle(0xffd166, 0.95);
        for (let i = 0; i < 3; i++) {
          const sx = Phaser.Math.Between(-16, 16);
          const sy = Phaser.Math.Between(-16, 16);
          sparks.fillCircle(sx, sy, Phaser.Math.Between(2, 4));
        }
        
        // Red scratch lines
        sparks.lineStyle(2, 0xff3333, 0.85);
        for (let i = 0; i < 2; i++) {
          const sx = Phaser.Math.Between(-12, 12);
          const sy = Phaser.Math.Between(-12, 12);
          const length = Phaser.Math.Between(8, 14);
          sparks.lineBetween(sx, sy, sx + length, sy + length * 0.5);
        }
      }
    });

    let ticks = 0;
    const brawlTimer = this.scene.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        // If either rat dies or leaves brawl state, end immediately
        if (!rat1.active || !rat2.active || rat1.state !== 'brawl' || rat2.state !== 'brawl') {
          endBrawl();
          return;
        }

        // Deal brawl damage to each other
        this.applyDamage(rat1, 0.5, 'brawl');
        this.applyDamage(rat2, 0.5, 'brawl');

        ticks++;
        if (ticks >= 5) { // 2.0 seconds max
          endBrawl();
        }
      }
    });

    const endBrawl = () => {
      brawlTimer.remove();
      animTimer.remove();
      soundTimer.remove();
      fightContainer.destroy();

      if (rat1.active) {
        if (rat1.body) (rat1.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
        if (rat1.hp > 0 && rat1.state === 'brawl') {
          // Survivor panics and runs away!
          rat1.panic();
        }
      }

      if (rat2.active) {
        if (rat2.body) (rat2.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
        if (rat2.hp > 0 && rat2.state === 'brawl') {
          // Survivor panics and runs away!
          rat2.panic();
        }
      }
    };
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

  private showArcadeComboAnnounce(
    text: string, color: string, scale: number,
    shakeTime: number, shakeIntensity: number,
    flashColor?: string
  ): void {
    const { width, height } = this.scene.scale;
    const txt = this.scene.add.text(width / 2, height / 2 - 50, text, {
      fontFamily: '"Arial Black", Impact, sans-serif',
      fontSize: '42px',
      color: color,
      stroke: '#000000',
      strokeThickness: 8,
      shadow: { color: '#000000', fill: true, offsetX: 3, offsetY: 3, blur: 5 }
    }).setOrigin(0.5).setDepth(450).setScale(0.1);

    if (flashColor) {
      this.scene.tweens.addCounter({
        from: 0,
        to: 100,
        duration: 300,
        yoyo: true,
        repeat: 2,
        onUpdate: (tween) => {
          const value = tween.getValue();
          if (value > 50) {
            txt.setColor(flashColor);
          } else {
            txt.setColor(color);
          }
        }
      });
    }

    this.scene.tweens.add({
      targets: txt,
      scaleX: scale,
      scaleY: scale,
      duration: 500,
      ease: 'Elastic.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: txt,
          alpha: 0,
          y: txt.y - 30,
          delay: 400,
          duration: 300,
          onComplete: () => txt.destroy()
        });
      }
    });

    this.scene.cameras.main.shake(shakeTime, shakeIntensity);
  }

  private registerKill(rat: Rat): void {
    this.comboCount++;
    this.comboTimer?.remove();
    this.comboTimer = this.scene.time.delayedCall(this.COMBO_TIMEOUT_MS, () => {
      this.comboCount = 0;
      this.comboText?.setAlpha(0);
    });

    // Play arcade announcer fanfares & show popups
    if (this.comboCount === 2) {
      AudioSystem.playDoubleKill();
      this.showArcadeComboAnnounce('DOUBLE KILL!', '#ffcc00', 1.5, 150, 0.008);
    } else if (this.comboCount === 3) {
      AudioSystem.playTripleKill();
      this.showArcadeComboAnnounce('TRIPLE KILL!!', '#ff6600', 1.8, 200, 0.012);
    } else if (this.comboCount === 5) {
      AudioSystem.playMonsterKill();
      this.showArcadeComboAnnounce('MONSTER KILL!!!', '#d90429', 2.2, 300, 0.018);
    } else if (this.comboCount >= 8 && (this.comboCount - 8) % 3 === 0) {
      AudioSystem.playVerminator();
      this.showArcadeComboAnnounce('VERMINATOR!!!!', '#ef233c', 2.6, 450, 0.025, '#ffb703');
    }

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

    this.onRatKilled(rat, this.comboCount);
  }

  private applyDamage(rat: Rat, amount: number, source: DamageSource = 'player'): void {
    const wasActive = rat.active;

    const hitColor = GAME_BALANCE.rat.profiles[rat.faction].tint;
    this.showHitEffect(rat.x, rat.y, hitColor);
    this.showFloatingDamage(rat.x, rat.y, amount, source);

    AudioSystem.playRatHit();

    rat.takeDamage(amount);

    if (wasActive && !rat.active) {
      AudioSystem.playRatSqueak();
      this.registerKill(rat);
      this.scene.cameras.main.shake(120, 0.005);
    }
  }
}
