import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { defaultHudState, HudState } from '../ui/hud';

export class UIScene extends Phaser.Scene {
  private static readonly CLIMB_THRESHOLD_RATIO = 0.45;
  private static readonly JOYSTICK_ZONE_WIDTH_RATIO = 0.48;
  private static readonly BUTTON_FEEDBACK_DURATION_MS = 120;
  private static readonly MOBILE_VIEWPORT_THRESHOLD = 1024;

  private topLeftText?: Phaser.GameObjects.Text;
  private bossText?: Phaser.GameObjects.Text;
  private skillText?: Phaser.GameObjects.Text;
  private touchToggleText?: Phaser.GameObjects.Text;

  private touchControlsVisible = false;
  private joystickBase?: Phaser.GameObjects.Arc;
  private joystickKnob?: Phaser.GameObjects.Arc;
  private joystickPointerId: number | null = null;
  private attackPointerId: number | null = null;
  private joystickRadius = 60;
  private joystickCenter = { x: 120, y: 0 };
  private lastTouchClimbHeld = false;
  private attackButton?: Phaser.GameObjects.Arc;
  private leftZone?: Phaser.GameObjects.Zone;
  private touchControlObjects: Phaser.GameObjects.GameObject[] = [];
  private debugPointerSpawnEnabled = false;

