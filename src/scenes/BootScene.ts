import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { HONGHUA_TEXTURE_KEY, FRAME_WIDTH, FRAME_HEIGHT } from '../animations/honghuaAnimations';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#111111');
    this.load.spritesheet(HONGHUA_TEXTURE_KEY, 'assets/honghua2.png', {
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
    });

    // Preload custom pixel art sprites to replace procedural shapes
    this.load.image('rat', 'assets/rat.png');
    this.load.image('rat_green', 'assets/rat_green.png');
    this.load.image('rat_blue', 'assets/rat_blue.png');
    this.load.image('betel_nut', 'assets/betel_nut.png');
    this.load.image('trap_texture', 'assets/trap_bear.png');
    this.load.image('trap_cheese', 'assets/trap_cheese.png');
    this.load.image('trap_barricade', 'assets/trap_barricade.png');
    this.load.image('human_texture', 'assets/human.png');
    this.load.image('portal_texture', 'assets/portal.png');
    this.load.image('anzo_agent', 'assets/anzo_agent.png');
    this.load.image('police_car', 'assets/police_car.png');
    this.load.image('ground_texture', 'assets/ground.png');
    this.load.image('underground_texture', 'assets/underground.png');
    this.load.image('pipe_texture', 'assets/pipe.png');
    this.load.image('boss_texture', 'assets/boss.png');
    // Taipei map for mission select screen
    this.load.image('taipei_map', 'assets/taipei_map.png');

    // Mission B – urban textures
    this.load.image('ground_b_texture', 'assets/ground_b.png');
    this.load.image('underground_b_texture', 'assets/underground_b.png');
    // Mission C – castle textures
    this.load.image('ground_c_texture', 'assets/ground_c.png');
    this.load.image('underground_c_texture', 'assets/underground_c.png');
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
