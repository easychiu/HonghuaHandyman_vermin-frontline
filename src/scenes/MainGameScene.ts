import Phaser from 'phaser';
import { Rat } from '../entities/Rat';
import { Player } from '../entities/Player'; // 1. 引入主角
import { Trap } from '../entities/Trap'; // 引入陷阱類別
import { Human } from '../entities/Human'; // 1. 引入人類類別

export class MainGameScene extends Phaser.Scene {
  private ratPool!: Phaser.Physics.Arcade.Group;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private player!: Player; // 宣告主角變數
  private trapPool!: Phaser.Physics.Arcade.Group; // 宣告陷阱池
  private humanPool!: Phaser.Physics.Arcade.Group; // 2. 宣告人類池

  constructor() {
    super('MainGameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    // ==========================================
    // 1. 視覺分層 (背景)
    // ==========================================
    // 地面層天空背景 (淺藍灰色)
    this.cameras.main.setBackgroundColor('#8d99ae');

    // 地下層背景 (深暗綠色，呈現下水道的髒污感)
    const undergroundBg = this.add.graphics();
    undergroundBg.fillStyle(0x1a2421);
    // 假設地面層高度在 Y = 250，地下層從 250 一路到底
    undergroundBg.fillRect(0, 250, width, height - 250);

    this.add.text(width / 2, 30, '地面層 (人類街道)', {
        color: '#ffffff', fontSize: '20px', align: 'center'
    }).setOrigin(0.5);

    this.add.text(width / 2, 280, '地下層 (藍綠鼠巢穴)', {
        color: '#888888', fontSize: '20px', align: 'center'
    }).setOrigin(0.5);

    // ==========================================
    // 2. 建立雙層物理地形 (Platforms)
    // ==========================================
    this.platforms = this.physics.add.staticGroup();

    // 畫一個灰白色的長方形當作「地面街道」材質
    const groundGraphics = this.add.graphics();
    groundGraphics.fillStyle(0xdddddd);
    groundGraphics.fillRect(0, 0, 100, 20); // 基準大小
    groundGraphics.generateTexture('ground_texture', 100, 20);
    groundGraphics.destroy();

    // 畫一個深褐色的長方形當作「下水道底層」材質
    const undergroundGraphics = this.add.graphics();
    undergroundGraphics.fillStyle(0x3e2723);
    undergroundGraphics.fillRect(0, 0, 100, 40);
    undergroundGraphics.generateTexture('underground_texture', 100, 40);
    undergroundGraphics.destroy();

    // --- 佈置地面層 (Y = 250) ---
    // 故意在中間留一個「水溝蓋」的缺口 (X: 400 ~ 560 之間是空的)
    const groundLeft = this.platforms.create(200, 250, 'ground_texture');
    groundLeft.setDisplaySize(400, 20); // 左半邊地板
    groundLeft.refreshBody();

    const groundRight = this.platforms.create(760, 250, 'ground_texture');
    groundRight.setDisplaySize(400, 20); // 右半邊地板
    groundRight.refreshBody();

    // --- 佈置地下層底部 (Y = height - 20) ---
    const undergroundFloor = this.platforms.create(width / 2, height - 20, 'underground_texture');
    undergroundFloor.setDisplaySize(width, 40); // 鋪滿整個底部
    undergroundFloor.refreshBody();


    // ==========================================
    // 3. 建立與設定老鼠物件池
    // ==========================================
    const ratGraphics = this.add.graphics();
    ratGraphics.fillStyle(0xffffff); 
    ratGraphics.fillRect(0, 0, 24, 24);
    ratGraphics.generateTexture('rat', 24, 24);
    ratGraphics.destroy();

    this.ratPool = this.physics.add.group({
      classType: Rat,
      maxSize: 100,
      runChildUpdate: true
    });

    // 讓老鼠會與所有地形（地面層與地下層）發生碰撞
    this.physics.add.collider(this.ratPool, this.platforms);


    // ==========================================
    // 4. 測試操作：點擊畫面生成綠鼠
    // ==========================================
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const rat = this.ratPool.get() as Rat;
      if (rat) {
        // 給予一個隨機的橫向移動速度
        const randomVelocityX = Phaser.Math.Between(-150, 150);
        rat.spawn(pointer.x, pointer.y, randomVelocityX);
      }
    });
    // ==========================================
    // 新增：5. 建立主角 (紅花)
    // ==========================================
    const playerGraphics = this.add.graphics();
    playerGraphics.fillStyle(0xe63946); // 紅色方塊代表紅花
    playerGraphics.fillRect(0, 0, 32, 48); // 高度稍微拉長，像個人型
    playerGraphics.generateTexture('player_texture', 32, 48);
    playerGraphics.destroy();

    // 將紅花生成在地面層左側 (X: 100, Y: 100)
    this.player = new Player(this, 100, 100);

    // 設定主角與地形的物理碰撞
    this.physics.add.collider(this.player, this.platforms);
    // ==========================================
    // 6. 建立陷阱系統 (Trap Pool)
    // ==========================================
    // 畫一個紫色的壓扁方塊當作老鼠夾/陷阱
    const trapGraphics = this.add.graphics();
    trapGraphics.fillStyle(0x9d4edd); 
    trapGraphics.fillRect(0, 0, 24, 8);
    trapGraphics.generateTexture('trap_texture', 24, 8);
    trapGraphics.destroy();

