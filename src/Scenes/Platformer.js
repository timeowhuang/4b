/*Eren Huang 
SlugID: 2140894
6-8-25


  Core game scene implementing a side-scroller platformer.
  - Handles player movement, physics, camera scrolling
  - Generates and animates tile layers, coins, enemies, items, moving platforms, and boss
  - Manages game state: death, checkpoints, level transitions

*/





class Platformer extends Phaser.Scene {
  constructor() {
    super("platformerScene");
  }

  init() {
    // --- Physics constants for player movement on solid ground ---
    this.ACCELERATION = 1000;    // Horizontal force applied when input is held
    this.DRAG = 1200;            // Deceleration when no horizontal input
    this.physics.world.gravity.y = 2000;  // Base gravitational pull on all bodies
    this.JUMP_VELOCITY = -850;    // Instantaneous upward velocity on ground jump
    this.MAX_X_VEL = 400;        // Cap on horizontal speed
    this.MAX_Y_VEL = 1000;       // Cap on vertical speed

    // --- Enemy AI movement speed ---
    this.ENEMY_SPEED = 100;

    // --- Camera pagination and scroll offsets ---
    this.SCENE_HEIGHT = 19 * 18 * SCALE;  // Height of one vertical map section
    this.SCROLL_HEIGHT = 17 * 18 * SCALE; // Vertical camera jump per section
    this.targetScrollY = 0;               // Desired Y for smooth camera interpolation

    // --- Water physics parameters and state ---
    this.isSubmerged = false;               // True while touching water tiles
    this.WATER_GRAVITY = 250;               // Lower gravity in water zones
    this.WATER_JUMP_VELOCITY = -100;        // Upward speed when jumping underwater
    this.WATER_ACCELERATION = 150;          // Horizontal acceleration in water
    this.WATER_DRAG = 800;                  // Horizontal drag in water
    this.waterTiles = [];                   // Store references to water tile bodies
    this.EXIT_WATER_JUMP_VELOCITY = -600;   // Boost applied when exiting water during jump
    this.WATER_MAX_X_VEL = 200;             // Horizontal speed cap underwater
    this.WATER_MAX_Y_VEL = 500;             // Vertical speed cap underwater

    // --- Climbing (ladder) parameters and state ---
    this.isClimbed = false;                 // True while overlapping climbable tiles
    this.CLIMB_GRAVITY = 250;               // Reduced gravity while climbing
    this.CLIMB_ACCELERATION = 150;          // Rarely used: horizontal movement while climbing
    this.CLIMB_DRAG = 800;                  // Drag while climbing to simulate friction
    this.climbTiles = [];                   // Store references to climbable tile bodies
    this.EXIT_CLIMB_JUMP_VELOCITY = -600;   // Boost on exiting climb when jump key pressed
    this.CLIMB_MAX_X_VEL = 200;             // Max horizontal speed while climbing
    this.CLIMB_MAX_Y_VEL = 500;             // Max vertical speed while climbing

    // --- Moving platform speed ---
    this.PLATFORM_SPEED = 80;               // Speed of auto-patrolling platforms

    // --- Spike trap detection bodies ---
    this.spikesTiles = [];                  // Bodies for spike collision (fatal)

    // --- Tile animation settings (water, flag, etc.) ---
    this.animationFreq = 250;               // Milliseconds between tile-frame toggles
    this.animationQueue = {
      water: [34, 54],  // Indices toggled to animate water surface
      flag:  [112,113], // Indices toggled to animate flag pole
    };

    // --- Game state flags and music ---
    this.isDead = false;            // True while player death animation plays
    this.currentCheckpoint = null;  // Position of last activated checkpoint
    this.music = this.sound.add("music", { loop: true, volume: 0.20 });
  }



  
  create() {
  // Load the main level geometry from the tilemap data (TMJ) loaded in preload().
  // Parameters: key, tile width, tile height, map width in tiles, map height in tiles.
    this.map = this.add.tilemap("platformer-level-1", 18, 18, 120, 20);
    this.backgroundMap = this.add.tilemap(
      "platformer-level-1B",
      24,
      24,
      90,
      15
    );


    this.ammo = 0;   // Track how many bullets the player can fire.
    this.uiCoins = this.add.group({   // UI group for on-screen coin icons (fixed to camera).
      classType: Phaser.GameObjects.Image,
      runChildUpdate: false // these icons don't need their own update()
    });

  // Physics-enabled group for bullets the player shoots.
    this.bullets = this.physics.add.group({
      classType: Phaser.GameObjects.Image,
      runChildUpdate: false
    });
    
      // Link the tilemap's tileset name ("kenny_tilemap_packed") to the loaded texture key "tilemap_tiles"
    this.tileset = this.map.addTilesetImage( 
      "kenny_tilemap_packed",
      "tilemap_tiles"
    );
    this.backgroundTileset = this.backgroundMap.addTilesetImage(
      "tilemap-backgrounds_packed",
      "tilemap-backgrounds_packed"
    );

    this.backgroundLayer = this.backgroundMap  // Create the far background layer for parallax effect
      .createLayer("background", this.backgroundTileset, 0, 0)
      .setScrollFactor(0.25)
      .setScale(SCALE);

    this.cloudsLayer = this.map   // Mid-distance layer for clouds or similar elements
      .createLayer("Clouds", this.tileset, 0, 0)
      .setScrollFactor(0.5)
      .setScale(SCALE);

    this.groundLayer = this.map
      .createLayer("Ground-n-Platforms", this.tileset, 0, 0)
      .setScale(SCALE);

    this.trapLayer = this.map
      .createLayer('Trap', this.tileset, 0, 0)
      .setScale(SCALE);


  // Find the Tiled object named "playerSpawn" to get spawn coordinates
    this.playerSpawn = this.map.findObject(
      "Objects",
      (obj) => obj.name === "playerSpawn"
    );
    my.sprite.player = this.physics.add
      .sprite(
        this.playerSpawn.x * SCALE,
        this.playerSpawn.y * SCALE,
        "platformer_characters",
        "tile_0000.png"
      )
      .setScale(SCALE)
      .setMaxVelocity(this.MAX_X_VEL, this.MAX_Y_VEL);

        // Pre-create a particle manager for coin/“star” effects (quantity 0, on-demand)
    this.coinVfxEffect = this.add.particles(0, 0, 'star', {
                speed:     { min: -100, max: 100 },
                scale:     { start: 0.03, end: 0.01 },
                lifespan:  500,
                blendMode: 'ADD',
                quantity:  0,              
                on:   false                
    });

// Generate Tiled objects
    this.createCoins();
    this.createEnemies();
    this.createItemBoxes();
    this.createMovingPlatforms();
    this.createBoss();

    this.groundLayer.setCollisionByProperty({   // Tell collider to treat tiles with property `collides: true` as solid
      collides: true,
    });
    
  // For each water tile, create an invisible physics body for overlap detection
    this.groundLayer.forEachTile((tile) => {
      if (tile.properties && tile.properties.water) {
        this.waterTiles.push(tile);
        const waterBody = this.add.rectangle(
          tile.pixelX * SCALE + (tile.width * SCALE) / 2,
          tile.pixelY * SCALE + (tile.height * SCALE) / 2,
          tile.width * SCALE,
          tile.height * SCALE,
          0x0000ff,
          0
        );
        this.physics.add.existing(waterBody, true);
        tile.waterBody = waterBody;
      }
    });

  // For each climbable tile, similarly create an overlap body
    this.groundLayer.forEachTile((tile) => {
      if (tile.properties && tile.properties.climb) {
        this.climbTiles.push(tile);
        const climbBody = this.add.rectangle(
          tile.pixelX * SCALE + (tile.width * SCALE) / 2,
          tile.pixelY * SCALE + (tile.height * SCALE) / 2,
          tile.width * SCALE,
          tile.height * SCALE,
          0x0000ff,
          0
        );
        this.physics.add.existing(climbBody, true);
        tile.climbBody = climbBody;
      }
    });


  // Collect spike tiles and set up their hitboxes
    this.spikesTiles = [];
this.trapLayer.forEachTile((tile) => {
  if (tile.properties && tile.properties.spikes) {
    this.spikesTiles.push(tile);
    const spikeBody = this.add.rectangle(
      tile.pixelX * SCALE + tile.width * SCALE*0.5,
      tile.pixelY * SCALE + tile.height * SCALE - 6,
      tile.width * SCALE,
      tile.height/2 * SCALE
    );
    this.physics.add.existing(spikeBody, true);
    tile.spikeBody = spikeBody;
    
  }
});

  // Overlap handling: entering water triggers splash and gravity change
    this.waterTiles.forEach((tile) => {
      this.physics.add.overlap(my.sprite.player, tile.waterBody, () => {
        if (!this.isSubmerged) {
          this.isSubmerged = true;
          my.sprite.player.setVelocityY(60);
          this.sound.play("splash");
          this.physics.world.gravity.y = this.WATER_GRAVITY;
        }
      });
    });

    this.climbTiles.forEach((tile) => {
      this.physics.add.overlap(my.sprite.player, tile.climbBody, () => {
        if (!this.isClimbed) {
          this.isClimbed = true;
          this.physics.world.gravity.y = this.CLIMB_GRAVITY;
        }
      });
    });

  // Overlap handling: touching spikes kills the player
    this.spikesTiles.forEach((tile) => {
      this.physics.add.overlap(my.sprite.player, tile.spikeBody, () => {
        if (!this.isDead) {
          this.playerDeath();
        }
      });
    });

      // Every 50ms, verify if player has exited water
    this.waterCheckTimer = this.time.addEvent({
      delay: 50,
      callback: this.checkWaterState,
      callbackScope: this,
      loop: true,
    });

      // Every 50ms, verify if player has exited a climbable area
    this.climbCheckTimer = this.time.addEvent({
      delay: 50,
      callback: this.checkClimbState,
      callbackScope: this,
      loop: true,
    });



    const mapWidth = this.map.widthInPixels * SCALE;
    const mapHeight = this.map.heightInPixels * SCALE;

    this.physics.add.collider(my.sprite.player, this.groundLayer);
// Constrain the physics world bounds to the map dimensions
    const leftWall = this.add
      .rectangle(0, 0, 1, mapHeight, 0x000000, 0)
      .setOrigin(0, 0);
    this.physics.add.existing(leftWall, true);
    this.physics.add.collider(my.sprite.player, leftWall);
    this.physics.world.bounds.setTo(
      0,
      0,
      this.map.widthInPixels * SCALE,
      this.map.heightInPixels * SCALE
    );

      // Constrain the camera to the same world rectangle
    this.cameras.main.setBounds(
      0,
      0,
      this.map.widthInPixels * SCALE,
      this.map.heightInPixels * SCALE
    );


  // Prevent bullets from passing through solid ground: destroy them on collision
    this.physics.add.collider(this.bullets, this.groundLayer,
      (bullet, tile) => {bullet.destroy();
      }
    );

  // Make the camera follow the player smoothly
    this.cameras.main.startFollow(my.sprite.player, true, 0, 0);

    this.cameras.main.on("followupdate", (camera) => {
      const targetX = my.sprite.player.x - camera.width / 2;
      camera.scrollX = Phaser.Math.Clamp(
        targetX,
        0,
        this.map.widthInPixels * SCALE - camera.width
      );

      const playerScene = Math.floor(my.sprite.player.y / this.SCENE_HEIGHT);
      this.targetScrollY = playerScene * this.SCROLL_HEIGHT;

      camera.scrollY = Phaser.Math.Linear(
        camera.scrollY,
        this.targetScrollY,
        0.1
      );
    });

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.ammo <= 0) return;      // ammo =  0 no shoot
      this.ammo -= 1;      // -ammo# and UI
      this.updateUICoins();
      this.fireBullet();      // Create Bullet
    });




  // 'D' toggles physics debug drawing on/off
    this.physics.world.drawDebug = false;
    this.input.keyboard.on(
      "keydown-D",
      () => {
        this.physics.world.drawDebug = this.physics.world.drawDebug
          ? false
          : true;
        this.physics.world.debugGraphic.clear();
      },
      this
    );

  // Animate certain tile indices (water, flags) every animationFreq ms
    this.tileAnimationTimer = this.time.addEvent({
      delay: this.animationFreq,
      callback: this.animateTiles,
      callbackScope: this,
      loop: true,
    });

    cursors = this.input.keyboard.createCursorKeys();  // Locate the checkpoint spawn object in Tiled
    this.checkpoint = this.map.findObject(
      "Objects",
      (obj) => obj.name === "checkpointSpawn"
    );
    this.victoryFlag = this.map.findObject(   // Locate the victory flag object in Tiled
      "Objects",
      (obj) => obj.name === "victoryFlag"
    );
    this.music.play();
  }

