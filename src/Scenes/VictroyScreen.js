class VictoryScreen extends Phaser.Scene {
  constructor() {
    super("victoryScreenScene");
  }

    preload() {
        // 加载胜利场景资源
        this.load.setPath("./assets/PNG/Background/");
        this.load.image('victoryBg', 'bg_layer2.png');
        
        this.load.setPath("./assets/PNG/HUD/");
        this.load.image('trophy', 'coin_gold.png');
    }
    
    create() {
        // 添加背景和视差效果
        this.bgLayer1 = this.add.tileSprite(400, 300, 800, 600, 'victoryBg');
        
        // 添加半透明暗色遮罩，增强文本可读性
        this.add.rectangle(400, 300, 800, 600, 0x000000, 0.5);
        
        // 添加胜利标题
        this.add.text(400, 180, 'Victory!', {
            fontSize: '64px',
            fill: '#ffff00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // 添加奖杯图标
        let trophy = this.add.image(400, 280, 'trophy');
        trophy.setScale(2);
        
        // 创建闪烁效果
        this.tweens.add({
            targets: trophy,
            alpha: { from: 0.7, to: 1 },
            scale: { from: 1.8, to: 2.2 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });
        
        // 添加重新开始提示
        let restartText = this.add.text(400, 480, 'Press Space Key to start', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // 添加闪烁效果
        this.tweens.add({
            targets: restartText,
            alpha: { from: 0.5, to: 1 },
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // 监听任意键重新开始游戏
        this.input.keyboard.on('keydown', () => {
            this.scene.start('platformerScene');
        });
        
        // 监听点击事件也可以重新开始
        this.input.on('pointerdown', () => {
            this.scene.start('platformerScene');
        });
    }
    
    update() {
        // 更新背景滚动以创建视差效果
        this.bgLayer1.tilePositionX += 0.5;
    }
}
