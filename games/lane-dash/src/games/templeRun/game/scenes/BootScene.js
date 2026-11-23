import Phaser from "phaser";
import { GAME, TEXTURES, ANIMS, SOUNDS } from "../constants";
import { EventBus } from "../EventBus";

/**
 * Where real art lives. Files go in /public, which Vite serves under the app's
 * base URL — e.g. public/assets/templeRun/player.png → `${BASE_URL}assets/
 * templeRun/player.png`. BASE_URL is '/' in dev and the configured `base`
 * (e.g. '/games/lane-dash/') in a build, so assets resolve correctly when the site
 * is served from a subpath (GitHub Pages). Drop a PNG in here and it's used
 * automatically; anything missing falls back to the generated placeholder
 * below, so the game always runs (spec §9).
 *
 * To animate the player or coin, change its entry from a string to a
 * { sheet, frameWidth, frameHeight } object (see loadAssets()).
 */
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/templeRun`;
const ASSET_FILES = {
  // Player animation sheets. Frame size = sheet size ÷ grid:
  //   idle 1024×1024, 4×2 → 256×512 (8 frames)
  //   run  2048×2048, 4×3 → 512×682 (12 frames)
  //   jump 1024×1024, 4×2 → 256×512 (8 frames)
  //   dead 1024×1024, 3×3 → 341×341 (9 frames)
  [TEXTURES.PLAYER_IDLE]: {
    sheet: `${ASSET_BASE}/player_idle.png`,
    frameWidth: 256,
    frameHeight: 512,
  },
  [TEXTURES.PLAYER_RUN]: {
    sheet: `${ASSET_BASE}/player_run.png`,
    frameWidth: 512,
    frameHeight: 682,
  },
  [TEXTURES.PLAYER_JUMP]: {
    sheet: `${ASSET_BASE}/player_jump.png`,
    frameWidth: 256,
    frameHeight: 512,
  },
  [TEXTURES.PLAYER_DEAD]: {
    sheet: `${ASSET_BASE}/player_dead.png`,
    frameWidth: 341,
    frameHeight: 341,
  },
  // Obstacle art variants (chosen at random per spawn). The generated
  // placeholder under TEXTURES.OBSTACLE stays as the pool's default texture.
  [TEXTURES.OBSTACLE_1]: `${ASSET_BASE}/obstacle_1.png`,
  [TEXTURES.OBSTACLE_2]: `${ASSET_BASE}/obstacle_2.png`,
  [TEXTURES.OBSTACLE_3]: `${ASSET_BASE}/obstacle_3.png`,
  // Coin spin sheet: 2400×950, 5×2 grid → 480×475 (10 frames).
  [TEXTURES.COIN]: {
    sheet: `${ASSET_BASE}/coin-sprite.png`,
    frameWidth: 480,
    frameHeight: 475,
  },
  // Static image fallback used only if the animated backdrop frames fail to load.
  [TEXTURES.PARALLAX]: `${ASSET_BASE}/parallax.jpeg`,
};

/**
 * Sound effects + music. A separate top-level folder from ASSET_BASE (art
 * lives under assets/templeRun/, sounds under assets/sounds/ — that's where
 * the first two files already were). Missing files 404 silently (same
 * FILE_LOAD_ERROR swallow as the art loader below) and gameplay code checks
 * `this.cache.audio.exists(key)` before playing (see game/audio.js), so any
 * subset of these can be absent and the game stays fully playable, silent
 * for that cue.
 */
const SOUND_BASE = `${import.meta.env.BASE_URL}assets/sounds`;
const SOUND_FILES = {
  [SOUNDS.UI_TAP]: "UI_Tap.wav",
  [SOUNDS.COUNTDOWN_BEEP]: "Countdown_Beep.wav",
  [SOUNDS.COUNTDOWN_GO]: "Countdown_Go.wav",
  [SOUNDS.JUMP]: "Jump.wav",
  [SOUNDS.COIN_COLLECT]: "Coin_Collect.wav",
  [SOUNDS.WALL_HIT]: "Wall_Hit.wav",
  [SOUNDS.REVIVE]: "Woosh_Revive.wav",
  [SOUNDS.GAME_OVER]: "Game_Over.wav",
  [SOUNDS.MUSIC_RUN]: "Music_Run.ogg",
};

/**
 * Loads real art if present, otherwise generates placeholder textures at
 * runtime so v1 runs with zero asset files (spec §9), then launches RunScene.
 * Gameplay code only ever references the TEXTURES keys, so swapping art in
 * never touches the scenes/objects.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // A missing sound file 404s at the network layer almost everywhere, BUT
    // Vite's dev/preview servers serve the SPA-fallback index.html (200 OK,
    // text/html) for ANY unmatched path — including a not-yet-sourced sound
    // file — so Phaser's WebAudio decoder is handed HTML bytes instead of a
    // real 404. Decoding that fails, and (browser-dependent) can surface as
    // an unhandled promise rejection even though Phaser's own callback-based
    // error path already handles it correctly (the key never gets cached, so
    // audio.js's `cache.audio.exists()` guard keeps playback silent). This
    // narrowly swallows just that one known, harmless rejection shape so a
    // partially-sourced sounds/ folder doesn't spam the console with
    // page-level errors during local dev; anything else still surfaces.
    window.addEventListener("unhandledrejection", (e) => {
      if (e.reason instanceof DOMException && /decode audio/i.test(e.reason.message || "")) {
        e.preventDefault();
      }
    });

    // Drive the React loading bar from real loader progress (the backdrop video
    // binary dominates the byte count, so this tracks the meaningful wait).
    this.load.on(Phaser.Loader.Events.PROGRESS, (v) =>
      EventBus.emit("load-progress", v),
    );
    this.loadAssets();
  }

  create() {
    // For any texture that didn't load (file absent or failed), draw the
    // placeholder shape so the key always resolves.
    if (!this.textures.exists(TEXTURES.PLAYER)) this.makePlayerTexture();
    if (!this.textures.exists(TEXTURES.OBSTACLE)) this.makeObstacleTexture();
    if (!this.textures.exists(TEXTURES.COIN)) this.makeCoinTexture();
    if (!this.textures.exists(TEXTURES.PARALLAX)) this.makeParallaxTexture();
    this.makeShadowTexture(); // always procedural — no real-art replacement path

    this.createPlayerAnims();
    this.prepareZoneVideos();

    // RunScene emits 'ready' once its setup (incl. the video's first frame)
    // completes (spec §6).
    this.scene.start("RunScene");
  }

  /**
   * Turn each preloaded zone clip's bytes into a Blob object URL for RunScene.
   * Going via a blob: URL sidesteps Phaser's extension-based codec sniffing —
   * the browser decodes the mp4 directly. The URLs are stored on the registry as
   * a { zoneKey → url } map; RunScene orders them by GAME.ZONE_SEQUENCE. If none
   * resolve, RunScene falls back to the static image.
   */
  prepareZoneVideos() {
    const urls = {};
    for (const key of Object.keys(GAME.ZONE_SOURCES)) {
      const cacheKey = `zone:${key}`;
      if (!this.cache.binary.exists(cacheKey)) continue;
      try {
        const data = this.cache.binary.get(cacheKey);
        const blob = new Blob([data], { type: "video/mp4" });
        urls[key] = URL.createObjectURL(blob);
      } catch {
        // Skip this zone; RunScene falls back if none resolve.
      }
    }
    this.registry.set("zoneUrls", urls);
  }

  /**
   * Build the player idle/run/dead + coin-spin animations from whichever sheets
   * loaded.
   * Each is skipped if its sheet is missing (or only a 1-frame placeholder
   * resolved), so the game still runs with the generated fallback (spec §9).
   * Player.setAnimState() falls back to the static texture when an anim is gone.
   */
  createPlayerAnims() {
    // No entry for PLAYER_JUMP/ANIMS.JUMP: the jump sheet is scrubbed frame-by
    // -frame off the jump tween's own progress (Player.jump), not played on
    // this anim system's independent clock — see Player.jump's comment for why.
    const defs = [
      { tex: TEXTURES.PLAYER_IDLE, key: ANIMS.IDLE, fps: 8, repeat: -1 },
      { tex: TEXTURES.PLAYER_RUN, key: ANIMS.RUN, fps: 16, repeat: -1 },
      { tex: TEXTURES.PLAYER_DEAD, key: ANIMS.DEAD, fps: 12, repeat: 0 },
      { tex: TEXTURES.COIN, key: ANIMS.COIN, fps: 14, repeat: -1 },
    ];
    for (const d of defs) {
      if (!this.textures.exists(d.tex)) continue;
      // frameTotal counts the cells plus the implicit __BASE frame.
      const frameCount = this.textures.get(d.tex).frameTotal - 1;
      if (frameCount < 2) continue;
      if (this.anims.exists(d.key)) continue;
      this.anims.create({
        key: d.key,
        frames: this.anims.generateFrameNumbers(d.tex, {
          start: 0,
          end: frameCount - 1,
        }),
        frameRate: d.fps,
        repeat: d.repeat,
      });
    }
  }

  // ---- real-art loading ----------------------------------------------------

  loadAssets() {
    // A missing file 404s; we swallow the loader error and fall back in create.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {});

    // Multi-zone backdrop: each zone clip is fetched as a binary blob so we
    // control the decode path (see prepareZoneVideos) rather than letting Phaser
    // sniff the codec by extension. Keyed by the zone name so RunScene can build
    // the playlist in GAME.ZONE_SEQUENCE order. If they all fail to load,
    // RunScene falls back to the static parallax image, then the placeholder.
    for (const [key, rel] of Object.entries(GAME.ZONE_SOURCES)) {
      this.load.binary(`zone:${key}`, `${ASSET_BASE}/${rel}`);
    }

    for (const [key, entry] of Object.entries(ASSET_FILES)) {
      if (typeof entry === "string") {
        this.load.image(key, entry);
      } else {
        // Sprite-sheet form: { sheet, frameWidth, frameHeight }.
        this.load.spritesheet(key, entry.sheet, {
          frameWidth: entry.frameWidth,
          frameHeight: entry.frameHeight,
        });
      }
    }

    for (const [key, file] of Object.entries(SOUND_FILES)) {
      this.load.audio(key, `${SOUND_BASE}/${file}`);
    }
  }

  // Placeholder runner seen from behind (head, backpack, arms, legs) so the
  // forward-running perspective reads correctly. Replace with player.png.
  makePlayerTexture() {
    const w = 56;
    const h = 84;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Legs.
    g.fillStyle(0x3f3550, 1);
    g.fillRoundedRect(w * 0.3, h * 0.66, w * 0.16, h * 0.3, 5);
    g.fillRoundedRect(w * 0.54, h * 0.66, w * 0.16, h * 0.3, 5);
    // Shoes.
    g.fillStyle(0xe2e8f0, 1);
    g.fillRoundedRect(w * 0.29, h * 0.92, w * 0.18, h * 0.07, 3);
    g.fillRoundedRect(w * 0.53, h * 0.92, w * 0.18, h * 0.07, 3);
    // Arms.
    g.fillStyle(0xe0a93b, 1);
    g.fillRoundedRect(w * 0.08, h * 0.34, w * 0.14, h * 0.28, 6);
    g.fillRoundedRect(w * 0.78, h * 0.34, w * 0.14, h * 0.28, 6);
    // Torso.
    g.fillStyle(0xffc44d, 1);
    g.fillRoundedRect(w * 0.18, h * 0.3, w * 0.64, h * 0.42, 12);
    // Backpack.
    g.fillStyle(0xd9534f, 1);
    g.fillRoundedRect(w * 0.3, h * 0.35, w * 0.4, h * 0.3, 8);
    g.fillStyle(0xb23b38, 1);
    g.fillRoundedRect(w * 0.4, h * 0.4, w * 0.2, h * 0.18, 5);
    // Head + hair.
    g.fillStyle(0x8a5a2b, 1);
    g.fillCircle(w * 0.5, h * 0.2, w * 0.19);
    g.fillStyle(0x2f2012, 1);
    g.fillCircle(w * 0.5, h * 0.16, w * 0.18);
    g.generateTexture(TEXTURES.PLAYER, w, h);
    g.destroy();
  }

  // Placeholder stone block with shaded top + warning chevrons. Replace with
  // obstacle.png.
  makeObstacleTexture() {
    const w = 64;
    const h = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xb91c1c, 1); // shadowed body
    g.fillRoundedRect(0, h * 0.18, w, h * 0.82, 10);
    g.fillStyle(0xef4444, 1); // lit top face
    g.fillRoundedRect(0, 0, w, h * 0.4, 10);
    // Warning chevrons.
    g.fillStyle(0xfde047, 1);
    for (let i = -1; i < 3; i++) {
      g.fillTriangle(
        i * 22 + 8,
        h * 0.95,
        i * 22 + 24,
        h * 0.55,
        i * 22 + 30,
        h * 0.55,
      );
      g.fillTriangle(
        i * 22 + 30,
        h * 0.55,
        i * 22 + 14,
        h * 0.95,
        i * 22 + 8,
        h * 0.95,
      );
    }
    g.generateTexture(TEXTURES.OBSTACLE, w, h);
    g.destroy();
  }

  // Placeholder gold coin with rim, inner ring and shine. Static fallback when
  // the coin-sprite.png spin sheet is unavailable. Replace with the sheet.
  makeCoinTexture() {
    const r = 18;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xb6890b, 1); // rim
    g.fillCircle(r, r, r);
    g.fillStyle(0xffd54a, 1); // face
    g.fillCircle(r, r, r - 3);
    g.lineStyle(2, 0xe9b949, 1); // inner ring
    g.strokeCircle(r, r, r - 7);
    g.fillStyle(0xfff3c4, 0.9); // shine highlight
    g.fillCircle(r - 5, r - 5, 3);
    g.generateTexture(TEXTURES.COIN, r * 2, r * 2);
    g.destroy();
  }

  // Placeholder night sky with a faint horizon glow + stars. Tiles vertically.
  // Replace with parallax.png.
  makeParallaxTexture() {
    const w = GAME.BASE_WIDTH;
    const h = 256;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x110e2e, 1);
    g.fillRect(0, 0, w, h);
    g.fillStyle(0x231a4d, 0.8);
    g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle(0x3a2a6b, 0.5);
    g.fillRect(0, h * 0.82, w, h * 0.18);
    // Scattered stars.
    g.fillStyle(0xc7d2fe, 0.9);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % w;
      const y = (i * 53) % Math.floor(h * 0.6);
      g.fillCircle(x, y, i % 3 === 0 ? 1.6 : 1);
    }
    g.generateTexture(TEXTURES.PARALLAX, w, h);
    g.destroy();
  }

  /**
   * Soft radial-gradient ellipse used as every obstacle's ground-contact
   * shadow (RunScene.advanceGroup positions/scales one under each obstacle).
   * Graphics' fillStyle can't do gradients, so this draws straight to a
   * canvas texture. Always generated (no real-art replacement expected).
   */
  makeShadowTexture() {
    const w = 128;
    const h = 64;
    const tex = this.textures.createCanvas(TEXTURES.SHADOW, w, h);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "rgba(0,0,0,0.9)");
    grad.addColorStop(0.7, "rgba(0,0,0,0.5)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
  }
}
