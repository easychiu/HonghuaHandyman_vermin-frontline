import Phaser from 'phaser';
import { GAME_BALANCE } from '../config/gameBalance';

/**
 * MapLayoutSystem
 * 根據任務 ID 和隨機種子生成不同的地圖佈局：
 * - Mission A「下水道」：深色污水管道風格，少量隨機地下跳台
 * - Mission B「平民區」：暖色城市街道風格，地面障礙物+地下跳台
 * - Mission C「城堡地下」：石灰岩城堡風格，複雜地下多層平台
 */
export class MapLayoutSystem {
  private readonly surfaceY = GAME_BALANCE.world.surfaceY;

  // Palette per mission
  private static readonly THEMES: Record<string, MapTheme> = {
    A: {
      skyColor: 0x4a4e69,         // 夜色城市藍灰
      undergroundColor: 0x1a2421, // 深綠污水管
      groundTint: 0x7a9e9f,
      undergroundAccent: 0x2d6a4f,
      label: '🕳 下水道 - 鼠群蔓延',
      subLabel: '⚠ 地下污水管道',
    },
    B: {
      skyColor: 0x6b4226,         // 黃昏磚瓦
      undergroundColor: 0x1c1c2e, // 暗夜地道
      groundTint: 0xd4a373,
      undergroundAccent: 0x3d405b,
      label: '🏘 平民區 - 鼠患爆發',
      subLabel: '⚠ 城市地下通道',
    },
    C: {
      skyColor: 0x2c2c54,         // 深夜城堡
      undergroundColor: 0x14213d, // 城堡地下室
      groundTint: 0x8d8d8d,
      undergroundAccent: 0x4a4e69,
      label: '🏰 城堡地下防線',
      subLabel: '⚠ 石灰岩地下室',
    },
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly platforms: Phaser.Physics.Arcade.StaticGroup,
    private readonly missionId: string,
    private readonly seed: number,
  ) {}

  /** 使用 seed 取得偽隨機數 (0~1) */
  private seededRandom(offset: number): number {
    const x = Math.sin(this.seed + offset) * 10000;
    return x - Math.floor(x);
  }

  private randBetween(min: number, max: number, offset: number): number {
    return Math.floor(this.seededRandom(offset) * (max - min + 1)) + min;
  }

  /** 主要入口：繪製背景 + 生成隨機平台/障礙物 */
  buildMap(): void {
    const theme = MapLayoutSystem.THEMES[this.missionId] ?? MapLayoutSystem.THEMES['A'];
    const { width, height } = this.scene.scale;

    this.drawBackground(theme, width, height);
    this.drawLayerLabels(theme, width);
    this.generateLayout(theme, width, height);
  }

  private drawBackground(theme: MapTheme, width: number, height: number): void {
    // Sky / surface layer
    const skyBg = this.scene.add.graphics().setDepth(0);
    skyBg.fillGradientStyle(
      theme.skyColor, theme.skyColor,
      Phaser.Display.Color.IntegerToColor(theme.skyColor).darken(30).color,
      Phaser.Display.Color.IntegerToColor(theme.skyColor).darken(30).color,
      1,
    );
    skyBg.fillRect(0, 0, width, this.surfaceY);

    // Underground layer
    const ugBg = this.scene.add.graphics().setDepth(0);
    ugBg.fillStyle(theme.undergroundColor, 1);
    ugBg.fillRect(0, this.surfaceY, width, height - this.surfaceY);

    // Underground accent stripes (horizontal mood lines)
    const accentG = this.scene.add.graphics().setDepth(1);
    accentG.lineStyle(1, theme.undergroundAccent, 0.3);
    const ugHeight = height - this.surfaceY;
    for (let i = 1; i <= 4; i++) {
      const ly = this.surfaceY + (ugHeight / 5) * i;
      accentG.lineBetween(0, ly, width, ly);
    }

    // Surface/underground separator line
    const divG = this.scene.add.graphics().setDepth(2);
    divG.lineStyle(3, 0x000000, 0.5);
    divG.lineBetween(0, this.surfaceY, width, this.surfaceY);

    // Random background details
    this.drawBackgroundDetails(theme, width, height);
  }

