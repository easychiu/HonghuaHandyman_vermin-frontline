import Phaser from 'phaser';

const LEVEL_TIMER_KEY = 'levelTimeLeft';

interface LevelTimerSystemConfig {
  scene: Phaser.Scene;
  durationSeconds: number;
  onTick?: (timeLeft: number) => void;
  onComplete: () => void;
}

export class LevelTimerSystem {
  private timeLeft: number;
  private timer?: Phaser.Time.TimerEvent;

  constructor(private readonly config: LevelTimerSystemConfig) {
    this.timeLeft = config.durationSeconds;
    this.sync();
  }

  start(): void {
    this.timer = this.config.scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        this.sync();

        if (this.timeLeft === 0) {
          this.stop();
          this.config.onComplete();
        }
      },
    });
  }

  stop(): void {
    this.timer?.remove(false);
    this.timer = undefined;
  }

  private sync(): void {
    this.config.scene.registry.set(LEVEL_TIMER_KEY, this.timeLeft);
    this.config.onTick?.(this.timeLeft);
  }
}
