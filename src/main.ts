import Phaser from 'phaser';
import { GAME_BALANCE } from './config/gameBalance';
import { BootScene } from './scenes/BootScene';
import { MainGameScene } from './scenes/MainGameScene';
import { ReadyScene } from './scenes/ReadyScene';
import { UIScene } from './scenes/UIScene';

const mountElement =
  document.getElementById('game-container') ??
  document.getElementById('app') ??
  document.body.appendChild(document.createElement('div'));

if (!mountElement.id) {
  mountElement.id = 'app';
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: mountElement.id,
  width: GAME_BALANCE.world.width,
  height: GAME_BALANCE.world.height,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#000000',
  input: {
    activePointers: 5,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: true,
      gravity: { x: 0, y: 800 },
    },
  },
  scene: [BootScene, ReadyScene, MainGameScene, UIScene],
};

void new Phaser.Game(config);