  private drawBackgroundDetails(theme: MapTheme, width: number, height: number): void {
    const g = this.scene.add.graphics().setDepth(1);

    if (this.missionId === 'A') {
      // Sewer pipes background decoration
      const pipeColor = Phaser.Display.Color.IntegerToColor(theme.undergroundAccent).lighten(10).color;
      g.lineStyle(8, pipeColor, 0.4);
      for (let i = 0; i < 3; i++) {
        const px = this.randBetween(80, width - 80, i * 7);
        g.lineBetween(px, this.surfaceY + 20, px, height - 40);
      }
      // Drip marks
      g.lineStyle(2, 0x4ade80, 0.2);
      for (let i = 0; i < 6; i++) {
        const dx = this.randBetween(30, width - 30, i * 3 + 100);
        const dy = this.surfaceY + this.randBetween(20, (height - this.surfaceY) - 40, i * 5);
        g.lineBetween(dx, dy, dx, dy + this.randBetween(10, 40, i * 9));
      }
    } else if (this.missionId === 'B') {
      // Window silhouettes on surface
      const winColor = 0xffd166;
      for (let i = 0; i < 4; i++) {
        const wx = this.randBetween(50, width - 50, i * 11);
        const wy = this.randBetween(20, this.surfaceY - 40, i * 7);
        g.fillStyle(winColor, 0.08);
        g.fillRect(wx, wy, 30, 20);
        g.lineStyle(1, winColor, 0.3);
        g.strokeRect(wx, wy, 30, 20);
        g.lineBetween(wx + 15, wy, wx + 15, wy + 20);
        g.lineBetween(wx, wy + 10, wx + 30, wy + 10);
      }
      // Underground brick texture lines
      g.lineStyle(1, 0x3d405b, 0.4);
      for (let row = 0; row < 5; row++) {
        const ly = this.surfaceY + 30 + row * 55;
        for (let col = 0; col < 8; col++) {
          const offset = row % 2 === 0 ? 0 : 60;
          g.lineBetween(offset + col * 120, ly, offset + col * 120 + 100, ly);
        }
      }
    } else if (this.missionId === 'C') {
      // Castle stone blocks underground
      g.fillStyle(0x4a4e69, 0.15);
      for (let row = 0; row < 4; row++) {
        const ly = this.surfaceY + 30 + row * 60;
        for (let col = 0; col < 7; col++) {
          const offset = row % 2 === 0 ? 0 : 70;
          const bx = offset + col * 140;
          g.fillRect(bx, ly, 120, 40);
          g.lineStyle(1, 0x6c757d, 0.5);
          g.strokeRect(bx, ly, 120, 40);
        }
      }
      // Torch glow on surface (decorative)
      const torchColor = 0xff9f1c;
      for (let i = 0; i < 2; i++) {
        const tx = i === 0 ? 120 : width - 120;
        g.fillStyle(torchColor, 0.25);
        g.fillCircle(tx, this.surfaceY - 30, 35);
        g.fillStyle(torchColor, 0.6);
        g.fillCircle(tx, this.surfaceY - 30, 8);
      }
    }
  }

