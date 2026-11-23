import Phaser from 'phaser';
import { GAME, TEXTURES, ANIMS, SOUNDS } from '../constants';
import { playSfx } from '../audio';

// state → [animation key, texture key, scaleMul] used by setAnimState. scaleMul
// corrects sheets whose figure is drawn smaller within the frame than the rest
// (see GAME.PLAYER_JUMP_SCALE); it defaults to 1 for sheets that fill the frame.
const STATE_MAP = {
  idle: [ANIMS.IDLE, TEXTURES.PLAYER_IDLE, 1],
  run: [ANIMS.RUN, TEXTURES.PLAYER_RUN, 1],
  jump: [ANIMS.JUMP, TEXTURES.PLAYER_JUMP, GAME.PLAYER_JUMP_SCALE],
  dead: [ANIMS.DEAD, TEXTURES.PLAYER_DEAD, 1],
};

/**
 * The player sprite. Fixed near the bottom, always full scale.
 * Moves between lanes by tweening x over LANE_SWITCH_MS (spec §5).
 * Drives the idle/run/dead animation states (setAnimState/die).
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, lane) {
    const startLane = lane ?? Math.floor(scene.lane.count / 2); // center
    const x = scene.lane.playerX(startLane);
    const y = scene.lane.playerY;
    super(scene, x, y, TEXTURES.PLAYER);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.laneIndex = startLane;
    this.laneTween = null;
    this.animState = null;
    // Jump state. jumpRise is the live screen-px the player is lifted above the
    // lane row (0 = grounded); RunScene reads it each frame to position us and
    // skips the run-bob while airborne. isJumping also gates obstacle hits, so
    // an airborne player clears ground obstacles (see RunScene.shouldHit).
    this.isJumping = false;
    this.jumpRise = 0;
    this.jumpTween = null;
    // Post-hit invulnerability (3-lives system): while true the player runs on,
    // unhittable (RunScene.shouldHit) and blinking translucent (invulnTween).
    this.invulnerable = false;
    this.invulnTween = null;
    this.invulnTimer = null;
    this.setDepth(100);
    this.setAnimState('idle'); // start idle on the Start screen
  }

  /**
   * Non-fatal obstacle hit: the player survives, spends a life, and gets an
   * INVULN_MS grace window — running on but unhittable, blinking translucent so
   * it's clear a life was lost. Called by RunScene.hitObstacle when lives remain.
   */
  startInvuln(ms = GAME.INVULN_MS) {
    this.invulnerable = true;
    if (this.invulnTween) this.invulnTween.stop();
    this.invulnTween = this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: GAME.INVULN_BLINK_MS,
      yoyo: true,
      repeat: -1,
    });
    // Scene clock → auto-pauses with the game, so the grace never burns while paused.
    if (this.invulnTimer) this.invulnTimer.remove();
    this.invulnTimer = this.scene.time.delayedCall(ms, () => this.clearInvuln());
  }

  clearInvuln() {
    this.invulnerable = false;
    if (this.invulnTween) {
      this.invulnTween.stop();
      this.invulnTween = null;
    }
    if (this.invulnTimer) {
      this.invulnTimer.remove();
      this.invulnTimer = null;
    }
    this.setAlpha(1);
  }

  /**
   * Switch animation state and normalize on-screen size. Every sheet has a
   * different native frame size, so we scale each to a constant display height
   * (GAME.PLAYER_DISPLAY_H) and re-anchor the feet + hitbox to the new frame.
   * Falls back to the static placeholder texture when an anim is unavailable.
   */
  setAnimState(state) {
    if (this.animState === state) return;
    this.animState = state;

    const [animKey, texKey, scaleMul = 1] = STATE_MAP[state];
    if (state === 'jump') {
      // Frame is driven manually, one step per physics tick, off the SAME
      // clock as the physical rise/fall (see jump()'s tween onUpdate) — NOT
      // Phaser's own animation clock, which runs independently of the tween's
      // easing and drifted out of sync with the actual arc (liftoff/apex/
      // landing poses showing at the wrong moment — the reported "choppy"
      // jump).
      //
      // Whatever state we came FROM (idle/run) called this.play(...), which
      // left Phaser's own AnimationState still actively ticking in the
      // background (e.g. 'run' has repeat:-1 — it never stops on its own).
      // setTexture()/setFrame() below don't know that and don't cancel it, so
      // without an explicit stop() that background animation keeps advancing
      // every frame and re-applies ITS texture/frame on top of ours a couple
      // of ticks later — the sprite silently snaps to the (much bigger) run
      // sheet mid-air, momentarily rendering the player far too large. stop()
      // is what actually hands full control of the texture/frame to us.
      this.anims.stop();
      if (this.scene.textures.exists(texKey)) {
        this.setTexture(texKey, 0);
      } else {
        this.setTexture(TEXTURES.PLAYER);
      }
    } else if (this.scene.anims.exists(animKey)) {
      // ignoreIfPlaying=false so 'dead' always restarts from frame 0.
      this.play(animKey, false);
    } else {
      this.setTexture(TEXTURES.PLAYER); // generated placeholder fallback
    }

    // this.width/height now reflect the current frame's source size. scaleMul
    // compensates sheets that draw the figure smaller within the frame.
    this.setScale((GAME.PLAYER_DISPLAY_H / this.height) * scaleMul);
    this.setOrigin(0.5, 0.92); // feet near the lane row
    // Tighter, torso-centered hitbox (source px; auto-scales with the sprite).
    if (this.body) this.body.setSize(this.width * 0.42, this.height * 0.5);
  }

  /**
   * Hop up and over a ground obstacle. No-op if already airborne or dead, so
   * jumps can't be queued/stacked. Tweens jumpRise up to GAME.JUMP_HEIGHT and
   * back over GAME.JUMP_DURATION (yoyo = symmetric rise/fall); while isJumping
   * is true the player is invulnerable to obstacles (RunScene.shouldHit),
   * which is what actually clears the obstacle.
   *
   * The jump SHEET is scrubbed frame-by-frame off this same tween's
   * totalProgress (0→1, linear across the whole up+down arc) rather than
   * played on Phaser's own independent animation clock. The two clocks don't
   * agree — the sheet's own fixed fps has no idea the physical rise/fall is
   * eased (Sine.easeOut) or exactly how long the arc actually lasts — so the
   * liftoff/apex/landing poses drift out of sync with where the character
   * really is, which reads as a choppy, "not calculated" jump. Driving both
   * off one clock keeps them locked: frame 0 (crouch) at takeoff, the full-tuck
   * frame lands right at the apex, and the landing-crouch frame lands exactly
   * as jumpRise returns to 0, so the touchdown pose matches the actual ground
   * contact instant instead of appearing early/late.
   */
  jump() {
    if (this.isJumping || this.animState === 'dead') return;
    playSfx(this.scene, SOUNDS.JUMP); // guard above already limits this to once per real jump
    this.isJumping = true;
    this.setAnimState('jump');

    const jumpFrames = this.scene.textures.exists(TEXTURES.PLAYER_JUMP)
      ? this.scene.textures.get(TEXTURES.PLAYER_JUMP).frameTotal - 1 // -1: exclude the implicit __BASE frame
      : 0;

    if (this.jumpTween) this.jumpTween.stop();
    this.jumpRise = 0;
    this.jumpTween = this.scene.tweens.add({
      targets: this,
      jumpRise: GAME.JUMP_HEIGHT,
      duration: GAME.JUMP_DURATION / 2, // half up...
      ease: 'Sine.easeOut',
      yoyo: true, // ...then mirrored back down for the fall
      onUpdate: (tween) => {
        if (jumpFrames < 2) return; // no real sheet loaded — static placeholder is fine as-is
        const idx = Math.min(jumpFrames - 1, Math.floor(tween.totalProgress * jumpFrames));
        this.setFrame(idx);
      },
      onComplete: () => {
        this.isJumping = false;
        this.jumpRise = 0;
        this.jumpTween = null;
        // Resume running unless the run ended (death/pause) mid-air.
        if (this.animState !== 'dead') this.setAnimState('run');
      },
    });
  }

  /** Play the death animation once, then invoke onComplete (game-over hook). */
  die(onComplete) {
    if (this.jumpTween) this.jumpTween.stop(); // cancel any in-flight hop
    this.isJumping = false;
    this.jumpRise = 0;
    this.setAnimState('dead');
    if (this.scene.anims.exists(ANIMS.DEAD)) {
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, onComplete);
    } else {
      // No dead sheet: brief beat so the game-over screen isn't instant.
      this.scene.time.delayedCall(300, onComplete);
    }
  }

  get maxLane() {
    return this.scene.lane.count - 1;
  }

  moveLeft() {
    this.switchTo(this.laneIndex - 1);
  }

  moveRight() {
    this.switchTo(this.laneIndex + 1);
  }

  switchTo(targetLane) {
    const clamped = Phaser.Math.Clamp(targetLane, 0, this.maxLane);
    if (clamped === this.laneIndex) return;
    this.laneIndex = clamped;

    if (this.laneTween) this.laneTween.stop();
    this.laneTween = this.scene.tweens.add({
      targets: this,
      x: this.scene.lane.playerX(clamped),
      duration: GAME.LANE_SWITCH_MS,
      ease: 'Quad.easeOut',
    });
  }

  /** Snap back to the center lane and idle (used on restart). */
  reset() {
    const center = Math.floor(this.scene.lane.count / 2);
    if (this.laneTween) this.laneTween.stop();
    if (this.jumpTween) this.jumpTween.stop();
    this.isJumping = false;
    this.jumpRise = 0;
    this.jumpTween = null;
    this.clearInvuln(); // drop any leftover grace window + restore full opacity
    this.laneIndex = center;
    this.setPosition(this.scene.lane.playerX(center), this.scene.lane.playerY);
    this.setAnimState('idle');
  }
}
