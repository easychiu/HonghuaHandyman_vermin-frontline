import Phaser from 'phaser';
import { ensureHonghuaAnimations } from '../animations/honghuaAnimations';
import { GAME_BALANCE } from '../config/gameBalance';
import { SCENE_KEYS } from '../config/sceneKeys';
import { BossEventController } from '../controllers/BossEventController';
import { Human } from '../entities/Human';
import { Player } from '../entities/Player';
import { Rat } from '../entities/Rat';
import { Trap } from '../entities/Trap';
import { CombatSystem } from '../systems/CombatSystem';
import { HumanSightSystem } from '../systems/HumanSightSystem';
import { LevelTimerSystem } from '../systems/LevelTimerSystem';
import { RatSpawnerSystem } from '../systems/RatSpawnerSystem';
import { ReputationSystem } from '../systems/ReputationSystem';
import { SkillSystem } from '../systems/SkillSystem';
import { TrapSystem } from '../systems/TrapSystem';
import { TrapBaitSystem } from '../systems/TrapBaitSystem';
import { GameInputController } from '../input/GameInputController';

export class MainGameScene extends Phaser.Scene {
  private greenRatPool!: Phaser.Physics.Arcade.Group;
  private blueRatPool!: Phaser.Physics.Arcade.Group;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private player!: Player;
  private trapPool!: Phaser.Physics.Arcade.Group;
  private humanPool!: Phaser.Physics.Arcade.Group;

  private combatSystem!: CombatSystem;
  private trapSystem!: TrapSystem;
  private humanSightSystem!: HumanSightSystem;
  private ratSpawnerSystem!: RatSpawnerSystem;
  private levelTimerSystem!: LevelTimerSystem;
  private bossController!: BossEventController;
  private reputationSystem!: ReputationSystem;
  private skillSystem!: SkillSystem;
  private inputController!: GameInputController;
  private debugPointerSpawnEnabled = false;
  private lastOxygenDamageTime?: number;

  constructor() {
    super(SCENE_KEYS.mainGame);
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#8d99ae');
    this.createBackground(width, height);
    ensureHonghuaAnimations(this);
    this.platforms = this.createPlatforms(width, height);

    const pipeHeight = height - GAME_BALANCE.world.surfaceY;
    const pipe = this.physics.add.staticImage(480, GAME_BALANCE.world.surfaceY, 'pipe_texture')
      .setOrigin(0.5, 0)
      .setDisplaySize(40, pipeHeight);
    pipe.refreshBody();

    this.greenRatPool = this.physics.add.group({ classType: Rat, maxSize: 100, runChildUpdate: true });
    this.blueRatPool = this.physics.add.group({ classType: Rat, maxSize: 100, runChildUpdate: true });
    this.trapPool = this.physics.add.group({ classType: Trap, maxSize: 20, runChildUpdate: false });
    this.humanPool = this.physics.add.group({ classType: Human, maxSize: 10, runChildUpdate: true });

    this.inputController = new GameInputController(this);
    this.player = new Player(this, 100, 100, this.inputController);

    // 初始化 registry 血量與氧氣資料
    this.registry.set('playerHp', this.player.hp);
    this.registry.set('playerMaxHp', this.player.maxHp);
    this.registry.set('playerOxygen', this.player.oxygen);
    this.registry.set('playerMaxOxygen', this.player.maxOxygen);

    this.physics.add.collider(this.greenRatPool, this.platforms);
    this.physics.add.collider(this.blueRatPool, this.platforms);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.humanPool, this.platforms);

    this.physics.add.overlap(this.greenRatPool, pipe, this.handleRatClimbPipe, undefined, this);
    this.physics.add.overlap(this.blueRatPool, pipe, this.handleRatClimbPipe, undefined, this);
    this.physics.add.overlap(this.player, pipe, this.handlePlayerClimbPipe, undefined, this);

