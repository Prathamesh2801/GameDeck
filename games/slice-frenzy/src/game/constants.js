// ─────────────────────────────────────────────────────────────────────────
//  SLICE FRENZY — game tuning
//  This is the single place to tweak gameplay. Change a number, save, done.
// ─────────────────────────────────────────────────────────────────────────
import mangoWhole from "../assets/fruits/mango.png";
import mangoHalfL from "../assets/fruits/mango_half_l.png";
import mangoHalfR from "../assets/fruits/mango_half_r.png";
import orangeWhole from "../assets/fruits/orange.png";
import orangeHalfL from "../assets/fruits/orange_half_l.png";
import orangeHalfR from "../assets/fruits/orange_half_r.png";
import anarWhole from "../assets/fruits/anar.png";
import anarHalfL from "../assets/fruits/anar_half_l.png";
import anarHalfR from "../assets/fruits/anar_half_r.png";
import watermelonWhole from "../assets/fruits/watermelon.png";
import watermelonHalfL from "../assets/fruits/watermelon_half_l.png";
import watermelonHalfR from "../assets/fruits/watermelon_half_r.png";
import bombImage from "../assets/negative/bomb.png";
import ghewarImage from "../assets/power_food/Ghewar.png";
import kachoriImage from "../assets/power_food/Mawa_Kachori.png";
import sndSplatter from "../assets/sounds/splatter.mp3";
import sndBoom from "../assets/sounds/boom.mp3";
import sndOver from "../assets/sounds/over.mp3";
import sndStart from "../assets/sounds/start.mp3";

// Logical resolution Phaser renders at (scaled to fit the device frame).
export const STAGE = { WIDTH: 450, HEIGHT: 800 };

// Core rules
export const RULES = {
  DURATION_MS: 120000, // one game lasts 2 minutes — no lives, just the clock
  LOW_TIME_S: 10, // seconds left when the timer starts warning (turns red)
  COMBO_MIN: 2, // fruits cut in ONE swipe to score a combo
  COMBO_BONUS_PER: 5, // combo bonus = sliceCount × this
};

// Physics & motion (px/sec; gravity is px/sec²)
export const PHYSICS = {
  GRAVITY: 1000,
  THROW_MIN: 880, // upward launch speed — lower = lazier arcs
  THROW_MAX: 1120, // upward launch speed — higher = reaches the top
  DRIFT_MAX: 90, // sideways speed toward centre
  SPIN_MAX: 200, // max rotation speed (deg/sec)
};

// Spawning cadence
export const SPAWN = {
  WAVE_DELAY_MS: 850, // time between waves (lower = harder)
  MIN_PER_WAVE: 1,
  MAX_PER_WAVE: 3,
  STAGGER_MS: 160, // gap between items within a wave
};

// On-screen object sizing & hit detection
export const OBJECT = {
  DISPLAY_SIZE: 104, // base on-screen size of a fruit (px); ×fruit.sizeScale
  SIZE_VARIANCE: 0.14, // ± random scale per spawn
  HITBOX_SCALE: 0.84, // slice circle radius relative to display size
  HALF_SCALE: 0.96, // sliced halves vs the whole fruit's on-screen size
};

// The bomb — slicing it costs points (no longer ends the run).
export const BOMB = {
  IMAGE: bombImage,
  CHANCE: 0.36, // probability per spawned object (after the grace period)
  GRACE_MS: 5000, // no bombs at the very start of a run
  DISPLAY_SIZE: 96,
  PENALTY: 10, // points lost for slicing a bomb (score never drops below 0)
};

// Power-up "sweet" — slicing one triggers the Feast bonus round.
export const POWERUP = {
  CHANCE: 0.03, // chance per spawned object (after grace) to be a power-up
  GRACE_MS: 10000, // none at the very start of a run
  DISPLAY_SIZE: 100, // airborne size before it's activated (~a normal fruit)
};

// The Feast: slice the power-up → it flies centre-stage and you slash it for
// the short window. Every counted slash scores POINTS_PER_SLICE, and every
// BONUS_EVERY-th slash lands an extra BONUS on top (repeating: 5th, 10th, …).
export const FEAST = {
  DURATION_MS: 3000, // the slashing window once it's centred
  INTRO_MS: 560, // fly-to-centre + grow time
  BIG_SIZE: 250, // centred size during the feast (px)
  CENTER_Y: 0.5, // vertical anchor as a fraction of stage height
  POINTS_PER_SLICE: 5, // points for each counted slash
  BONUS_EVERY: 5, // every Nth slash grants the bonus below (repeats)
  BONUS: 50, // extra points on each Nth slash
  SLICE_COOLDOWN_MS: 195, // min time between counted slashes (1 per swipe-ish)
  GROW_PER_SLICE: 0.03, // extra idle scale added per counted slash
  MAX_GROW: 0.22, // cap on how much bigger the sweet can swell
};

// Sound effects (key → file + volume). Tune volumes here.
export const SOUNDS = {
  start: { url: sndStart, volume: 0.6 },
  slice: { url: sndSplatter, volume: 0.55 },
  bomb: { url: sndBoom, volume: 0.8 },
  over: { url: sndOver, volume: 0.7 },
};

// Blade trail look
export const BLADE = {
  LIFETIME_MS: 130, // how long trail points linger
  GLOW_COLOR: 0x9c2b2b, // maroon under-glow
  CORE_COLOR: 0xfff6e9, // ivory core
};

// ── Fruit registry ─────────────────────────────────────────────────────
// Add a fruit here (with its 3 trimmed PNGs) and it spawns automatically.
//   whole       — intact sprite shown in the air
//   halfL/halfR — the two pieces flung apart on slice
//   sizeScale   — relative size (1 = base DISPLAY_SIZE); bigger fruits > 1
//   juice       — particle burst colour
//   points      — score per slice
export const FRUITS = [
  {
    key: "mango",
    label: "Mango",
    whole: mangoWhole,
    halfL: mangoHalfL,
    halfR: mangoHalfR,
    sizeScale: 0.75,
    points: 5,
    juice: 0xf6a51f,
  },
  {
    key: "orange",
    label: "Orange",
    whole: orangeWhole,
    halfL: orangeHalfL,
    halfR: orangeHalfR,
    sizeScale: 0.78,
    points: 5,
    juice: 0xff7a1a,
  },
  {
    key: "anar",
    label: "Pomegranate",
    whole: anarWhole,
    halfL: anarHalfL,
    halfR: anarHalfR,
    sizeScale: 0.8,
    points: 5,
    juice: 0xc01f3a,
  },
  {
    key: "watermelon",
    label: "Watermelon",
    whole: watermelonWhole,
    halfL: watermelonHalfL,
    halfR: watermelonHalfR,
    sizeScale: 1.0,
    points: 5,
    juice: 0xfa476a,
  },
];

// ── Power-up registry ──────────────────────────────────────────────────
// Sweets. Slicing one in the air kicks off the Feast bonus round.
//   image — the single sprite (no halves needed)
//   crumb — particle burst colour
export const POWERUPS = [
  { key: "ghewar", label: "Ghewar", image: ghewarImage, crumb: 0xe9b44a },
  { key: "kachori", label: "Mawa Kachori", image: kachoriImage, crumb: 0xd98a2b },
];
