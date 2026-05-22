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
import { AudioSystem } from '../systems/AudioSystem';
import { GameInputController } from '../input/GameInputController';
import { HazardSystem } from '../systems/HazardSystem';
import { RatFaction } from '../config/gameBalance';

export class MainGameScene extends Phaser.Scene {
  private greenRatPool!: Phaser.Physics.Arcade.Group;
  private blueRatPool!: Phaser.Physics.Arcade.Group;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private player!: Player;
  private trapPool!: Phaser.Physics.Arcade.Group;
  private humanPool!: Phaser.Physics.Arcade.Group;

  // Custom pools for items and coins
  private coinPool!: Phaser.Physics.Arcade.Group;
  private supplyDropPool!: Phaser.Physics.Arcade.Group;

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

  // Custom states
  private magnetTimeLeft = 0;
  
  public hazardSystem!: HazardSystem;
  private timeElapsedSeconds = 0;
  private hordeTriggered = false;
  private floodTriggered = false;
  private isSewersFlooded = false;
  private floodParticles?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super(SCENE_KEYS.mainGame);
  }

  create(): void {
    // Read mission and generate random seed for this run
    const selectedMission = this.registry.get('selectedMission') as { id?: string } | undefined;
    const missionId = selectedMission?.id ?? 'A';
    const mapSeed = Date.now() % 100000;

    // Play appropriate BGM based on theme (Sewers vs. Night Market/Street)
    const bgmKey = (missionId === 'C' || missionId === 'D') ? 'bgm_darkpip' : 'bgm_funny';
    AudioSystem.playBgm(this, bgmKey, 0.25);

    const { width, height } = this.scale;

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

    // 建立一個隱形的橋（Gap Bridge）覆蓋中央水溝開口 (x=460 ~ 500)
    // 專供路人行走，這樣路人就能直接路過中央管道口而不掉下去
    const gapBridge = this.physics.add.staticImage(480, GAME_BALANCE.world.surfaceY, 'ground_texture');
    gapBridge.setDisplaySize(40, 20);
    gapBridge.refreshBody();
    gapBridge.setVisible(false); // 隱形不破壞畫面

    this.greenRatPool = this.physics.add.group({ classType: Rat, maxSize: 100, runChildUpdate: true });
    this.blueRatPool = this.physics.add.group({ classType: Rat, maxSize: 100, runChildUpdate: true });
    this.trapPool = this.physics.add.group({ classType: Trap, maxSize: 20, runChildUpdate: false });
    this.humanPool = this.physics.add.group({ classType: Human, maxSize: 10, runChildUpdate: true });

    // Custom coin and supply drop pools
    this.coinPool = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 100 });
    this.supplyDropPool = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: 10 });

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
    this.physics.add.collider(this.humanPool, gapBridge);

    // Colliders for items and coins on platforms
    this.physics.add.collider(this.coinPool, this.platforms);
    this.physics.add.collider(this.supplyDropPool, this.platforms);

    // Overlaps for item collection
    this.physics.add.overlap(this.player, this.coinPool, this.handleCollectCoin, undefined, this);
    this.physics.add.overlap(this.player, this.supplyDropPool, this.handleCollectSupplyDrop, undefined, this);

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
          const profile = GAME_BALANCE.rat.profiles[rat.faction];
          this.player.receiveRatDamage(profile.damage);
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
          const profile = GAME_BALANCE.rat.profiles[rat.faction];
          this.player.receiveRatDamage(profile.damage);
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
      onRatKilled: (rat, _combo) => this.handleRatKilled(rat),
    });

    this.trapSystem = new TrapSystem(this, this.trapPool, this.player);

    this.skillSystem = new SkillSystem(
      this,
      this.player,
      () => this.getActiveRats(),
      (rat, _combo) => this.handleRatKilled(rat),
    );
    // 初始化技能使用次數到 registry
    this.registry.set('skillUses', { ...this.skillSystem.getRemainingUses() });

    this.humanSightSystem = new HumanSightSystem({
      humanPool: this.humanPool,
      getActiveRats: () => this.getActiveRats(),
      panicRadius: GAME_BALANCE.human.sightRadius,
      onHumanSawRat: () => this.reputationSystem.recordScaredHuman(GAME_BALANCE.reputation.humanSightPenalty),
    });

    this.hazardSystem = new HazardSystem(this, missionId, this.player, () => this.getActiveRats(), this.platforms);

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

    // Periodically spawn new civilians from the edges to maintain a lively street
    this.time.addEvent({
      delay: 7000, // Check every 7 seconds
      callback: this.spawnNewCivilianFromEdge,
      callbackScope: this,
      loop: true
    });

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
      if (this.hazardSystem) {
        this.hazardSystem.destroy();
      }
      this.scene.stop(SCENE_KEYS.ui);
    });
  }

  update(_time: number, delta: number): void {
    // Block all updates during countdown
    if (!this.gameStarted) return;

    this.timeElapsedSeconds += delta / 1000;

    // Update Hazard System
    this.hazardSystem.update(delta);

    const { width, height } = this.scale;

    // 1. Vermin Horde Event at 25s
    if (this.timeElapsedSeconds >= 25 && !this.hordeTriggered) {
      this.hordeTriggered = true;
      this.cameras.main.shake(500, 0.015);
      AudioSystem.playAlarm();

      // Show warning banner
      const bannerBg = this.add.graphics().setDepth(1500);
      bannerBg.fillStyle(0xcc0000, 0.85);
      bannerBg.fillRect(0, height / 2 - 50, width, 100);

      const bannerText = this.add.text(width / 2, height / 2, '🚨 警告：大量鼠群正從兩側湧入！ 🚨', {
        fontFamily: '"Microsoft JhengHei", "Arial Black", sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(1501);

      this.tweens.add({
        targets: [bannerBg, bannerText],
        alpha: { start: 1, end: 0.1 },
        yoyo: true,
        duration: 300,
        repeat: 5,
        onComplete: () => {
          bannerBg.destroy();
          bannerText.destroy();
        }
      });

      // Spawn 12 rats over 3 seconds
      for (let i = 0; i < 12; i++) {
        this.time.delayedCall(i * 250, () => {
          const fromLeft = Phaser.Math.Between(0, 1) === 0;
          const isSurface = Phaser.Math.Between(0, 1) === 0;
          const x = fromLeft ? -20 : width + 20;
          const y = isSurface ? GAME_BALANCE.world.surfaceY - 20 : height - 60;
          const velX = fromLeft ? Phaser.Math.Between(100, 220) : Phaser.Math.Between(-220, -100);
          
          let faction: RatFaction;
          if (isSurface) {
            const roll = Math.random();
            if (roll < 0.5) faction = 'green';
            else if (roll < 0.75) faction = 'red';
            else if (roll < 0.9) faction = 'yellow';
            else faction = 'orange';
          } else {
            const roll = Math.random();
            if (roll < 0.5) faction = 'blue';
            else if (roll < 0.75) faction = 'purple';
            else if (roll < 0.9) faction = 'cyan';
            else faction = 'orange';
          }
          this.ratSpawnerSystem.spawn(faction, x, y, velX);
        });
      }
    }

    // 2. Sewer Flood Event at 42s
    if (this.timeElapsedSeconds >= 42 && !this.floodTriggered) {
      this.floodTriggered = true;
      this.cameras.main.shake(500, 0.01);
      AudioSystem.playAlarm();

      // Show flood warning banner
      const bannerBg = this.add.graphics().setDepth(1500);
      bannerBg.fillStyle(0x0066cc, 0.85);
      bannerBg.fillRect(0, height / 2 - 50, width, 100);

      const bannerText = this.add.text(width / 2, height / 2, '🌊 警告：下水道水位暴漲！氧氣消耗加倍！ 🌊', {
        fontFamily: '"Microsoft JhengHei", "Arial Black", sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(1501);

      this.tweens.add({
        targets: [bannerBg, bannerText],
        alpha: { start: 1, end: 0.1 },
        yoyo: true,
        duration: 300,
        repeat: 5,
        onComplete: () => {
          bannerBg.destroy();
          bannerText.destroy();
        }
      });

      // Spawn translucent water
      const floodGraphics = this.add.graphics().setDepth(500);
      floodGraphics.fillStyle(0x0077be, 0.45);
      floodGraphics.fillRect(0, 0, width, height - GAME_BALANCE.world.surfaceY);
      floodGraphics.y = height;

      this.tweens.add({
        targets: floodGraphics,
        y: GAME_BALANCE.world.surfaceY,
        duration: 1500,
        ease: 'Quad.easeOut',
        onStart: () => {
          this.isSewersFlooded = true;
        }
      });

      // Spawn bubbles
      this.floodParticles = this.add.particles(0, 0, 'flame_particle', {
        scale: { start: 0.3, end: 0.1 },
        alpha: { start: 0.5, end: 0 },
        tint: 0xa8dadc,
        speedY: { min: -40, max: -80 },
        speedX: { min: -10, max: 10 },
        lifespan: 1200,
        frequency: 100,
        emitZone: {
          type: 'random',
          source: new Phaser.Geom.Rectangle(0, GAME_BALANCE.world.surfaceY, width, height - GAME_BALANCE.world.surfaceY)
        }
      }).setDepth(501);

      // Recede after 10 seconds
      this.time.delayedCall(10000, () => {
        this.tweens.add({
          targets: floodGraphics,
          y: height,
          duration: 1500,
          ease: 'Quad.easeIn',
          onComplete: () => {
            this.isSewersFlooded = false;
            floodGraphics.destroy();
            if (this.floodParticles) {
              this.floodParticles.destroy();
              this.floodParticles = undefined;
            }
          }
        });
      });
    }

    if (this.isSewersFlooded) {
      // Force sewer rats to panic
      this.getActiveRats().forEach(rat => {
        if (rat.active && rat.y > GAME_BALANCE.world.surfaceY + 20 && !rat.isPanicking) {
          rat.panic();
        }
      });
    }

    // Ticking active buff timers
    if (this.magnetTimeLeft > 0) {
      this.magnetTimeLeft = Math.max(0, this.magnetTimeLeft - delta / 1000);
      this.registry.set('magnetTimeLeft', this.magnetTimeLeft);
    } else {
      this.registry.set('magnetTimeLeft', 0);
    }

    if (this.player.active) {
      this.registry.set('speedBoostTimeLeft', this.player.getSpeedBoostTimeLeft());
    } else {
      this.registry.set('speedBoostTimeLeft', 0);
    }

    // Vacuum / Magnet coin pull
    const isMagnetActive = this.magnetTimeLeft > 0;
    this.coinPool.getChildren().forEach((coinObj) => {
      const coin = coinObj as Phaser.Physics.Arcade.Image;
      if (!coin.active) return;
      
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, coin.x, coin.y);
      if (isMagnetActive || distance < 100) {
        const body = coin.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setAllowGravity(false);
          const angle = Phaser.Math.Angle.Between(coin.x, coin.y, this.player.x, this.player.y);
          const speed = isMagnetActive ? 450 : 250;
          body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        }
      } else {
        const body = coin.body as Phaser.Physics.Arcade.Body;
        if (body && !body.allowGravity) {
          body.setAllowGravity(true);
        }
      }
    });

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
      const drainMult = this.isSewersFlooded ? 2 : 1;
      this.player.oxygen = Math.max(
        0,
        this.player.oxygen - GAME_BALANCE.player.oxygenUseRate * drainMult * (delta / 1000)
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

  private handleRatKilled(rat: Rat): void {
    let points = GAME_BALANCE.reputation.ratKillReward;
    let goldReward = 0;
    let floatingTextColor = '#ffb703';

    if (rat.faction === 'yellow') {
      points = 3;
      goldReward = 15;
      floatingTextColor = '#ffb703';
    } else if (rat.faction === 'white') {
      points = 5;
      goldReward = 30;
      floatingTextColor = '#ffffff';
    } else if (rat.faction === 'black') {
      points = 2;
      goldReward = 5;
      floatingTextColor = '#b388ff';
    } else if (rat.faction === 'orange') {
      points = 4;
      goldReward = 10;
      floatingTextColor = '#ff6d00';
    } else if (rat.faction === 'cyan') {
      points = 2;
      goldReward = 8;
      floatingTextColor = '#00e5ff';
    }

    if (goldReward > 0) {
      this.spawnPhysicalCoins(rat.x, rat.y, goldReward);
    }
    this.reputationSystem.recordRatKill(points);

    // Roll for supply drop (20% total chance)
    const roll = Math.random();
    if (roll < 0.20) {
      let itemType = 'bubble_tea';
      if (roll < 0.10) {
        itemType = 'bubble_tea'; // 10%
      } else if (roll < 0.15) {
        itemType = 'betel_nut_box'; // 5%
      } else {
        itemType = 'magnet'; // 5%
      }
      this.spawnSupplyDrop(rat.x, rat.y, itemType);
    }
  }

  public showFloatingGoldText(x: number, y: number, amount: number, textColor = '#ffb703'): void {
    const txt = this.add
      .text(x, y - 20, `+$${amount} GOLD`, {
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: '18px',
        color: textColor,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(300);

    this.tweens.add({
      targets: txt,
      y: txt.y - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
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
    // 隨機生成數量 (3 ~ 6 個)
    const count = Phaser.Math.Between(3, 6);
    for (let i = 0; i < count; i++) {
      const human = this.humanPool.get() as Human | null;
      if (human) {
        // 隨機分配在左半邊或右半邊的街道上
        const onLeft = Phaser.Math.Between(0, 1) === 0;
        const x = onLeft 
          ? Phaser.Math.Between(50, 400) 
          : Phaser.Math.Between(560, 910);
        human.spawn(x, 200);
      }
    }
  }

  private spawnNewCivilianFromEdge(): void {
    // 遊戲未開始或已結束時不生成路人
    if (!this.gameStarted) return;
    const gameStatus = this.registry.get('gameStatus');
    if (gameStatus === 'victory' || gameStatus === 'gameover') return;

    const activeCount = this.humanPool.countActive(true);
    if (activeCount >= 6) {
      return; // 街上路人已達上限 (最多 6 個)
    }

    const human = this.humanPool.get() as Human | null;
    if (human) {
      // 隨機從左邊或右邊螢幕外生成
      const fromLeft = Phaser.Math.Between(0, 1) === 0;
      if (fromLeft) {
        // 從左側螢幕外生成，向右走
        human.spawn(-20, 200, 1);
      } else {
        // 從右側螢幕外生成，向左走
        human.spawn(this.scale.width + 20, 200, -1);
      }
    }
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
    });
  }

  private spawnPhysicalCoins(x: number, y: number, amount: number): void {
    const coinCount = Math.max(1, Math.floor(amount / 5));
    const remainder = amount % 5;
    
    for (let i = 0; i < coinCount; i++) {
      const coin = this.coinPool.get(x, y, 'gold_coin') as Phaser.Physics.Arcade.Image;
      if (coin) {
        coin.setActive(true);
        coin.setVisible(true);
        coin.setPosition(x, y);
        this.physics.add.existing(coin);
        
        const body = coin.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setAllowGravity(true);
          body.setBounce(0.4);
          body.setDragX(10);
          body.setCollideWorldBounds(true);
          
          const velX = Phaser.Math.Between(-150, 150);
          const velY = Phaser.Math.Between(-250, -100);
          body.setVelocity(velX, velY);
        }
        
        const val = (i === coinCount - 1 && remainder > 0) ? (5 + remainder) : 5;
        coin.setData('goldValue', val);
      }
    }
  }

  private handleCollectCoin(
    _playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    coinObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ): void {
    const coin = coinObj as Phaser.Physics.Arcade.Image;
    if (!coin.active) return;
    
    const val = coin.getData('goldValue') ?? 5;
    
    const curGold = this.registry.get('persistent_gold') as number ?? 200;
    const newGold = curGold + val;
    this.registry.set('persistent_gold', newGold);
    localStorage.setItem('honghua_gold', newGold.toString());
    
    this.showFloatingGoldText(coin.x, coin.y, val);
    
    AudioSystem.playCoin();
    
    coin.destroy();
  }

  private spawnSupplyDrop(x: number, y: number, itemType: string): void {
    const item = this.supplyDropPool.get(x, y, itemType) as Phaser.Physics.Arcade.Sprite;
    if (item) {
      item.setActive(true);
      item.setVisible(true);
      item.setPosition(x, y);
      item.setTexture(itemType);
      this.physics.add.existing(item);
      
      const body = item.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setAllowGravity(true);
        body.setBounce(0.2);
        body.setCollideWorldBounds(true);
        body.setVelocityY(-150);
      }
      
      item.setData('itemType', itemType);
      
      this.tweens.add({
        targets: item,
        scaleX: 1.1,
        scaleY: 1.1,
        yoyo: true,
        duration: 800,
        repeat: -1
      });
    }
  }

  private handleCollectSupplyDrop(
    _playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    supplyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ): void {
    const supply = supplyObj as Phaser.Physics.Arcade.Sprite;
    if (!supply.active) return;
    
    const itemType = supply.getData('itemType') ?? 'bubble_tea';
    
    if (itemType === 'bubble_tea') {
      this.player.heal(3);
      this.player.boostSpeed(1.5, 5000);
      this.showBuffFloatingText(this.player.x, this.player.y - 40, '珍奶! HP+3 & 速度上升!', '#44ff44');
      AudioSystem.playPowerup();
    } else if (itemType === 'betel_nut_box') {
      this.skillSystem.refillSkills();
      this.registry.set('skillUses', { ...this.skillSystem.getRemainingUses() });
      this.showBuffFloatingText(this.player.x, this.player.y - 40, '檳榔攤補給! 技能次數全滿!', '#ffff44');
      AudioSystem.playPowerup();
    } else if (itemType === 'magnet') {
      this.magnetTimeLeft = 8.0;
      this.registry.set('magnetTimeLeft', this.magnetTimeLeft);
      this.showBuffFloatingText(this.player.x, this.player.y - 40, '磁鐵! 吸引金幣!', '#00e5ff');
      AudioSystem.playPowerup();
    }
    
    supply.destroy();
  }

  private showBuffFloatingText(x: number, y: number, text: string, color: string): void {
    const txt = this.add.text(x, y, text, {
      fontFamily: '"Arial Black", Impact, sans-serif',
      fontSize: '18px',
      color: color,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
      targets: txt,
      y: txt.y - 60,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }
}
