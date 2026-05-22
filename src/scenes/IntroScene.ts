import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { AudioSystem } from '../systems/AudioSystem';

export class IntroScene extends Phaser.Scene {
  private videoEl?: HTMLVideoElement;
  private skipBtnEl?: HTMLButtonElement;

  constructor() {
    super(SCENE_KEYS.intro);
  }

  create(): void {
    const { width, height } = this.scale;

    // Background color same as ReadyScene
    this.cameras.main.setBackgroundColor('#090d16');

    // Create a beautiful premium splash prompt to click to play
    const title = this.add.text(width / 2, height / 2 - 40, '紅花萬事屋：鼠鼠之亂', {
      color: '#ffffff',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '36px',
      fontWeight: 'bold'
    }).setOrigin(0.5);
    title.setStroke('#a855f7', 4);
    title.setShadow(0, 0, '#ff007f', 10, true, true);

    const promptText = this.add.text(width / 2, height / 2 + 40, '— 點擊螢幕播放開場影片 —', {
      color: '#00ffff',
      fontFamily: '"Outfit", "Inter", "Microsoft JhengHei", Arial, sans-serif',
      fontSize: '16px',
      fontWeight: '600'
    }).setOrigin(0.5);

    // Pulse prompt
    this.tweens.add({
      targets: promptText,
      alpha: { start: 1, end: 0.3 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Power1.easeInOut'
    });

    this.input.once('pointerdown', () => {
      AudioSystem.playClick();
      this.playVideo();
    });

    // Also support keyboard Enter or Space to play
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        this.input.keyboard?.off('keydown', handleKey);
        AudioSystem.playClick();
        this.playVideo();
      }
    };
    this.input.keyboard?.on('keydown', handleKey);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', handleKey);
      this.cleanupVideo();
    });
  }

  private playVideo(): void {
    const gameContainer = this.game.canvas.parentElement;
    if (!gameContainer) {
      this.transitionToNextScene();
      return;
    }

    // Ensure the container is positioned relatively so the video and skip button align inside it
    gameContainer.style.position = 'relative';

    // Clear prompt text
    this.children.removeAll();

    // Create video element
    const video = document.createElement('video');
    video.src = 'assets/Cinematic_D_pixel_art_style_g.mp4';
    video.autoplay = true;
    video.playsInline = true;
    
    // Style video to fit the parent container perfectly
    video.style.position = 'absolute';
    video.style.left = '0';
    video.style.top = '0';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.zIndex = '1000';
    video.style.objectFit = 'contain';
    video.style.backgroundColor = '#000000';
    
    gameContainer.appendChild(video);
    this.videoEl = video;

    // Create a beautiful premium skip button
    const skipBtn = document.createElement('button');
    skipBtn.innerText = '跳過 Skip ⏩';
    skipBtn.style.position = 'absolute';
    skipBtn.style.right = '20px';
    skipBtn.style.top = '20px';
    skipBtn.style.zIndex = '1001';
    skipBtn.style.padding = '10px 20px';
    skipBtn.style.backgroundColor = 'rgba(17, 24, 39, 0.8)';
    skipBtn.style.color = '#ffffff';
    skipBtn.style.border = '1px solid #a855f7';
    skipBtn.style.borderRadius = '8px';
    skipBtn.style.cursor = 'pointer';
    skipBtn.style.fontFamily = '"Inter", "Microsoft JhengHei", Arial, sans-serif';
    skipBtn.style.fontSize = '14px';
    skipBtn.style.fontWeight = 'bold';
    skipBtn.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.4)';
    skipBtn.style.transition = 'all 0.2s';
    
    skipBtn.onmouseenter = () => {
      skipBtn.style.backgroundColor = '#a855f7';
      skipBtn.style.boxShadow = '0 0 15px #ff007f';
    };
    skipBtn.onmouseleave = () => {
      skipBtn.style.backgroundColor = 'rgba(17, 24, 39, 0.8)';
      skipBtn.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.4)';
    };

    skipBtn.onclick = () => {
      AudioSystem.playClick();
      this.transitionToNextScene();
    };

    gameContainer.appendChild(skipBtn);
    this.skipBtnEl = skipBtn;

    // Transition when video ends
    video.onended = () => {
      this.transitionToNextScene();
    };

    // If video fails to load or play, fallback
    video.onerror = () => {
      console.error('Opening cinematic playback failed, skipping.');
      this.transitionToNextScene();
    };
  }

  private transitionToNextScene(): void {
    this.cleanupVideo();
    this.cameras.main.fadeOut(500, 9, 13, 22);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.lobby);
    });
  }

  private cleanupVideo(): void {
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.remove();
      this.videoEl = undefined;
    }
    if (this.skipBtnEl) {
      this.skipBtnEl.remove();
      this.skipBtnEl = undefined;
    }
  }
}