//Coins creatation and collision with player
  createCoins() {
    this.coins = this.map.createFromObjects("Objects", {
      name: "coin",
      key: "tilemap_tiles",
      frame: 151,
    });

    this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);
    this.coins.map((coin) => {
      coin.setScale(SCALE);
      coin.x = coin.x * SCALE;
      coin.y = coin.y * SCALE;
      coin.body.x = coin.x;
      coin.body.y = coin.y;
      coin.body.setCircle(5 * SCALE).setOffset(-5 * SCALE, -5 * SCALE);
      coin.anims.play("coin");
    });
    this.coinGroup = this.add.group(this.coins);

    this.physics.add.overlap(my.sprite.player, this.coinGroup, (obj1, obj2) => {
      const { x, y } = obj2;
      obj2.destroy();
        this.coinVfxEffect.explode(10, x, y);
        this.sound.play("coin_collect");

        this.ammo += 1;
        this.updateUICoins();

      
    });
  }

//ItemBoxes creatation and collision with player
createItemBoxes() {
  // 1) Instantiate sprites from Tiled objects with name "itemBox"
  //    - key: the texture atlas key where the box tile is located
  //    - frame: the initial frame index for the closed box
  this.itemBoxes = this.map.createFromObjects("Objects", {
    name: "itemBox",
    key: "tilemap_tiles",
    frame: 10,
  });

  // 2) Enable Arcade physics bodies on all the itemBox sprites
  //    Using STATIC_BODY so they do not move when collided with
  this.physics.world.enable(
    this.itemBoxes,
    Phaser.Physics.Arcade.STATIC_BODY
  );

  // 3) Iterate through each box to configure its display and body
  this.itemBoxes.forEach(itemBox => {
    // a) Scale up from base tile size to match game world units
    itemBox.setScale(SCALE);

    // b) Convert Tiled coordinates (in tiles) to world pixels
    itemBox.x = itemBox.x * SCALE;
    itemBox.y = itemBox.y * SCALE;
    // c) Sync the physics body position to the sprite position
    itemBox.body.x = itemBox.x;
    itemBox.body.y = itemBox.y;

    // d) Resize the static body to tightly fit the box graphic
    //    Width/height are 18 pixels at base tile resolution
    itemBox.body
      .setSize(18 * SCALE, 18 * SCALE)
      // Offset the body so it's centered under the sprite
      .setOffset(-9 * SCALE, -9 * SCALE);

    // e) Custom flags for tracking activation and original position:
    //    - isActivated: whether the box has already been hit
    //    - originalY: store the starting Y to bounce it back later
    itemBox.isActivated = false;
    itemBox.originalY = itemBox.y;
  });

  // 4) Group all itemBox sprites for easy collision handling
  this.itemBoxGroup = this.add.group(this.itemBoxes);

  // 5) Add a collider between the player and the box group
  //    Callback handles the “hit-from-below” logic
  this.physics.add.collider(
    my.sprite.player,
    this.itemBoxGroup,
    (player, box) => {
      // Compute key vertical values:
      const playerTop   = player.body.y;                  // Y of player's top
      const boxTop      = box.body.y;                     // Y of top of box
      const boxBottom   = box.body.y + box.body.height;   // Y of box's bottom

      // Check conditions for a valid “hit-from-below”:
      // - Player's top edge is between bottom and top of box
      // - Player is not moving vertically (standing/jumping exactly into it)
      // - Box has not been activated yet
      if (
        playerTop <= boxBottom &&
        playerTop >= boxTop &&
        player.body.velocity.y === 0 &&
        !box.isActivated
      ) {
        // Mark box as used so it can't be re-triggered
        box.isActivated = true;
        // Swap its tile/frame to the “activated” frame (e.g. an open box)
        box.setFrame(30);

        // Play the coin spawn visual effect at the box location
        this.coinVfxEffect.explode(3, box.x, box.y);
        // Play the coin collection sound
        this.sound.play("coin_collect");

        // Increase player ammo (number of bullets) by one
        this.ammo += 1;
        // Refresh the on-screen coin/bullet UI icons
        this.updateUICoins();

        // Animate the box moving up by 10 pixels, then back down (yoyo)
        this.tweens.add({
          targets: box,
          y: box.originalY - 10 * SCALE,
          duration: 150,
          yoyo: true,
          ease: "Sine.easeInOut",
        });

        // Return false to skip default collision separation
        // so the player can continue moving through the box
        return false;
      }
      // Otherwise, if the player is falling onto the box from above,
      // allow the normal collision response so the player lands on it
      else if (player.body.velocity.y > 0 && playerTop >= boxTop) {
        return true;
      }
    }
  );
}


