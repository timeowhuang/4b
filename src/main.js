"use strict";
let config = {
  parent: "phaser-game",
  type: Phaser.CANVAS,
  render: {
    pixelArt: true,
  },
  physics: {
    default: "arcade",
    arcade: {
      tileBias: 32,
      debug: true,
      gravity: {
        x: 0,
        y: 0,
      },
    },
  },
  width: 1440,
  height: 720,
  scene: [Load, Platformer, VictoryScreen],
};

var cursors;
const SCALE = 2.0;
var my = { sprite: {}, text: {} };

const game = new Phaser.Game(config);
