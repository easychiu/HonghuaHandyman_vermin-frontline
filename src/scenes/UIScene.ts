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
  private screenOverlayActive = false;

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

    const maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0;
    const isTouchCapable = this.sys.game.device.input.touch || maxTouchPoints > 0;
    const isLikelyMobileViewport = this.scale.width <= UIScene.MOBILE_VIEWPORT_THRESHOLD;
    const isLikelyMobileOs = this.sys.game.device.os.android || this.sys.game.device.os.iOS;
    const shouldShowTouchUi = !this.sys.game.device.os.desktop || isLikelyMobileOs || isLikelyMobileViewport;
    this.touchControlsVisible = isTouchCapable && shouldShowTouchUi;
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

    // HP 顯示與氧氣顯示
    const oxygen = Math.round(Number(this.registry.get('playerOxygen') ?? 100));
    const maxOxygen = Math.round(Number(this.registry.get('playerMaxOxygen') ?? 100));
    const oxygenStr = oxygen < maxOxygen ? `  💧氧氣: ${oxygen}%` : '';

    const hearts = '❤'.repeat(hud.playerHp) + '🖤'.repeat(Math.max(0, hud.playerMaxHp - hud.playerHp));
    this.topLeftText?.setText(
      `HP: ${hud.playerHp}/${hud.playerMaxHp}  ${hearts}${oxygenStr}\n評分: ${hud.score}\n擊殺: ${hud.kills}\n嚇跑人數: ${hud.scaredHumans}\n倒數: ${hud.timeLeft}s`,
    );

    this.bossText?.setText(hud.bossActive ? '⚠ 大BOSS 驅趕鼠群中 ⚠' : '');

    // 技能欄顯示
    const s = hud.skillUses;
    this.skillText?.setText(
      `[1] A.青仔檳榔  ${s.qingZai}x\n` +
      `[2] B.雙子檳榔  ${s.shuangZi}x\n` +
      `[3] C.紅灰檳榔  ${s.hongHui}x  🔥燃燒\n` +
      `[4] D.白灰檳榔  ${s.baiHui}x  ❄減速\n` +
      `[5] E.包葉檳榔  ${s.baoYe}x  🛡護盾(3次)\n` +
      `[6/R] 庵左特工  ${(s as any).anzo ?? 0}x  🚒召喚`,
    );

    this.refreshTouchToggleText(this.debugPointerSpawnEnabled);

    // 偵測勝負狀態
    const gameStatus = this.registry.get('gameStatus');
    if (gameStatus === 'victory' && !this.screenOverlayActive) {
      this.showVictoryScreen(hud);
    } else if (gameStatus === 'gameover' && !this.screenOverlayActive) {
      this.showGameOverScreen();
    }
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

    const skillButtons: Array<{ key: 1 | 2 | 3 | 4 | 5 | 6; x: number; y: number; color: number }> = [
      { key: 1, x: this.scale.width - 315, y: h - 120, color: 0x2b9348 },
      { key: 2, x: this.scale.width - 270, y: h - 80, color: 0x90a955 },
      { key: 3, x: this.scale.width - 225, y: h - 120, color: 0xff6b6b },
      { key: 4, x: this.scale.width - 180, y: h - 80, color: 0x4cc9f0 },
      { key: 5, x: this.scale.width - 135, y: h - 120, color: 0x00b4d8 },
      { key: 6, x: this.scale.width - 90, y: h - 50, color: 0xff3333 },
    ];
    skillButtons.forEach(({ key, x, y, color }) => {
      const label = key === 6 ? '特工' : String(key);
      const btn = this.createTouchButton(x, y, 24, label, color);
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

  private showVictoryScreen(hud: HudState): void {
    this.screenOverlayActive = true;
    this.cleanupTouchControls();
    this.applyTouchControlVisibility(false);

    const { width, height } = this.scale;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x0f172a, 0.85);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(2000);

    const remainingRats = Number(this.registry.get('remainingRats') ?? 0);
    const finalScore = hud.score - remainingRats * 5;
    
    let evaluation = 'F';
    let comment = '紅花的黑歷史...';
    if (finalScore >= 80) {
      evaluation = 'S';
      comment = '萬事屋的榮耀！完美控制鼠患！';
    } else if (finalScore >= 60) {
      evaluation = 'A';
      comment = '備受國王信賴！工作完成出色！';
    } else if (finalScore >= 40) {
      evaluation = 'B';
      comment = '合格的委託人。聲譽依然良好。';
    } else if (finalScore >= 20) {
      evaluation = 'C';
      comment = '差強人意，請繼續努力。';
    }

    const panelY = height / 2;

    this.add.text(width / 2, panelY - 140, '任務成功！', {
      color: '#f8fafc',
      fontFamily: 'Arial, sans-serif',
      fontSize: '44px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2005);

    const statsText = 
      `老鼠擊殺數: ${hud.kills}\n` +
      `人類受驚次數: ${hud.scaredHumans}\n` +
      `殘留老鼠總數: ${remainingRats}\n` +
      `最終聲望分數: ${hud.score}\n` +
      `結算總評分: ${finalScore}`;

    this.add.text(width / 2 - 120, panelY - 60, statsText, {
      color: '#cbd5e1',
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      lineSpacing: 8,
    }).setDepth(2005);

    this.add.text(width / 2 + 120, panelY - 40, `國王評價\n\n${evaluation}`, {
      color: evaluation === 'S' || evaluation === 'A' ? '#f59e0b' : '#94a3b8',
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2005);

    this.add.text(width / 2, panelY + 70, `「 ${comment} 」`, {
      color: '#e2e8f0',
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(2005);

    this.add.text(width / 2, panelY + 150, '重新開始', {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      backgroundColor: '#2563eb',
      padding: { x: 24, y: 10 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(2005)
      .on('pointerdown', () => this.restartGame());
  }

  private showGameOverScreen(): void {
    this.screenOverlayActive = true;
    this.cleanupTouchControls();
    this.applyTouchControlVisibility(false);

    const { width, height } = this.scale;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x450a0a, 0.9);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(2000);

    const panelY = height / 2;

    this.add.text(width / 2, panelY - 60, '任務失敗！', {
      color: '#fecdd3',
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2005);

    this.add.text(width / 2, panelY + 10, '紅花體力耗盡，已被老鼠擊敗...', {
      color: '#fda4af',
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    }).setOrigin(0.5).setDepth(2005);

    this.add.text(width / 2, panelY + 100, '重新挑戰', {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      backgroundColor: '#be123c',
      padding: { x: 24, y: 10 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(2005)
      .on('pointerdown', () => this.restartGame());
  }

  private restartGame(): void {
    this.registry.destroy();
    this.screenOverlayActive = false;
    this.scene.stop(SCENE_KEYS.ui);
    this.scene.stop(SCENE_KEYS.mainGame);
    this.scene.start(SCENE_KEYS.ready);
  }
}
