// All physics-space distances are in abstract "lane units" (~1 unit ≈ 1 cm).
// Physics plane is top-down: x = lateral (0 at lane center), y = depth
// (0 at the foul line, increasing toward the pins).

export const C = {
  // game rules — one rule the player can do in their head: every pin is worth
  // PIN_POINTS, and clearing the whole rack adds a round bonus on top
  // (spare = 10 pins + 100, strike = 10 pins + 200). Stays ordered strike >
  // spare > open, and lands a perfect game on 3000 (5 × STRIKE_SCORE) — a scale
  // that reads like the other leaderboard games rather than a 0-100 bowling
  // total. All scoring copy is derived from these, so the rules screen can
  // never drift from what the game actually awards.
  TOTAL_FRAMES: 5, // mini game: 5 frames (~2-3 min)
  PIN_POINTS: 40, // every pin, in every frame
  SPARE_SCORE: 500, // all 10 pins across 2 balls (400 + 100 bonus)
  STRIKE_SCORE: 600, // all 10 pins on ball 1 (400 + 200 bonus)

  // lane geometry
  HALF_LANE: 52.5, // lane is 105 units wide
  GUTTER_W: 24,
  OUTER: 76.5, // HALF_LANE + GUTTER_W
  LANE_LENGTH: 1700, // depth of the back wall / pit
  DECK_END: 1650, // ball past this = in the pit
  DECK_START: 1550, // pin deck shading starts here
  HEAD_PIN_DEPTH: 1500,
  PIN_ROW_DZ: 26.4, // row spacing (30.5 * cos 30°)
  PIN_DX: 15.25, // half of the 30.5 in-row pin spacing

  // bodies
  BALL_R: 13,
  BALL_DRAW_R: 12.5,
  BALL_ROLL: 0.016, // spin (radians) per lane-unit travelled — visual roll rate
  // finger-hole grip layout (eyeball these): two finger holes a small gap
  // apart, with the thumb hole a "span" below them.
  BALL_HOLE_SPAN: 0.5, // thumb → finger distance on the ball surface
  BALL_FINGER_GAP: 0.4, // gap between the two finger holes
  BALL_HOLE_R: 0.1, // hole radius as a fraction of the ball radius
  PIN_R: 6.0,
  PIN_H: 36, // visual pin height in lane units
  BALL_START_DEPTH: 150, // start further up-lane so the ball isn't glued to the bottom

  // fake-3D projection — NEAR scales with lane length to keep the same look
  NEAR: 580, // 1/z falloff constant: persp = NEAR / (NEAR + relDepth)
  NEAR_CLIP: 1, // min relative depth so 1/z never flips/explodes
  HORIZON_FRAC: 0.27, // horizon y as fraction of canvas height (lower VP → more
  // ceiling visible + a slight looking-down-the-lane tilt, per the reference)
  BASE_FRAC: 1.02, // near-plane y as fraction of canvas height
  NEAR_HALF_FRAC: 0.49, // half of (lane + gutters) as fraction of canvas width

  // ball-follow camera (dollies down-lane while the ball rolls)
  CAM_FOLLOW_LAG: 150, // camera trails this far behind the ball
  CAM_MAX: 920, // deepest the camera dollies (keeps pins ahead of it)
  CAM_EASE: 0.09, // per-frame lerp toward the target depth
  CAM_RETURN_EASE: 0.07, // per-frame lerp when dollying back to the foul line

  // opening cinematic (plays once on PLAY NOW): start framed on the back-wall
  // branding (depth ~1430), then a dramatic pull-back to the foul line while
  // the ball rolls up-lane and settles at the start mark.
  INTRO_CAM: 1200, // camera depth that frames the branding + scoreboard
  // Pull-back duration, matched to sounds/intro.mp3: the sting's loudest accent
  // lands at 2.75s, so the camera settles on the hit rather than 350ms before
  // it. The track runs 5.25s total — INTRO_FADE_S below sheds the leftover tail.
  INTRO_MS: 2750,
  INTRO_FADE_S: 0.9, // seconds to fade the sting out once the camera lands
  // PLAY NOW holds on the branding/scoreboard frame while the assets finish
  // loading (the "TV boot-up" beat) before the pull-back reveal begins.
  INTRO_MIN_LOAD_MS: 1800, // always show the boot board this long, so the bar
  // sweeps and a themed message or two reads — an intentional power-up beat
  // rather than a flash, even off a warm cache. Also the artificial fill ramp.
  INTRO_MAX_LOAD_MS: 8000, // hard cap: release the reveal even if a load stalls,

  // throw tuning
  MAX_AIM: 0.12, // radians — half-width of the aim sweep (± from lane centre)
  MIN_SPEED: 8, // units per physics step (tuned for the longer lane)
  MAX_SPEED: 18,
  BALL_FRICTION_AIR: 0.004,
  PIN_FRICTION_AIR: 0.009,
  BALL_DENSITY: 0.006,
  PIN_DENSITY: 0.0009,
  BALL_RESTITUTION: 0.12,
  PIN_RESTITUTION: 0.8,

  // pin knockdown detection
  KNOCK_SPEED: 1.1,
  KNOCK_DIST: 7,
  KNOCK_BODY_TTL: 700, // ms a knocked pin keeps colliding (chain reactions)
  KNOCK_ANIM_MS: 700, // topple + fade duration

  // timing
  STEP_MS: 1000 / 60,
  PHYS_SUBSTEPS: 2, // sub-steps per physics step (stops the fast ball tunneling)
  SETTLE_MS: 900,
  RESULT_MS: 1700,
  // AIM SWING SPEED — the aim-skill dial. Time (ms) for one full left→right→left
  // sweep, so HIGHER = SLOWER swing = easier to time. Edit this one number and
  // reload to tune. Rough feel: 1700 = brisk (old default), 2800 = relaxed
  // (current), 3600+ = very forgiving. The sweep eases at the gutters and speeds
  // through centre, so the pocket window is always the quickest part.
  AIM_PERIOD_MS: 2500,
  POWER_PERIOD_MS: 1200, // same idea for the power meter fill (higher = slower)
  TAP_SLOP_PX: 8,

  // bowling-ball colours — one per game frame [highlight, mid, dark rim].
  // Popular glossy colours that fit the neon alley (no plain black).
  BALL_COLORS: [
    ["#6db3ff", "#1f5fd0", "#0a2456"], // 1 · electric blue
    ["#ff8a7a", "#d82f36", "#5c0f13"], // 2 · crimson red
    ["#c793ec", "#7d33c4", "#2f0f52"], // 3 · purple
    ["#6ff0d8", "#16a98c", "#08453a"], // 4 · teal
    ["#ffc06b", "#ef8a1f", "#6e3606"], // 5 · amber orange
  ],

  // juice / feedback
  TRAIL_LEN: 5, // number of ball-trail samples
  SHAKE_IMPACT: 5, // px screen shake on pin contact
  SHAKE_STRIKE: 13, // px screen shake on a strike / spare
  SHAKE_DECAY: 0.86, // per-frame shake falloff
  FLASH_DECAY: 0.9, // per-frame strike-flash falloff
  HOOK_START: 1300, // depth where the ball begins to break toward the pins
  HOOK_GAIN: 0.002, // lateral-velocity amplification per step past the break
  POCKET_X: 7.6, // pocket lateral position (between the head & 3 pin)

  // backdrop room (neon corridor, per docs/ref_gemini.jpg) — same perspective
  // as the lane so walls/ceiling track the follow-cam
  ROOM_HALF: 118, // side-wall distance from lane centre
  ROOM_CEIL_H: 340, // ceiling height above the floor (fills the screen top)

  // collision categories
  CAT_BALL: 0x0001,
  CAT_PIN: 0x0002,
  CAT_WALL: 0x0004,

  // audio mix board — tune by hand, then reload. MASTER scales everything
  // (0 = silent, 1 = full); each sound is an individual 0..1 level.
  SOUND: {
    MASTER: 0.9,
    ROLL: 0.6, // ball rolling down the lane
    HIT: 0.85, // ball striking the pins
    SCATTER: 0.7, // pins scattering / falling
    STRIKE: 0.85, // strike / spare fanfare
    GUTTER: 0.8, // ball rolling into the gutter
    TAP: 0.85, // UI tap (bowl / play again)
    GAMEOVER: 0.6, // end-of-game jingle
    INTRO: 0.5, // opening cinematic pull-back swell
    MUSIC: 0.5, // looping lofi-jazz background bed (sits under every SFX)
  },
};

// Standard 10-pin rack positions, index 0 = head pin.
export function rackPositions() {
  const pins = [];
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      pins.push({
        x: (2 * i - row) * C.PIN_DX,
        y: C.HEAD_PIN_DEPTH + row * C.PIN_ROW_DZ,
      });
    }
  }
  return pins;
}
