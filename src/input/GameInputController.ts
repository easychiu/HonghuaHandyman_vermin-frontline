import Phaser from 'phaser';

type SkillKey = 1 | 2 | 3 | 4 | 5 | 6;

export class GameInputController {
  private static readonly TOUCH_AUTO_ATTACK_INTERVAL_MS = 220;

  private readonly scene: Phaser.Scene;
  private readonly gameEvents: Phaser.Events.EventEmitter;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private eKey?: Phaser.Input.Keyboard.Key;
  private key1?: Phaser.Input.Keyboard.Key;
  private key2?: Phaser.Input.Keyboard.Key;
  private key3?: Phaser.Input.Keyboard.Key;
  private key4?: Phaser.Input.Keyboard.Key;
  private key5?: Phaser.Input.Keyboard.Key;
  private key6?: Phaser.Input.Keyboard.Key;
  private rKey?: Phaser.Input.Keyboard.Key;
  private qKey?: Phaser.Input.Keyboard.Key;

  private moveAxisX = 0;
  private climbUpHeld = false;
  private climbDownHeld = false;
  private jumpJustPressed = false;
  private attackJustPressed = false;
  private trapJustPressed = false;
  private cycleTrapJustPressed = false;
  private skillJustPressed: Record<SkillKey, boolean> = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };

  private touchMoveAxisX = 0;
  private touchClimbUpHeld = false;
  private touchClimbDownHeld = false;
  private touchJumpQueued = false;
  private touchTrapQueued = false;
  private touchCycleTrapQueued = false;
  private touchSkillQueued = new Set<SkillKey>();
  private touchAttackHeld = false;
  private touchAttackQueued = false;
  private nextTouchAutoAttackAt: number | null = null;

  private readonly onTouchMove = (axisX: number) => {
    this.touchMoveAxisX = Phaser.Math.Clamp(axisX, -1, 1);
  };

  private readonly onTouchClimbHeld = (isHeld: boolean) => {
    this.touchClimbUpHeld = isHeld;
  };

  private readonly onTouchClimbDownHeld = (isHeld: boolean) => {
    this.touchClimbDownHeld = isHeld;
  };

  private readonly onTouchJump = () => {
    this.touchJumpQueued = true;
  };

  private readonly onTouchAttackHeld = (isHeld: boolean) => {
    if (isHeld && !this.touchAttackHeld) {
      this.touchAttackQueued = true;
    }
    if (!isHeld) {
      this.nextTouchAutoAttackAt = null;
    }
    this.touchAttackHeld = isHeld;
  };

  private readonly onTouchTrap = () => {
    this.touchTrapQueued = true;
  };

  private readonly onTouchSkill = (skill: SkillKey) => {
    this.touchSkillQueued.add(skill);
  };

  private readonly onTouchControlsEnabled = (enabled: boolean) => {
    if (!enabled) {
      this.touchMoveAxisX = 0;
      this.touchClimbUpHeld = false;
      this.touchClimbDownHeld = false;
      this.touchJumpQueued = false;
      this.touchTrapQueued = false;
      this.touchCycleTrapQueued = false;
      this.touchSkillQueued.clear();
      this.touchAttackHeld = false;
      this.touchAttackQueued = false;
      this.nextTouchAutoAttackAt = null;
    }
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gameEvents = scene.game.events;

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = scene.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
      }) as {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
      };
      this.spaceKey = scene.input.keyboard.addKey('SPACE');
      this.eKey = scene.input.keyboard.addKey('E');
      this.key1 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
      this.key2 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      this.key3 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
      this.key4 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
      this.key5 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE);
      this.key6 = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SIX);
      this.rKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.qKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    }

    this.gameEvents.on('controls:move', this.onTouchMove);
    this.gameEvents.on('controls:climb-held', this.onTouchClimbHeld);
    this.gameEvents.on('controls:climb-down-held', this.onTouchClimbDownHeld);
    this.gameEvents.on('controls:jump', this.onTouchJump);
    this.gameEvents.on('controls:attack-held', this.onTouchAttackHeld);
    this.gameEvents.on('controls:trap', this.onTouchTrap);
    this.gameEvents.on('controls:cycle-trap', () => { this.touchCycleTrapQueued = true; });
    this.gameEvents.on('controls:skill', this.onTouchSkill);
    this.gameEvents.on('controls:touch-ui-enabled', this.onTouchControlsEnabled);
  }

  update(): void {
    const keyboardMoveX =
      (this.isKeyDown(this.cursors?.left) || this.isKeyDown(this.wasd?.A) ? -1 : 0) +
      (this.isKeyDown(this.cursors?.right) || this.isKeyDown(this.wasd?.D) ? 1 : 0);
    const resolvedKeyboardMoveX = Phaser.Math.Clamp(keyboardMoveX, -1, 1);

    const keyboardClimbUpHeld = this.isKeyDown(this.cursors?.up) || this.isKeyDown(this.wasd?.W);
    const keyboardClimbDownHeld = this.isKeyDown(this.cursors?.down) || this.isKeyDown(this.wasd?.S);
    const keyboardJumpJustPressed = this.isJustDown(this.cursors?.up) || this.isJustDown(this.wasd?.W);
    const keyboardAttackJustPressed = this.isJustDown(this.spaceKey);
    const keyboardTrapJustPressed = this.isJustDown(this.eKey);

    const keyboardCycleTrapJustPressed = this.isJustDown(this.qKey);

    this.moveAxisX = resolvedKeyboardMoveX !== 0 ? resolvedKeyboardMoveX : this.touchMoveAxisX;
    this.climbUpHeld = keyboardClimbUpHeld || this.touchClimbUpHeld;
    this.climbDownHeld = keyboardClimbDownHeld || this.touchClimbDownHeld;
    this.jumpJustPressed = keyboardJumpJustPressed || this.touchJumpQueued;
    this.attackJustPressed = keyboardAttackJustPressed || this.touchAttackQueued;
    this.trapJustPressed = keyboardTrapJustPressed || this.touchTrapQueued;
    this.cycleTrapJustPressed = keyboardCycleTrapJustPressed || this.touchCycleTrapQueued;

    this.skillJustPressed = {
      1: this.isJustDown(this.key1) || this.touchSkillQueued.has(1),
      2: this.isJustDown(this.key2) || this.touchSkillQueued.has(2),
      3: this.isJustDown(this.key3) || this.touchSkillQueued.has(3),
      4: this.isJustDown(this.key4) || this.touchSkillQueued.has(4),
      5: this.isJustDown(this.key5) || this.touchSkillQueued.has(5),
      6: this.isJustDown(this.key6) || this.isJustDown(this.rKey) || this.touchSkillQueued.has(6),
    };

    if (!this.attackJustPressed && this.touchAttackHeld) {
      const now = this.scene.time.now;
      const canAutoAttackNow = this.nextTouchAutoAttackAt === null || now >= this.nextTouchAutoAttackAt;
      if (canAutoAttackNow) {
        this.attackJustPressed = true;
      }
    }

    if (this.attackJustPressed && this.touchAttackHeld) {
      this.scheduleNextTouchAutoAttack(this.scene.time.now);
    }

    this.touchJumpQueued = false;
    this.touchAttackQueued = false;
    this.touchTrapQueued = false;
    this.touchCycleTrapQueued = false;
    this.touchSkillQueued.clear();
  }

  getMoveAxisX(): number {
    return this.moveAxisX;
  }

  isClimbUpHeld(): boolean {
    return this.climbUpHeld;
  }

  isClimbDownHeld(): boolean {
    return this.climbDownHeld;
  }

  isJumpJustPressed(): boolean {
    return this.jumpJustPressed;
  }

  isAttackJustPressed(): boolean {
    return this.attackJustPressed;
  }

  isTrapJustPressed(): boolean {
    return this.trapJustPressed;
  }

  isCycleTrapJustPressed(): boolean {
    return this.cycleTrapJustPressed;
  }

  isSkillJustPressed(n: SkillKey): boolean {
    return this.skillJustPressed[n];
  }

  destroy(): void {
    this.gameEvents.off('controls:move', this.onTouchMove);
    this.gameEvents.off('controls:climb-held', this.onTouchClimbHeld);
    this.gameEvents.off('controls:climb-down-held', this.onTouchClimbDownHeld);
    this.gameEvents.off('controls:jump', this.onTouchJump);
    this.gameEvents.off('controls:attack-held', this.onTouchAttackHeld);
    this.gameEvents.off('controls:trap', this.onTouchTrap);
    this.gameEvents.off('controls:cycle-trap');
    this.gameEvents.off('controls:skill', this.onTouchSkill);
    this.gameEvents.off('controls:touch-ui-enabled', this.onTouchControlsEnabled);
  }

  private isKeyDown(key?: Phaser.Input.Keyboard.Key): boolean {
    return !!key?.isDown;
  }

  private isJustDown(key?: Phaser.Input.Keyboard.Key): boolean {
    return !!key && Phaser.Input.Keyboard.JustDown(key);
  }

  private scheduleNextTouchAutoAttack(now: number): void {
    this.nextTouchAutoAttackAt = now + GameInputController.TOUCH_AUTO_ATTACK_INTERVAL_MS;
  }
}
