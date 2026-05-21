import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';

export class ReadyScene extends Phaser.Scene {
  private particles: Array<{
    sprite: Phaser.GameObjects.Arc;
    vx: number;
    vy: number;
  }> = [];

  constructor() {
    super(SCENE_KEYS.ready);
  }

  create(): void {
    const { width, height } = this.scale;

    // Set background color to dark tech color (#090d16)
    this.cameras.main.setBackgroundColor('#090d16');

    // Create floating purple/blue/pink background particles
    this.particles = [];
    for (let i = 0; i < 35; i++) {
      const radius = Phaser.Math.Between(2, 6);
      const color = Phaser.Utils.Array.GetRandom([0xa855f7, 0x3b82f6, 0xec4899]);
      const p = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        radius,
        color,
        Phaser.Math.FloatBetween(0.1, 0.45)
      );
      this.particles.push({
        sprite: p,
        vx: Phaser.Math.FloatBetween(-15, 15),
        vy: Phaser.Math.FloatBetween(-30, -5), // float upwards
      });
    }

    // Glowing Neon Title: 紅花萬事屋：鼠鼠之亂
    const titleText = this.add
      .text(width / 2, height / 2 - 165, '紅花萬事屋：鼠鼠之亂', {
        color: '#ffffff',
        fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '44px',
        fontWeight: 'bold',
      })
      .setOrigin(0.5);

    titleText.setStroke('#a855f7', 6);
    titleText.setShadow(0, 0, '#ff007f', 15, true, true);

    const subtitleText = this.add
      .text(width / 2, height / 2 - 115, '— 滅 鼠 行 動 —', {
        color: '#00ffff',
        fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '18px',
        fontWeight: 'bold',
      })
      .setOrigin(0.5);
    subtitleText.setShadow(0, 0, '#00ffff', 6, true, true);

    // Double panels graphics card container
    const panel = this.add.graphics();
    // Glassmorphism background: semi-transparent dark slate
    panel.fillStyle(0x111827, 0.85);
    // Glowing neon border
    panel.lineStyle(2, 0xa855f7, 0.6);
    panel.fillRoundedRect(120, 170, 720, 200, 16);
    panel.strokeRoundedRect(120, 170, 720, 200, 16);

    // Separator line
    panel.lineStyle(1, 0xffffff, 0.15);
    panel.lineBetween(480, 190, 480, 350);

    // Left Column: Desktop Controls
    this.add.text(300, 190, '💻 桌機操作 (Desktop)', {
      color: '#00ffff',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '16px',
      fontWeight: 'bold',
    }).setOrigin(0.5);

    const desktopControls = [
      '• A / D 或 左右方向鍵：左右移動',
      '• W 或 上方向鍵：爬管 / 向上跳躍',
      '• S 或 下方向鍵：爬管下樓',
      '• [ 空白鍵 ]：揮舞掃帚攻擊老鼠',
      '• [ E 鍵 ]：放置防禦陷阱',
      '• [ Q 鍵 ]：循環切換防禦陷阱類型',
      '• [ 1 ~ 6 鍵 ]：使用萬事屋特工技能'
    ].join('\n');

    this.add.text(140, 220, desktopControls, {
      color: '#cbd5e1',
      fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '12px',
      lineSpacing: 5,
    });

    // Right Column: Mobile Controls
    this.add.text(660, 190, '📱 手機操作 (Mobile)', {
      color: '#00ffff',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '16px',
      fontWeight: 'bold',
    }).setOrigin(0.5);

    const mobileControls = [
      '• [ 左下虛擬搖桿 ]：控制移動及爬跳',
      '• [ 右下攻擊按鈕 ]：揮舞掃帚攻擊',
      '• [ 右下陷阱按鈕 ]：放置防禦陷阱',
      '• [ 陷阱旁切換鈕 ]：切換防禦陷阱',
      '• [ 頂部頭像按鈕 ]：點擊釋放技能',
      '• 支援多點觸控，手動防禦更靈活'
    ].join('\n');

    this.add.text(500, 220, mobileControls, {
      color: '#cbd5e1',
      fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '12px',
      lineSpacing: 5,
    });

    // Call to Action
    const startText = this.add
      .text(width / 2, height / 2 + 120, '— 點擊螢幕 或 按下 [ 空白鍵 / Enter ] 開始行動 —', {
        color: '#ff007f',
        fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '15px',
        fontWeight: 'bold',
      })
      .setOrigin(0.5);
    startText.setShadow(0, 0, '#ff007f', 6, true, true);

    // Pulse animation
    this.tweens.add({
      targets: startText,
      alpha: { start: 1, end: 0.3 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Power1.easeInOut'
    });

    let started = false;
    const startGame = () => {
      if (started) {
        return;
      }
      started = true;

      this.input.keyboard?.off('keydown', onKeyboardStart);

      // Camera fade out transition
      this.cameras.main.fadeOut(500, 9, 13, 22);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENE_KEYS.mainGame);
      });
    };

    const onKeyboardStart = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        startGame();
      }
    };

    this.input.once('pointerdown', startGame);
    this.input.keyboard?.on('keydown', onKeyboardStart);
    
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', onKeyboardStart);
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.particles.forEach((p) => {
      p.sprite.y += p.vy * dt;
      p.sprite.x += p.vx * dt;
      if (p.sprite.y < -10) {
        p.sprite.y = this.scale.height + 10;
        p.sprite.x = Phaser.Math.Between(0, this.scale.width);
      }
      if (p.sprite.x < -10) {
        p.sprite.x = this.scale.width + 10;
      } else if (p.sprite.x > this.scale.width + 10) {
        p.sprite.x = -10;
      }
    });
  }
}
