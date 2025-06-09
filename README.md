Credit: Eren Huang 
SlugID: 2140984
Email: thuan112@ucsc.edu

Project 4b (Self Project)

Game control: Use the ARROW keys to move the character.
              Space Key to shoot AFTER you collect coins. 

1. All elements are designed in this way, no bug so far. 
2. The upper level path required 10 coins/bullets to kill the boss.


Edit History

May 29: 
Core Engine & Player Controls
Scene setup: Created the Platformer scene with init() constants (acceleration, drag, gravity, jump velocity, max speeds) and create() loading the main & background tilemaps.

Player movement & camera: Implemented left/right acceleration, jumping, world bounds, and smooth camera follow.

Collision & input: Enabled tilemap collisions, keyboard cursors, and world debug toggle.



May 30 - Jun 1: 
Collectibles & Shooting
Coins & VFX: createCoins() spawns static coins; overlap destroys coin, plays coinVfxEffect.explode(), and sound.

Item boxes: createItemBoxes() reads Tiled “itemBox”, bounces on hit, spawns dynamic coins via spawnCoin().

Bullet system: fireBullet() and this.bullets group; SPACE fires coin‐bullets, no gravity, fixed speed.

Coin UI: updateUICoins() displays bullet count as on-screen icons.



Jun 3–4: 
Enemies & Moving Platforms
Basic enemies: createEnemies() spawns patrol enemies, enemyBouncer objects reverse direction, player/enemy and bullet/enemy collisions.

Moving platforms: createMovingPlatforms() reads “movingTile” objects, gives them horizontal velocity and world-bounds bounce; “tileBouncer” objects reverse them.

Bullet-terrain collision: Added collider to destroy bullets on hitting solid tiles.



Jun 6: 
Swimming & Climbing
Water mechanics: Mark water=true tiles, detect entry/exit, adjust gravity (WATER_GRAVITY), swimming controls with up/down override.

Ladder climbing: Mark climb=true tiles, checkClimbState() toggles isClimbed, ladder controls disable gravity and allow vertical movement.



Jun 7:
Boss & Hazard Expansion
Boss enemy: createBoss() at bossSpawn spawns a boss with health = 10, bullet collisions decrement health, destroy on zero.

Spikes traps: Mark spike tiles, create invisible bodies, overlap kills player.

Checkpoints & victory flag: Read “checkpointSpawn” and “victoryFlag” objects, trigger respawn or scene transition.



Jun 8: 
Bug Fixes & Effect & Multi-Level Support & Documentation

Jump & gravity reset: Refactored restartPlayer() to clear isSubmerged/isClimbed, restore gravity and body parameters so respawn jump height matches initial.

Particle emitter update: Migrated from removed createEmitter() to add.particles(config) for star/coin effects.

Audio integration: Loaded and wired up enemy_hit, enemy_death, splash, coin_collect sounds.

Level2 inheritance: Refactored Platformer to accept mapKey/backgroundKey; created Level2 subclass loading level_2.tmj with identical logic.

Code comments: Added extensive English inline documentation across init(), create(), core helpers (createItemBoxes(), checkClimbState(), animateTiles(), fireBullet(), etc.).

Polish & final tweaks: Tweaked speeds, tweens, animations, audio volumes, and organized code into logical sections for maintainability.







