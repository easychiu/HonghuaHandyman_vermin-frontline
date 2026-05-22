import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { AudioSystem } from '../systems/AudioSystem';

interface Mission {
  id: 'A' | 'B' | 'C';
  name: string;
  difficulty: string;
  duration: number;
  spawnRateMult: number;
  goldReward: number;
  repReward: number;
  description: string;
}

interface Upgrades {
  broomDamage: number;
  bearTrapDamage: number;
  cheeseDurability: number;
  barricadeDurability: number;
  baoYeShield: number;
}

export class YorozuyaLobbyScene extends Phaser.Scene {
  private particles: Array<{
    sprite: Phaser.GameObjects.Arc;
    vx: number;
    vy: number;
  }> = [];

  private goldText!: Phaser.GameObjects.Text;
  private repText!: Phaser.GameObjects.Text;

  private selectedMissionId: 'A' | 'B' | 'C' = 'A';
  private missionDescText!: Phaser.GameObjects.Text;
  private missionRewardText!: Phaser.GameObjects.Text;
  private missionDiffText!: Phaser.GameObjects.Text;

  private upgradeItems: Array<{
    key: keyof Upgrades;
    name: string;
    description: string;
    levels: Array<{ value: number; cost: number }>;
  }> = [];

  private missions: Mission[] = [
    {
      id: 'A',
      name: '下水道的騷動',
      difficulty: '★☆☆☆☆ (輕鬆)',
      duration: 60,
      spawnRateMult: 1.0,
      goldReward: 150,
      repReward: 20,
      description: '地下下水道的老鼠數量激增，似乎有外來老鼠在擴張地盤。請紅花前往清除！'
    },
    {
      id: 'B',
      name: '平民區的鼠群危機',
      difficulty: '★★★☆☆ (普通)',
      duration: 75,
      spawnRateMult: 1.4,
      goldReward: 350,
      repReward: 40,
      description: '地面上的民宅出現鼠隻。在清除鼠群的同時，特別要注意別嚇壞在人行道上散步的居民！'
    },
    {
      id: 'C',
      name: '國王城堡的地下防線',
      difficulty: '★★★★★ (極難)',
      duration: 90,
      spawnRateMult: 1.8,
      goldReward: 600,
      repReward: 80,
      description: '大量的綠鼠與在地藍鼠爆發全面衝突，並伴隨巨型老鼠首領出沒！最高危險任務！'
    }
  ];

  constructor() {
    super(SCENE_KEYS.lobby);
  }

  init(): void {
    // Read the current selected mission id from registry to keep selection consistent
    const currentMission = this.registry.get('selectedMission') as Mission | undefined;
    if (currentMission) {
      this.selectedMissionId = currentMission.id;
    }

    // Define the upgrades configurations
    this.upgradeItems = [
      {
        key: 'broomDamage',
        name: '🧹 掃除掃帚',
        description: '增加主角普通攻擊傷害',
        levels: [
          { value: 1.0, cost: 0 },
          { value: 1.5, cost: 150 },
          { value: 2.2, cost: 300 }
        ]
      },
      {
        key: 'bearTrapDamage',
        name: '⚙️ 鋼牙捕鼠夾',
        description: '大幅提升捕鼠夾單次傷害',
        levels: [
          { value: 2.0, cost: 0 },
          { value: 3.5, cost: 120 },
          { value: 5.0, cost: 250 }
        ]
      },
      {
        key: 'cheeseDurability',
        name: '🧀 頂級誘餌起司',
        description: '增加起司可以被老鼠啃食的次數',
        levels: [
          { value: 3, cost: 0 },
          { value: 4, cost: 100 },
          { value: 6, cost: 200 }
        ]
      },
      {
        key: 'barricadeDurability',
        name: '🚧 加厚防禦路障',
        description: '提高路障的耐咬程度',
        levels: [
          { value: 4, cost: 0 },
          { value: 6, cost: 100 },
          { value: 9, cost: 220 }
        ]
      },
      {
        key: 'baoYeShield',
        name: '🍃 護身包葉檳榔',
        description: '增加護盾可抵擋傷害的次數',
        levels: [
          { value: 3, cost: 0 },
          { value: 5, cost: 130 },
          { value: 8, cost: 240 }
        ]
      }
    ];
  }