updateUICoins() {
  this.uiCoins.clear(true, true);

  const startX = 16;          // x for  UI coin
  const startY = 16;          // y for  UI coin
  const spacing = 32;         // space for each UI coin

  for (let i = 0; i < this.ammo; i++) {
    const icon = this.add
      .image(startX + i * spacing, startY, "coin_gold")
      .setScrollFactor(0)     // set it on the screen follow the camera
      .setOrigin(0, 0)
      .setDepth(1000);        // make sure is seen

    // sizing 
    icon.setDisplaySize(24, 24);

    // add to coin UI
    this.uiCoins.add(icon);
  }
}

// ===== new function：shoot a bullet as the coins =====
fireBullet() {
  // —— delete the last coin UI —— 
  const icons = this.uiCoins.getChildren();
  if (icons.length > 0) {
    icons[icons.length - 1].destroy();
  }
this.sound.play("shot1");

  // 1. take a bullets
  const px = my.sprite.player.x;
  const py = my.sprite.player.y;
  const bullet = this.bullets.get(px, py, "coin_gold");
  if (!bullet) {
    return;  // return if pool is full
  }

  // 2. initialize the bullets
    bullet.body.allowGravity = false;  
  bullet.setActive(true);
  bullet.setVisible(true);
  bullet.body.enable = true;
  bullet.setDisplaySize(20, 15);   // size
  bullet.setDepth(500);            // make sure in a right depth

  // 3. give speed to bullet
  const speed = 500;
  if (my.sprite.player.flipX) {
    //to left
    bullet.body.setVelocity(speed, 0);
  } else {
    // to right
    bullet.body.setVelocity(-speed, 0);
  }

  // 4. destroy bullet when cross the boardland
  bullet.body.setCollideWorldBounds(true);
  bullet.body.onWorldBounds = true;
  bullet.body.world.on("worldbounds", (body) => {
    if (body.gameObject === bullet) {
      bullet.destroy();
    }
  });
}

  createEnemies() {
    this.enemyGroup = this.physics.add.group();

    const enemySpawns = this.map.filterObjects(
      "Objects",
      (obj) => obj.name === "enemySpawn"
    );

    enemySpawns.forEach((spawn) => {
      const enemy = this.physics.add
        .sprite(
          spawn.x * SCALE,
          spawn.y * SCALE,
          "platformer_characters",
          "tile_0018.png"
        )
        .setScale(SCALE);

      enemy.body.setSize(9 * SCALE, 9 * SCALE).setOffset(2 * SCALE, 3 * SCALE);

      this.enemyGroup.add(enemy);

      enemy.anims.play("enemy");

      this.physics.add.collider(enemy, this.groundLayer);
      this.physics.add.collider(enemy, my.sprite.player, (enemy, player) => {
        if (!this.isDead) {
          this.playerDeath();
        }
      });


      enemy.setVelocityX(-this.ENEMY_SPEED);
    });

    this.enemyBouncers = this.map.createFromObjects("Objects", {
      name: "enemyBouncer",
    });

    this.physics.world.enable(
      this.enemyBouncers,
      Phaser.Physics.Arcade.STATIC_BODY
    );
    this.enemyBouncers.forEach((bouncer) => {
      bouncer.setScale(SCALE);
      bouncer.x = bouncer.x * SCALE;
      bouncer.y = bouncer.y * SCALE;
      bouncer.body.x = bouncer.x;
      bouncer.body.y = bouncer.y;
      bouncer.setVisible(false);
    });

    this.physics.add.collider(
      this.enemyGroup,
      this.enemyBouncers,
      (bouncer, enemy) => {
        const wasMovingLeft = !enemy.flipX;

        enemy.setVelocityX(
          wasMovingLeft ? this.ENEMY_SPEED : -this.ENEMY_SPEED
        );
        enemy.flipX = wasMovingLeft;
      }
    );

this.physics.add.collider(
  this.bullets,           // bullet :contentReference[oaicite:0]{index=0}
  this.enemyGroup,        // enermy :contentReference[oaicite:1]{index=1}
  (bullet, enemy) => {
    bullet.destroy();
    enemy.destroy();
    this.sound.play('enemy_death');
  }
);

  }

  animateTiles() {
    let tileQueue = Object.entries(this.animationQueue);
    for (const entry of tileQueue) {
      this.groundLayer.swapByIndex(entry[1][0], entry[1][1]);
      let tileID = entry[1].shift();
      entry[1].push(tileID);
      this.animationQueue[entry[0]] = entry[1];
    }
  }

  nextScene() {
    this.scene.start("victoryScreenScene");
  }

  update() {
    if (!this.isDead && my.sprite.player.y > this.map.heightInPixels * SCALE) {
      this.playerDeath();
    }

    if (
      this.checkpoint &&
      !this.currentCheckpoint &&
      my.sprite.player.x > this.checkpoint.x * SCALE
    ) {
      this.currentCheckpoint = {
        x: this.checkpoint.x * SCALE,
        y: this.checkpoint.y * SCALE,
      };
      this.sound.play("checkpoint");
    }
    if (my.sprite.player.x > this.victoryFlag.x * SCALE) {
      this.sound.play("checkpoint");
      this.nextScene();
      this.scene.start("victoryScreenScene");
    }

    if (!this.isDead) {
      const currentAcceleration = this.isSubmerged
        ? this.WATER_ACCELERATION
        : this.ACCELERATION;
      
      const currentDrag = this.isSubmerged ? this.WATER_DRAG : this.DRAG;
      const currentJumpVelocity = this.isSubmerged
        ? this.WATER_JUMP_VELOCITY
        : this.JUMP_VELOCITY;

      if (this.isSubmerged) {
        my.sprite.player.body.setMaxVelocityX(this.WATER_MAX_X_VEL);
        my.sprite.player.body.setMaxVelocityY(this.WATER_MAX_Y_VEL);
      } else {
        my.sprite.player.body.setMaxVelocityX(this.MAX_X_VEL);
        my.sprite.player.body.setMaxVelocityY(this.MAX_Y_VEL);
      }

      if (cursors.left.isDown) {
        my.sprite.player.body.setAccelerationX(-currentAcceleration);
        my.sprite.player.resetFlip();
        if (!this.isSubmerged) {
          my.sprite.player.anims.play("walk", true);
        }
      } else if (cursors.right.isDown) {
        my.sprite.player.body.setAccelerationX(currentAcceleration);
        my.sprite.player.setFlip(true, false);
        if (!this.isSubmerged) {
          my.sprite.player.anims.play("walk", true);
        }
      } else {
        my.sprite.player.body.setAccelerationX(0);
        my.sprite.player.body.setDragX(currentDrag);
      }






      if (
        (!my.sprite.player.body.blocked.down && !this.isSubmerged) ||
        (this.isSubmerged && my.sprite.player.body.velocity.y < 0)
      ) {
        my.sprite.player.anims.play("jump");
      } else if (!cursors.left.isDown && !cursors.right.isDown) {
        my.sprite.player.anims.play("idle");
      }




      if (
        (my.sprite.player.body.blocked.down || this.isSubmerged) &&
        Phaser.Input.Keyboard.JustDown(cursors.up)
      ) {
        my.sprite.player.body.setVelocityY(currentJumpVelocity);
        let jumpSound = Phaser.Math.Between(1, 3);
        this.sound.play("jump" + jumpSound, {
          volume: 0.25,
        });
      }
    }
  }




  playerDeath() {
    this.isDead = true;
    this.sound.play("player_death", {
      volume: 0.35,
    });
    this.music.stop();
    my.sprite.player.visible = false;
    my.sprite.player.body.setVelocity(0, 0);
    my.sprite.player.body.setAcceleration(0, 0);
    this.physics.world.gravity.y = 0;
    this.time.delayedCall(1000, () => {
      this.restartPlayer();
    });
  }

  restartPlayer() {

    this.isSubmerged = false;  
    this.isClimbed   = false;  

    const body = my.sprite.player.body;
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
    body.setDragX(this.DRAG);             
    body.setMaxVelocity(this.MAX_X_VEL, this.MAX_Y_VEL);  
  
    if (this.currentCheckpoint) {
      my.sprite.player.x = this.currentCheckpoint.x;
      my.sprite.player.y = this.currentCheckpoint.y;
    } else {
      my.sprite.player.x = this.playerSpawn.x * SCALE;
      my.sprite.player.y = this.playerSpawn.y * SCALE;
    }

    this.coinGroup.clear(true, true);
    this.enemyGroup.clear(true, true);
    this.bossGroup.clear(true, true);
    this.enemyBouncers.forEach((bouncer) => bouncer.destroy());

    this.createCoins();
    this.createEnemies();
    this.createBoss();

    this.physics.world.gravity.y = 2000;
    my.sprite.player.visible = true;
    this.isDead = false;
    this.music.play();


  this.itemBoxes.forEach(box => {
    // 1. set to original spot
    box.y = box.originalY;
    box.body.y = box.originalY;

    // 2. not actived
    box.isActivated = false;
    box.setFrame(10);

    // 3. **reset size and place****
    box.body.setSize(18 * SCALE, 18 * SCALE);
    box.body.setOffset(-9 * SCALE, -9 * SCALE);

    // 4. alignment
    if (box.body.updateFromGameObject) {
      box.body.updateFromGameObject();
    }
  });

    this.ammo = 0;
    this.updateUICoins();
    this.bullets.clear(true, true);
   //重置子弹，暂时不调用，测试中

  }

  checkWaterState() {
    let isInWater = false;

    for (const tile of this.waterTiles) {
      if (
        Phaser.Geom.Intersects.RectangleToRectangle(
          my.sprite.player.getBounds(),
          tile.waterBody.getBounds()
        )
      ) {
        isInWater = true;
        break;
      }
    }

    if (isInWater !== this.isSubmerged) {
      if (!isInWater && this.isSubmerged && cursors.up.isDown) {
        my.sprite.player.setVelocityY(this.EXIT_WATER_JUMP_VELOCITY);
      }
      this.isSubmerged = isInWater;
      this.physics.world.gravity.y = isInWater ? this.WATER_GRAVITY : 2000;
    }
  }



  checkClimbState() {
    let isInClimb = false;
  // 1. Loop through each climbable tile we stored earlier
    for (const tile of this.climbTiles) {     // Compare the tile’s invisible body bounds with the player's bounds
      if (
        Phaser.Geom.Intersects.RectangleToRectangle(
          my.sprite.player.getBounds(),
          tile.climbBody.getBounds()
        )
      ) {
        isInClimb = true; // Found at least one overlap → player is on a ladder
        break;
      }
    }
  // 2. If the overlap state has changed since last frame, update
    if (isInClimb !== this.isInClimb) {
      if (!isInClimb && this.isInClimb && cursors.up.isDown) {
        my.sprite.player.setVelocityY(this.EXIT_CLIMB_JUMP_VELOCITY);
      }

    // 3. When climbing, reduce world gravity so the player doesn’t fall off.
    //    When exiting, restore the normal gravity defined in init().
      this.isInClimb = isInClimb;
      this.physics.world.gravity.y = isInClimb ? this.CLIMB_GRAVITY : 2000;
    }
  }



