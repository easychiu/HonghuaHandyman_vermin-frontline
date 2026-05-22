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
import { MapLayoutSystem } from '../systems/MapLayoutSystem';
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
  private gameStarted = false; // blocked during countdown

  constructor() {
    super(SCENE_KEYS.mainGame);
  }

  create(): void {
    const { width, height } = this.scale;

    // Read mission and generate random seed for this run
    const selectedMission = this.registry.get('selectedMission') as { id?: string } | undefined;
    const missionId = selectedMission?.id ?? 'A';
    const mapSeed = Date.now() % 100000;

    // Platform group must be created before MapLayoutSystem (which adds to it)
    this.platforms = this.physics.add.staticGroup();

    // Build themed map (background + base platforms + random extras)
    this.createBasePlatforms(width, height, missionId);
    const mapLayout = new MapLayoutSystem(this, this.platforms, missionId, mapSeed);
    mapLayout.buildMap();

    // Sky color driven by theme (set before layout so gradient shows on top)
    // Theme colors are built into MapLayoutSystem; we just set camera BG here
    const skyColors: Record<string, string> = { A: '#4a4e69', B: '#6b4226', C: '#2c2c54' };
    this.cameras.main.setBackgroundColor(skyColors[missionId] ?? '#4a4e69');

    ensureHonghuaAnimations(this);

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
      onRatKilled: (_combo) => this.reputationSystem.recordRatKill(GAME_BALANCE.reputation.ratKillReward),
    });

    this.trapSystem = new TrapSystem(this, this.trapPool, this.player);

    this.skillSystem = new SkillSystem(
      this,
      this.player,
      () => this.getActiveRats(),
      (_combo) => this.reputationSystem.recordRatKill(GAME_BALANCE.reputation.ratKillReward),
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
    // Note: startAutoSpawn() is called from showCountdownThenStart() after GO!!

    this.bossController = new BossEventController({
      scene: this,
      pipeX: pipe.x,
      surfaceY: GAME_BALANCE.world.surfaceY,
      onStateChange: (active) => this.registry.set('bossActive', active),
    });

    const triggerBossRush = () => {
      this.bossController.trigger(() => this.getActiveRats());
    };

    const levelDuration = selectedMission?.duration ?? GAME_BALANCE.level.durationSeconds;

    this.levelTimerSystem = new LevelTimerSystem({
      scene: this,
      durationSeconds: levelDuration,
      onTick: (timeLeft) => {
        if (timeLeft <= GAME_BALANCE.level.bossTriggerTimeLeftSeconds + 5 && !this.registry.get('bossImminent')) {
          this.registry.set('bossImminent', true);
        }
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
    // Note: levelTimerSystem.start() is called from showCountdownThenStart() after GO!!

    if (!this.scene.isActive(SCENE_KEYS.ui)) {
      this.scene.launch(SCENE_KEYS.ui);
    }

    // Countdown before game starts
    this.gameStarted = false;
    this.showCountdownThenStart();

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
    // Block all updates during countdown
    if (!this.gameStarted) return;

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

    // Count rats on surface layer for crisis alert
    const surfaceRats = this.getActiveRats().filter(r => r.y < GAME_BALANCE.world.surfaceY + 20);
    this.registry.set('surfaceRatCount', surfaceRats.length);

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

  /**
   * Creates the fixed base platforms using mission-themed textures.
   * MapLayoutSystem adds extra platforms on top of this.
   */
  private createBasePlatforms(width: number, height: number, missionId = 'A'): void {
    const groundKey: Record<string, string> = {
      A: 'ground_texture',
      B: 'ground_b_texture',
      C: 'ground_c_texture',
    };
    const ugKey: Record<string, string> = {
      A: 'underground_texture',
      B: 'underground_b_texture',
      C: 'underground_c_texture',
    };
    const gTex = groundKey[missionId] ?? 'ground_texture';
    const uTex = ugKey[missionId] ?? 'underground_texture';

    // Store for MapLayoutSystem to reuse
    this.registry.set('mapGroundTex', gTex);
    this.registry.set('mapUgTex', uTex);

    const addTile = (x: number, y: number, w: number, h: number, texture: string) => {
      const t = this.add.tileSprite(x, y, w, h, texture);
      this.physics.add.existing(t, true);
      this.platforms.add(t);
    };

    // Surface left (pipe gap starts at x=460)
    addTile(230, GAME_BALANCE.world.surfaceY, 460, 20, gTex);
    // Surface right
    addTile(730, GAME_BALANCE.world.surfaceY, 460, 20, gTex);
    // Underground floor
    addTile(width / 2, height - 20, width, 40, uTex);
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

  /**
   * 3-2-1 倒數動畫，結束後才真正開始遊戲（啟動spawner/timer）
   */
  private showCountdownThenStart(): void {
    const { width, height } = this.scale;
    const overlay = this.add.graphics().setDepth(900);
    overlay.fillStyle(0x000000, 0.4);
    overlay.fillRect(0, 0, width, height);

    const countStyle = {
      fontFamily: '"Arial Black", Impact, sans-serif',
      fontSize: '120px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 10,
      shadow: { color: '#ffd166', fill: true, offsetX: 0, offsetY: 0, blur: 40 },
    };
    const countText = this.add.text(width / 2, height / 2, '3', countStyle)
      .setOrigin(0.5)
      .setDepth(910)
      .setScale(2);

    const missionName = this.registry.get('selectedMission')?.name ?? '任務開始';
    const subText = this.add.text(width / 2, height / 2 + 100, missionName, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(910);

    const steps = ['3', '2', '1', 'GO!!'];
    const colors = ['#ffffff', '#ffdd44', '#ff9f1c', '#ff3333'];
    let step = 0;

    const doStep = () => {
      if (step >= steps.length) {
        this.tweens.add({
          targets: [countText, subText, overlay],
          alpha: 0,
          duration: 400,
          onComplete: () => {
            countText.destroy();
            subText.destroy();
            overlay.destroy();
          },
        });
        // Actually start the game
        this.ratSpawnerSystem.startAutoSpawn();
        this.levelTimerSystem.start();
        this.gameStarted = true;
        return;
      }

      countText.setText(steps[step]).setColor(colors[step]).setScale(2.0).setAlpha(1);
      this.tweens.add({
        targets: countText,
        scale: 1.0,
        alpha: step < steps.length - 1 ? 0.3 : 1,
        duration: step < steps.length - 1 ? 800 : 600,
        ease: 'Power2',
        onComplete: () => {
          step++;
          doStep();
        },
      });
    };

    doStep();
  }

  private createPortal(portalX: number, portalY: number): void {
    const portal = this.add.image(portalX, portalY, 'portal_texture').setDisplaySize(60, 60);
    // Capture the scale AFTER setDisplaySize so breathing is relative to 60x60, not raw texture size
    const baseScaleX = portal.scaleX;
    const baseScaleY = portal.scaleY;
    this.tweens.add({
      targets: portal,
      angle: 360,
      duration: 3000,
      repeat: -1,
    });
    this.tweens.add({
      targets: portal,
      alpha: 0.6,
      scaleX: baseScaleX * 0.8,
      scaleY: baseScaleY * 0.8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }
}
