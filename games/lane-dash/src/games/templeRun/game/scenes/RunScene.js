import Phaser from 'phaser';
import { GAME, TEXTURES, OBSTACLE_VARIANTS, ANIMS, SOUNDS } from '../constants';
import { EventBus } from '../EventBus';
import { Lane } from '../objects/Lane';
import { Road } from '../objects/Road';
import { Player } from '../objects/Player';
import { getLevel } from '../data/levelConfig';
import { playSfx, startMusic, stopMusic, duckMusic, restoreMusic } from '../audio';

/**
 * The single reusable lane-runner scene (spec §6). Owns the game loop,
 * spawning/pooling, collisions, scoring, and the React→scene command bridge
 * (pause/resume/restart). The environment is a multi-zone looping video
 * backdrop (the zone clips in GAME.ZONE_SEQUENCE, each repeated GAME.ZONE_LOOPS
 * times before the next takes over); the player, obstacles and coins are drawn
 * on top and tuned (via Lane.js) to ride the painted road.
 */
export class RunScene extends Phaser.Scene {
  constructor() {
    super('RunScene');
  }

  create() {
    this.level = getLevel();
    this.lane = new Lane(this);

    // Calibration overlay: bright lane guides drawn ABOVE the video so the
    // code's 3 lanes can be eyeballed against the road in the clip. Toggle with
    // GAME.DEBUG_LANES in constants.js.
    if (GAME.DEBUG_LANES) {
      this.road = new Road(this);
      this.road.draw();
    }

    this.player = new Player(this);
    // Player's own ground-contact shadow — pinned to the lane ROW (not the
    // character's jumpRise-lifted y), so the gap that opens up between them
    // mid-air is what actually sells the jump's height (see updatePlayerShadow).
    this.playerShadow = this.add.image(this.player.x, this.lane.playerY, TEXTURES.SHADOW).setDepth(99);
    this.updatePlayerShadow(); // size/alpha it correctly before the first run starts (idle Start screen)

    // Pooled groups — reuse, never destroy mid-run (spec §12).
    this.obstacles = this.physics.add.group({
      defaultKey: TEXTURES.OBSTACLE,
      maxSize: GAME.POOL_OBSTACLES,
    });
    this.coins = this.physics.add.group({
      defaultKey: TEXTURES.COIN,
      maxSize: GAME.POOL_COINS,
    });
    this.obstacles.createMultiple({
      key: TEXTURES.OBSTACLE,
      quantity: GAME.POOL_OBSTACLES,
      active: false,
      visible: false,
    });
    this.coins.createMultiple({
      key: TEXTURES.COIN,
      quantity: GAME.POOL_COINS,
      active: false,
      visible: false,
    });

    // One ground-contact shadow per pooled obstacle slot (never coins — they
    // read as floating collectibles), created once and reused for that slot's
    // whole lifetime; spawnItem/advanceGroup/recycle show/position/hide it in
    // lockstep with its paired obstacle via item.getData('shadowImg').
    this.obstacles.getChildren().forEach((o) => {
      const shadow = this.add.image(0, 0, TEXTURES.SHADOW).setDepth(49).setVisible(false);
      o.setData('shadowImg', shadow);
    });

    // Obstacle art variants that actually loaded (fall back to placeholder).
    this.obstacleKeys = OBSTACLE_VARIANTS.filter((k) => this.textures.exists(k));
    if (!this.obstacleKeys.length) this.obstacleKeys = [TEXTURES.OBSTACLE];

    this.physics.add.overlap(this.player, this.obstacles, this.hitObstacle, this.shouldHit, this);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, this.shouldCollect, this);

    this.setupInput();
    this.resetRunState();

    // Spawn + throttled score timers.
    this.spawnTimer = this.time.addEvent({
      delay: this.level.spawnInterval,
      loop: true,
      callback: this.spawn,
      callbackScope: this,
    });
    this.spawnTimer.paused = true; // idle until the run actually begins

    // Keep the camera inside the world so the Start zoom can't reveal blank
    // edges (see beginCountdown/startZoom).
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setBounds(0, 0, width, height);
    this.scoreTimer = this.time.addEvent({
      delay: GAME.SCORE_TICK_MS,
      loop: true,
      callback: this.tickScore,
      callbackScope: this,
    });

    this.bindEventBus();
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', this.shutdownScene, this);

