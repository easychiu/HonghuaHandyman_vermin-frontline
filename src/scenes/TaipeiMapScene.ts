import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { AudioSystem } from '../systems/AudioSystem';

/**
 * TaipeiMapScene — 台北大地圖選關場景
 *
 * 顯示台北市全覽像素地圖，玩家點擊地標 Pin 選擇任務。
 * 每個 Pin 對應一個台北知名地點（鼠患嚴重場所）。
 */

interface MissionPin {
  id: string;
  name: string;
  area: string;           // 地區說明
  emoji: string;
  x: number;             // 在地圖上的相對位置 (0~1)
  y: number;
  difficulty: string;
  stars: number;          // 1-5
  duration: number;       // seconds
  spawnRateMult: number;
  goldReward: number;
  repReward: number;
  description: string;
  mapTheme: string;       // 'A' | 'B' | 'C'
}

const MISSIONS: MissionPin[] = [
  {
    id: 'A',
    name: '饒河夜市',
    area: '松山區・饒河街觀光夜市',
    emoji: '🍢',
    x: 0.63,
    y: 0.48,
    difficulty: '★☆☆☆☆',
    stars: 1,
    duration: 60,
    spawnRateMult: 1.0,
    goldReward: 150,
    repReward: 20,
    description: '饒河夜市的下水道老鼠猖獗，食攤附近都是洞穴！\n簡單入門任務，適合初學者試手。',
    mapTheme: 'A',
  },
  {
    id: 'B',
    name: '士林夜市',
    area: '士林區・地下美食廣場',
    emoji: '🦑',
    x: 0.40,
    y: 0.22,
    difficulty: '★★★☆☆',
    stars: 3,
    duration: 75,
    spawnRateMult: 1.4,
    goldReward: 350,
    repReward: 40,
    description: '士林夜市地下美食廣場，鼠輩橫行、氣味誘鼠。\n人流極大，清除時注意勿嚇到市民！',
    mapTheme: 'B',
  },
  {
    id: 'C',
    name: '台北地下街',
    area: '中正區・台北車站地下商城',
    emoji: '🚇',
    x: 0.38,
    y: 0.52,
    difficulty: '★★★★☆',
    stars: 4,
    duration: 90,
    spawnRateMult: 1.7,
    goldReward: 500,
    repReward: 65,
    description: '台北車站地下街，四通八達的隧道是鼠群最愛的巢穴。\n迷宮般的通道讓藍鼠軍團難以追蹤！',
    mapTheme: 'C',
  },
  {
    id: 'D',
    name: '萬華龍山寺',
    area: '萬華區・艋舺夜市周邊',
    emoji: '🏮',
    x: 0.26,
    y: 0.65,
    difficulty: '★★★★★',
    stars: 5,
    duration: 90,
    spawnRateMult: 2.0,
    goldReward: 600,
    repReward: 80,
    description: '萬華百年老城，地下排水系統老舊破損。\n最高難度！綠鼠藍鼠聯手出擊，巨型 BOSS 坐鎮！',
    mapTheme: 'C',
  },
];

export class TaipeiMapScene extends Phaser.Scene {
  private selectedPin: MissionPin = MISSIONS[0];
  private pinObjects: Array<{ pin: MissionPin; container: Phaser.GameObjects.Container }> = [];
  private infoCard?: Phaser.GameObjects.Container;
  private scanline?: Phaser.GameObjects.Graphics;

  constructor() {
    super(SCENE_KEYS.taipeiMap);
  }

  preload(): void {
    if (!this.textures.exists('taipei_map')) {
      this.load.image('taipei_map', 'assets/taipei_map.png');
    }
  }

  create(): void {
    // Start Taipei Map BGM (fun)
    AudioSystem.playBgm(this, 'bgm_fun');

    const { width, height } = this.scale;

    // Restore previously selected mission if any
    const prev = this.registry.get('selectedMission') as { id?: string } | undefined;
    if (prev?.id) {
      this.selectedPin = MISSIONS.find(m => m.id === prev.id) ?? MISSIONS[0];
    }

    // ── Map background ───────────────────────────────────────────────────
    this.add.image(width / 2, height / 2, 'taipei_map')
      .setDisplaySize(width, height)
      .setDepth(0);

    // Dark vignette overlay
    const vignette = this.add.graphics().setDepth(1);
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0.6, 0, 0);
    vignette.fillRect(0, 0, width, height);

    // CRT scanline effect
    this.scanline = this.add.graphics().setDepth(10).setAlpha(0.04);
    for (let y = 0; y < height; y += 3) {
      this.scanline.lineStyle(1, 0x000000, 1);
      this.scanline.lineBetween(0, y, width, y);
    }

    // ── Title bar ────────────────────────────────────────────────────────
    const titleBg = this.add.graphics().setDepth(5);
    titleBg.fillStyle(0x000000, 0.7);
    titleBg.fillRect(0, 0, width, 48);
    titleBg.lineStyle(1, 0xa855f7, 0.8);
    titleBg.lineBetween(0, 48, width, 48);