createMovingPlatforms() {
  // platformGroup：not taking gravity
  this.movingPlatformGroup = this.physics.add.group({
    allowGravity: false,
    immovable: true
  });

  const platformSpawns = this.map.filterObjects("Objects", obj => obj.name === "movingTile");

  platformSpawns.forEach(spawn => {
    
    const frame = spawn.gid - this.tileset.firstgid;
    const p = this.movingPlatformGroup.create(
      spawn.x * SCALE,
      spawn.y * SCALE,
      "tilemap_tiles",
      frame
    )
    .setOrigin(0)
    .setScale(SCALE);

    // physical body size = tile's width/height align
    p.body.setSize(spawn.width * SCALE, spawn.height * SCALE);
    p.body.setOffset(0, 0);

    // initial speed for movement
    p.body.velocity.x = -this.PLATFORM_SPEED;
    p.body.setCollideWorldBounds(true);
    p.body.setBounce(1, 0);
  });

  // tileBouncer 
  this.tileBouncerGroup = this.physics.add.staticGroup();
  const bouncerSpawns = this.map.filterObjects("Objects", obj => obj.name === "tileBouncer");
  bouncerSpawns.forEach(spawn => {
    // use invisible for area to bounce
    const b = this.tileBouncerGroup.create(
      spawn.x * SCALE,
      spawn.y * SCALE,
      "tilemap_tiles",
      spawn.gid - this.tileset.firstgid
    )
    .setOrigin(0)
    .setScale(SCALE)
    .setVisible(false);

    // alignment
    b.body.setSize(spawn.width * SCALE, spawn.height * SCALE);
    b.body.setOffset(0, 0);
  });

  //move another direction after collision 
  this.physics.add.collider(
    this.movingPlatformGroup,
    this.tileBouncerGroup,
    (platform, bouncer) => {
      platform.body.velocity.x *= -1;
    },
    null,
    this
  );

  // player can move with it
  this.physics.add.collider(
    my.sprite.player,
    this.movingPlatformGroup,
    (player, platform) => {
      const playerBottom = player.body.y + player.body.height;
      const platTop = platform.body.y;
      if (playerBottom <= platTop + 5 && player.body.velocity.y >= 0) {
        player.x += platform.body.velocity.x * this.game.loop.delta / 1000;
      }
    },
    null,
    this
  );
}