    // Build the backdrop last; it emits 'ready' once the video's first frame is
    // decoded (or immediately for the image fallback) so the loading screen
    // stays up until the scene can actually render.
    this.buildBackground();
  }

  // ---- setup helpers -------------------------------------------------------

  /**
   * Looping video backdrop (sky + environment + road) shown as a cover image.
   * Lane.js is tuned to the painted road so objects ride it, and the run speed
   * is constant so the road + obstacles stay locked to the clip. The video's
   * dimensions aren't known until its first frame decodes, so booting waits on
   * the 'created'/'playing' events (onVideoReady). Falls back to the static JPEG
   * (then the generated placeholder) if the video is unavailable.
   */
  buildBackground() {
    this.bgIsVideo = false;
    this._bgFitted = false;
    this._booted = false;
    // Zone playlist cursor: which zone we're on and how many times its clip has
    // looped so far. _lastVideoTime drives the per-loop wrap detection (update).
    this.zoneIndex = 0;
    this.zoneLoopsDone = 0;
    this._lastVideoTime = null;

    const zoneUrls = this.registry.get('zoneUrls') || {};
    // Ordered zone keys + their blob URLs from the tunable sequence (skips any
    // zone whose clip failed to load). zoneKeys stays index-aligned with
    // zonePlaylist so zoneIndex → key → per-zone playback rate (applyBgRate).
    this.zoneKeys = (GAME.ZONE_SEQUENCE || []).filter((key) => zoneUrls[key]);
    this.zonePlaylist = this.zoneKeys.map((key) => zoneUrls[key]);

    if (!this.zonePlaylist.length) {
      this.useImageBackground();
      return;
    }

    const { width, height } = this.scale.gameSize;
    this.bg = this.add.video(width / 2, height / 2).setDepth(0);
    this.bg.setLoop(true); // native loop = seamless repeats of the SAME zone;
    this.bg.setMute(true); // advancing BETWEEN zones is handled manually below.

    // 'created' fires once the first frame + true dimensions are ready;
    // 'playing' is a belt-and-suspenders fallback for the same.
    this.bg.once('created', () => this.onVideoReady());
    this.bg.once('playing', () => this.onVideoReady());
    this.bg.once('unsupported', () => this.useImageBackground());
    this.bg.once('error', () => this.useImageBackground());
    // Safety net: never hang the loading screen if the video stalls.
    this._bgTimeout = this.time.delayedCall(8000, () => {
      if (!this.bgIsVideo) this.useImageBackground();
    });

    this.bg.loadURL(this.zonePlaylist[0], true); // blob: URL → browser decodes
    this.bg.play(true); // decode a frame so 'created' fires; we hold it after
  }

  /**
   * Switch the backdrop to a zone clip by playlist index (all zones share the
   * 1080×1920 frame, so the cover-fit/lane geometry carries over unchanged).
   * Keeps the clip rolling only if the run is live; otherwise holds a still
   * frame (idle/start). Called when a zone has repeated GAME.ZONE_LOOPS times.
   */
  loadZone(index) {
    if (!this.bgIsVideo || !this.bg || !this.zonePlaylist.length) return;
    this.zoneIndex = ((index % this.zonePlaylist.length) + this.zonePlaylist.length) % this.zonePlaylist.length;
    this._lastVideoTime = null; // don't read the source-swap reset as a wrap
    this.bg.loadURL(this.zonePlaylist[this.zoneIndex], true);
    this.bg.setLoop(true);
    this.bg.setMute(true);
    this.bg.play(true);
    this.applyBgRate(); // loadURL can reset playbackRate — re-apply the tuned one
    this.setBgPlaying(this.running); // hold still unless the run is active
  }

  /**
   * One full play-through of the current zone finished (its time wrapped back to
   * the start). After GAME.ZONE_LOOPS play-throughs, advance to the next zone in
   * the sequence (wrapping to the first after the last).
   */
  onZoneLoopComplete() {
    this.zoneLoopsDone += 1;
    if (this.zoneLoopsDone >= GAME.ZONE_LOOPS) {
      this.zoneLoopsDone = 0;
      const next = (this.zoneIndex + 1) % this.zonePlaylist.length;
      // Only reload when the NEXT zone is actually a different clip. With a
      // single-zone playlist (next === current) the video's native setLoop(true)
      // already repeats it seamlessly — reloading the blob here would just cause
      // a needless hitch every loop (very noticeable once the ramp shortens the
      // loop to ~1s at top speed).
      if (next !== this.zoneIndex) this.loadZone(next);
    }
  }

  /** Video first frame is ready: size it, hold it still, and finish booting. */
  onVideoReady() {
    if (this.bgIsVideo) return;
    if (this._bgTimeout) this._bgTimeout.remove();
    this.bgIsVideo = true;
    this.applyBgRate();
    this.fitBackground();
    this.setBgPlaying(false); // hold a still frame on the idle/start screen
    this.finishBoot();
  }

  /** Use the static JPEG (then generated placeholder) when no video is usable. */
  useImageBackground() {
    if (this.bgIsVideo || this._booted) return;
    if (this._bgTimeout) this._bgTimeout.remove();
    if (this.bg) this.bg.destroy(); // drop the failed video object
    const { width, height } = this.scale.gameSize;
    this.bgIsVideo = false;
    this.bg = this.add.image(width / 2, height / 2, TEXTURES.PARALLAX).setDepth(0);
    this.fitBackground();
    this.finishBoot();
  }

  /** Emit 'ready' exactly once, after the backdrop can render (spec §6). */
  finishBoot() {
    if (this._booted) return;
    this._booted = true;
    EventBus.emit('ready');
  }

  /**
   * Scale the backdrop to cover the canvas, centered. Video dimensions aren't
   * known until the first frame decodes, so this no-ops until they're ready and
   * update() keeps retrying via _bgFitted.
   */
  fitBackground() {
    if (!this.bg) return;
    const { width, height } = this.scale.gameSize;
    let srcW;
    let srcH;
    if (this.bgIsVideo) {
      // The <video> element's intrinsic size isn't known until a frame decodes.
      srcW = this.bg.width || this.bg.video?.videoWidth || 0;
      srcH = this.bg.height || this.bg.video?.videoHeight || 0;
    } else {
      const img = this.bg.texture.getSourceImage();
      srcW = img.width;
      srcH = img.height;
    }
    if (!srcW || !srcH) return; // not ready yet
    const scale = Math.max(width / srcW, height / srcH);
    this.bg.setPosition(width / 2, height / 2).setScale(scale);
    this._bgFitted = true;
    // Lock the lane geometry to the SAME cover-fit transform: feed it the live
    // source size so vidToScreen maps onto the exact pixels we just drew. When
    // the source size first becomes known (or changes), re-place the guides and
    // the idle player so they snap onto the filmed road.
    if (this.lane.setSource(srcW, srcH)) {
      if (this.road) this.road.draw();
      if (this.player && !this.isOver) {
        this.player.setPosition(this.lane.playerX(this.player.laneIndex), this.lane.playerY);
      }
    }
  }

  /** Play/pause the video backdrop so the scenery freezes exactly with gameplay. */
  setBgPlaying(play) {
    if (!this.bgIsVideo || !this.bg) return;
    if (typeof this.bg.setPaused === 'function') {
      this.bg.setPaused(!play);
    } else if (this.bg.video) {
      play ? this.bg.video.play() : this.bg.video.pause();
    }
  }

  /**
   * How much faster than baseline the run is currently going (1 at START_SPEED,
   * up to MAX_SPEED/START_SPEED). Both the obstacles and the backdrop video are
   * scaled by this SAME factor, which is what keeps the painted road locked to
   * the obstacles as the speed ramps (see desiredBgRate / update).
   */
  speedFactor() {
    const base = this.level?.startSpeed || GAME.START_SPEED || 1;
    return (this.speed || base) / base;
  }

  /**
   * The playback rate the backdrop video SHOULD be at right now: the current
   * zone's calibrated base rate (matched to obstacles at START_SPEED) times the
   * live speed factor. Each zone clip dollies at its own speed, so the base is
   * per-zone (GAME.ZONE_PLAYBACK_RATES), falling back to GAME.BG_PLAYBACK_RATE.
   */
  desiredBgRate() {
    const key = this.zoneKeys?.[this.zoneIndex];
    const baseRate = GAME.ZONE_PLAYBACK_RATES?.[key] ?? GAME.BG_PLAYBACK_RATE;
    return baseRate * this.speedFactor();
  }

  /** Set the backdrop video's playback rate to desiredBgRate (base × speed factor). */
  applyBgRate() {
    if (!this.bgIsVideo || !this.bg) return;
    const rate = this.desiredBgRate();
    this._appliedBgRate = rate;
    if (typeof this.bg.setPlaybackRate === 'function') {
      this.bg.setPlaybackRate(rate);
    } else if (this.bg.video) {
      this.bg.video.playbackRate = rate;
    }
  }

  setupInput() {
    // Lane switching + jump. Pause keys are owned by React.
    this.input.keyboard.on('keydown-LEFT', this.onLeft, this);
    this.input.keyboard.on('keydown-A', this.onLeft, this);
    this.input.keyboard.on('keydown-RIGHT', this.onRight, this);
    this.input.keyboard.on('keydown-D', this.onRight, this);
    this.input.keyboard.on('keydown-UP', this.onJump, this);
    this.input.keyboard.on('keydown-W', this.onJump, this);
    this.input.keyboard.on('keydown-SPACE', this.onJump, this);

    // Swipe detection (horizontal → lane switch, upward → jump).
    this.input.on('pointerdown', (p) => {
      this._swipeX = p.x;
      this._swipeY = p.y;
    });
    this.input.on('pointerup', (p) => {
      if (this._swipeX == null) return;
      const dx = p.x - this._swipeX;
      const dy = p.y - this._swipeY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > GAME.SWIPE_THRESHOLD) dx < 0 ? this.onLeft() : this.onRight();
      } else if (dy < -GAME.SWIPE_THRESHOLD) {
        this.onJump(); // upward swipe
      }
      this._swipeX = null;
    });
  }

  onLeft() {
    if (this.running) this.player.moveLeft();
  }

  onRight() {
    if (this.running) this.player.moveRight();
  }

  onJump() {
    if (this.running) this.player.jump();
  }

  bindEventBus() {
    // React → scene commands. Stored so we can unsubscribe on shutdown.
    this._onStartRun = () => this.beginCountdown();
    this._onBeginTutorial = () => this.beginTutorial();
    this._onBeginRun = () => this.beginRun();
    this._onPause = () => this.pauseRun();
    this._onResume = () => this.resumeRun();
    this._onRestart = () => this.resetToIdle();
    // The React HUD reports its coin pill's live center (mount + resize) so
    // collected coins fly to the real counter position (flyCoinToHud).
    this._onHudCoinsPos = (pos) => {
      this.hudCoinsPos = pos;
    };
    // Generic UI-sound bridge: React-side moments (button taps, countdown
    // beeps, game-over sting) have no scene of their own, so they emit a
    // SOUNDS.* key here and the scene plays it via the shared playSfx guard.
    this._onSfx = (key) => playSfx(this, key);
    EventBus.on('start-run', this._onStartRun); // Start tapped → zoom + 3,2,1
    EventBus.on('begin-tutorial', this._onBeginTutorial); // countdown done → practice
    EventBus.on('begin-run', this._onBeginRun); // tutorial done → spawns begin
    EventBus.on('pause', this._onPause);
    EventBus.on('resume', this._onResume);
    EventBus.on('restart', this._onRestart);
    EventBus.on('hud-coins-pos', this._onHudCoinsPos);
    EventBus.on('sfx', this._onSfx);
  }

  resetRunState() {
    this.score = 0;
    this.coinCount = 0;
    this.lives = GAME.LIVES; // absorb LIVES-1 hits; the last hit ends the run
    this.timeLeftMs = GAME.RUN_DURATION_MS; // full clock, ticks once the real run starts
    this._lastTimeEmit = null; // throttle 'time-update' to whole-second changes
    this.speed = this.level.startSpeed;
    this.running = false; // idle until React emits 'resume' (Start tapped)
    this.inTutorial = false; // practice window: running, but no spawns/scoring
    this.isOver = false;
    this._lastLane = -1;
    this._laneBlockedUntil = {}; // coin-train lane holds don't outlive the run
    // New flight generation: any in-flight coin from the previous run won't emit
    // its (now stale) count into this run's HUD when it's stopped below.
    this._flightToken = (this._flightToken || 0) + 1;
    // Clear any collected coins still flying to the HUD (e.g. run ended mid-flight).
    if (this._flyCoins) {
      for (const fly of [...this._flyCoins]) {
        this.tweens.killTweensOf(fly);
        if (fly.active) fly.destroy();
      }
      this._flyCoins.clear();
    }
  }

  // ---- main loop -----------------------------------------------------------

  update(time, delta) {
    // The video's true size lands asynchronously (onVideoReady), and the canvas
    // size may not be settled at that instant; keep retrying the cover-fit until
    // it takes, then lock in the playback rate and the held still frame.
    if (this.bgIsVideo && !this._bgFitted) {
      this.fitBackground();
      if (this._bgFitted) {
        this.applyBgRate();
        if (!this.running) this.setBgPlaying(false);
      }
    }

    // Zone playlist progression: the clip loops natively (seamless), so each
    // pass is detected by its playback time jumping back to the start. Count
    // those wraps and hand off to onZoneLoopComplete, which advances zones.
    if (this.bgIsVideo && this.running && this.zonePlaylist?.length && this.bg?.video) {
      const t = this.bg.video.currentTime;
      if (this._lastVideoTime != null && t + 0.3 < this._lastVideoTime) {
        this.onZoneLoopComplete();
      }
      this._lastVideoTime = t;
    }

    if (!this.running) return;
    const dt = delta / 1000;
    const move = this.speed * dt;

    // Run clock: counts down only during the REAL run (the practice tutorial is
    // excluded). update() isn't called while the scene is paused, so pausing the
    // game pauses the clock for free. At 0 the run auto-completes (time's up).
    if (!this.inTutorial) {
      this.timeLeftMs -= delta;
      if (this.timeLeftMs <= 0) {
        this.timeLeftMs = 0;
        this.emitTimeLeft();
        this.completeRun();
        return;
      }
      this.emitTimeLeft();
    }

    // The video is the scenery, so nothing to scroll here — motion reads from
    // the approaching/scaling obstacles and coins below.
    this.advanceGroup(this.obstacles, move);
    this.advanceGroup(this.coins, move);

    // Position the player on its lane row: a subtle running bob while grounded,
    // or lifted by the jump arc while airborne (jumpRise, set by Player.jump).
    const bob = this.player.isJumping ? 0 : Math.sin(time * 0.02) * 3;
    this.player.y = this.lane.playerY + bob - this.player.jumpRise;
    this.updatePlayerShadow();

    // Ramp the run speed toward MAX_SPEED — but NOT during the no-obstacle
    // tutorial (it should stay at the calibrated baseline while practicing).
    if (!this.inTutorial) {
      this.speed = Math.min(this.level.maxSpeed, this.speed + this.level.speedRamp * dt);
    }

    // Keep the backdrop video locked to the (now ramping) obstacle speed: both
    // scale by the same speed factor, so the painted road never drifts from the
    // obstacles. Only re-set the rate when it's moved meaningfully (~every 0.7s
    // at the default ramp) rather than every frame, to avoid churning the video
    // element's playbackRate with sub-perceptible increments.
    if (this.bgIsVideo && Math.abs(this.desiredBgRate() - (this._appliedBgRate ?? -1)) > 0.02) {
      this.applyBgRate();
    }
  }

  /**
   * Position/size/fade the player's ground shadow. Pinned to the lane ROW
   * (this.lane.playerY) — NOT this.player.y, which is lifted by jumpRise —
   * so as the character rises the shadow stays put and the growing gap
   * between them is what visually sells the jump's height. Called every
   * frame during a run, and once at creation so it looks right on the idle
   * Start screen too (before the first 'running' tick would otherwise size it).
   */
  updatePlayerShadow() {
    const liftT = Phaser.Math.Clamp(this.player.jumpRise / (GAME.JUMP_HEIGHT || 1), 0, 1);
    this.playerShadow.setPosition(this.player.x, this.lane.playerY);
    const shadowW =
      GAME.PLAYER_DISPLAY_H * GAME.PLAYER_SHADOW_WIDTH_MUL * (1 - liftT * GAME.PLAYER_SHADOW_LIFT_SHRINK);
    this.playerShadow.setDisplaySize(shadowW, shadowW * GAME.PLAYER_SHADOW_SQUASH);
    this.playerShadow.setAlpha(GAME.PLAYER_SHADOW_ALPHA * (1 - liftT * GAME.PLAYER_SHADOW_LIFT_FADE));
  }

  advanceGroup(group, move) {
    const bottom = this.lane.height + 60;
    const children = group.getChildren();
    for (let i = 0; i < children.length; i++) {
      const item = children[i];
      if (!item.active) continue;
      item.y += move;
      const t = Phaser.Math.Clamp(this.lane.depthAt(item.y), 0, 1);
      item.x = this.lane.xAtLanes(item.getData('lanes'), t);
      // Depth-scale uniformly; coins spin via their own sprite-sheet animation.
      const scale = this.lane.scaleAt(t) * (item.getData('baseScale') || 1);
      item.setScale(scale);

      // Ground-contact shadow (obstacles only): sits at the sprite's origin
      // point (its content's bottom edge, see OBSTACLE_META.originY), so no
      // extra y-offset is needed — the origin IS the ground contact.
      const shadow = item.getData('shadowImg');
      if (shadow?.visible) {
        shadow.setPosition(item.x, item.y);
        const w = item.displayWidth * GAME.SHADOW_WIDTH_MUL;
        shadow.setDisplaySize(w, w * GAME.SHADOW_SQUASH);
        shadow.setAlpha(GAME.SHADOW_ALPHA * this.lane.scaleAt(t));
      }

      if (item.y > bottom) this.recycle(group, item);
    }
  }

  recycle(group, item) {
    group.killAndHide(item);
    if (item.body) item.body.enable = false;
    const shadow = item.getData('shadowImg');
    if (shadow) shadow.setVisible(false);
  }

  // ---- spawning ------------------------------------------------------------

  spawn() {
    if (!this.running || this.inTutorial) return; // no spawns during practice

    const isCoin = Math.random() < this.level.coinChance;
    if (!isCoin) {
      if (!GAME.SPAWN_OBSTACLES) return; // obstacles disabled (debug)
      // Pick the obstacle variant FIRST — its OBSTACLE_META.lanes determines
      // how many lanes to reserve for it (see pickLanes).
      const key = Phaser.Utils.Array.GetRandom(this.obstacleKeys);
      const span = Math.min(GAME.OBSTACLE_META[key]?.lanes || 1, this.lane.count - 1);
      const lanes = this.pickLanes(span);
      if (!lanes) return; // no valid placement this row (every window busy) — skip
      this.spawnItem(this.obstacles, false, lanes, 0, key);
      return;
    }

    // A coin row is sometimes a trailing train (Temple Run style): extra coins
    // spawn GAP_PX behind the far point and emerge from it one after another.
    const lanes = this.pickLanes(1);
    if (!lanes) return;
    const [lane] = lanes;
    const T = GAME.COIN_TRAIN || {};
    const count =
      Math.random() < (T.CHANCE ?? 0) ? Phaser.Math.Between(T.MIN ?? 3, T.MAX ?? 4) : 1;
    const gap = T.GAP_PX ?? 95;
    for (let i = 0; i < count; i++) this.spawnItem(this.coins, true, lanes, -i * gap);
    if (count > 1) {
      // Block this lane until the tail coin has cleared the far point.
      if (!this._laneBlockedUntil) this._laneBlockedUntil = {};
      this._laneBlockedUntil[lane] = this.time.now + (((count - 1) * gap) / this.speed) * 1000 + 200;
    }
  }

  /**
   * Choose `span` ADJACENT lanes for a spawn row (span=1 for coins and
   * 1-lane obstacles; span>1 for a wide obstacle like the pillar/log). Skips
   * any lane still emitting a coin train (trailing coins spawn behind the far
   * point, so a fresh spawn there could land on top of one). Fairness (spec
   * §5): span is clamped by the caller to lane.count-1, so at least one lane
   * is always left passable. Returns an array of lane indices, or null if no
   * valid window is free this row (every window blocked — skip the row).
   */
  pickLanes(span) {
    const now = this.time.now;
    const L = this.lane.count;
    const windows = [];
    for (let start = 0; start <= L - span; start++) {
      windows.push(Array.from({ length: span }, (_, k) => start + k));
    }
    const free = windows.filter((w) => w.every((l) => !(this._laneBlockedUntil?.[l] > now)));
    if (!free.length) return null;
    // Prefer a window that doesn't start on the same lane as the last spawn,
    // for row-to-row variety; fall back to any free window if that's all there is.
    const fresh = free.filter((w) => w[0] !== this._lastLane);
    const pick = Phaser.Utils.Array.GetRandom(fresh.length ? fresh : free);
    this._lastLane = pick[0];
    return pick;
  }

  /**
   * Activate one pooled item on a set of adjacent lanes (single-element array
   * for coins and 1-lane obstacles; 2+ for a wide obstacle). yOffset (≤0)
   * spawns it BEHIND the far point for coin trains: advanceGroup clamps depth
   * t to 0, so a trailing coin holds as a speck at the vanishing point until
   * it crosses and emerges. `forcedKey` lets spawn() pre-pick the obstacle
   * variant (it needs to know the variant's lane span before calling this).
   */
  spawnItem(group, isCoin, lanes, yOffset, forcedKey) {
    const t = 0; // far point
    const x = this.lane.xAtLanes(lanes, t);
    const y = this.lane.yAt(t) + yOffset;

    const item = group.get(x, y);
    if (!item) return; // pool exhausted — skip this item

    // Normalize the source art to one on-screen size. baseScale folds that
    // normalization into the per-frame depth scaling in advanceGroup.
    let baseScale;
    if (!isCoin) {
      const key = forcedKey || Phaser.Utils.Array.GetRandom(this.obstacleKeys);
      item.setTexture(key);
      const meta = GAME.OBSTACLE_META[key];
      // Scale off the CONTENT width (tight crop, no transparent padding), not
      // the raw texture width — otherwise art with more padding (a diagonal
      // pose) reads unnaturally small next to art with less. Falls back to
      // the raw texture width for any variant missing calibration.
      const contentW = meta?.contentW || item.width;
      // 1-lane obstacles use the tuned baseline; a multi-lane obstacle is
      // instead sized to fill the REAL on-screen width of the lanes it spans
      // (Lane.laneSpanWidth), so it visibly covers its footprint instead of a
      // guessed multiplier (see the OBSTACLE_DISPLAY_W comment for why a flat
      // multiplier doesn't work here).
      const targetW =
        lanes.length > 1
          ? this.lane.laneSpanWidth(lanes) * GAME.OBSTACLE_SPAN_FILL
          : GAME.OBSTACLE_DISPLAY_W;
      baseScale = targetW / contentW;
      // Anchor near the content's ground contact (like the player's origin
      // 0.92) so it grows toward the camera while staying planted, instead of
      // growing symmetrically around its texture center.
      item.setOrigin(0.5, meta?.originY ?? 0.5);
      if (item.body) item.body.setSize(item.width * 0.6, item.height * 0.6);
    } else {
      baseScale = GAME.COIN_DISPLAY_W / item.width;
      if (item.body) item.body.setSize(item.width * 0.7, item.height * 0.7);
      if (this.anims.exists(ANIMS.COIN)) item.play(ANIMS.COIN); // looping spin
    }

    item.setData('lanes', lanes);
    item.setData('baseScale', baseScale);
    item.setActive(true).setVisible(true);
    item.setScale(this.lane.scaleAt(t) * baseScale);
    item.setDepth(50);
    if (item.body) {
      item.body.enable = true;
      item.body.reset(x, y);
    }

    const shadow = item.getData('shadowImg');
    if (shadow) shadow.setVisible(!isCoin);
  }

  // ---- collisions + scoring ------------------------------------------------
  // Score = survival distance (tickScore below, paced by GAME.SCORE_TICK_MS)
  // + a coin bonus. The bonus value (APP_CONFIG.POINTS_PER_COIN) is applied on
  // the React side — the scene reports raw score and coinCount at game-over.

  tickScore() {
    if (!this.running || this.inTutorial) return;
    this.score += 1;
    EventBus.emit('score-update', this.score);
  }

  // Push the remaining time to the HUD, but only when the whole-second value
  // changes (the countdown displays seconds — no need to spam it every frame).
  emitTimeLeft() {
    const secs = Math.ceil(this.timeLeftMs / 1000);
    if (secs === this._lastTimeEmit) return;
    this._lastTimeEmit = secs;
    EventBus.emit('time-update', this.timeLeftMs);
  }

  /**
   * Process callback gating coin pickups (mirror of shouldHit). Bodies are wide
   * and the lanes converge far away, so raw overlap collects across lanes and
   * even mid-jump. A coin only counts when it's in the player's OWN lane, has
   * reached the player's row, and the player is (near) grounded — an airborne
   * player sails clean over it, Temple Run style. COIN_COLLECT_MAX_RISE is the
   * take-off/landing grace so hop edges don't feel stingy.
   */
  shouldCollect(player, coin) {
    if (!coin.active) return false;
    if (!coin.getData('lanes')?.includes(player.laneIndex)) return false;
    if (player.jumpRise > GAME.COIN_COLLECT_MAX_RISE) return false;
    // Gate on nearness to the player's fixed lane ROW (not player.y, which
    // rises with the jump arc) so the pickup window is stable.
    const gap = Math.abs(this.lane.depthAt(coin.y) - this.lane.depthAt(this.lane.playerY));
    return gap <= 1 - GAME.COLLIDE_NEAR_T;
  }

  collectCoin(_player, coin) {
    if (!coin.active) return;
    playSfx(this, SOUNDS.COIN_COLLECT);
    const { x, y } = coin;
    this.recycle(this.coins, coin);
    this.coinCount += 1; // game truth now; the HUD ticks when the coin lands
    this.flyCoinToHud(x, y);
  }

  /**
   * Temple Run-style pickup: a small coin token swoops up to the HUD coin
   * counter, pulsing like a heartbeat as it flies; the counter increments only
   * when it arrives. Its flight size is GAME.COIN_FLY_W (independent of the
   * world coin), and the HUD pill reports its live position ('hud-coins-pos'),
   * with a top-left fallback if that hasn't landed yet. Sprites are tracked so a
   * restart can clear any still in flight (and the flight token stops a
   * cut-short flight from writing a stale count into the next run's HUD).
   */
  flyCoinToHud(x, y) {
    const token = this._flightToken;
    const countOnLanding = this.coinCount;
    const target = this.hudCoinsPos || { x: this.scale.gameSize.width * 0.3, y: 44 };
    const fly = this.add.image(x, y, TEXTURES.COIN, 0).setDepth(200);
    const base = GAME.COIN_FLY_W / fly.width; // tunable flight size, world-scale-independent
    fly.setScale(base);
    if (!this._flyCoins) this._flyCoins = new Set();
    this._flyCoins.add(fly);

    // Heartbeat pulse — its own yoyo tween so it doesn't fight the flight tween
    // (which only animates position).
    const beat = this.tweens.add({
      targets: fly,
      scale: base * GAME.COIN_FLY_BEAT,
      duration: GAME.COIN_FLY_BEAT_MS,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    let finished = false;
    const done = () => {
      if (finished) return; // onComplete + onStop can both fire — run once
      finished = true;
      beat.stop();
      this._flyCoins.delete(fly);
      fly.destroy();
      if (token === this._flightToken) EventBus.emit('coins-update', countOnLanding);
    };

    this.tweens.add({
      targets: fly,
      x: target.x,
      y: target.y,
      duration: GAME.COIN_FLY_MS,
      ease: 'Cubic.easeIn', // accelerating swoop into the counter
      onComplete: done,
      onStop: done, // killed mid-flight (restart) → clean up, no stale HUD emit
    });
  }

  /**
   * Process callback gating obstacle collisions. Bodies are wide (scaled art),
   * and lanes converge near the far point, so raw body overlap fires across
   * lanes. Only count a hit when the obstacle is in the player's lane AND has
   * arrived in the near collision zone — fair, art-size-independent.
   */
  shouldHit(player, obstacle) {
    if (!obstacle.active) return false;
    if (player.invulnerable) return false; // in the post-hit grace window
    if (player.isJumping) return false; // airborne → clears ground obstacles
    if (!obstacle.getData('lanes')?.includes(player.laneIndex)) return false;
    // Gate on nearness to the player's ROW, not an absolute depth — the player
    // sits at depthAt(PLAYER_Y) (~0.78), so an absolute 0.9 threshold could
    // never be reached while the bodies actually overlap. COLLIDE_NEAR_T → the
    // allowed depth gap above/below the player (1 = must be right on the row).
    const gap = Math.abs(this.lane.depthAt(obstacle.y) - this.lane.depthAt(player.y));
    return gap <= 1 - GAME.COLLIDE_NEAR_T;
  }

  /**
   * Obstacle overlap (gated by shouldHit). Spends a life; if any remain the
   * player survives — the obstacle is consumed, the screen flashes white, the
   * Woosh_Revive sfx plays and an invulnerability window starts (see
   * Player.startInvuln). Only the final life ends the run (crash → death anim).
   */
  hitObstacle(_player, obstacle) {
    if (this.isOver || this.player.invulnerable) return;
    this.lives -= 1;
    EventBus.emit('lives-update', this.lives);

    if (this.lives <= 0) {
      this.crash();
      return;
    }

    // Survived: consume the obstacle so it can't linger, cue the hit + recovery.
    this.recycle(this.obstacles, obstacle);
    this.cameras.main.flash(GAME.HIT_FLASH_MS, 255, 255, 255); // split-second white flash
    this.cameras.main.shake(180, 0.008);
    playSfx(this, SOUNDS.WALL_HIT); // the impact...
    playSfx(this, SOUNDS.REVIVE); // ...then the recovery whoosh
    this.player.startInvuln(GAME.INVULN_MS);
  }

  /** Final-life impact: freeze the world and play the death → game-over flow. */
  crash() {
    this.isOver = true;
    this.running = false; // freezes the world; only the death anim plays on
    this.spawnTimer.paused = true;
    this.setBgPlaying(false); // freeze the scenery on impact
    playSfx(this, SOUNDS.WALL_HIT); // fires here (impact), not in Player.die() — avoid a double-fire
    stopMusic(this);
    this.cameras.main.shake(220, 0.012);
    this.player.clearInvuln(); // in case a hit landed during a grace blink
    // Play the death animation, THEN hand off to the React game-over screen so
    // the transition reads as one continuous beat.
    this.player.die(() => {
      // scene.pause() freezes tweens — if stopMusic's fade (MUSIC_FADE_MS) is
      // still mid-flight its onComplete would never fire and the music loop
      // would keep playing under the game-over screen. Hard-stop it now.
      this.music?.stop();
      // Payload: authoritative distance score + coin count (game truth) — the
      // HUD 'coins-update' can lag behind by any coins still in flight, so the
      // hub score is derived from THESE, not the React state. React applies the
      // coin bonus (× APP_CONFIG.POINTS_PER_COIN) on top of the score. The final
      // `false` marks this as a crash (vs a time-up completion — see completeRun).
      EventBus.emit('game-over', this.score, this.coinCount, false);
      this.scene.pause();
    });
  }

  /**
   * Time's up — the player survived the full RUN_DURATION_MS. Ends the run
   * cleanly (no crash/death animation), hard-stops the world and music, and
   * hands off to the same results/submit screen with `completed = true`.
   */
  completeRun() {
    if (this.isOver) return;
    this.isOver = true;
    this.running = false; // freezes the world; player holds its last pose
    this.spawnTimer.paused = true;
    this.setBgPlaying(false);
    this.music?.stop(); // hard-stop (scene.pause below would freeze a fade tween)
    EventBus.emit('game-over', this.score, this.coinCount, true);
    this.scene.pause();
  }

  // ---- start sequence (zoom + countdown) ----------------------------------

  /**
   * Start tapped (React phase → 'countdown'). The world stays still and the
   * player keeps idling while the camera zooms in for the 3,2,1 overlay.
   */
  beginCountdown() {
    if (this.isOver) return;
    this.scene.resume(); // in case we came from a paused/idle state
    this.setBgPlaying(false); // road stays still through the 3·2·1 zoom
    this.player.setAnimState('idle');
    this.startZoom();
  }

  /**
   * Countdown finished (React phase → 'tutorial'): zoom out and start running so
   * the player can practice the controls, but keep the spawn timer paused and
   * scoring frozen for the tutorial window — no obstacles or coins yet.
   */
  beginTutorial() {
    if (this.isOver) return;
    this.endZoom();
    this.setBgPlaying(true); // road scrolls so movement feels real
    this.player.setAnimState('run');
    this.speed = this.level.startSpeed;
    this.inTutorial = true;
    this.running = true; // controls (lane switch + jump) are live to practice
    this.spawnTimer.paused = true; // ...but nothing spawns yet
    startMusic(this);
  }

  /**
   * Tutorial finished (React phase → 'running'): the real run begins — start
   * spawning and scoring. Also handles the direct path (retry skips the tutorial)
   * by setting up the run state itself, so it's correct whether or not
   * beginTutorial ran first.
   */
  beginRun() {
    if (this.isOver) return;
    this.endZoom();
    this.setBgPlaying(true); // road starts scrolling exactly when the run does
    this.player.setAnimState('run');
    this.speed = this.level.startSpeed;
    this.inTutorial = false;
    this.running = true;
    this.spawnTimer.paused = false;
    startMusic(this); // idempotent — covers both the post-tutorial and direct-retry paths
  }

  startZoom() {
    const cam = this.cameras.main;
    cam.zoomTo(1.6, 650, 'Sine.easeInOut');
    cam.pan(this.player.x, this.player.y - 30, 650, 'Sine.easeInOut');
  }

  endZoom() {
    const cam = this.cameras.main;
    const { width, height } = this.scale.gameSize;
    cam.zoomTo(1, 450, 'Sine.easeInOut');
    cam.pan(width / 2, height / 2, 450, 'Sine.easeInOut');
  }

  // ---- React-driven controls ----------------------------------------------

  pauseRun() {
    if (this.isOver) return;
    this.running = false;
    this.setBgPlaying(false);
    this.scene.pause();
    duckMusic(this);
  }

  resumeRun() {
    if (this.isOver) return;
    this.scene.resume();
    this.setBgPlaying(true);
    this.running = true;
    restoreMusic(this);
  }

  /** Reset everything back to the idle Start state (used by restart/retry). */
  resetToIdle() {
    stopMusic(this); // no run music bleeding into the idle/countdown screens
    this.obstacles.getChildren().forEach((o) => this.recycle(this.obstacles, o));
    this.coins.getChildren().forEach((c) => this.recycle(this.coins, c));
    this.scene.resume(); // game-over pauses the scene; revive it for the anims
    this.setBgPlaying(false); // back to a still idle road until the next run
    this.cameras.main.setZoom(1);
    const { width, height } = this.scale.gameSize;
    this.cameras.main.centerOn(width / 2, height / 2);
    this.player.reset(); // back to center lane + idle
    this.updatePlayerShadow(); // snap back with it, not wherever the run ended
    this.resetRunState();
    // Restart the zone playlist from the top for the next run.
    this.zoneLoopsDone = 0;
    this._lastVideoTime = null;
    if (this.bgIsVideo && this.zonePlaylist?.length) {
      if (this.zoneIndex !== 0) {
        this.loadZone(0); // running is false here → loadZone holds it still (re-applies rate)
      } else if (typeof this.bg.setCurrentTime === 'function') {
        this.bg.setCurrentTime(0); // already on zone 1 — just rewind it
      }
    }
    this.applyBgRate(); // speed is back to START_SPEED → snap video rate back to base
    this.spawnTimer.paused = true; // stays idle until the next countdown
    EventBus.emit('score-update', 0);
    EventBus.emit('coins-update', 0);
    EventBus.emit('time-update', GAME.RUN_DURATION_MS); // reset the HUD clock
    EventBus.emit('lives-update', GAME.LIVES); // refill the hearts
  }

  // ---- lifecycle -----------------------------------------------------------

  handleResize() {
    this.lane.recompute();
    if (this.road) this.road.draw();
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setBounds(0, 0, width, height);
    this.fitBackground();
    if (this.player && !this.isOver) {
      this.player.setPosition(this.lane.playerX(this.player.laneIndex), this.lane.playerY);
      this.updatePlayerShadow();
    }
  }

  shutdownScene() {
    stopMusic(this); // final safety net on whole-game teardown
    if (this.bgIsVideo && this.bg?.stop) this.bg.stop(); // stop decoding
    // Release the zone blob: URLs created in BootScene (whole game tears down).
    const zoneUrls = this.registry.get('zoneUrls');
    if (zoneUrls) {
      for (const url of Object.values(zoneUrls)) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // already revoked / invalid — ignore
        }
      }
      this.registry.remove('zoneUrls');
    }
    EventBus.off('start-run', this._onStartRun);
    EventBus.off('begin-tutorial', this._onBeginTutorial);
    EventBus.off('begin-run', this._onBeginRun);
    EventBus.off('pause', this._onPause);
    EventBus.off('resume', this._onResume);
    EventBus.off('restart', this._onRestart);
    EventBus.off('hud-coins-pos', this._onHudCoinsPos);
    EventBus.off('sfx', this._onSfx);
    this.scale.off('resize', this.handleResize, this);
  }
}
