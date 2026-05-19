import Phaser from 'phaser';
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
import { TrapSystem } from '../systems/TrapSystem';

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

  constructor() {
    super(SCENE_KEYS.mainGame);
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#8d99ae');
    this.createBackground(width, height);
    this.createCommonTextures(height);
    this.platforms = this.createPlatforms(width, height);

    const pipe = this.physics.add.staticImage(480, GAME_BALANCE.world.surfaceY, 'pipe_texture').setOrigin(0.5, 0);
    pipe.refreshBody();

    this.greenRatPool = this.physics.add.group({ classType: Rat, maxSize: 100, runChildUpdate: true });
    this.blueRatPool = this.physics.add.group({ classType: Rat, maxSize: 100, runChildUpdate: true });
    this.trapPool = this.physics.add.group({ classType: Trap, maxSize: 20, runChildUpdate: false });
    this.humanPool = this.physics.add.group({ classType: Human, maxSize: 10, runChildUpdate: true });

    this.player = new Player(this, 100, 100);

    this.physics.add.collider(this.greenRatPool, this.platforms);
    this.physics.add.collider(this.blueRatPool, this.platforms);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.humanPool, this.platforms);

    this.physics.add.overlap(this.greenRatPool, pipe, this.handleRatClimbPipe, undefined, this);
    this.physics.add.overlap(this.blueRatPool, pipe, this.handleRatClimbPipe, undefined, this);

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

    this.trapSystem = new TrapSystem(this.trapPool, this.player);

    this.humanSightSystem = new HumanSightSystem({
      humanPool: this.humanPool,
      getActiveRats: () => this.getActiveRats(),
      panicRadius: GAME_BALANCE.human.sightRadius,
      onHumanSawRat: () => this.reputationSystem.penalizeHumanSight(GAME_BALANCE.reputation.humanSightPenalty),
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

    this.levelTimerSystem = new LevelTimerSystem({
      scene: this,
      durationSeconds: GAME_BALANCE.level.durationSeconds,
      onTick: (timeLeft) => {
        if (timeLeft <= GAME_BALANCE.level.bossTriggerTimeLeftSeconds) {
          triggerBossRush();
        }
      },
      onComplete: () => {
        this.ratSpawnerSystem.stop();
        this.bossController.stop();
      },
    });
    this.levelTimerSystem.start();

    if (!this.scene.isActive(SCENE_KEYS.ui)) {
      this.scene.launch(SCENE_KEYS.ui);
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.ratSpawnerSystem.spawnByPointer(pointer);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ratSpawnerSystem.stop();
      this.levelTimerSystem.stop();
      this.bossController.stop();
      this.scene.stop(SCENE_KEYS.ui);
    });
  }

  update(_time: number, delta: number): void {
    this.player.update(delta);

    if (this.player.isJustAttacking()) {
      this.combatSystem.handlePlayerAttack();
    }

    if (this.player.isJustPlacingTrap()) {
      this.trapSystem.placeTrap();
    }

    this.humanSightSystem.update();
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

    const groundLeft = platforms.create(200, GAME_BALANCE.world.surfaceY, 'ground_texture');
    groundLeft.setDisplaySize(400, 20);
    groundLeft.refreshBody();

    const groundRight = platforms.create(760, GAME_BALANCE.world.surfaceY, 'ground_texture');
    groundRight.setDisplaySize(400, 20);
    groundRight.refreshBody();

    const undergroundFloor = platforms.create(width / 2, height - 20, 'underground_texture');
    undergroundFloor.setDisplaySize(width, 40);
    undergroundFloor.refreshBody();

    return platforms;
  }

  private createCommonTextures(height: number): void {
    if (!this.textures.exists('ground_texture')) {
      const g = this.add.graphics();
      g.fillStyle(0xdddddd);
      g.fillRect(0, 0, 100, 20);
      g.generateTexture('ground_texture', 100, 20);
      g.destroy();
    }

    if (!this.textures.exists('underground_texture')) {
      const g = this.add.graphics();
      g.fillStyle(0x3e2723);
      g.fillRect(0, 0, 100, 40);
      g.generateTexture('underground_texture', 100, 40);
      g.destroy();
    }

    if (!this.textures.exists('pipe_texture')) {
      const g = this.add.graphics();
      g.fillStyle(0x555555);
      g.fillRect(0, 0, 40, height - GAME_BALANCE.world.surfaceY);
      g.generateTexture('pipe_texture', 40, height - GAME_BALANCE.world.surfaceY);
      g.destroy();
    }

    if (!this.textures.exists('rat')) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 24, 24);
      g.generateTexture('rat', 24, 24);
      g.destroy();
    }

    if (!this.textures.exists('player_texture')) {
      const g = this.add.graphics();
      g.fillStyle(0xe63946);
      g.fillRect(0, 0, 32, 48);
      g.generateTexture('player_texture', 32, 48);
      g.destroy();
    }

    if (!this.textures.exists('trap_texture')) {
      const g = this.add.graphics();
      g.fillStyle(0x9d4edd);
      g.fillRect(0, 0, 24, 8);
      g.generateTexture('trap_texture', 24, 8);
      g.destroy();
    }

    if (!this.textures.exists('human_texture')) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 24, 40);
      g.generateTexture('human_texture', 24, 40);
      g.destroy();
    }

    if (!this.textures.exists('portal_texture')) {
      const g = this.add.graphics();
      g.fillStyle(0x9d4edd, 0.8);
      g.fillCircle(20, 20, 20);
      g.generateTexture('portal_texture', 40, 40);
      g.destroy();
    }
  }

  private spawnInitialHumans(): void {
    const human1 = this.humanPool.get() as Human | null;
    human1?.spawn(200, 200);

    const human2 = this.humanPool.get() as Human | null;
    human2?.spawn(760, 200);
  }

  private createPortal(portalX: number, portalY: number): void {
    const portal = this.add.image(portalX, portalY, 'portal_texture');
    this.tweens.add({
      targets: portal,
      alpha: 0.4,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
  }
}
