import Phaser from 'phaser';

export class Trap extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'trap_texture');
  }

  spawn(x: number, y: number): void {
    this.body?.reset(x, y);
    this.setActive(true);
    this.setVisible(true);
    
    // 陷阱固定在地板上，不受重力影響，也不能被老鼠推動
    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
      this.body.immovable = true;
    }
  }

  despawn(): void {
    this.setActive(false);
    this.setVisible(false);
    this.body?.stop();
  }
}