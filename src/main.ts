import Phaser from 'phaser';
import { GAME_BALANCE } from './config/gameBalance';
import { BootScene } from './scenes/BootScene';
import { IntroScene } from './scenes/IntroScene';
import { YorozuyaLobbyScene } from './scenes/YorozuyaLobbyScene';
import { TaipeiMapScene } from './scenes/TaipeiMapScene';
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
  render: {
    pixelArt: true,
    antialias: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#000000',
  input: {
    activePointers: 5,
    keyboard: true,
    mouse: true,
    touch: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { x: 0, y: 800 },
    },
  },
  scene: [BootScene, IntroScene, YorozuyaLobbyScene, TaipeiMapScene, ReadyScene, MainGameScene, UIScene],
};

void new Phaser.Game(config);