createBoss() {
  // —— no more this.enemyGroup —— 
  // this.enemyGroup = this.physics.add.group();

  this.bossGroup = this.physics.add.group();

  const bossSpawns = this.map.filterObjects(
    "Objects",
    obj => obj.name === "bossSpawn"
  );

  bossSpawns.forEach(spawn => {
    // create a Boss
    
    const boss = this.physics.add
      .sprite(
        spawn.x * SCALE,
        spawn.y * SCALE,
        "platformer_characters",
        "tile_0018.png"
      )
      .setScale(SCALE);

    // initialize hp
    boss.health = 10;

    // body size
    boss.body
      .setSize(9 * SCALE, 9 * SCALE)
      .setOffset(2 * SCALE, 3 * SCALE);

    boss.anims.play("enemy");
    this.physics.add.collider(boss, this.groundLayer);

    //player collision with Boss → death
    this.physics.add.collider(
      my.sprite.player,
      boss,
      () => { if (!this.isDead) this.playerDeath(); },
      null,
      this
    );

    boss.setVelocityX(-this.ENEMY_SPEED);

    // add to bossGroup
    this.bossGroup.add(boss);
  });

  // same bouncer logic
  this.enemyBouncers = this.map.createFromObjects("Objects", {
    name: "enemyBouncer",
  });
  this.physics.world.enable(this.enemyBouncers, Phaser.Physics.Arcade.STATIC_BODY);
  this.enemyBouncers.forEach(b => {
    b.setScale(SCALE);
    b.x *= SCALE; b.y *= SCALE;
    b.body.x = b.x; b.body.y = b.y;
    b.setVisible(false);
  });
  this.physics.add.collider(
    this.bossGroup,
    this.enemyBouncers,
    (bouncer, boss) => {
      const wasMovingLeft = !boss.flipX;
      boss.setVelocityX(wasMovingLeft ? this.ENEMY_SPEED : -this.ENEMY_SPEED);
      boss.flipX = wasMovingLeft;
    }
  );

  // bullet hit logic
  this.physics.add.collider(
    this.bullets,
    this.bossGroup,
    (bullet, boss) => {
      this.coinVfxEffect.explode(5, boss.x, boss.y);
      bullet.destroy();
      this.sound.play("gethit1");
      boss.health -= 1;
      if (boss.health <= 0) {
        boss.destroy();
        this.sound.play("enemy_death");
      }
    },
    null,
    this
  );
}


  
}
