/**
 * Dependency-free game constants (spec §11). Kept in their own module so the
 * config → scenes → levelConfig import chain never has to wait on config.js to
 * finish initializing (avoids a circular-import TDZ on GAME). Keep ALL magic
 * numbers here — scenes/objects read from GAME, never hardcode.
 */
export const GAME = {
  BASE_WIDTH: 650,
  BASE_HEIGHT: 800,
  // Native pixel size of the backdrop video (videos/Udaipur_loop.webm = 1080×1920).
  // Used as the fallback source size for the lane cover-fit transform; once the
  // video's first frame decodes, Lane.js reads its live dimensions so its
  // transform is byte-identical to the backdrop's (see RunScene.fitBackground /
  // Lane.setSource). The ROAD calibration below is expressed as fractions of this
  // frame, so it stays valid as long as the clip keeps the 9:16 ratio.
  VIDEO_SRC_W: 1080,
  VIDEO_SRC_H: 1920,
  // --- Animated backdrop (multi-zone looping video) -----------------------
  // The environment is assembled from several seamless-loop clips ("zones").
  // Each zone repeats ZONE_LOOPS times back-to-back, then the next key in
  // ZONE_SEQUENCE takes over; after the last zone the sequence wraps to the
  // first. Tune the play ORDER and how many times each zone repeats here, with
  // no scene changes. ZONE_SOURCES maps each zone key to its clip file (paths
  // are relative to the templeRun asset base; see BootScene). To reorder or
  // repeat zones, just edit ZONE_SEQUENCE (e.g. ["zone_2", "zone_1", "zone_2"]).
  ZONE_LOOPS: 1, // times each zone clip repeats before advancing to the next
  ZONE_SEQUENCE: ["zone_1"], // play order (keys of ZONE_SOURCES)
  ZONE_SOURCES: {
    zone_1: "zones/Udaipur_zone_1_loop.mp4",
    // zone_2: "zones/Udaipur_zone_2_loop.mp4",
    // zone_3: "zones/Udaipur_zone_3_loop.mp4",
  },
  // It's decoded by the browser and shown as a cover backdrop
  // (RunScene.buildBackground); tune BG_PLAYBACK_RATE until the scenery scroll
  // matches the obstacle motion.
  // --- Painted-road geometry ----------------------------------------------
  // The road is modeled as a trapezoid calibrated from the actual backdrop
  // frame: a single vanishing point at the horizon (the sun) and the near road
  // edges where the path meets the bottom of the frame. Lanes are spaced evenly
  // across that trapezoid and ALL converge to the vanishing point, so the guides,
  // player, obstacles and coins ride the filmed path. Every value is a fraction
  // of the SOURCE video frame (0..1) and is mapped to screen px through the same
  // cover-fit as the backdrop, so the fit holds on any screen aspect.
  // Re-calibrate by toggling DEBUG_LANES and matching the guides to the path.
  ROAD: {
    VANISH_X: 0.52, // horizon convergence column (the sun) — scene is symmetric
    VANISH_Y: 0.35, // horizon row where the path narrows to a point
    NEAR_Y: 1.0, // road meets the bottom edge of the frame
    NEAR_LEFT: 0.15, // sandy path's left edge at the bottom row
    NEAR_RIGHT: 0.85, // sandy path's right edge at the bottom row
    LANES: 3, // number of evenly-spaced lanes across the path
  },
  // Calibration overlay: bright lane guides drawn over the video so the code
  // lanes can be eyeballed against the painted road. Set false to hide them.
  DEBUG_LANES: false,
  // Debug toggle: set false to suppress the killable obstacles while tuning the
  // background/scenery (the run then can't end on a hit). Coins still spawn.
  // Flip back to true to re-enable obstacle_1/2/3.
  SPAWN_OBSTACLES: true,
  PLAYER_Y: 0.86, // player's row as a fraction of the video frame height
  // How close (0..1, relative to the player's row) an in-lane obstacle must get
  // before it counts as a hit. 1 = must be right on the player's row; lower
  // widens the kill window above/below the player. Measured against PLAYER_Y so
  // it stays correct regardless of the vanishing point / PLAYER_Y.
  COLLIDE_NEAR_T: 0.9,
  // On-screen size of an item as a fraction of its full (near) size, lerped by
  // depth t (0 = vanishing point/horizon, 1 = near/bottom row). For a flat
  // ground plane, projected size ∝ distance below the horizon, so this is ~linear
  // in t and anchored near 0 at the vanishing point — items emerge as a speck at
  // the sun and grow to full size as they reach the player, matching the road's
  // perspective. (Was 0.3, which made far items "pop in" too large.)
  SCALE_FAR: 0.04, // tiny speck at the horizon (not 0, so it's never sub-pixel)
  SCALE_NEAR: 1.0,
  // Run speed ramps over time (Temple Run-style acceleration). Crucially, the
  // backdrop VIDEO speeds up by the exact same factor (speed / START_SPEED) so
  // the painted road and the obstacles never drift apart — see
  // RunScene.desiredBgRate. Because both scale together, the calibration below
  // (and ZONE_PLAYBACK_RATES) only has to be right AT START_SPEED; the ramp
  // takes care of every faster moment automatically.
  //   START_SPEED — px/sec at the start of a run (the baseline everything is
  //     calibrated to; CALIBRATE by nudging it until a dropped obstacle slides
  //     with the painted road at the very start, before any ramp kicks in).
  //   MAX_SPEED   — px/sec cap the ramp climbs to (also caps the video rate:
  //     the fastest video rate = zone base rate × MAX_SPEED/START_SPEED, so if
  //     the backdrop looks too frantic at top speed, LOWER this).
  //   SPEED_RAMP  — px/sec added per second of running (acceleration). 0 =
  //     constant speed (old behaviour). Reaches MAX_SPEED after
  //     (MAX_SPEED − START_SPEED) / SPEED_RAMP seconds — e.g. (360−210)/3 = 50s.
  // The ramp does NOT run during the no-obstacle tutorial window; it starts
  // fresh from START_SPEED when the real run begins.
  START_SPEED: 210, // px/sec baseline (video rates are calibrated to THIS)
  MAX_SPEED: 360, // px/sec cap (≈1.7× → video also caps at 1.7× its base rate)
  SPEED_RAMP: 3, // px/sec² — reaches MAX_SPEED in ~50s; set 0 for constant speed
  BG_PLAYBACK_RATE: 1, // fallback base playbackRate for any zone not listed below
  // Per-zone playback rate. Each source clip dollies forward at a DIFFERENT
  // speed, so a single global rate can't match every zone to the obstacle
  // motion. Tune each zone BY EYE until its road scroll matches the obstacles
  // (a dropped item should slide with the painted lanes, not faster/slower).
  // Keyed by ZONE_SOURCES key. Any zone omitted here uses BG_PLAYBACK_RATE.
  // Measured relative dolly speed (rough): zone_2 is the SLOWEST (so it likely
  // needs a HIGHER rate) and zone_3 the FASTEST (likely a LOWER rate); zone_1
  // is in between. Start from these and nudge:
  ZONE_PLAYBACK_RATES: {
    zone_1: 2,
    // zone_2: 3,
    // zone_3: 2,
  },
  SPAWN_INTERVAL: 950, // ms between spawns
  // Total length of a run. The clock only ticks during the REAL run (not the
  // 3·2·1 countdown, the practice tutorial, or while paused); when it reaches 0
  // the run auto-completes ("time's up" — the player survived). Tune freely.
  RUN_DURATION_MS: 120000, // 120 seconds
  // --- Lives ----------------------------------------------------------------
  // The player can absorb LIVES-1 obstacle hits; the LIVES-th hit ends the run.
  // A non-fatal hit: white screen flash + Woosh_Revive sfx, one life spent, and
  // an INVULN_MS window where the player runs on, blinking translucent and
  // unhittable (so the same/next obstacle can't instantly drain another life).
  LIVES: 3,
  INVULN_MS: 1500, // post-hit grace: translucent + unhittable while running
  HIT_FLASH_MS: 160, // split-second white flash on a non-fatal hit
  INVULN_BLINK_MS: 150, // one half-cycle of the translucent blink
  // After the 3·2·1 countdown the player runs for this long with NO obstacles or
  // coins while animated swipe-right / swipe-left / swipe-up hints play, so the
  // player can learn the controls. Set to 0 to skip the tutorial entirely.
  TUTORIAL_MS: 5000,
  LANE_SWITCH_MS: 150,
  // --- Jump tuning ----------------------------------------------------------
  // JUMP_HEIGHT is how far (screen px) the player rises at the apex; bump it up
  // for a floatier hop. JUMP_DURATION is the total airtime (rise + fall) in ms
  // and also paces how long the player is invulnerable to obstacles. Keep the
  // jump sheet's anim (8 frames) roughly in sync with this — see BootScene fps.
  JUMP_HEIGHT: 135,
  JUMP_DURATION: 700,
  // Scale multiplier applied ONLY to the jump sheet, on top of the normal
  // PLAYER_DISPLAY_H (frame-height) normalization. The other sheets draw the
  // character filling ≈0.89–0.92 of their cell HEIGHT, but the jump sheet
  // fills only ≈0.77 (more transparent padding above/below the pose), so
  // normalizing everything by frame height alone leaves the jumping character
  // visibly SHORTER than the running one (measured on-screen: run ≈152px tall,
  // jump ≈127px at scale 1). This compensates so the jump's tallest pose reads
  // the same size as the run cycle: value = run_fill ÷ jump_fill ≈ 0.92/0.77.
  // (An earlier attempt at 1.2 LOOKED too big, but that was a SEPARATE bug —
  // Phaser's run animation kept ticking under the manual jump frames and
  // snapped the sprite to the much larger run SHEET mid-air; fixed with
  // anims.stop() in setAnimState. With that gone, this only affects the jump
  // sheet as intended.) Re-tune if the jump art's fill ratio changes.
  PLAYER_JUMP_SCALE: 1.2,
  PLAYER_DISPLAY_H: 165, // on-screen height (px) of the standing character at
  // full (near) scale; every player sheet is scaled to this so idle/run/dead
  // read as one consistent size despite different native frame sizes.
  OBSTACLE_DISPLAY_W: 100, // near (full-scale) on-screen width of a 1-LANE
  // obstacle. A multi-lane obstacle (OBSTACLE_META.lanes > 1) is instead sized
  // from the ACTUAL on-screen width of the lanes it spans (Lane.laneSpanWidth
  // × OBSTACLE_SPAN_FILL below) — NOT a multiplier on this constant. A fixed
  // multiplier doesn't work here: obstacle_1/2's CONTENT is already ~1.8×
  // wider than obstacle_3's (diagonal poses fill more of their canvas), so
  // dividing a "OBSTACLE_DISPLAY_W × 1.7" target by that already-larger
  // content width cancelled out almost the whole intended size boost — they
  // rendered barely bigger than the 1-lane rock pile. Deriving the target
  // width from the real lane geometry instead sidesteps that entirely.
  // --- Obstacle art calibration ----------------------------------------
  // Each obstacle PNG has a different amount of transparent padding around its
  // drawn content (diagonal poses, off-center compositions). Normalizing by
  // the raw texture width (as before) sized them by their PADDED canvas, not
  // their actual drawn size — obstacle_1/2's big diagonal margins made them
  // read unnaturally small next to obstacle_3's near-full-bleed canvas. These
  // are the CONTENT bounding box (tight crop of the drawn shape, alpha-based,
  // no padding) measured directly from each PNG, plus how many adjacent lanes
  // the object is wide enough to plausibly span, and where its visual "ground
  // contact" sits (originY: fraction down the FULL texture, top=0, where the
  // content's bottom edge is) — the sprite is origin-anchored there (like the
  // player's origin 0.92) so it scales while staying planted on the road
  // instead of growing symmetrically around its center. Re-measure (crop the
  // alpha channel to content) if the art changes. Keyed by the raw
  // TEXTURES.OBSTACLE_N string — TEXTURES isn't defined yet at this point in
  // the file (same reason ZONE_SOURCES/SFX_VOLUMES above use literal keys).
  OBSTACLE_META: {
    obstacle_1: { contentW: 572, contentH: 196, originY: 0.99, lanes: 2 }, // stone pillar (lying flat) — spans 2 lanes
    obstacle_2: { contentW: 506, contentH: 166, originY: 0.988, lanes: 2 }, // carved stone piece — spans 2 lanes
    obstacle_3: { contentW: 474, contentH: 268, originY: 0.971, lanes: 1 }, // rock pile — 1 lane
  },
  // Fraction of a multi-lane obstacle's REAL geometric footprint (the actual
  // on-screen width of the lanes it spans, outer edge to outer edge — see
  // Lane.laneSpanWidth) that it's sized to fill. 1 = exactly edge-to-edge;
  // slightly under 1 leaves a hair of breathing room so it doesn't look like
  // it's touching its neighbor lanes.
  OBSTACLE_SPAN_FILL: 0.92,
  // --- Ground contact shadow ---------------------------------------------
  // A soft procedural ellipse (BootScene.makeShadowTexture) drawn beneath each
  // obstacle so it reads as sitting ON the road instead of pasted over it.
  // Position/scale track the obstacle every frame (RunScene.advanceGroup).
  // WIDTH_MUL/SQUASH shape the ellipse relative to the obstacle's own
  // on-screen width; ALPHA is its opacity at full (near) scale — it fades
  // toward the horizon along with everything else via the shared depth scale.
  SHADOW_WIDTH_MUL: 0.85,
  SHADOW_SQUASH: 0.32, // ellipse height as a fraction of its width
  SHADOW_ALPHA: 0.45,
  // The player's own ground shadow (RunScene.create/update) — same texture,
  // sized off PLAYER_DISPLAY_H instead of an obstacle's width. It stays
  // pinned to the LANE row (unaffected by jumpRise) while the character
  // lifts above it, which is what actually sells the jump's height: the
  // growing gap between character and shadow reads as "airborne" far more
  // clearly than the sprite alone. Shrinks/fades slightly at the apex
  // (PLAYER_SHADOW_LIFT_SHRINK/FADE, 0 = no change at full height) for a
  // subtle extra depth cue.
  PLAYER_SHADOW_WIDTH_MUL: 0.6, // fraction of PLAYER_DISPLAY_H
  PLAYER_SHADOW_SQUASH: 0.34,
  PLAYER_SHADOW_ALPHA: 0.4,
  PLAYER_SHADOW_LIFT_SHRINK: 0.2, // e.g. 0.2 = 20% smaller at the jump apex
  PLAYER_SHADOW_LIFT_FADE: 0.35, // e.g. 0.35 = 35% more transparent at the apex
  COIN_DISPLAY_W: 70, // near (full-scale) on-screen width of a coin
  // (A coin's bonus-point value lives in APP_CONFIG.POINTS_PER_COIN,
  // src/data/appConfig.js — the hub score is distance score + that bonus.)
  // --- Coin trains ----------------------------------------------------------
  // Sometimes a coin spawn is a trailing GROUP in one lane (Temple Run style):
  // CHANCE of a coin spawn becoming a train, MIN..MAX coins per train, GAP_PX
  // between consecutive coins (screen px along the travel axis — smaller = a
  // tighter chain). While a train is still emerging its lane is blocked so an
  // obstacle can't spawn on top of a trailing coin.
  COIN_TRAIN: { CHANCE: 0.45, MIN: 2, MAX: 4, GAP_PX: 35 },
  // A coin only collects while the player is on the ground in ITS lane. This is
  // the jump grace: how high (px of jumpRise) the player can be and still grab
  // one — covers take-off/landing frames; above it the coin sails underneath.
  COIN_COLLECT_MAX_RISE: 30,
  // Collected-coin flight: a small coin token swoops up to the HUD coin counter
  // over COIN_FLY_MS (the counter ticks when it lands). COIN_FLY_W is its
  // on-screen width (px) IN FLIGHT — independent of the world coin size, so tune
  // it small here without touching COIN_DISPLAY_W. While flying it pulses like a
  // heartbeat: COIN_FLY_BEAT = peak scale multiplier, COIN_FLY_BEAT_MS = one
  // half-beat (grow or shrink).
  COIN_FLY_MS: 400,
  COIN_FLY_W: 30, // flight token size (px) — smaller than the world coin
  COIN_FLY_BEAT: 1.5, // heartbeat peak (1 = no pulse)
  COIN_FLY_BEAT_MS: 160, // one half-beat
  POOL_OBSTACLES: 12,
  POOL_COINS: 24, // headroom for trains (up to 4 per spawn tick)
  // Distance score: +1 point every SCORE_TICK_MS of survival. 250ms = 4 pts/sec
  // — deliberately a MEDIUM pace (the old 100ms/10 pts-per-sec climbed too fast
  // and drowned out the coin bonus). Raise the delay to slow scoring further.
  SCORE_TICK_MS: 250,
  MAX_DPR: 2, // cap device pixel ratio
  SWIPE_THRESHOLD: 30, // px before a horizontal swipe registers
  // --- Audio ------------------------------------------------------------
  SFX_VOLUME: 0.6, // master sfx level — every SFX_VOLUMES multiplier below stacks on top of this
  MUSIC_VOLUME: 0.80,
  MUSIC_DUCK_VOLUME: 0.32, // level while paused (kept playing, just quiet)
  MUSIC_FADE_MS: 350, // fade in/out on start/stop/pause/resume
  // Per-sound volume multiplier (0..1+, keyed by SOUNDS.* value), so each sfx
  // can be balanced independently against the others — e.g. a punchy
  // Coin_Collect.wav that reads too loud next to a quiet Jump.wav. Actual
  // playback volume = SFX_VOLUME * SFX_VOLUMES[key] (playSfx in game/audio.js);
  // a key with no entry here just plays at the master SFX_VOLUME (multiplier
  // 1). Values above 1 are fine — Web Audio allows overdriving a quiet source.
  SFX_VOLUMES: {
    "sfx-ui-tap": 1,
    "sfx-countdown-beep": 1,
    "sfx-countdown-go": 1,
    "sfx-jump": 2,
    "sfx-coin-collect": 0.3,
    "sfx-wall-hit": 1,
    "sfx-revive": 1,
    "sfx-game-over": 1,
  },
};

