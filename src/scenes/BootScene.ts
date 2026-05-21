import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { HONGHUA_TEXTURE_KEY, FRAME_WIDTH, FRAME_HEIGHT } from '../animations/honghuaAnimations';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#111111');
    this.load.spritesheet(HONGHUA_TEXTURE_KEY, 'assets/honghua.png', {
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    });
  }

  create(): void {
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

    this.scene.start(SCENE_KEYS.intro);
  }
}