    // 玩家與老鼠碰撞 → 玩家受傷
    this.physics.add.overlap(
      this.player,
      this.greenRatPool,
      (_playerObj, ratObj) => {
        const rat = ratObj as Rat;
        if (rat.active) {
          this.player.receiveRatDamage(GAME_BALANCE.collision.greenRatDamage);
          this.registry.set('playerHp', this.player.hp);
        }
      },
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.player,
      this.blueRatPool,
      (_playerObj, ratObj) => {
        const rat = ratObj as Rat;
        if (rat.active) {
          this.player.receiveRatDamage(GAME_BALANCE.collision.blueRatDamage);
          this.registry.set('playerHp', this.player.hp);
        }
      },
      undefined,
      this,
    );

    this.spawnInitialHumans();

    this.reputationSystem = new ReputationSystem(this, GAME_BALANCE.reputation.startingScore);

    this.combatSystem = new CombatSystem({
      scene: this,
      player: this.player,
      greenRatPool: this.greenRatPool,
      blueRatPool: this.blueRatPool,
      trapPool: this.trapPool,
      onRatKilled: () => this.reputationSystem.recordRatKill(GAME_BALANCE.reputation.ratKillReward),
    });

    this.trapSystem = new TrapSystem(this, this.trapPool, this.player);

    this.skillSystem = new SkillSystem(
      this,
      this.player,
      () => this.getActiveRats(),
      () => this.reputationSystem.recordRatKill(GAME_BALANCE.reputation.ratKillReward),
    );
    // 初始化技能使用次數到 registry
    this.registry.set('skillUses', { ...this.skillSystem.getRemainingUses() });

    this.humanSightSystem = new HumanSightSystem({
      humanPool: this.humanPool,
      getActiveRats: () => this.getActiveRats(),
      panicRadius: GAME_BALANCE.human.sightRadius,
      onHumanSawRat: () => this.reputationSystem.recordScaredHuman(GAME_BALANCE.reputation.humanSightPenalty),
    });

    const portalX = width - 40;
    const portalY = height - 80;
    this.createPortal(portalX, portalY);

    this.ratSpawnerSystem = new RatSpawnerSystem({
      scene: this,
      greenRatPool: this.greenRatPool,
      blueRatPool: this.blueRatPool,
      portalX,
      portalY,
      pipeX: pipe.x,
      surfaceY: GAME_BALANCE.world.surfaceY,
    });
    this.ratSpawnerSystem.startAutoSpawn();

    this.bossController = new BossEventController({
      scene: this,
      pipeX: pipe.x,
      surfaceY: GAME_BALANCE.world.surfaceY,
      onStateChange: (active) => this.registry.set('bossActive', active),
    });

    const triggerBossRush = () => {
      this.bossController.trigger(() => this.getActiveRats());
    };

    const selectedMission = this.registry.get('selectedMission');
    const levelDuration = selectedMission ? selectedMission.duration : GAME_BALANCE.level.durationSeconds;

    this.levelTimerSystem = new LevelTimerSystem({
      scene: this,
      durationSeconds: levelDuration,
      onTick: (timeLeft) => {
        if (timeLeft <= GAME_BALANCE.level.bossTriggerTimeLeftSeconds) {
          triggerBossRush();
        }
      },
      onComplete: () => {
        this.ratSpawnerSystem.stop();
        this.bossController.stop();
        this.registry.set('gameStatus', 'victory');
        this.physics.pause();
      },
    });
    this.levelTimerSystem.start();

    if (!this.scene.isActive(SCENE_KEYS.ui)) {
      this.scene.launch(SCENE_KEYS.ui);
    }