  private drawLayerLabels(theme: MapTheme, width: number): void {
    this.scene.add.text(width / 2, 22, theme.label, {
      color: '#ffffff',
      fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
      fontSize: '18px',
      stroke: '#000000',
      strokeThickness: 4,
      shadow: { color: '#000000', fill: true, blur: 8, offsetX: 0, offsetY: 0 },
    }).setOrigin(0.5).setDepth(5).setAlpha(0.85);

    this.scene.add.text(width / 2, this.surfaceY + 22, theme.subLabel, {
      color: '#aaaaaa',
      fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
      fontSize: '15px',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5).setAlpha(0.7);
  }

  private generateLayout(theme: MapTheme, width: number, height: number): void {
    switch (this.missionId) {
      case 'A': this.layoutSewer(width, height); break;
      case 'B': this.layoutUrban(width, height); break;
      case 'C': this.layoutCastle(width, height); break;
      default:  this.layoutSewer(width, height);
    }
  }

  // ─── Mission A: 下水道 ────────────────────────────────────────────────
  private layoutSewer(width: number, height: number): void {
    const ugBase = this.surfaceY;
    const ugHeight = height - ugBase;

    // 1–2 random floating platforms underground
    const numPlatforms = this.randBetween(1, 2, 1);
    for (let i = 0; i < numPlatforms; i++) {
      const px = this.randBetween(100, width - 200, i * 13 + 20);
      const py = ugBase + this.randBetween(60, ugHeight - 100, i * 17 + 30);
      const pw = this.randBetween(100, 160, i * 11);
      this.addPlatform(px, py, pw, 16, 'underground_texture');
    }

    // Sewer water pool (cosmetic) at bottom
    const poolG = this.scene.add.graphics().setDepth(3);
    poolG.fillStyle(0x2d6a4f, 0.35);
    const poolH = this.randBetween(18, 30, 99);
    poolG.fillRect(0, height - poolH - 20, width, poolH);
    poolG.lineStyle(1, 0x4ade80, 0.4);
    poolG.lineBetween(0, height - poolH - 20, width, height - poolH - 20);
  }

  // ─── Mission B: 平民區 ────────────────────────────────────────────────
  private layoutUrban(width: number, height: number): void {
    const ugBase = this.surfaceY;
    const ugHeight = height - ugBase;

    // Surface: 1–2 crate obstacles (block movement)
    const numCrates = this.randBetween(1, 2, 55);
    for (let i = 0; i < numCrates; i++) {
      // Avoid pipe area (x ~460-500)
      let cx = this.randBetween(80, width - 80, i * 19 + 60);
      if (cx > 430 && cx < 530) cx += 120;
      cx = Math.min(cx, width - 80);
      const crateY = ugBase - 20;
      this.addObstacle(cx, crateY, 40, 40, 0x8b5e3c, 0xa07850, '📦');
    }

    // Underground: 2–3 platforms at different heights
    const numPlatforms = this.randBetween(2, 3, 2);
    for (let i = 0; i < numPlatforms; i++) {
      const px = this.randBetween(80, width - 200, i * 17 + 10);
      const py = ugBase + this.randBetween(55, ugHeight - 90, i * 23 + 5);
      const pw = this.randBetween(100, 180, i * 13 + 3);
      this.addPlatform(px, py, pw, 16, 'underground_texture');
    }

    // Bonus: storm drain grate on surface (cosmetic)
    const grateG = this.scene.add.graphics().setDepth(3);
    grateG.lineStyle(2, 0x555555, 0.7);
    const gx = this.randBetween(150, width - 200, 88);
    grateG.strokeRect(gx, ugBase - 8, 50, 8);
    for (let j = 0; j < 5; j++) {
      grateG.lineBetween(gx + j * 10, ugBase - 8, gx + j * 10, ugBase);
    }
  }

  // ─── Mission C: 城堡地下 ──────────────────────────────────────────────
  private layoutCastle(width: number, height: number): void {
    const ugBase = this.surfaceY;
    const ugHeight = height - ugBase;

    // Surface: 2 stone pillar decorations
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 60 : width - 60;
      this.addObstacle(side, ugBase - 40, 32, 80, 0x6c757d, 0x868e96, '🪨');
    }

    // Underground: 3–4 platforms forming multi-tier structure
    const numPlatforms = this.randBetween(3, 4, 4);
    const tiers = [
      ugBase + Math.round(ugHeight * 0.25),
      ugBase + Math.round(ugHeight * 0.5),
      ugBase + Math.round(ugHeight * 0.72),
    ];

    for (let i = 0; i < numPlatforms; i++) {
      const tierIdx = i % tiers.length;
      const baseY = tiers[tierIdx];
      const py = baseY + this.randBetween(-15, 15, i * 29 + 7);
      const px = this.randBetween(60, width - 200, i * 23 + 15);
      const pw = this.randBetween(120, 200, i * 17 + 8);
      this.addPlatform(px, py, pw, 20, 'underground_texture');
    }

    // Bonus: Lava cracks at bottom (cosmetic)
    const lavaG = this.scene.add.graphics().setDepth(3);
    lavaG.fillStyle(0xff4500, 0.18);
    lavaG.fillRect(0, height - 45, width, 25);
    lavaG.lineStyle(2, 0xff6b00, 0.5);
    lavaG.lineBetween(0, height - 45, width, height - 45);
    // Random lava cracks
    for (let i = 0; i < 5; i++) {
      const lx = this.randBetween(30, width - 30, i * 11 + 77);
      lavaG.lineStyle(1, 0xff4500, 0.4);
      lavaG.lineBetween(lx, height - 45, lx + this.randBetween(-20, 20, i * 7), height - 20);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private addPlatform(x: number, y: number, w: number, h: number, _texture: string): void {
    // Use mission-themed underground texture
    const ugTex = (this.scene.registry.get('mapUgTex') as string | undefined) ?? 'underground_texture';
    const plat = this.scene.add.tileSprite(x + w / 2, y, w, h, ugTex);
    this.scene.physics.add.existing(plat, true);
    this.platforms.add(plat);

    // Subtle drop shadow below platform
    const shadow = this.scene.add.graphics().setDepth(2);
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillRect(x, y + h, w, 6);
  }

  private addObstacle(
    cx: number, cy: number, w: number, h: number,
    fillColor: number, strokeColor: number, _emoji: string,
  ): void {
    // Draw crate/block graphic
    const g = this.scene.add.graphics().setDepth(8);
    g.fillStyle(fillColor, 1);
    g.fillRect(cx - w / 2, cy - h, w, h);
    g.lineStyle(2, strokeColor, 0.9);
    g.strokeRect(cx - w / 2, cy - h, w, h);
    // Cross detail
    g.lineStyle(1, strokeColor, 0.5);
    g.lineBetween(cx - w / 2, cy - h, cx + w / 2, cy);
    g.lineBetween(cx + w / 2, cy - h, cx - w / 2, cy);

    // Add physics body as a rectangle zone
    const zone = this.scene.add.zone(cx, cy - h / 2, w, h);
    this.scene.physics.add.existing(zone, true);
    this.platforms.add(zone as unknown as Phaser.GameObjects.GameObject);
  }
}

interface MapTheme {
  skyColor: number;
  undergroundColor: number;
  groundTint: number;
  undergroundAccent: number;
  label: string;
  subLabel: string;
}