    this.trapPool = this.physics.add.group({
      classType: Trap,
      maxSize: 20, // 限制場上最多同時存在 20 個陷阱
      runChildUpdate: false
    });

    // 設定老鼠與陷阱的重疊觸發 (Overlap，不用 Collider 因為陷阱不應該阻擋老鼠的物理移動)
    this.physics.add.overlap(
      this.ratPool, 
      this.trapPool, 
      this.handleRatHitTrap, // 觸發時呼叫的函式
      undefined, 
      this
    );
    // ==========================================
    // 7. 建立人類系統
    // ==========================================
    // 畫一個藍色的長方形當作人類
    const humanGraphics = this.add.graphics();
    humanGraphics.fillStyle(0xffffff); // 設為全白方便後續 setTint 染色
    humanGraphics.fillRect(0, 0, 24, 40);
    humanGraphics.generateTexture('human_texture', 24, 40);
    humanGraphics.destroy();

    this.humanPool = this.physics.add.group({
      classType: Human,
      maxSize: 10,
      runChildUpdate: true
    });

    // 人類也會與地形發生碰撞
    this.physics.add.collider(this.humanPool, this.platforms);

    // 測試：在遊戲開始時，在左右兩邊的地面層各生成一個人類
    const human1 = this.humanPool.get() as Human;
    human1?.spawn(200, 200);

    const human2 = this.humanPool.get() as Human;
    human2?.spawn(760, 200);
  }
  // ==========================================
  // 新增：主迴圈 (每秒執行 60 次)
  // ==========================================
  update(time: number, delta: number): void {
    if (this.player) {
      // 把 delta 傳給主角，用來計算 Coyote Time
      this.player.update(delta);
      // --- 偵測玩家攻擊 ---
      if (this.player.isJustAttacking()) {
        this.handlePlayerAttack();
      }
      // --- 偵測玩家放置陷阱 ---
      if (this.player.isJustPlacingTrap()) {
        this.placeTrap();
      }
    }
    // ==========================================
    // 偵測：人類是否看到老鼠
    // ==========================================
    const panicRadius = 100; // 人類的視力範圍（距離像素）

    // 取得所有活著的人類與老鼠
    const activeHumans = this.humanPool.getChildren().filter(h => h.active) as Human[];
    const activeRats = this.ratPool.getChildren().filter(r => r.active) as Rat[];

    activeHumans.forEach(human => {
      // 如果這個人已經在逃跑了，就不用再檢查他有沒有看到老鼠
      if (human.isPanicking) return;

      activeRats.forEach(rat => {
        // 使用 Phaser 內建的數學函式計算兩點距離
        const distance = Phaser.Math.Distance.Between(human.x, human.y, rat.x, rat.y);
        
        if (distance < panicRadius) {
          human.panic();
        }
      });
    });

  }
  // --- 新增：放置陷阱邏輯 ---
  private placeTrap(): void {
    const trap = this.trapPool.get() as Trap;
    if (trap) {
      // 將陷阱放置在紅花腳下的位置
      // 因為紅花高度是 48，腳底大約是 y + 24
      trap.spawn(this.player.x, this.player.y + 20);
    }
  }
  // --- 新增：老鼠踩到陷阱的邏輯 ---
  private handleRatHitTrap(ratObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, trapObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile): void {
    const rat = ratObj as Rat;
    const trap = trapObj as Trap;

    // 確保兩者都是啟用狀態才觸發
    if (rat.active && trap.active) {
      // 陷阱造成 2 點傷害 (剛好秒殺綠鼠，如果綠鼠血量是 2)
      rat.takeDamage(2);
      
      // 陷阱消耗掉，回收進物件池
      trap.despawn();
    }
  }
  // --- 處理攻擊邏輯與視覺特效 ---
  private handlePlayerAttack(): void {
    const attackRange = 40;  // 攻擊距離
    const attackHeight = 48; // 攻擊高度 (跟主角一樣高)
    
    // 根據紅花面向，計算攻擊框的座標
    const attackX = this.player.facingDirection === 1 
      ? this.player.x + 16 // 面向右：從角色右邊緣開始
      : this.player.x - 16 - attackRange; // 面向左：從角色左側往外推
      
    const attackY = this.player.y - 24; // 對齊角色上半部

    // 1. 視覺回饋：畫一道黃色的「劍氣/攻擊框」
    const slash = this.add.graphics();
    slash.fillStyle(0xffd166, 0.8);
    slash.fillRect(attackX, attackY, attackRange, attackHeight);
    
    // 0.1秒後讓特效自動消失
    this.time.delayedCall(100, () => slash.destroy());

    // 2. 物理判定：抓出攻擊框範圍內的所有物理實體
    const hits = this.physics.overlapRect(attackX, attackY, attackRange, attackHeight);
    
    hits.forEach(body => {
      // Phaser 的物理 body 會帶有對應的 gameObject 參考
      const entity = body.gameObject as any;
      
      // 如果打到的物件是老鼠（擁有 takeDamage 方法）
      if (entity && typeof entity.takeDamage === 'function') {
        entity.takeDamage(1); // 扣 1 滴血
      }
    });
  }
}