    this.debugPointerSpawnEnabled = new URLSearchParams(window.location.search).get('debugSpawn') === '1';
    this.registry.set('debugPointerSpawnEnabled', this.debugPointerSpawnEnabled);
    if (this.debugPointerSpawnEnabled) {
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.ratSpawnerSystem.spawnByPointer(pointer);
      });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ratSpawnerSystem.stop();
      this.levelTimerSystem.stop();
      this.bossController.stop();
      this.inputController.destroy();
      this.scene.stop(SCENE_KEYS.ui);
    });
  }

  update(_time: number, delta: number): void {
    const gameStatus = this.registry.get('gameStatus');
    if (gameStatus === 'victory' || gameStatus === 'gameover') {
      return;
    }

    if (!this.player.isAlive()) {
      this.registry.set('gameStatus', 'gameover');
      this.physics.pause();
      this.ratSpawnerSystem.stop();
      this.levelTimerSystem.stop();
      this.bossController.stop();
      return;
    }

    this.registry.set('remainingRats', this.getActiveRats().length);

    this.inputController.update();
    this.player.update(delta);

    // 1. 爬管下樓檢測 (玩家在地面且在管道附近按住 S/下鍵)
    if (this.inputController.isClimbDownHeld() && this.player.y <= GAME_BALANCE.world.surfaceY + 10) {
      if (Math.abs(this.player.x - 480) < 40) {
        this.player.setPosition(480, GAME_BALANCE.world.surfaceY + 30);
        this.player.playClimbAnimation();
      }
    }

    // 2. 地下層缺氧與地面呼吸邏輯
    if (this.player.y > GAME_BALANCE.world.surfaceY + 20) {
      // 在地下層：消耗氧氣
      this.player.oxygen = Math.max(
        0,
        this.player.oxygen - GAME_BALANCE.player.oxygenUseRate * (delta / 1000)
      );

      if (this.player.oxygen <= 0) {
        if (!this.lastOxygenDamageTime) {
          this.lastOxygenDamageTime = this.time.now;
        }
        if (this.time.now - this.lastOxygenDamageTime >= GAME_BALANCE.player.oxygenDamageIntervalMs) {
          this.player.receiveRatDamage(GAME_BALANCE.player.oxygenDamage);
          this.registry.set('playerHp', this.player.hp);
          this.lastOxygenDamageTime = this.time.now;
        }
      } else {
        this.lastOxygenDamageTime = undefined;
      }
    } else {
      // 在地面層：恢復氧氣
      this.player.oxygen = Math.min(
        this.player.maxOxygen,
        this.player.oxygen + GAME_BALANCE.player.oxygenRestoreRate * (delta / 1000)
      );
      this.lastOxygenDamageTime = undefined;
    }

    // 同步氧氣至 registry
    this.registry.set('playerOxygen', this.player.oxygen);

    if (this.inputController.isAttackJustPressed()) {
      this.combatSystem.handlePlayerAttack();
    }

    if (this.inputController.isTrapJustPressed()) {
      this.trapSystem.placeTrap();
    }

    if (this.inputController.isCycleTrapJustPressed()) {
      this.trapSystem.cycleTrap();
    }

    // 技能輸入
    const skillActions: Array<[1 | 2 | 3 | 4 | 5 | 6, () => boolean]> = [
      [1, () => this.skillSystem.useQingZai()],
      [2, () => this.skillSystem.useShuangZi()],
      [3, () => this.skillSystem.useHongHui()],
      [4, () => this.skillSystem.useShiHui()],
      [5, () => this.skillSystem.useBaoYe()],
      [6, () => this.skillSystem.useAnzo()],
    ];
    for (const [key, action] of skillActions) {
      if (this.inputController.isSkillJustPressed(key)) {
        action();
        this.registry.set('skillUses', { ...this.skillSystem.getRemainingUses() });
      }
    }

    // 更新技能系統（慢速區域）
    this.skillSystem.update();

    // BOSS 碰撞傷害（接近檢測）
    const bossPos = this.bossController.getBossPosition();
    if (bossPos) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, bossPos.x, bossPos.y);
      if (dist <= GAME_BALANCE.collision.bossContactRadius) {
        this.player.receiveRatDamage(GAME_BALANCE.collision.bossDamage);
        this.registry.set('playerHp', this.player.hp);
      }
    }

    this.humanSightSystem.update();

    // 更新起司誘餌吸引系統
    TrapBaitSystem.update(this.getActiveRats(), this.trapPool.getChildren() as Trap[]);
  }

  private handleRatClimbPipe(
    ratObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    _pipeObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    const rat = ratObj as Rat;
    if (!rat.active || rat.isClimbing) {
      return;
    }

    if (rat.isPanicking) {
      rat.climb();
    }
  }

  private handlePlayerClimbPipe(
    playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    pipeObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    const player = playerObj as Player;
    if (!player.active || !player.body) {
      return;
    }

    const pipe = pipeObj as Phaser.Physics.Arcade.StaticImage;

    if (this.inputController.isClimbUpHeld()) {
      if (player.y <= GAME_BALANCE.world.surfaceY + 10) {
        const surfaceLandingY =
          GAME_BALANCE.world.surfaceY - GAME_BALANCE.world.surfacePlatformThickness / 2 - player.displayHeight / 2;
        player.setPosition(pipe.x, surfaceLandingY);
        player.setVelocityY(-60);
      } else {
        player.playClimbAnimation();
        player.setVelocityY(-180);
      }
    } else if (this.inputController.isClimbDownHeld()) {
      player.playClimbAnimation();
      player.setVelocityY(180);
    }
  }

  private getActiveRats(): Rat[] {
    const activeGreen = this.greenRatPool.getChildren().filter((r) => r.active) as Rat[];
    const activeBlue = this.blueRatPool.getChildren().filter((r) => r.active) as Rat[];
    return [...activeGreen, ...activeBlue];
  }

  private createBackground(width: number, height: number): void {
    const undergroundBg = this.add.graphics();
    undergroundBg.fillStyle(0x1a2421);
    undergroundBg.fillRect(0, GAME_BALANCE.world.surfaceY, width, height - GAME_BALANCE.world.surfaceY);

    this.add
      .text(width / 2, 30, '地面層 (人類街道)', { color: '#ffffff', fontSize: '20px', align: 'center' })
      .setOrigin(0.5);

    this.add
      .text(width / 2, GAME_BALANCE.world.surfaceY + 30, '地下層 (藍綠鼠巢穴)', {
        color: '#888888',
        fontSize: '20px',
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private createPlatforms(width: number, height: number): Phaser.Physics.Arcade.StaticGroup {
    const platforms = this.physics.add.staticGroup();

    const groundLeft = this.add.tileSprite(200, GAME_BALANCE.world.surfaceY, 400, 20, 'ground_texture');
    this.physics.add.existing(groundLeft, true);
    platforms.add(groundLeft);

    const groundRight = this.add.tileSprite(760, GAME_BALANCE.world.surfaceY, 400, 20, 'ground_texture');
    this.physics.add.existing(groundRight, true);
    platforms.add(groundRight);

    const undergroundFloor = this.add.tileSprite(width / 2, height - 20, width, 40, 'underground_texture');
    this.physics.add.existing(undergroundFloor, true);
    platforms.add(undergroundFloor);

    return platforms;
  }

  private createCommonTextures(): void {
    // Textures are pre-loaded in BootScene.ts
  }

  private spawnInitialHumans(): void {
    const human1 = this.humanPool.get() as Human | null;
    human1?.spawn(200, 200);

    const human2 = this.humanPool.get() as Human | null;
    human2?.spawn(760, 200);
  }

  private createPortal(portalX: number, portalY: number): void {
    const portal = this.add.image(portalX, portalY, 'portal_texture').setDisplaySize(60, 60);
    this.tweens.add({
      targets: portal,
      angle: 360,
      duration: 3000,
      repeat: -1,
    });
    this.tweens.add({
      targets: portal,
      alpha: 0.5,
      scaleX: 0.25,
      scaleY: 0.15,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }
}