  create(): void {
    // Start Lobby BGM (funny)
    AudioSystem.playBgm(this, 'bgm_funny');

    const { width, height } = this.scale;

    // Background color
    this.cameras.main.setBackgroundColor('#090d16');

    // Create background particles
    this.particles = [];
    for (let i = 0; i < 25; i++) {
      const radius = Phaser.Math.Between(2, 5);
      const color = Phaser.Utils.Array.GetRandom([0xa855f7, 0x3b82f6, 0xec4899]);
      const p = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        radius,
        color,
        Phaser.Math.FloatBetween(0.1, 0.3)
      );
      this.particles.push({
        sprite: p,
        vx: Phaser.Math.FloatBetween(-10, 10),
        vy: Phaser.Math.FloatBetween(-20, -5),
      });
    }

    // Header layout
    this.add.text(40, 25, '紅花萬事屋 總部營地', {
      color: '#ffffff',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '24px',
      fontWeight: 'bold'
    }).setShadow(0, 0, '#a855f7', 8, true, true);

    const gold = this.registry.get('persistent_gold') as number;
    const rep = this.registry.get('persistent_reputation') as number;

    this.goldText = this.add.text(width - 340, 28, `🪙 金幣: ${gold} G`, {
      color: '#ffd166',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '16px',
      fontWeight: 'bold'
    });

    this.repText = this.add.text(width - 190, 28, `🏆 國王聲望: ${rep}`, {
      color: '#06d6a0',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '16px',
      fontWeight: 'bold'
    });

    // Dividers
    const headerLine = this.add.graphics();
    headerLine.lineStyle(2, 0xa855f7, 0.4);
    headerLine.lineBetween(30, 65, width - 30, 65);

    // Left Panel: Map Select Button + Current Mission Preview
    this.createMapSelectPanel(30, 85, 430, 420);

    // Right Panel: Upgrades
    this.createUpgradesPanel(490, 85, 440, 420);

