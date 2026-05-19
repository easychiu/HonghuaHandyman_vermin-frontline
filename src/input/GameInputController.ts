import Phaser from 'phaser';

type SkillKey = 1 | 2 | 3 | 4 | 5;

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

  private moveAxisX = 0;
  private climbUpHeld = false;
  private jumpJustPressed = false;
  private attackJustPressed = false;
  private trapJustPressed = false;
  private skillJustPressed: Record<SkillKey, boolean> = { 1: false, 2: false, 3: false, 4: false, 5: false };

  private touchMoveAxisX = 0;
  private touchClimbUpHeld = false;
  private touchJumpQueued = false;
  private touchTrapQueued = false;
  private touchSkillQueued = new Set<SkillKey>();
  private touchAttackHeld = false;
  private touchAttackQueued = false;
  private nextTouchAutoAttackAt = 0;

  private readonly onTouchMove = (axisX: number) => {
    this.touchMoveAxisX = Phaser.Math.Clamp(axisX, -1, 1);
  };

  private readonly onTouchClimbHeld = (isHeld: boolean) => {
    this.touchClimbUpHeld = isHeld;
  };

  private readonly onTouchJump = () => {
    this.touchJumpQueued = true;
  };

  private readonly onTouchAttackHeld = (isHeld: boolean) => {
    if (isHeld && !this.touchAttackHeld) {
      this.touchAttackQueued = true;
    }
    if (!isHeld) {
      this.nextTouchAutoAttackAt = 0;
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
      this.touchJumpQueued = false;
      this.touchTrapQueued = false;
      this.touchSkillQueued.clear();
      this.touchAttackHeld = false;
      this.touchAttackQueued = false;
      this.nextTouchAutoAttackAt = 0;
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
    }

    this.gameEvents.on('controls:move', this.onTouchMove);
    this.gameEvents.on('controls:climb-held', this.onTouchClimbHeld);
    this.gameEvents.on('controls:jump', this.onTouchJump);
    this.gameEvents.on('controls:attack-held', this.onTouchAttackHeld);
    this.gameEvents.on('controls:trap', this.onTouchTrap);
    this.gameEvents.on('controls:skill', this.onTouchSkill);
    this.gameEvents.on('controls:touch-ui-enabled', this.onTouchControlsEnabled);
  }

  update(): void {
    const keyboardMoveX =
      (this.isKeyDown(this.cursors?.left) || this.isKeyDown(this.wasd?.A) ? -1 : 0) +
      (this.isKeyDown(this.cursors?.right) || this.isKeyDown(this.wasd?.D) ? 1 : 0);
    const resolvedKeyboardMoveX = Phaser.Math.Clamp(keyboardMoveX, -1, 1);

    const keyboardClimbUpHeld = this.isKeyDown(this.cursors?.up) || this.isKeyDown(this.wasd?.W);
    const keyboardJumpJustPressed = this.isJustDown(this.cursors?.up) || this.isJustDown(this.wasd?.W);
    const keyboardAttackJustPressed = this.isJustDown(this.spaceKey);
    const keyboardTrapJustPressed = this.isJustDown(this.eKey);

    this.moveAxisX = resolvedKeyboardMoveX !== 0 ? resolvedKeyboardMoveX : this.touchMoveAxisX;
    this.climbUpHeld = keyboardClimbUpHeld || this.touchClimbUpHeld;
    this.jumpJustPressed = keyboardJumpJustPressed || this.touchJumpQueued;
    this.attackJustPressed = keyboardAttackJustPressed || this.touchAttackQueued;
    this.trapJustPressed = keyboardTrapJustPressed || this.touchTrapQueued;

    this.skillJustPressed = {
      1: this.isJustDown(this.key1) || this.touchSkillQueued.has(1),
      2: this.isJustDown(this.key2) || this.touchSkillQueued.has(2),
      3: this.isJustDown(this.key3) || this.touchSkillQueued.has(3),
      4: this.isJustDown(this.key4) || this.touchSkillQueued.has(4),
      5: this.isJustDown(this.key5) || this.touchSkillQueued.has(5),
    };

    if (!this.attackJustPressed && this.touchAttackHeld) {
      const now = this.scene.time.now;
      if (this.nextTouchAutoAttackAt === 0 || now >= this.nextTouchAutoAttackAt) {
        this.attackJustPressed = true;
        this.scheduleNextTouchAutoAttack(now);
      }
    } else if (this.attackJustPressed && this.touchAttackHeld) {
      this.scheduleNextTouchAutoAttack(this.scene.time.now);
    }

    this.touchJumpQueued = false;
    this.touchAttackQueued = false;
    this.touchTrapQueued = false;
    this.touchSkillQueued.clear();
  }

  getMoveAxisX(): number {
    return this.moveAxisX;
  }

  isClimbUpHeld(): boolean {
    return this.climbUpHeld;
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

  isSkillJustPressed(n: SkillKey): boolean {
    return this.skillJustPressed[n];
  }

  destroy(): void {
    this.gameEvents.off('controls:move', this.onTouchMove);
    this.gameEvents.off('controls:climb-held', this.onTouchClimbHeld);
    this.gameEvents.off('controls:jump', this.onTouchJump);
    this.gameEvents.off('controls:attack-held', this.onTouchAttackHeld);
    this.gameEvents.off('controls:trap', this.onTouchTrap);
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