/**
 * Texture keys generated at runtime in BootScene (spec §9).
 */
export const TEXTURES = {
  PLAYER: "player", // generated placeholder fallback (single frame)
  PLAYER_IDLE: "player_idle", // 256×512 sheet, 8 frames
  PLAYER_RUN: "player_run", // 512×682 sheet, 12 frames
  PLAYER_JUMP: "player_jump", // 256×512 sheet, 8 frames (4×2)
  PLAYER_DEAD: "player_dead", // 341×341 sheet, 9 frames
  OBSTACLE: "obstacle", // generated placeholder + pool default
  OBSTACLE_1: "obstacle_1",
  OBSTACLE_2: "obstacle_2",
  OBSTACLE_3: "obstacle_3",
  COIN: "coin",
  PARALLAX: "parallax", // static JPEG fallback for the backdrop
  SHADOW: "obstacle_shadow", // procedural ground-contact ellipse (BootScene.makeShadowTexture)
  // Zone backdrop clips are cached under `zone:<key>` binary keys (see BootScene).
};

/**
 * Obstacle art variants spawned at random (BootScene loads each; spawn picks
 * one per obstacle). Falls back to the generated placeholder if none loaded.
 */
export const OBSTACLE_VARIANTS = [
  TEXTURES.OBSTACLE_1,
  TEXTURES.OBSTACLE_2,
  TEXTURES.OBSTACLE_3,
];

/**
 * Animation keys created in BootScene from the player sheets above.
 */
export const ANIMS = {
  IDLE: "player-idle",
  RUN: "player-run",
  JUMP: "player-jump",
  DEAD: "player-dead",
  COIN: "coin-spin",
};

/**
 * Sound keys loaded in BootScene (see SOUND_FILES). Gameplay code only ever
 * references these keys, never raw filenames — swapping audio in never
 * touches the scenes/objects. A missing file degrades to silence, same
 * philosophy as TEXTURES falling back to a generated placeholder.
 */
export const SOUNDS = {
  UI_TAP: "sfx-ui-tap",
  COUNTDOWN_BEEP: "sfx-countdown-beep",
  COUNTDOWN_GO: "sfx-countdown-go",
  JUMP: "sfx-jump",
  COIN_COLLECT: "sfx-coin-collect",
  WALL_HIT: "sfx-wall-hit",
  REVIVE: "sfx-revive", // Woosh_Revive — non-fatal hit / life-lost recovery
  GAME_OVER: "sfx-game-over",
  MUSIC_RUN: "music-run",
};