    // Bottom: Mission History Board
    this.createMissionHistoryPanel(30, 520, width - 60, 80);
  }

  private createMapSelectPanel(x: number, y: number, w: number, h: number): void {
    // Panel background
    const bg = this.add.graphics();
    bg.fillStyle(0x111625, 0.75);
    bg.lineStyle(1, 0xa855f7, 0.4);
    bg.fillRoundedRect(x, y, w, h, 12);
    bg.strokeRoundedRect(x, y, w, h, 12);

    this.add.text(x + 20, y + 18, '🗺 任務地圖・台北市', {
      color: '#a855f7',
      fontFamily: '"Microsoft JhengHei", "Outfit", Arial, sans-serif',
      fontSize: '18px',
      fontWeight: 'bold',
    });

    // Map preview image (mini Taipei map)
    const previewImg = this.add.image(x + w / 2, y + 155, 'taipei_map')
      .setDisplaySize(w - 40, 195)
      .setAlpha(0.7);

    // Vignette over preview
    const previewVig = this.add.graphics();
    previewVig.fillStyle(0x000000, 0.35);
    previewVig.fillRoundedRect(x + 20, y + 57, w - 40, 195, 6);

    // Location pins preview (decorative dots)
    const pins = [
      { rx: 0.63, ry: 0.48, color: 0x3b82f6 },   // 饒河
      { rx: 0.40, ry: 0.22, color: 0xffd166 },   // 士林
      { rx: 0.38, ry: 0.52, color: 0xff9f1c },   // 地下街
      { rx: 0.26, ry: 0.65, color: 0xff3333 },   // 萬華
    ];
    const previewW = w - 40;
    const previewH = 195;
    const previewX = x + 20;
    const previewY = y + 57;

    pins.forEach(p => {
      const px = previewX + p.rx * previewW;
      const py = previewY + p.ry * previewH;
      const dot = this.add.graphics();
      dot.fillStyle(p.color, 1);
      dot.fillCircle(px, py, 5);
      dot.lineStyle(1, 0xffffff, 0.6);
      dot.strokeCircle(px, py, 5);

      this.tweens.add({
        targets: dot,
        scaleX: 1.8,
        scaleY: 1.8,
        alpha: 0.3,
        yoyo: true,
        duration: 900 + Math.random() * 400,
        repeat: -1,
      });
    });

    // Current mission info strip
    const mission = this.registry.get('selectedMission') as Record<string, unknown> | undefined;
    const missionName = (mission?.name as string | undefined) ?? '未選擇';
    const missionId   = (mission?.missionId as string | undefined) ?? '';

    const diffMap: Record<string, string> = { A: '★☆☆☆☆', B: '★★★☆☆', C: '★★★★☆', D: '★★★★★' };
    const colorMap: Record<string, string> = { A: '#3b82f6', B: '#ffd166', C: '#ff9f1c', D: '#ff3333' };

    const stripBg = this.add.graphics();
    stripBg.fillStyle(0x0f172a, 0.9);
    stripBg.fillRoundedRect(x + 20, y + 262, w - 40, 50, 6);

    this.add.text(x + 35, y + 274, '📍 已選擇任務：', {
      fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
      fontSize: '12px',
      color: '#64748b',
    });
    this.add.text(x + 35, y + 292, missionName || '（尚未選擇，請打開地圖）', {
      fontFamily: '"Microsoft JhengHei", Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: colorMap[missionId] ?? '#94a3b8',
    });
    if (missionId) {
      this.add.text(x + w - 60, y + 285, diffMap[missionId] ?? '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: colorMap[missionId] ?? '#94a3b8',
      }).setOrigin(1, 0.5);
    }

    // Big "打開大地圖" button
    const btnY = y + 330;
    const btnBg = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(hover ? 0xa855f7 : 0x7c3aed, 0.95);
      btnBg.fillRoundedRect(x + 20, btnY, w - 40, 52, 10);
      if (hover) {
        btnBg.lineStyle(2, 0xffffff, 0.3);
        btnBg.strokeRoundedRect(x + 20, btnY, w - 40, 52, 10);
      }
    };
    drawBtn(false);

    const btnTxt = this.add.text(x + w / 2, btnY + 26, '🗺  打開台北大地圖', {
      fontFamily: '"Microsoft JhengHei", "Outfit", Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const btnHit = this.add.zone(x + w / 2, btnY + 26, w - 40, 52).setInteractive({ useHandCursor: true });
    btnHit.on('pointerover', () => { drawBtn(true); btnTxt.setScale(1.05); });
    btnHit.on('pointerout', () => { drawBtn(false); btnTxt.setScale(1); });
    btnHit.on('pointerdown', () => {
      AudioSystem.playClick();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENE_KEYS.taipeiMap);
      });
    });

    // Pulse glow on button
    this.tweens.add({
      targets: btnBg,
      alpha: 0.75,
      yoyo: true,
      duration: 1100,
      repeat: -1,
    });

    // Suppress unused variable warnings
    void previewImg;
    void previewVig;
  }

  private createMissionHistoryPanel(x: number, y: number, w: number, h: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.7);
    bg.lineStyle(1, 0xa855f7, 0.3);
    bg.fillRoundedRect(x, y, w, h, 8);
    bg.strokeRoundedRect(x, y, w, h, 8);

    this.add.text(x + 20, y + 10, '📋 過往任務記錄', {
      color: '#a855f7',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '14px',
      fontWeight: 'bold',
    });

    const historyRaw = localStorage.getItem('honghua_mission_history') ?? '[]';
    const history: Array<{ mission: string; evaluation: string; kills: number; gold: number }> =
      JSON.parse(historyRaw);

    if (history.length === 0) {
      this.add.text(x + 20, y + 35, '尚無記錄 — 快去接下第一個委託！', {
        color: '#475569',
        fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '13px',
      });
      return;
    }

    const evalColors: Record<string, string> = {
      S: '#ffd166', A: '#06d6a0', B: '#3b82f6', C: '#94a3b8', F: '#ef4444',
    };

    history.forEach((rec, i) => {
      const col = x + 20 + i * (w / 3);
      const c = evalColors[rec.evaluation] ?? '#ffffff';
      this.add.text(col, y + 32, `${rec.mission}`, {
        color: '#cbd5e1',
        fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '11px',
      });
      this.add.text(col, y + 48, `評價: `, {
        color: '#94a3b8',
        fontFamily: '"Inter", Arial, sans-serif',
        fontSize: '11px',
      });
      this.add.text(col + 38, y + 48, rec.evaluation, {
        color: c,
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
      });
      this.add.text(col + 62, y + 48, `  擊殺: ${rec.kills}  +${rec.gold}G`, {
        color: '#94a3b8',
        fontFamily: '"Inter", Arial, sans-serif',
        fontSize: '11px',
      });
    });
  }

  private createCommissionsPanel(x: number, y: number, w: number, h: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x111625, 0.75);
    bg.lineStyle(1, 0x3b82f6, 0.4);
    bg.fillRoundedRect(x, y, w, h, 12);
    bg.strokeRoundedRect(x, y, w, h, 12);

    this.add.text(x + 20, y + 18, '👑 接受國王委託 (Commissions)', {
      color: '#00ffff',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '18px',
      fontWeight: 'bold'
    });

    // Draw Mission Buttons
    this.missions.forEach((m, idx) => {
      const btnY = y + 55 + idx * 56;
      
      const btnBg = this.add.graphics();
      btnBg.fillStyle(m.id === this.selectedMissionId ? 0x1e293b : 0x0f172a, 0.9);
      btnBg.lineStyle(1.5, m.id === this.selectedMissionId ? 0x00ffff : 0x3b82f6, m.id === this.selectedMissionId ? 0.8 : 0.3);
      btnBg.fillRoundedRect(x + 20, btnY, w - 40, 46, 8);
      btnBg.strokeRoundedRect(x + 20, btnY, w - 40, 46, 8);

      const t1 = this.add.text(x + 40, btnY + 14, m.name, {
        color: m.id === this.selectedMissionId ? '#00ffff' : '#ffffff',
        fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold'
      });

      const t2 = this.add.text(x + w - 150, btnY + 14, m.difficulty, {
        color: m.id === this.selectedMissionId ? '#00ffff' : '#94a3b8',
        fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '12px'
      });

      // Click to select
      const hitArea = this.add.zone(x + 20 + (w - 40) / 2, btnY + 23, w - 40, 46);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        AudioSystem.playClick();
        this.selectedMissionId = m.id;
        this.registry.set('selectedMission', m);
        
        // Refresh panel
        this.cameras.main.flash(100, 0, 255, 255, true);
        this.scene.restart();
      });
    });

    // Detail Panel
    const detailY = y + 235;
    const detailH = 110;
    const detailBg = this.add.graphics();
    detailBg.fillStyle(0x0f172a, 0.8);
    detailBg.fillRoundedRect(x + 20, detailY, w - 40, detailH, 8);

    const activeMission = this.missions.find(m => m.id === this.selectedMissionId) || this.missions[0];

    this.missionDescText = this.add.text(x + 35, detailY + 15, activeMission.description, {
      color: '#94a3b8',
      fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '12px',
      wordWrap: { width: w - 70 },
      lineSpacing: 4
    });

    this.missionRewardText = this.add.text(x + 35, detailY + 75, `報酬: 🪙 ${activeMission.goldReward} G  |  🏆 聲望 +${activeMission.repReward}  |  時間: ${activeMission.duration}秒`, {
      color: '#ffd166',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '13px',
      fontWeight: 'bold'
    });

    // Start Button
    const startBtn = this.add.graphics();
    startBtn.fillStyle(0x06d6a0, 0.95);
    startBtn.fillRoundedRect(x + 20, y + 355, w - 40, 45, 8);

    const startBtnText = this.add.text(x + w / 2, y + 377, '⚔️ 開始任務 (Start Mission)', {
      color: '#090d16',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '16px',
      fontWeight: 'bold'
    }).setOrigin(0.5);

    const startHit = this.add.zone(x + 20 + (w - 40) / 2, y + 355 + 22, w - 40, 45);
    startHit.setInteractive({ useHandCursor: true });
    startHit.on('pointerdown', () => {
      AudioSystem.playClick();
      startBtn.fillStyle(0x05b88a, 0.95);
      startBtnText.setScale(0.95);
      
      this.cameras.main.fadeOut(500, 9, 13, 22);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENE_KEYS.ready);
      });
    });
  }

  private createUpgradesPanel(x: number, y: number, w: number, h: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x111625, 0.75);
    bg.lineStyle(1, 0xa855f7, 0.4);
    bg.fillRoundedRect(x, y, w, h, 12);
    bg.strokeRoundedRect(x, y, w, h, 12);

    this.add.text(x + 20, y + 18, '🔧 萬事屋工作坊 (Upgrades)', {
      color: '#a855f7',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '18px',
      fontWeight: 'bold'
    });

    const upgrades = this.registry.get('upgrades') as Upgrades;
    const gold = this.registry.get('persistent_gold') as number;

    this.upgradeItems.forEach((item, idx) => {
      const itemY = y + 55 + idx * 70;
      const currentLv = upgrades[item.key] || 1;

      // Draw item info
      this.add.text(x + 20, itemY, item.name, {
        color: '#ffffff',
        fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '13px',
        fontWeight: 'bold'
      });

      this.add.text(x + 20, itemY + 18, item.description, {
        color: '#64748b',
        fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '11px'
      });

      const maxLevel = item.levels.length;
      let lvString = `Lv. ${currentLv}`;
      let costString = '';
      let isMax = currentLv >= maxLevel;

      if (isMax) {
        lvString = 'Lv. MAX 🌟';
        costString = '已滿級';
      } else {
        const nextCost = item.levels[currentLv].cost;
        costString = `Cost: ${nextCost}G`;
      }

      this.add.text(x + 190, itemY + 2, lvString, {
        color: isMax ? '#06d6a0' : '#a855f7',
        fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '12px',
        fontWeight: 'bold'
      });

      this.add.text(x + 190, itemY + 18, costString, {
        color: '#ffd166',
        fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
        fontSize: '11px'
      });

      // Buy Button
      if (!isMax) {
        const nextCost = item.levels[currentLv].cost;
        const canAfford = gold >= nextCost;

        const btn = this.add.graphics();
        btn.fillStyle(canAfford ? 0xa855f7 : 0x475569, 0.85);
        btn.fillRoundedRect(x + w - 95, itemY + 2, 75, 28, 6);

        const btnTxt = this.add.text(x + w - 57, itemY + 16, '升級', {
          color: '#ffffff',
          fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
          fontSize: '11px',
          fontWeight: 'bold'
        }).setOrigin(0.5);

        if (canAfford) {
          const hit = this.add.zone(x + w - 95 + 37, itemY + 2 + 14, 75, 28);
          hit.setInteractive({ useHandCursor: true });
          hit.on('pointerdown', () => {
            // Purchase processing
            const newGold = gold - nextCost;
            upgrades[item.key] = currentLv + 1;
            
            // Save persistent values
            localStorage.setItem('honghua_gold', newGold.toString());
            localStorage.setItem('honghua_upgrades', JSON.stringify(upgrades));

            this.registry.set('persistent_gold', newGold);
            this.registry.set('upgrades', upgrades);

            AudioSystem.playUpgradeSuccess();

            // Audio-visual feedback
            this.cameras.main.flash(200, 168, 85, 247, true);
            this.scene.restart();
          });
        }
      } else {
        const btn = this.add.graphics();
        btn.fillStyle(0x1e293b, 0.85);
        btn.fillRoundedRect(x + w - 95, itemY + 2, 75, 28, 6);

        this.add.text(x + w - 57, itemY + 16, 'MAX', {
          color: '#06d6a0',
          fontFamily: '"Inter", "Microsoft JhengHei", Arial, sans-serif',
          fontSize: '11px',
          fontWeight: 'bold'
        }).setOrigin(0.5);
      }

      // Separator between items
      if (idx < this.upgradeItems.length - 1) {
        const separator = this.add.graphics();
        separator.lineStyle(1, 0xffffff, 0.05);
        separator.lineBetween(x + 15, itemY + 45, x + w - 15, itemY + 45);
      }
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