  private readonly onPointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!this.touchControlsVisible || this.joystickPointerId !== pointer.id) {
      return;
    }
    this.updateJoystick(pointer);
  };

  private readonly onPointerUp = (pointer: Phaser.Input.Pointer) => {
    if (this.joystickPointerId === pointer.id) {
      this.releaseJoystick();
    }
    if (this.attackPointerId === pointer.id) {
      this.attackPointerId = null;
      this.attackButton?.setFillStyle(0xf77f00, 0.8);
      this.game.events.emit('controls:attack-held', false);
    }
  };

  private readonly onLeftZonePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!this.touchControlsVisible || this.joystickPointerId !== null) {
      return;
    }
    this.joystickPointerId = pointer.id;
    this.updateJoystick(pointer);
  };

  constructor() {
    super(SCENE_KEYS.ui);
  }

  create(): void {
    this.topLeftText = this.add.text(16, 12, '', {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    }).setDepth(1000);

    this.bossText = this.add.text(this.scale.width / 2, 14, '', {
      color: '#ff6b6b',
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
    }).setDepth(1000).setOrigin(0.5, 0);

    this.skillText = this.add.text(16, this.scale.height - 100, '', {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      lineSpacing: 4,
    }).setDepth(1000);

    const maxTouchPoints = navigator?.maxTouchPoints ?? 0;
    const isTouchCapable = this.sys.game.device.input.touch || maxTouchPoints > 0;
    const isLikelyMobileViewport = this.scale.width <= UIScene.MOBILE_VIEWPORT_THRESHOLD;
    const isLikelyMobileOs = this.sys.game.device.os.android || this.sys.game.device.os.iOS;
    const shouldAutoShowTouchUi = !this.sys.game.device.os.desktop || isLikelyMobileOs || isLikelyMobileViewport;
    this.touchControlsVisible = isTouchCapable && shouldAutoShowTouchUi;
    this.createTouchControls();
    this.applyTouchControlVisibility(this.touchControlsVisible);
    this.game.events.emit('controls:touch-ui-enabled', this.touchControlsVisible);

    this.touchToggleText = this.add.text(this.scale.width - 16, 12, '', {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 5 },
    })
      .setDepth(1100)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.touchControlsVisible = !this.touchControlsVisible;
        this.applyTouchControlVisibility(this.touchControlsVisible);
        this.game.events.emit('controls:touch-ui-enabled', this.touchControlsVisible);
      });
    this.refreshTouchToggleText();

    this.debugPointerSpawnEnabled = Boolean(this.registry.get('debugPointerSpawnEnabled'));
    this.registry.events.on('changedata-debugPointerSpawnEnabled', this.onDebugPointerSpawnChanged, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-debugPointerSpawnEnabled', this.onDebugPointerSpawnChanged, this);
      this.cleanupTouchControls();
    });
  }

  update(): void {
    const hud: HudState = {
      score:       Number(this.registry.get('reputationScore') ?? defaultHudState.score),
      kills:       Number(this.registry.get('ratKills')        ?? defaultHudState.kills),
      scaredHumans: Number(this.registry.get('scaredHumans')  ?? defaultHudState.scaredHumans),
      timeLeft:    Number(this.registry.get('levelTimeLeft')   ?? defaultHudState.timeLeft),
      bossActive:  Boolean(this.registry.get('bossActive')     ?? defaultHudState.bossActive),
      playerHp:    Number(this.registry.get('playerHp')        ?? defaultHudState.playerHp),
      playerMaxHp: Number(this.registry.get('playerMaxHp')     ?? defaultHudState.playerMaxHp),
      skillUses:   (this.registry.get('skillUses')             ?? defaultHudState.skillUses),
    };

    // HP 顯示
    const hearts = '❤'.repeat(hud.playerHp) + '🖤'.repeat(Math.max(0, hud.playerMaxHp - hud.playerHp));
    this.topLeftText?.setText(
      `HP: ${hud.playerHp}/${hud.playerMaxHp}  ${hearts}\n評分: ${hud.score}\n擊殺: ${hud.kills}\n嚇跑人數: ${hud.scaredHumans}\n倒數: ${hud.timeLeft}s`,
    );

    this.bossText?.setText(hud.bossActive ? '⚠ 大BOSS 驅趕鼠群中 ⚠' : '');

    // 技能欄顯示
    const s = hud.skillUses;
    this.skillText?.setText(
      `[1] A.青仔檳榔  ${s.qingZai}x\n` +
      `[2] B.雙子檳榔  ${s.shuangZi}x\n` +
      `[3] C.紅灰檳榔  ${s.hongHui}x  🔥燃燒\n` +
      `[4] D.白灰檳榔  ${s.baiHui}x  ❄減速\n` +
      `[5] E.包葉檳榔  ${s.baoYe}x  🛡護盾(3次)`,
    );

    this.refreshTouchToggleText(this.debugPointerSpawnEnabled);
  }

  private createTouchControls(): void {
    const h = this.scale.height;
    this.joystickCenter = { x: 120, y: h - 110 };

    this.joystickBase = this.add.circle(this.joystickCenter.x, this.joystickCenter.y, this.joystickRadius, 0x111111, 0.35)
      .setDepth(1050);
    this.joystickKnob = this.add.circle(this.joystickCenter.x, this.joystickCenter.y, 24, 0xffffff, 0.65)
      .setDepth(1060);
    this.touchControlObjects.push(this.joystickBase, this.joystickKnob);

    this.leftZone = this
      .add
      .zone(0, h - 240, this.scale.width * UIScene.JOYSTICK_ZONE_WIDTH_RATIO, 240)
      .setOrigin(0, 0)
      .setDepth(1040);
    this.leftZone.setInteractive();
    this.leftZone.on('pointerdown', this.onLeftZonePointerDown);
    this.touchControlObjects.push(this.leftZone);

    this.attackButton = this.createTouchButton(this.scale.width - 90, h - 130, 44, '攻擊', 0xf77f00);
    this.attackButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.touchControlsVisible || this.attackPointerId !== null) {
        return;
      }
      this.attackPointerId = pointer.id;
      this.attackButton?.setFillStyle(0xffa94d, 0.95);
      this.game.events.emit('controls:attack-held', true);
    });

    const trapBtn = this.createTouchButton(this.scale.width - 190, h - 170, 34, '陷阱', 0x9d4edd);
    trapBtn.on('pointerdown', () => {
      if (!this.touchControlsVisible) {
        return;
      }
      trapBtn.setFillStyle(0xbe95ff, 0.9);
      this.game.events.emit('controls:trap', true);
      this.time.delayedCall(UIScene.BUTTON_FEEDBACK_DURATION_MS, () => trapBtn.setFillStyle(0x9d4edd, 0.8));
    });

    const skillButtons: Array<{ key: 1 | 2 | 3 | 4 | 5; x: number; y: number; color: number }> = [
      { key: 1, x: this.scale.width - 270, y: h - 120, color: 0x2b9348 },
      { key: 2, x: this.scale.width - 225, y: h - 80, color: 0x90a955 },
      { key: 3, x: this.scale.width - 180, y: h - 120, color: 0xff6b6b },
      { key: 4, x: this.scale.width - 135, y: h - 80, color: 0x4cc9f0 },
      { key: 5, x: this.scale.width - 90, y: h - 50, color: 0x00b4d8 },
    ];
    skillButtons.forEach(({ key, x, y, color }) => {
      const btn = this.createTouchButton(x, y, 24, String(key), color);
      btn.on('pointerdown', () => {
        if (!this.touchControlsVisible) {
          return;
        }
        btn.setScale(1.15);
        this.game.events.emit('controls:skill', key);
        this.time.delayedCall(UIScene.BUTTON_FEEDBACK_DURATION_MS, () => btn.setScale(1));
      });
    });

    this.input.on('pointermove', this.onPointerMove);
    this.input.on('pointerup', this.onPointerUp);
  }

  private createTouchButton(
    x: number,
    y: number,
    radius: number,
    label: string,
    color: number,
  ): Phaser.GameObjects.Arc {
    const button = this.add.circle(x, y, radius, color, 0.8).setDepth(1055).setInteractive();
    const text = this.add.text(x, y, label, {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: radius >= 34 ? '18px' : '14px',
      fontStyle: 'bold',
    }).setDepth(1065).setOrigin(0.5);
    this.touchControlObjects.push(button, text);
    return button;
  }

  private updateJoystick(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.joystickCenter.x;
    const dy = pointer.y - this.joystickCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDist = this.joystickRadius;

    let knobX = this.joystickCenter.x;
    let knobY = this.joystickCenter.y;
    if (distance > 0) {
      const clamped = Math.min(distance, maxDist);
      knobX += (dx / distance) * clamped;
      knobY += (dy / distance) * clamped;
    }

    this.joystickKnob?.setPosition(knobX, knobY);

    const normalizedX = Phaser.Math.Clamp(dx / maxDist, -1, 1);
    const climbHeld = this.isJoystickMovingUpward(dy, maxDist);
    const jumpTriggered = climbHeld && !this.lastTouchClimbHeld;

    this.game.events.emit('controls:move', normalizedX);
    this.game.events.emit('controls:climb-held', climbHeld);
    if (jumpTriggered) {
      this.game.events.emit('controls:jump');
    }
    this.lastTouchClimbHeld = climbHeld;
  }

  private releaseJoystick(): void {
    this.joystickPointerId = null;
    this.lastTouchClimbHeld = false;
    this.joystickKnob?.setPosition(this.joystickCenter.x, this.joystickCenter.y);
    this.game.events.emit('controls:move', 0);
    this.game.events.emit('controls:climb-held', false);
  }

  private applyTouchControlVisibility(visible: boolean): void {
    this.touchControlObjects.forEach((child) => child.setVisible(visible));
    if (!visible) {
      this.releaseJoystick();
      this.attackPointerId = null;
      this.game.events.emit('controls:attack-held', false);
    }
  }

  private cleanupTouchControls(): void {
    this.input.off('pointermove', this.onPointerMove);
    this.input.off('pointerup', this.onPointerUp);
    this.leftZone?.off('pointerdown', this.onLeftZonePointerDown);
    this.releaseJoystick();
    this.attackPointerId = null;
    this.game.events.emit('controls:attack-held', false);
    this.touchControlObjects.forEach((obj) => obj.destroy());
    this.touchControlObjects = [];
    this.leftZone = undefined;
    this.attackButton = undefined;
  }

  private isJoystickMovingUpward(deltaY: number, maxDistance: number): boolean {
    // In Phaser's coordinate system, y grows downward, so upward motion is negative.
    return deltaY < -maxDistance * UIScene.CLIMB_THRESHOLD_RATIO;
  }

  private onDebugPointerSpawnChanged(
    _parent: Phaser.Data.DataManager,
    value: unknown,
  ): void {
    this.debugPointerSpawnEnabled = Boolean(value);
  }

  private refreshTouchToggleText(debugPointerSpawnEnabled = false): void {
    this.touchToggleText?.setText(
      `觸控UI: ${this.touchControlsVisible ? 'ON' : 'OFF'}\n` +
      `壓測加鼠: ${debugPointerSpawnEnabled ? 'ON(debugSpawn=1)' : 'OFF'}`,
    );
  }
}
