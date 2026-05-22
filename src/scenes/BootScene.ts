import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { HONGHUA_TEXTURE_KEY, FRAME_WIDTH, FRAME_HEIGHT } from '../animations/honghuaAnimations';
import { GAME_BALANCE, RatFaction } from '../config/gameBalance';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#111111');

    const { width, height } = this.scale;
    const progressText = this.add.text(width / 2, height / 2, '正在載入遊戲資源... 0%', {
      fontFamily: '"Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressText.setText(`正在載入遊戲資源... ${Math.floor(value * 100)}%`);
    });

    this.load.on('complete', () => {
      progressText.destroy();
    });

    this.load.spritesheet(HONGHUA_TEXTURE_KEY, 'assets/honghua2.png', {
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    });

    // Preload custom pixel art sprites to replace procedural shapes
    this.load.image('rat', 'assets/rat.png');
    this.load.image('betel_nut', 'assets/betel_nut.png');
    this.load.image('trap_texture', 'assets/trap_bear.png');
    this.load.image('trap_cheese', 'assets/trap_cheese.png');
    this.load.image('trap_barricade', 'assets/trap_barricade.png');
    this.load.image('human_texture', 'assets/human.png');
    this.load.image('human_man', 'assets/human_man.png');
    this.load.image('human_woman', 'assets/human_woman.png');
    this.load.image('human_boy', 'assets/human_boy.png');
    this.load.image('human_girl', 'assets/human_girl.png');
    this.load.image('portal_texture', 'assets/portal.png');
    this.load.image('anzo_agent', 'assets/anzo_agent.png');
    this.load.image('police_car', 'assets/police_car.png');
    this.load.image('ground_texture', 'assets/ground.png');
    this.load.image('underground_texture', 'assets/underground.png');
    this.load.image('pipe_texture', 'assets/pipe.png');
    this.load.image('boss_texture', 'assets/boss.png');
    this.load.image('bubble_tea', 'assets/bubble_tea.png');
    this.load.image('betel_nut_box', 'assets/betel_nut_box.png');
    this.load.image('magnet', 'assets/magnet.png');
    // Taipei map for mission select screen
    this.load.image('taipei_map', 'assets/taipei_map.png');

    // Mission B – urban textures
    this.load.image('ground_b_texture', 'assets/ground_b.png');
    this.load.image('underground_b_texture', 'assets/underground_b.png');
    // Mission C – castle textures
    this.load.image('ground_c_texture', 'assets/ground_c.png');
    this.load.image('underground_c_texture', 'assets/underground_c.png');

    // Load background music (MP3) files
    this.load.audio('bgm_darkpip', 'assets/darkpip.mp3');
    this.load.audio('bgm_funny', 'assets/funny.mp3');
    this.load.audio('bgm_fun', 'assets/fun.mp3');
  }

  create(): void {
    // Generate colored textures dynamically from 'rat'
    const colorizeRat = (targetKey: string, targetR: number, targetG: number, targetB: number) => {
      const texture = this.textures.get('rat');
      const sourceImage = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      
      const canvas = document.createElement('canvas');
      canvas.width = sourceImage.width;
      canvas.height = sourceImage.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(sourceImage, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const targetMax = Math.max(targetR, targetG, targetB);
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        if (a < 10) {
          data[i + 3] = 0; // force fully transparent
          continue;
        }
        
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        
        const isSkin = r > g * 1.1 && r > b * 1.1 && lum > 50;
        const isOutline = lum < 50;
        
        if (isSkin || isOutline) {
          continue;
        }
        
        const blend = 0.85;
        const tR = (targetR / targetMax) * lum;
        const tG = (targetG / targetMax) * lum;
        const tB = (targetB / targetMax) * lum;
        
        data[i]     = Math.min(255, Math.max(0, r * (1 - blend) + tR * blend));
        data[i + 1] = Math.min(255, Math.max(0, g * (1 - blend) + tG * blend));
        data[i + 2] = Math.min(255, Math.max(0, b * (1 - blend) + tB * blend));
      }
      
      ctx.putImageData(imgData, 0, 0);
      if (this.textures.exists(targetKey)) {
        this.textures.remove(targetKey);
      }
      this.textures.addCanvas(targetKey, canvas);
    };

    const profiles = GAME_BALANCE.rat.profiles;
    for (const faction of Object.keys(profiles) as RatFaction[]) {
      const p = profiles[faction];
      colorizeRat(`rat_${faction}`, p.colorR, p.colorG, p.colorB);
    }

    // Persistent stats (Lobby system)
    if (localStorage.getItem('honghua_gold') === null) {
      localStorage.setItem('honghua_gold', '200');
    }
    if (localStorage.getItem('honghua_reputation') === null) {
      localStorage.setItem('honghua_reputation', '100');
    }
    
    const defaultUpgrades = {
      broomDamage: 1,
      bearTrapDamage: 1,
      cheeseDurability: 1,
      barricadeDurability: 1,
      baoYeShield: 1
    };
    if (localStorage.getItem('honghua_upgrades') === null) {
      localStorage.setItem('honghua_upgrades', JSON.stringify(defaultUpgrades));
    }

    const gold = parseInt(localStorage.getItem('honghua_gold') ?? '200', 10);
    const rep = parseInt(localStorage.getItem('honghua_reputation') ?? '100', 10);
    const upgrades = JSON.parse(localStorage.getItem('honghua_upgrades') ?? '{}');

    this.registry.set('persistent_gold', gold);
    this.registry.set('persistent_reputation', rep);
    this.registry.set('upgrades', upgrades);

    // Level-specific temporary scores
    this.registry.set('reputationScore', 0);
    this.registry.set('ratKills', 0);
    this.registry.set('scaredHumans', 0);
    this.registry.set('levelTimeLeft', 0);
    this.registry.set('bossActive', false);

    // Default selected mission (Mission A)
    this.registry.set('selectedMission', {
      id: 'A',
      name: '下水道的騷動',
      duration: 60,
      spawnRateMult: 1.0,
      goldReward: 150,
      repReward: 20
    });

    // Programmatically generate a beautiful pixel-art gold coin texture
    if (this.textures.exists('gold_coin')) {
      this.textures.remove('gold_coin');
    }
    const coinCanvas = this.textures.createCanvas('gold_coin', 16, 16);
    if (coinCanvas) {
      const coinCtx = coinCanvas.context;
      coinCtx.beginPath();
      coinCtx.arc(8, 8, 7, 0, Math.PI * 2);
      coinCtx.fillStyle = '#ffb703';
      coinCtx.fill();
      coinCtx.strokeStyle = '#fb8500';
      coinCtx.lineWidth = 1.5;
      coinCtx.stroke();
      
      coinCtx.beginPath();
      coinCtx.arc(8, 8, 4, 0, Math.PI * 2);
      coinCtx.strokeStyle = '#ffb703';
      coinCtx.lineWidth = 1;
      coinCtx.stroke();
      coinCanvas.refresh();
    }

    this.scene.start(SCENE_KEYS.intro);
  }
}