    this.add.text(width / 2, 24, '📍 台北市・委託地圖', {
      fontFamily: '"Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(6);

    // Subtitle
    this.add.text(20, 24, '紅花萬事屋・外勤作戰', {
      fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
      fontSize: '13px',
      color: '#a855f7',
    }).setOrigin(0, 0.5).setDepth(6);

    // ── Back button ───────────────────────────────────────────────────────
    const backBtn = this.add.text(width - 20, 24, '← 返回營地', {
      fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
      backgroundColor: '#1e293b88',
      padding: { x: 10, y: 5 },
    }).setOrigin(1, 0.5).setDepth(6).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#94a3b8'));
    backBtn.on('pointerdown', () => {
      AudioSystem.playClick();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.stop();
        this.scene.start(SCENE_KEYS.lobby);
      });
    });

    // ── Mission pins ──────────────────────────────────────────────────────
    MISSIONS.forEach((pin, i) => {
      this.createPin(pin, i);
    });

    // ── Info card (bottom) ────────────────────────────────────────────────
    this.createInfoCard();
    this.updateInfoCard(this.selectedPin);

    // ── Start mission button ──────────────────────────────────────────────
    this.createStartButton();

    // Fade in
    this.cameras.main.fadeIn(400);

    // Animated scanline scroll
    this.tweens.add({
      targets: this.scanline,
      alpha: 0.07,
      yoyo: true,
      duration: 2000,
      repeat: -1,
    });
  }

  // ─── Pin creation ─────────────────────────────────────────────────────────

  private createPin(pin: MissionPin, _index: number): void {
    const { width, height } = this.scale;
    const px = pin.x * width;
    const py = pin.y * height;

    const container = this.add.container(px, py).setDepth(20);

    // Pulse ring (always visible)
    const ring = this.add.graphics();
    ring.lineStyle(2, this.starColor(pin.stars), 0.7);
    ring.strokeCircle(0, 0, 22);
    container.add(ring);

    this.tweens.add({
      targets: ring,
      scaleX: 1.6,
      scaleY: 1.6,
      alpha: 0,
      duration: 1400,
      repeat: -1,
      delay: _index * 300,
    });

    // Pin background circle
    const isSelected = pin.id === this.selectedPin.id;
    const pinBg = this.add.graphics();
    pinBg.fillStyle(isSelected ? this.starColor(pin.stars) : 0x000000, isSelected ? 0.9 : 0.75);
    pinBg.fillCircle(0, 0, 18);
    pinBg.lineStyle(2, this.starColor(pin.stars), 1);
    pinBg.strokeCircle(0, 0, 18);
    container.add(pinBg);

    // Emoji label
    const emojiText = this.add.text(0, 0, pin.emoji, {
      fontSize: '16px',
    }).setOrigin(0.5);
    container.add(emojiText);

    // Location name label below pin
    const nameLabel = this.add.text(0, 26, pin.name, {
      fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
      fontSize: '11px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 0);
    container.add(nameLabel);

    // Difficulty stars beneath name
    const starsStr = '★'.repeat(pin.stars) + '☆'.repeat(5 - pin.stars);
    const starsLabel = this.add.text(0, 43, starsStr, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: this.starColorHex(pin.stars),
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0);
    container.add(starsLabel);

    // Interactive hit area
    const hitZone = this.add.zone(0, 0, 44, 44).setInteractive({ useHandCursor: true });
    container.add(hitZone);

    hitZone.on('pointerover', () => {
      this.tweens.add({ targets: container, scaleX: 1.2, scaleY: 1.2, duration: 150, ease: 'Back.Out' });
    });
    hitZone.on('pointerout', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 150 });
    });
    hitZone.on('pointerdown', () => {
      this.selectPin(pin);
    });

    this.pinObjects.push({ pin, container });
  }

  private selectPin(pin: MissionPin): void {
    AudioSystem.playClick();
    this.selectedPin = pin;

    // Redraw all pins to update selected state
    this.pinObjects.forEach(({ pin: p, container }) => {
      const bg = container.getAt(1) as Phaser.GameObjects.Graphics;
      bg.clear();
      const sel = p.id === pin.id;
      bg.fillStyle(sel ? this.starColor(p.stars) : 0x000000, sel ? 0.9 : 0.75);
      bg.fillCircle(0, 0, 18);
      bg.lineStyle(2, this.starColor(p.stars), 1);
      bg.strokeCircle(0, 0, 18);

      if (sel) {
        this.tweens.add({
          targets: container,
          scaleX: 1.25, scaleY: 1.25,
          duration: 200, ease: 'Back.Out',
          yoyo: true, hold: 100,
        });
      }
    });

    this.updateInfoCard(pin);
  }

  // ─── Info card ────────────────────────────────────────────────────────────

  private createInfoCard(): void {
    const { width, height } = this.scale;

    this.infoCard = this.add.container(0, height - 138).setDepth(30);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x000000, 0.82);
    cardBg.fillRect(0, 0, width, 138);
    cardBg.lineStyle(1, 0xa855f7, 0.5);
    cardBg.lineBetween(0, 0, width, 0);
    this.infoCard.add(cardBg);
  }

  private updateInfoCard(pin: MissionPin): void {
    if (!this.infoCard) return;

    // Remove old children except background (index 0)
    while (this.infoCard.length > 1) {
      const child = this.infoCard.getAt(this.infoCard.length - 1) as Phaser.GameObjects.GameObject;
      child.destroy();
    }

    const { width } = this.scale;
    const col1 = 24;
    const col2 = width / 2 + 20;

    // Left col: mission name + area + description
    this.infoCard.add(this.make.text({
      x: col1, y: 14,
      text: `${pin.emoji} ${pin.name}`,
      style: {
        fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
        fontSize: '22px',
        color: this.starColorHex(pin.stars),
        stroke: '#000000',
        strokeThickness: 4,
      },
      add: false,
    }));

    this.infoCard.add(this.make.text({
      x: col1, y: 42,
      text: `📌 ${pin.area}`,
      style: {
        fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
        fontSize: '13px',
        color: '#94a3b8',
      },
      add: false,
    }));

    this.infoCard.add(this.make.text({
      x: col1, y: 62,
      text: pin.description,
      style: {
        fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
        fontSize: '12px',
        color: '#cbd5e1',
        wordWrap: { width: width / 2 - 40 },
      },
      add: false,
    }));

    // Right col: stats
    const starsStr = '★'.repeat(pin.stars) + '☆'.repeat(5 - pin.stars);
    const statsLines = [
      `難度　 ${starsStr}  (${pin.difficulty})`,
      `作戰時間　 ${pin.duration} 秒`,
      `鼠群倍率　 ×${pin.spawnRateMult.toFixed(1)}`,
      ``,
      `🪙 報酬　 ${pin.goldReward} G`,
      `🏆 聲望　 +${pin.repReward}`,
    ];

    statsLines.forEach((line, i) => {
      this.infoCard!.add(this.make.text({
        x: col2, y: 14 + i * 18,
        text: line,
        style: {
          fontFamily: '"Microsoft JhengHei", "Courier New", monospace',
          fontSize: '13px',
          color: i >= 4 ? '#ffd166' : '#e2e8f0',
        },
        add: false,
      }));
    });

    // Animated entrance
    this.tweens.add({
      targets: this.infoCard,
      alpha: { from: 0, to: 1 },
      duration: 200,
    });
  }

  // ─── Start button ─────────────────────────────────────────────────────────

  private createStartButton(): void {
    const { width, height } = this.scale;
    const btnW = 200;
    const btnH = 44;
    const btnX = width - 240;
    const btnY = height - 68;

    const btnBg = this.add.graphics().setDepth(35);
    const drawBtn = (hover: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(hover ? 0x06d6a0 : 0x059669, 0.95);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      if (hover) {
        btnBg.lineStyle(2, 0xffffff, 0.4);
        btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      }
    };
    drawBtn(false);

    const btnText = this.add.text(btnX + btnW / 2, btnY + btnH / 2, '⚔️  出發任務！', {
      fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(36);

    const hitZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true })
      .setDepth(37);

    hitZone.on('pointerover', () => { drawBtn(true); btnText.setScale(1.04); });
    hitZone.on('pointerout', () => { drawBtn(false); btnText.setScale(1); });
    hitZone.on('pointerdown', () => {
      this.startMission();
    });

    // Pulse glow
    this.tweens.add({
      targets: btnBg,
      alpha: 0.8,
      yoyo: true,
      duration: 900,
      repeat: -1,
    });
  }

  private startMission(): void {
    AudioSystem.playClick();
    const pin = this.selectedPin;

    this.registry.set('selectedMission', {
      id: pin.mapTheme,          // 地圖主題給 MainGameScene 用
      missionId: pin.id,         // 真實任務 ID
      name: pin.name,
      duration: pin.duration,
      spawnRateMult: pin.spawnRateMult,
      goldReward: pin.goldReward,
      repReward: pin.repReward,
    });

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop();
      this.scene.start(SCENE_KEYS.ready);
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private starColor(stars: number): number {
    if (stars >= 5) return 0xff3333;
    if (stars >= 4) return 0xff9f1c;
    if (stars >= 3) return 0xffd166;
    if (stars >= 2) return 0x06d6a0;
    return 0x3b82f6;
  }

  private starColorHex(stars: number): string {
    if (stars >= 5) return '#ff3333';
    if (stars >= 4) return '#ff9f1c';
    if (stars >= 3) return '#ffd166';
    if (stars >= 2) return '#06d6a0';
    return '#3b82f6';
  }
}
