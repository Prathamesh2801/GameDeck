import Phaser from "phaser";
import {
  STAGE,
  RULES,
  PHYSICS,
  SPAWN,
  OBJECT,
  BOMB,
  BLADE,
  FRUITS,
  POWERUP,
  POWERUPS,
  FEAST,
  SOUNDS,
} from "../constants";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
  }

  // Load the fruit sprites + bomb declared in constants. Progress is mirrored
  // to the React loading screen so nothing pops in mid-run.
  preload() {
    const reg = this.game.registry;
    reg.set("rn:loadprogress", 0);
    this.load.on("progress", (v) => {
      reg.set("rn:loadprogress", v);
      this.game.events.emit("rn:loadprogress", v);
    });
    this.load.once("complete", () => {
      reg.set("rn:loadprogress", 1);
      this.game.events.emit("rn:loadprogress", 1);
    });

    FRUITS.forEach((f) => {
      this.load.image(`${f.key}`, f.whole);
      this.load.image(`${f.key}_l`, f.halfL);
      this.load.image(`${f.key}_r`, f.halfR);
    });
    this.load.image("bomb", BOMB.IMAGE);
    POWERUPS.forEach((p) => this.load.image(p.key, p.image));
    Object.entries(SOUNDS).forEach(([key, s]) => this.load.audio(key, s.url));
  }

  // Play a sound effect by key (no-op if it failed to load).
  playSfx(key) {
    const s = SOUNDS[key];
    if (s && this.cache.audio.exists(key)) {
      this.sound.play(key, { volume: s.volume });
    }
  }

  // One-time setup. A run is (re)started via startRun() — we never tear the
  // scene down, so there's no restart race and no listener re-registration.
  create() {
    // This game instance's own emitter — the React HUD talks to exactly this
    // one. "rn:" prefix avoids clashing with Phaser's own game events.
    this.bus = this.game.events;

    this.buildTextures();
    this.bladeGfx = this.add.graphics().setDepth(100);

    this.input.on("pointerdown", this.onDown, this);
    this.input.on("pointermove", this.onMove, this);
    this.input.on("pointerup", this.onUp, this);

    this.textPool = []; // reused floating "+points" labels (see popText)

    // Safe defaults so update() can run harmlessly during the loading screen,
    // before the first startRun() (triggered by "rn:begin") populates state.
    this.objects = [];
    this.trail = [];
    this.gameOver = false;
    this.mode = "boot";

    // React → scene controls (registered once for this game instance).
    this.onBegin = () => this.startRun();
    this.onRestart = () => this.startRun();
    this.onPause = () => this.pauseGame();
    this.onResume = () => this.resumeGame();
    this.bus.on("rn:begin", this.onBegin);
    this.bus.on("rn:restart", this.onRestart);
    this.bus.on("rn:pause", this.onPause);
    this.bus.on("rn:resume", this.onResume);
    this.events.once("shutdown", () => {
      this.bus.off("rn:begin", this.onBegin);
      this.bus.off("rn:restart", this.onRestart);
      this.bus.off("rn:pause", this.onPause);
      this.bus.off("rn:resume", this.onResume);
    });

    // The run no longer auto-starts: we wait for React to dismiss the loading
    // screen and fire "rn:begin", so the countdown never plays behind it.
    this.bus.emit("rn:ready");
  }

  // Reset all run state without recreating the scene.
  startRun() {
    if (this.objects) this.objects.forEach((o) => o.destroy());
    this.objects = []; // active airborne objects
    this.trail = []; // recent pointer points {x,y,t} for the blade
    this.swipeSlices = 0; // fruits cut in the current swipe (for combos)
    this.score = 0;
    this.gameOver = false;
    this.startTime = this.time.now;
    this.playEndsAt = 0; // set once play actually begins (after countdown)
    this.lastTimeEmit = Math.ceil(RULES.DURATION_MS / 1000);
    this.clearFeast(); // wipe any in-progress feast

    if (this.bladeGfx) this.bladeGfx.clear();
    if (this.scene.isPaused()) this.scene.resume();
    this.physics.resume();

    if (this.spawnEvent) {
      this.spawnEvent.remove();
      this.spawnEvent = null;
    }

    this.bus.emit("rn:score", 0);
    this.bus.emit("rn:time", this.lastTimeEmit);

    this.startCountdown();
  }

  // 3 · 2 · 1 · go — spawning waits until the count reaches zero.
  startCountdown() {
    this.mode = "countdown";
    if (this.countdownEvent) this.countdownEvent.remove();
    this.playSfx("start");
    let n = 3;
    this.bus.emit("rn:countdown", n);
    this.countdownEvent = this.time.addEvent({
      delay: 1000,
      repeat: 2, // fires for 2, 1, 0
      callback: () => {
        n -= 1;
        this.bus.emit("rn:countdown", n);
        if (n === 0) this.beginPlay();
      },
    });
  }

  beginPlay() {
    this.mode = "play";
    this.startTime = this.time.now; // grace timers start now
    this.playEndsAt = this.time.now + RULES.DURATION_MS; // the 2-minute clock
    if (this.spawnEvent) this.spawnEvent.remove();
    this.spawnEvent = this.time.addEvent({
      delay: SPAWN.WAVE_DELAY_MS,
      callback: this.spawnWave,
      callbackScope: this,
      loop: true,
    });
  }

  pauseGame() {
    if (this.gameOver || this.scene.isPaused()) return;
    this.scene.pause(); // freezes update, timers, physics & input
  }

  resumeGame() {
    if (this.scene.isPaused()) this.scene.resume();
  }

  // ── Procedural textures (juice spark) ─────────────────────────────────
  buildTextures() {
    if (this.texturesBuilt) return;
    this.sparkTexture("spark", 14);
    this.texturesBuilt = true;
  }

  sparkTexture(key, d) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(d / 2, d / 2, d / 2);
    g.generateTexture(key, d, d);
    g.destroy();
  }

  // ── Spawning ──────────────────────────────────────────────────────────
  spawnWave() {
    if (this.gameOver || this.mode !== "play") return;
    const n = Phaser.Math.Between(SPAWN.MIN_PER_WAVE, SPAWN.MAX_PER_WAVE);
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * SPAWN.STAGGER_MS, () => this.spawnObject());
    }
  }

  spawnObject() {
    // The feast pauses the spawn loop, but a wave already in flight can still
    // fire its staggered delayed calls — bail here so nothing joins the
    // centre-stage sweet while the bonus round is running.
    if (this.gameOver || this.mode !== "play") return;
    const { width, height } = this.scale;
    const elapsed = this.time.now - this.startTime;
    const isBomb = elapsed > BOMB.GRACE_MS && Math.random() < BOMB.CHANCE;
    const isPower =
      !isBomb && elapsed > POWERUP.GRACE_MS && Math.random() < POWERUP.CHANCE;

    const x = Phaser.Math.Between(width * 0.18, width * 0.82);
    const y = height + 60;

    let obj;
    if (isBomb) {
      obj = this.physics.add.image(x, y, "bomb").setDepth(10);
      this.fitToDisplay(obj, BOMB.DISPLAY_SIZE);
      obj.setData({ type: "bomb", juice: 0xf2a23a, sliced: false, counted: false });
    } else if (isPower) {
      const pu = Phaser.Utils.Array.GetRandom(POWERUPS);
      obj = this.physics.add.image(x, y, pu.key).setDepth(11);
      this.fitToDisplay(obj, POWERUP.DISPLAY_SIZE);
      obj.setData({ type: "powerup", powerup: pu, sliced: false, counted: false });
      // gentle shimmer so it reads as special
      this.tweens.add({
        targets: obj,
        scale: obj.scale * 1.1,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      const fruit = Phaser.Utils.Array.GetRandom(FRUITS);
      obj = this.physics.add.image(x, y, fruit.key).setDepth(10);
      const variance =
        1 + Phaser.Math.FloatBetween(-OBJECT.SIZE_VARIANCE, OBJECT.SIZE_VARIANCE);
      this.fitToDisplay(obj, OBJECT.DISPLAY_SIZE * (fruit.sizeScale ?? 1) * variance);
      obj.setData({
        type: "fruit",
        fruit,
        points: fruit.points,
        juice: fruit.juice,
        sliced: false,
        counted: false,
      });
    }

    // Slice detection uses a manual geom circle, and objects never collide,
    // so the default arcade body (gravity only) is all we need.
    const dir = x < width / 2 ? 1 : -1; // arc gently toward centre
    obj.setVelocity(
      dir * Phaser.Math.Between(10, PHYSICS.DRIFT_MAX),
      -Phaser.Math.Between(PHYSICS.THROW_MIN, PHYSICS.THROW_MAX)
    );
    obj.setAngularVelocity(Phaser.Math.Between(-PHYSICS.SPIN_MAX, PHYSICS.SPIN_MAX));

    this.objects.push(obj);
  }

  // Scale a sprite so its larger dimension equals `size` (game px).
  fitToDisplay(obj, size) {
    obj.setScale(size / Math.max(obj.width, obj.height));
  }

  // ── Input → slicing ───────────────────────────────────────────────────
  onDown(pointer) {
    if (this.gameOver) return;
    this.swipeSlices = 0;
    this.trail.push({ x: pointer.x, y: pointer.y, t: this.time.now });
  }

  onMove(pointer) {
    if (this.gameOver || !pointer.isDown) return;
    const prev = this.trail[this.trail.length - 1];
    this.trail.push({ x: pointer.x, y: pointer.y, t: this.time.now });
    if (prev) this.checkSlice(prev.x, prev.y, pointer.x, pointer.y);
  }

  onUp() {
    if (this.gameOver) return;
    if (this.swipeSlices >= RULES.COMBO_MIN) {
      const bonus = this.swipeSlices * RULES.COMBO_BONUS_PER;
      this.score += bonus;
      this.bus.emit("rn:score", this.score);
      this.bus.emit("rn:combo", { count: this.swipeSlices, bonus });
    }
    this.swipeSlices = 0;
  }

  checkSlice(x1, y1, x2, y2) {
    // Reused scratch geometry — checkSlice runs on every pointer-move, so we
    // avoid allocating a fresh Line/Circle (and GC'ing it) each time.
    const line = (this._line ??= new Phaser.Geom.Line());
    const circle = (this._circle ??= new Phaser.Geom.Circle());
    line.setTo(x1, y1, x2, y2);

    // During the feast, the only thing to slash is the big centred sweet.
    if (this.mode === "feast") {
      if (this.feastActive && this.feastItem) {
        const r = (this.feastItem.displayWidth / 2) * 0.92;
        circle.setTo(this.feastItem.x, this.feastItem.y, r);
        if (Phaser.Geom.Intersects.LineToCircle(line, circle)) this.feastHit(x2, y2);
      }
      return;
    }

    for (const obj of this.objects) {
      if (obj.getData("sliced")) continue;
      const radius = (obj.displayWidth / 2) * OBJECT.HITBOX_SCALE;
      circle.setTo(obj.x, obj.y, radius);
      if (Phaser.Geom.Intersects.LineToCircle(line, circle)) this.sliceObject(obj);
    }
  }

  sliceObject(obj) {
    obj.setData("sliced", true);

    const type = obj.getData("type");

    if (type === "bomb") {
      // Bombs no longer end the run — they just cost points (floored at 0)
      // and break any combo the current swipe was building.
      this.score = Math.max(0, this.score - BOMB.PENALTY);
      this.swipeSlices = 0;
      this.bus.emit("rn:score", this.score);
      this.playSfx("bomb");
      this.bombFx(obj.x, obj.y);
      this.popText(obj.x, obj.y - 10, `-${BOMB.PENALTY}`, "#c0202a", 30);
      this.removeObject(obj);
      return;
    }

    if (type === "powerup") {
      this.enterFeast(obj);
      return;
    }

    const pts = obj.getData("points");
    this.score += pts;
    this.swipeSlices += 1;
    this.bus.emit("rn:score", this.score);
    this.playSfx("slice");
    this.sliceFx(obj);
    this.popText(obj.x, obj.y, `+${pts}`, "#9c2b2b");
    this.removeObject(obj);
  }

  removeObject(obj) {
    const i = this.objects.indexOf(obj);
    if (i >= 0) this.objects.splice(i, 1);
    // Destroying a target does NOT stop its tweens, and the power-up shimmer
    // is an infinite (repeat:-1) tween — so an unsliced power-up that falls
    // away would leave a zombie tween ticking forever. Kill them first.
    this.tweens.killTweensOf(obj);
    obj.destroy();
  }

  // ── Feast (power-up bonus round) ──────────────────────────────────────
  enterFeast(obj) {
    this.mode = "feast";
    this.feastActive = false; // not slashable until it lands centre-stage
    this.feastCdUntil = 0;
    this.feastSlashes = 0; // counted slashes so far this feast
    this.feastEarned = 0; // total points banked this feast
    this.feastIdleTweens = [];
    this.spawnEvent.paused = true;

    // sweep away the other airborne fruit
    this.objects.forEach((o) => {
      if (o === obj) return;
      this.tweens.add({
        targets: o,
        alpha: 0,
        scale: 0,
        duration: 200,
        onComplete: () => o.destroy(),
      });
    });
    this.objects = [];

    const cx = this.scale.width / 2;
    const cy = this.scale.height * FEAST.CENTER_Y;
    this.feastCx = cx;
    this.feastCy = cy;

    // focus dim behind the sweet
    this.feastDim = this.add
      .rectangle(cx, this.scale.height / 2, this.scale.width, this.scale.height, 0x140a06, 0)
      .setDepth(70);
    this.tweens.add({ targets: this.feastDim, alpha: 0.55, duration: 260 });

    // take over the sliced sweet as the feast centrepiece
    this.tweens.killTweensOf(obj);
    if (obj.body) obj.body.enable = false;
    obj.setDepth(76);
    this.feastItem = obj;

    const big = FEAST.BIG_SIZE / Math.max(obj.width, obj.height);
    this.feastBigScale = big;
    this.tweens.add({
      targets: obj,
      x: cx,
      y: cy,
      scale: big,
      angle: 0,
      duration: FEAST.INTRO_MS,
      ease: "Back.easeOut",
      onComplete: () => {
        this.feastActive = true;
        this.startFeastIdle(); // gentle bob/sway while waiting for slashes
        this.feastTimer = this.time.delayedCall(FEAST.DURATION_MS, () => this.endFeast());
        // banner + timer bar align with the actual slashing window
        this.bus.emit("rn:feast-start", {
          duration: FEAST.DURATION_MS,
          perSlash: FEAST.POINTS_PER_SLICE,
          bonusEvery: FEAST.BONUS_EVERY,
          bonus: FEAST.BONUS,
        });
      },
    });
  }

  // Current resting scale of the centrepiece — swells with each counted slash.
  feastCurrentScale() {
    const grow = Math.min(this.feastSlashes * FEAST.GROW_PER_SLICE, FEAST.MAX_GROW);
    return this.feastBigScale * (1 + grow);
  }

  // Idle float: a slow vertical bob, a lazy sway, and a soft "breathing"
  // squash so the sweet always feels alive between slashes.
  startFeastIdle() {
    const item = this.feastItem;
    if (!item || !this.feastActive) return;
    this.stopFeastIdle();
    const base = this.feastCurrentScale();
    item.setPosition(this.feastCx, this.feastCy);
    item.setScale(base);
    item.setAngle(0);
    this.feastIdleTweens = [
      this.tweens.add({
        targets: item,
        y: this.feastCy + 12,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
      this.tweens.add({
        targets: item,
        angle: 4,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        delay: 200,
        ease: "Sine.easeInOut",
      }),
      this.tweens.add({
        targets: item,
        scaleX: base * 1.04,
        scaleY: base * 0.96,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
    ];
  }

  stopFeastIdle() {
    if (this.feastIdleTweens) {
      this.feastIdleTweens.forEach((t) => t.remove());
      this.feastIdleTweens = [];
    }
  }

  feastHit(x, y) {
    const now = this.time.now;
    if (!this.feastActive || now < this.feastCdUntil) return;
    this.feastCdUntil = now + FEAST.SLICE_COOLDOWN_MS;

    const item = this.feastItem;
    const crumb = item.getData("powerup").crumb;

    this.feastSlashes += 1;
    this.playSfx("slice");

    // richer burst that grows as the streak climbs
    const streak = Math.min(this.feastSlashes, 12);
    this.burst(x, y, crumb, 12 + streak);
    this.burst(item.x, item.y, 0xffe9b0, 6);
    this.feastRing(item.x, item.y, crumb, 1 + streak * 0.12);

    // ── Scoring: +POINTS_PER_SLICE every slash, +BONUS on every Nth slash ──
    const bonusHit = this.feastSlashes % FEAST.BONUS_EVERY === 0;
    const gain = FEAST.POINTS_PER_SLICE + (bonusHit ? FEAST.BONUS : 0);
    this.score += gain;
    this.feastEarned += gain;
    this.bus.emit("rn:score", this.score);

    if (bonusHit) {
      // celebrate the milestone slash
      this.popText(item.x, item.y - 12, `BONUS +${FEAST.BONUS}`, "#8a5a22", 32);
      this.feastRing(item.x, item.y, 0xffe9b0, 2.4);
    } else {
      this.popText(x, y - 10, `+${FEAST.POINTS_PER_SLICE}`, "#8a5a22");
    }

    // springy punch that settles back to the (now larger) resting scale
    const base = this.feastCurrentScale();
    this.stopFeastIdle();
    this.tweens.killTweensOf(item);
    item.setScale(base * 1.18);
    item.setAngle(Phaser.Math.Between(-9, 9));
    this.tweens.add({
      targets: item,
      scale: base,
      angle: 0,
      duration: 190,
      ease: "Back.easeOut",
      onComplete: () => this.startFeastIdle(),
    });
    this.cameras.main.shake(90 + streak * 6, 0.006 + streak * 0.0004);
  }

  // Quick expanding halo pulse behind the sweet on each slash.
  feastRing(x, y, color, scale) {
    const ring = this.add.image(x, y, "spark").setTint(color).setDepth(75).setScale(1);
    this.tweens.add({
      targets: ring,
      scale: 6 * scale,
      alpha: 0,
      duration: 320,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  endFeast() {
    this.feastActive = false;
    this.stopFeastIdle();
    const earned = this.feastEarned;
    const item = this.feastItem;

    if (item) {
      const crumb = item.getData("powerup").crumb;
      if (earned > 0) {
        // celebratory finale showing the feast's running total
        this.bigBurst(item.x, item.y, crumb);
        this.popText(item.x, item.y - 24, `FEAST!  +${earned}`, "#9c2b2b", 30);
      } else {
        // never landed a slash — nothing earned
        this.popText(item.x, item.y - 24, "Missed!", "#9c2b2b", 26);
      }
      this.tweens.killTweensOf(item);
      this.tweens.add({
        targets: item,
        scale: 0,
        angle: 80,
        alpha: 0,
        duration: 320,
        ease: "Back.easeIn",
        onComplete: () => item.destroy(),
      });
      this.feastItem = null;
    }

    if (this.feastDim) {
      const dim = this.feastDim;
      this.feastDim = null;
      this.tweens.add({ targets: dim, alpha: 0, duration: 300, onComplete: () => dim.destroy() });
    }

    this.mode = "play";
    if (this.spawnEvent) this.spawnEvent.paused = false;
    this.bus.emit("rn:feast-end", { total: earned });
  }

  // Tear down feast state immediately (used on restart).
  clearFeast() {
    this.stopFeastIdle();
    if (this.feastTimer) {
      this.feastTimer.remove(false);
      this.feastTimer = null;
    }
    if (this.feastItem) {
      this.feastItem.destroy();
      this.feastItem = null;
    }
    if (this.feastDim) {
      this.feastDim.destroy();
      this.feastDim = null;
    }
    this.feastActive = false;
    this.feastSlashes = 0;
    this.feastEarned = 0;
    this.mode = "play";
  }

  // ── Per-frame: countdown clock, blade trail + cull fallen objects ─────
  update() {
    this.drawBlade();
    this.tickClock();

    const h = this.scale.height;
    const w = this.scale.width;

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      if (o.getData("sliced")) continue;
      // Fell past the bottom or drifted off the side — no penalty now, a
      // missed fruit simply scores nothing.
      if (o.y > h + 90 || o.x < -120 || o.x > w + 120) this.removeObject(o);
    }
  }

  // Drive the 2-minute clock; emit whole-second changes and end at zero.
  tickClock() {
    if (this.gameOver || !this.playEndsAt) return;
    if (this.mode !== "play" && this.mode !== "feast") return;
    const remain = Math.max(0, this.playEndsAt - this.time.now);
    const secs = Math.ceil(remain / 1000);
    if (secs !== this.lastTimeEmit) {
      this.lastTimeEmit = secs;
      this.bus.emit("rn:time", secs);
    }
    if (remain <= 0) this.endGame("time");
  }

  drawBlade() {
    const now = this.time.now;
    this.trail = this.trail.filter((p) => now - p.t < BLADE.LIFETIME_MS);
    const g = this.bladeGfx;
    g.clear();
    if (this.trail.length < 2) return;
    // two passes: maroon glow under a bright ivory core, tapering to the tip
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < this.trail.length; i++) {
        const p0 = this.trail[i - 1];
        const p1 = this.trail[i];
        const k = i / this.trail.length;
        if (pass === 0) g.lineStyle(4 + 14 * k, BLADE.GLOW_COLOR, 0.05 + 0.35 * k);
        else g.lineStyle(2 + 7 * k, BLADE.CORE_COLOR, 0.2 + 0.7 * k);
        g.lineBetween(p0.x, p0.y, p1.x, p1.y);
      }
    }
  }

  // ── Juice ─────────────────────────────────────────────────────────────
  // Fling the matching left/right halves apart + a particle burst.
  sliceFx(obj) {
    const fruit = obj.getData("fruit");
    const { x, y } = obj;
    // Size the halves off the whole's on-screen size so they always match,
    // regardless of each half image's own source resolution.
    const target = Math.max(obj.displayWidth, obj.displayHeight) * OBJECT.HALF_SCALE;

    [
      { key: `${fruit.key}_l`, dir: -1 },
      { key: `${fruit.key}_r`, dir: 1 },
    ].forEach(({ key, dir }) => {
      const half = this.add.image(x, y, key).setDepth(40);
      half.setScale(target / Math.max(half.width, half.height));
      half.setAngle(obj.angle);
      this.tweens.add({
        targets: half,
        x: x + dir * Phaser.Math.Between(40, 80),
        y: y + Phaser.Math.Between(30, 90),
        angle: half.angle + dir * Phaser.Math.Between(60, 120),
        alpha: 0,
        duration: 600,
        ease: "Quad.easeIn",
        onComplete: () => half.destroy(),
      });
    });

    this.burst(x, y, obj.getData("juice"), 9);
  }

  burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const p = this.add.image(x, y, "spark").setTint(color).setDepth(35);
      p.setScale(Phaser.Math.FloatBetween(0.4, 1));
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const d = Phaser.Math.Between(30, 90);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(300, 600),
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  // Bigger celebratory burst (feast finale).
  bigBurst(x, y, color) {
    const ring = this.add.image(x, y, "spark").setTint(0xffe9b0).setDepth(78).setScale(1);
    this.tweens.add({
      targets: ring,
      scale: 20,
      alpha: 0,
      duration: 420,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    for (let i = 0; i < 26; i++) {
      const tint = Phaser.Math.RND.pick([color, 0xffe9b0, 0xfff6e9, 0x8a5a22]);
      const p = this.add.image(x, y, "spark").setTint(tint).setDepth(79);
      p.setScale(Phaser.Math.FloatBetween(0.6, 1.8));
      const a = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(60, 200);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(380, 760),
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  bombFx(x, y) {
    const cam = this.cameras.main;
    cam.shake(260, 0.012); // brief jolt — bombs are a point penalty, not death
    cam.flash(180, 200, 40, 40); // quick red sting instead of a full white-out

    // expanding shockwave ring
    const ring = this.add.image(x, y, "spark").setTint(0xffffff).setDepth(80).setScale(0.6);
    this.tweens.add({
      targets: ring,
      scale: 22,
      alpha: 0,
      duration: 480,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });

    // bright fireball core
    const core = this.add.image(x, y, "spark").setTint(0xffe08a).setDepth(81);
    this.tweens.add({
      targets: core,
      scale: 13,
      alpha: 0,
      duration: 320,
      ease: "Quad.easeOut",
      onComplete: () => core.destroy(),
    });

    // debris + embers flung outward
    for (let i = 0; i < 28; i++) {
      const tint = Phaser.Math.RND.pick([
        0x1a1a1a, 0x2c160f, 0xf2a23a, 0x9c2b2b, 0xffd27a,
      ]);
      const p = this.add.image(x, y, "spark").setTint(tint).setDepth(82);
      p.setScale(Phaser.Math.FloatBetween(0.5, 1.9));
      const a = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(70, 240);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(420, 820),
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  // Floating "+points" label. Text objects are expensive to create (each one
  // rasterises to a canvas + uploads a GPU texture), so we pool and reuse them
  // instead of spawning/destroying one per slice — this is the main fix for
  // the stutter felt while cutting.
  popText(x, y, txt, color, size = 22) {
    let t = this.textPool.pop();
    if (!t) {
      t = this.add
        .text(0, 0, "", { fontFamily: "Montserrat, sans-serif", fontStyle: "700" })
        .setOrigin(0.5)
        .setDepth(60);
    }
    t.setText(txt)
      .setColor(color)
      .setFontSize(size)
      .setPosition(x, y)
      .setAlpha(1)
      .setActive(true)
      .setVisible(true);
    this.tweens.add({
      targets: t,
      y: y - 55,
      alpha: 0,
      duration: 650,
      ease: "Quad.easeOut",
      onComplete: () => {
        t.setActive(false).setVisible(false);
        this.textPool.push(t);
      },
    });
  }

  endGame(reason) {
    if (this.gameOver) return;
    this.gameOver = true;
    if (this.spawnEvent) this.spawnEvent.remove();
    // If the clock runs out mid-feast, tidy the centre-stage sweet + banner.
    if (this.mode === "feast") this.bus.emit("rn:feast-end", { total: this.feastEarned });
    this.clearFeast();
    this.physics.pause(); // freeze the airborne fruit
    this.playSfx("over");
    this.bus.emit("rn:gameover", { score: this.score, reason });
  }
}
