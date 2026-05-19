import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainGameScene } from './scenes/MainGameScene';
import { ReadyScene } from './scenes/ReadyScene';

const mountElement = document.getElementById('app') ?? document.body.appendChild(document.createElement('div'));

if (!mountElement.id) {
  mountElement.id = 'app';
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: mountElement.id,
  width: 960,
  height: 540,
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { x: 0, y: 0 },
    },
  },
  scene: [BootScene, ReadyScene, MainGameScene],
};

void new Phaser.Game(config);
