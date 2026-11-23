import Matter from 'matter-js'
import { C, rackPositions } from './constants.js'
import {
  createPhysics,
  makeBallBody,
  makePinBody,
  resetBall,
  launchBall,
  sendToGutter,
} from './physics.js'
import { makeLayout } from './projection.js'
import { render, ensureLogo, isLogoReady } from './render.js'
import { Sound } from './sound.js'

const { Engine, Composite, Body } = Matter

export const PHASE = {
  INTRO: 'INTRO', // opening cinematic: pull back from the branding to the lane
  AIMING: 'AIMING',
  POWER: 'POWER',
  ROLLING: 'ROLLING',
  RESULT: 'RESULT',
  RETURNING: 'RETURNING', // camera dollies back to the foul line after a throw
  GAMEOVER: 'GAMEOVER',
}

// Flat, self-teaching scoring — no look-ahead, so a frame's value is final the
// moment it ends and never rewrites itself (the thing that confuses first-time
// players about real bowling). Every pin is worth PIN_POINTS, and clearing the
// rack pays a bonus on top:
//   open = pins × 40 (0..360) · spare = 500 (400 + 100) · strike = 600 (400 + 200)
// A frame commits only once it's complete: an in-progress open frame (one ball,
// no strike) is NOT scored yet, so the total climbs by whole-frame amounts.
// Max game = 5×600 = 3000.
function scoreGame(rolls, frames) {
  let score = 0
  let i = 0
  for (let f = 0; f < frames && i < rolls.length; f++) {
    if (rolls[i] === 10) {
      score += C.STRIKE_SCORE // strike — one ball, frame complete
      i += 1
    } else if (i + 1 < rolls.length) {
      const pins = rolls[i] + rolls[i + 1]
      score += pins === 10 ? C.SPARE_SCORE : pins * C.PIN_POINTS
      i += 2
    } else {
      break // trailing frame still in progress (one ball, not a strike)
    }
  }
  return score
}

export class Game {
  constructor(canvas, onUiState) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.onUiState = onUiState

    this.engine = createPhysics()
    this.ball = makeBallBody()
    Composite.add(this.engine.world, this.ball)

    this.sound = new Sound()
    this.muted = false

    // pin game-state; bodies are (re)created per rack
    // `home` is the immutable rack slot (used to re-rack a fresh frame).
    // `baseX/baseY` is the knockdown reference: it starts at home but gets
    // re-based to where a surviving pin actually rests between balls, so small
    // settle-drift isn't measured against the original rack on the next throw.
    this.pins = rackPositions().map((home) => ({
      home,
      body: null,
      x: home.x,
      y: home.y,
      baseX: home.x,
      baseY: home.y,
      standing: true,
      knockedAt: 0,
      dir: 1,
    }))
    this.rackPins()

    this.phase = PHASE.INTRO // holds on the branding until PLAY NOW (startPlay)
    this.introLoading = false // true while the boot board waits for assets
    this.introLoadStart = 0 // timeMs the load hold began
    this.introPlaying = false // true once the pull-back is running
    this.introStart = 0 // timeMs the pull-back began
    ensureLogo() // start the branding logo decoding now, not on first draw
    this.aim = 0
    this.aimStart = 0 // timeMs when the aim sweep began (drives the swing)
    this.aimLockAt = 0 // timeMs of the aim-lock tap (drives the lock flourish)
    this.power = 0
    this.score = 0
    this.frame = 1 // current frame, 1..TOTAL_FRAMES
    this.ballNumber = 1 // ball within the current frame (1, 2, or 3 on the last)
    this.rolls = [] // flat list of every ball's pin count, for scoring
    this.frameRolls = [] // pin counts for the current frame only
    this.frameHistory = [] // completed frames: { rolls, score } snapshots, for the scoreboard
    this.inGutter = false
    this.settleStart = 0
    this.resultUntil = 0
    this.banner = null
    this.bannerId = 0
    this.camDepth = C.INTRO_CAM // start framed on the branding

    // juice state
    this.trail = [] // recent ball positions for the motion streak
    this.shake = 0 // current screen-shake magnitude (px)
    this.flash = 0 // current strike-flash intensity (0..1)

    this.timeMs = 0
    this.lastFrame = 0
    this.acc = 0
    this.raf = 0
    this.running = false

    this.dpr = 1
    this.layout = makeLayout(1, 1)
    this.lastUi = null

    this.pointer = { down: false, startX: 0, startY: 0, lastX: 0, moved: 0 }

    this.onPointerDown = this.onPointerDown.bind(this)
    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerUp = this.onPointerUp.bind(this)
    this.onVisibility = this.onVisibility.bind(this)
    this.tick = this.tick.bind(this)
  }

  /* ---------- lifecycle ---------- */

  start() {
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.canvas)
    this.resize()

    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    document.addEventListener('visibilitychange', this.onVisibility)

    this.running = true
    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this.tick)
    this.emitUi()
  }

  destroy() {
    this.running = false
    this.sound.stop('roll', 0)
    this.sound.stop('gutter', 0)
    this.sound.stopMusic(0)
    cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    document.removeEventListener('visibilitychange', this.onVisibility)
    Engine.clear(this.engine)
  }

  setMuted(m) {
    this.muted = m
    this.sound.init()
    this.sound.setMuted(m)
    // the bed isn't kicked off here — it starts when the intro resolves. Before
    // that there's nothing to reveal; after, the loop already runs and the
    // master gain (set above) handles muting it.
  }

  // PLAY NOW — a real user gesture, so it's the moment to unlock audio and kick
  // off decoding. Rather than starting the reveal straight away, we hold on the
  // branding/scoreboard frame while the assets finish loading (the TV shows a
  // "booting up" board); the tick releases into the pull-back via beginReveal()
  // once they're ready. This guarantees the sting is synced and the logo/music
  // are present before the cinematic plays — the win on slow connections.
  startPlay() {
    this.sound.init() // unlock + start decoding inside the gesture
    if (this.phase === PHASE.INTRO && !this.introPlaying && !this.introLoading) {
      this.introLoading = true
      this.introLoadStart = this.timeMs
    }
  }

  // Leave the load hold and run the pull-back cinematic. The lofi bed is NOT
  // started here — it would fight the sting through the whole reveal; it swells
  // in only once the intro resolves into the aim (the t >= 1 branch in tick).
  beginReveal() {
    this.introLoading = false
    this.introPlaying = true
    // Fallback start: if audio is muted, blocked or missing, onStart never fires
    // and the cinematic still runs from here.
    this.introStart = this.timeMs
    this.sound.play('intro', 0, {
      // managed, so the sting can be faded out the moment the camera lands
      managed: true,
      // Re-base the pull-back on the instant the sting is actually audible so the
      // camera lands on the music's accent (INTRO_MS). With the load gate the
      // buffer is already decoded, so this fires ~immediately — but it's kept for
      // the muted/blocked path where the sting may still be a touch late.
      onStart: () => {
        if (this.phase === PHASE.INTRO) this.introStart = this.timeMs
      },
    })
  }

  onVisibility() {
    if (document.hidden) {
      this.running = false
      this.sound.stop('roll', 0.1)
      this.sound.stop('gutter', 0.1)
      // the cinematic freezes with the loop, but audio would play on and come
      // back desynced from the camera — drop the sting and finish the reveal dry
      this.sound.stop('intro', 0.1)
      cancelAnimationFrame(this.raf)
    } else if (!this.running) {
      this.running = true
      this.lastFrame = performance.now()
      this.raf = requestAnimationFrame(this.tick)
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (!w || !h) return
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.dpr = dpr
    this.layout = makeLayout(w, h)
  }

  /* ---------- input ---------- */

  onPointerDown(e) {
    this.sound.init() // unlock/resume audio inside the user gesture
    this.canvas.setPointerCapture?.(e.pointerId)
    this.pointer = {
      down: true,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      moved: 0,
    }
    if (this.phase === PHASE.POWER) {
      this.sound.play('tap') // click on the bowl tap too (roll fades in after)
      this.launch()
    }
  }

  onPointerMove(e) {
    if (!this.pointer.down) return
    this.pointer.moved = Math.max(
      this.pointer.moved,
      Math.abs(e.clientX - this.pointer.startX),
      Math.abs(e.clientY - this.pointer.startY),
    )
    this.pointer.lastX = e.clientX
    // aim is timing-based (the swinging arrow), so pointer moves no longer steer
    // it — we only track movement above to tell a tap from a drag.
  }

  onPointerUp() {
    const wasTap = this.pointer.moved < C.TAP_SLOP_PX
    this.pointer.down = false
    if (this.phase === PHASE.AIMING && wasTap) {
      this.phase = PHASE.POWER
      this.aimLockAt = this.timeMs // triggers the aim-guide lock flourish
      this.powerStart = this.timeMs
      this.sound.play('tap')
      this.emitUi()
    }
  }

  getPower() {
    return this.power
  }

  /* ---------- game flow ---------- */

  launch() {
    const speed = C.MIN_SPEED + this.power * (C.MAX_SPEED - C.MIN_SPEED)
    launchBall(this.ball, this.aim, speed)
    this.phase = PHASE.ROLLING
    this.inGutter = false
    this.settleStart = 0
    this.pinsHit = false // becomes true on the first pin contact this throw
    this.ballParked = false // true once the ball drops into the pit
    this.trail.length = 0
    this.standingBefore = this.pins.filter((p) => p.standing).length
    this.sound.start('roll')
    this.emitUi()
  }

  rackPins() {
    for (const pin of this.pins) {
      if (pin.body) Composite.remove(this.engine.world, pin.body)
      pin.body = makePinBody(pin.home.x, pin.home.y)
      pin.x = pin.home.x
      pin.y = pin.home.y
      pin.baseX = pin.home.x
      pin.baseY = pin.home.y
      pin.standing = true
      pin.knockedAt = 0
      Composite.add(this.engine.world, pin.body)
    }
  }

  clearDeadwood() {
    // remove knocked pins between balls; keep standing pins where they are
    for (const pin of this.pins) {
      if (!pin.standing && pin.body) {
        Composite.remove(this.engine.world, pin.body)
        pin.body = null
      }
    }
    // freeze the survivors: physics is paused through RETURNING/AIMING, so any
    // residual velocity would otherwise be replayed on the next throw's first
    // step and register as a phantom knockdown before the ball arrives.
    this.settleStandingPins()
  }

  // Bring surviving pins fully to rest and re-baseline their knockdown
  // reference to where they came to rest, so settle-drift from this ball isn't
  // measured against the original rack slot on the next one.
  settleStandingPins() {
    for (const pin of this.pins) {
      if (!pin.standing || !pin.body) continue
      Body.setVelocity(pin.body, { x: 0, y: 0 })
      Body.setAngularVelocity(pin.body, 0)
      pin.baseX = pin.body.position.x
      pin.baseY = pin.body.position.y
      pin.x = pin.body.position.x
      pin.y = pin.body.position.y
    }
  }

  finishThrow() {
    this.sound.stop('roll') // safety: ends the rumble on a gutter/miss too
    this.sound.stop('gutter')
    const standingNow = this.pins.filter((p) => p.standing).length
    const knocked = this.standingBefore - standingNow

    this.frameRolls.push(knocked)
    this.rolls.push(knocked)
    this.score = scoreGame(this.rolls, C.TOTAL_FRAMES)

    const isStrike = this.standingBefore === 10 && knocked === 10
    const isSpare = !isStrike && standingNow === 0 && knocked > 0

    // Floating feedback shows the pins knocked on THIS shot only (never a
    // running frame total); a strike/spare gets its celebratory word instead.
    // The actual score lives on the TV scoreboard and commits per frame, so
    // this pop is pure action feedback — it says "PINS", not "+N", because a
    // pin is no longer worth a point and "+7" would read as a score.
    let text
    let kind = ''
    if (isStrike) {
      text = 'STRIKE!'
      kind = 'strike'
    } else if (isSpare) {
      text = 'SPARE!'
      kind = 'strike'
    } else if (knocked === 0) {
      text = this.inGutter ? 'GUTTER…' : 'MISS…'
    } else {
      text = `${knocked} ${knocked === 1 ? 'PIN' : 'PINS'}`
    }
    this.banner = { text, kind, id: ++this.bannerId }
    if (kind === 'strike') {
      this.sound.play('strike') // strike or spare fanfare
      this.shake = Math.max(this.shake, C.SHAKE_STRIKE)
      this.flash = 1
    }

    this.phase = PHASE.RESULT
    this.resultUntil = this.timeMs + C.RESULT_MS
    this.emitUi()
  }

  nextBall() {
    const isLast = this.frame === C.TOTAL_FRAMES
    const r = this.frameRolls
    // Every frame is the same: a strike clears the rack and ends it on ball 1,
    // otherwise it ends after the second ball. No bonus/fill balls — clearing
    // the rack is rewarded in points (20 / 15), not in extra throws.
    const frameDone = (this.ballNumber === 1 && r[0] === 10) || this.ballNumber >= 2

    if (frameDone) {
      // snapshot this frame's rolls + the cumulative score for the scoreboard;
      // scoreGame counts complete frames only, so this is the frame's final value
      this.frameHistory.push({
        rolls: [...r],
        score: scoreGame(this.rolls, this.frame),
      })
    }

    if (frameDone && isLast) {
      this.gameOver()
      return
    }

    if (frameDone) {
      this.frame += 1
      this.ballNumber = 1
      this.frameRolls = []
      this.rackPins()
    } else {
      this.ballNumber += 1
      this.clearDeadwood()
    }

    // hold the ball out of view in the pit; it returns to the foul line only
    // once the camera has finished dollying home (the RETURNING phase), so the
    // view pulls back smoothly instead of cutting straight to the aim position
    Body.setPosition(this.ball, { x: this.ball.position.x, y: C.LANE_LENGTH + 40 })
    this.trail.length = 0
    this.inGutter = false
    this.aim = 0
    this.banner = null
    this.phase = PHASE.RETURNING
    this.emitUi()
  }

  gameOver() {
    this.phase = PHASE.GAMEOVER
    this.banner = null
    this.sound.play('gameover')
    this.emitUi()
  }

  restart() {
    this.sound.init() // Play Again is a user gesture — safe to (re)unlock audio
    this.sound.play('tap')
    this.frame = 1
    this.ballNumber = 1
    this.rolls = []
    this.frameRolls = []
    this.frameHistory = []
    this.score = 0
    this.inGutter = false
    this.aim = 0
    this.power = 0
    this.banner = null
    this.settleStart = 0
    this.camDepth = 0
    this.rackPins()
    resetBall(this.ball)
    this.aimStart = this.timeMs
    this.phase = PHASE.AIMING
    this.emitUi()
  }

  /* ---------- simulation ---------- */

  step() {
    if (this.phase !== PHASE.ROLLING && this.phase !== PHASE.RESULT) return

    // sub-step the physics so the (now faster) ball can't tunnel past a pin
    const sub = C.PHYS_SUBSTEPS
    for (let s = 0; s < sub; s++) Engine.update(this.engine, C.STEP_MS / sub)

    if (this.phase !== PHASE.ROLLING) return

    // ball hook: amplify the lateral break near the pins so aim rewards skill
    // (a dead-straight ball stays straight; set HOOK_GAIN to 0 to disable)
    if (!this.inGutter && !this.ballParked && this.ball.position.y > C.HOOK_START) {
      const v = this.ball.velocity
      Body.setVelocity(this.ball, { x: v.x * (1 + C.HOOK_GAIN), y: v.y })
    }

    // gutter check (only before the pin deck; past it the pit takes over)
    if (!this.inGutter && this.ball.position.y < C.DECK_START) {
      const bx = this.ball.position.x
      if (Math.abs(bx) > C.HALF_LANE) {
        this.inGutter = true
        sendToGutter(this.ball, Math.sign(bx))
        this.sound.stop('roll', 0.1) // swap the lane rumble for the hollow gutter
        this.sound.start('gutter')
      }
    }

    // knockdown detection
    for (const pin of this.pins) {
      if (!pin.standing || !pin.body) continue
      const speed = pin.body.speed
      const dx = pin.body.position.x - pin.baseX
      const dy = pin.body.position.y - pin.baseY
      if (speed > C.KNOCK_SPEED || Math.hypot(dx, dy) > C.KNOCK_DIST) {
        pin.standing = false
        pin.knockedAt = this.timeMs
        // topple toward the side it's moving (screen-space lean)
        const vx = pin.body.velocity.x
        pin.dir = vx > 0.15 ? 1 : vx < -0.15 ? -1 : Math.random() < 0.5 ? -1 : 1
        if (!this.pinsHit) {
          // first contact: crack of impact, then the scatter of falling pins
          this.pinsHit = true
          this.shake = Math.max(this.shake, C.SHAKE_IMPACT) // impact kick
          this.sound.stop('roll', 0.12)
          this.sound.play('hit')
          this.sound.play('scatter', 0.06)
        }
        this.emitUi()
      }
    }

    // knocked pins keep colliding briefly for chain reactions, then vanish
    for (const pin of this.pins) {
      if (pin.standing || !pin.body) continue
      if (this.timeMs - pin.knockedAt > C.KNOCK_BODY_TTL) {
        Composite.remove(this.engine.world, pin.body)
        pin.body = null
      }
    }

    // once the ball reaches the pit, park it so it can't bounce off the back
    // wall and come rolling back up the lane
    if (!this.ballParked && this.ball.position.y > C.DECK_END) {
      this.parkBall()
    }

    // end-of-throw detection
    if (!this.settleStart) {
      const ballDone =
        this.ball.position.y > C.DECK_END || this.ball.speed < 0.2
      if (ballDone) this.settleStart = this.timeMs
    } else if (this.timeMs - this.settleStart > C.SETTLE_MS) {
      this.finishThrow()
    }
  }

  // Drop the ball into the pit and freeze it: no more collisions, no velocity,
  // parked out of view past the draw cutoff so it never rolls back into frame.
  parkBall() {
    this.ballParked = true
    this.ball.collisionFilter.mask = 0
    Body.setVelocity(this.ball, { x: 0, y: 0 })
    Body.setAngularVelocity(this.ball, 0)
    Body.setPosition(this.ball, {
      x: this.ball.position.x,
      y: C.LANE_LENGTH + 40,
    })
    if (this.inGutter) this.sound.stop('gutter', 0.25)
  }

  tick(now) {
    if (!this.running) return
    const dt = Math.min(now - this.lastFrame, 100)
    this.lastFrame = now
    this.timeMs += dt

    // swinging aim while lining up: cosine sweep from -MAX_AIM (left gutter)
    // through centre to +MAX_AIM and back — slow at the edges, fast through the
    // middle, so catching the pocket takes timing. Tapping locks it (see
    // onPointerUp, which flips the phase and freezes this).
    if (this.phase === PHASE.AIMING) {
      const t = (this.timeMs - this.aimStart) / C.AIM_PERIOD_MS
      this.aim = -C.MAX_AIM * Math.cos(t * Math.PI * 2)
    }

    // oscillating power while the meter is up (0 → 1 → 0)
    if (this.phase === PHASE.POWER) {
      const t = (this.timeMs - this.powerStart) / C.POWER_PERIOD_MS
      this.power = (1 - Math.cos(t * Math.PI * 2)) / 2
    }

    this.acc += dt
    let steps = 0
    while (this.acc >= C.STEP_MS && steps < 5) {
      this.step()
      this.acc -= C.STEP_MS
      steps++
    }
    if (steps === 5) this.acc = 0 // spiral-of-death guard

    if (this.phase === PHASE.RESULT && this.timeMs > this.resultUntil) {
      this.nextBall()
    }

    // ball-follow camera: dolly down-lane behind the ball while it rolls, then
    // hold on the pins through the result, then dolly smoothly back to the foul
    // line (RETURNING) — the reverse of the shooting move, not a hard cut.
    if (this.phase === PHASE.ROLLING || this.phase === PHASE.RESULT) {
      const target = clamp(
        this.ball.position.y - C.CAM_FOLLOW_LAG,
        0,
        C.CAM_MAX,
      )
      this.camDepth += (target - this.camDepth) * C.CAM_EASE
    } else if (this.phase === PHASE.RETURNING) {
      this.camDepth += (0 - this.camDepth) * C.CAM_RETURN_EASE
      if (this.camDepth < 1.5) {
        // arrived home: place the ball at the foul line and hand over to aiming
        this.camDepth = 0
        resetBall(this.ball)
        this.aimStart = this.timeMs
        this.phase = PHASE.AIMING
        this.emitUi()
      }
    } else if (this.phase === PHASE.INTRO) {
      if (this.introLoading) {
        // PLAY pressed — hold on the branding/scoreboard frame while assets
        // decode (the TV shows the boot board). Release into the reveal once
        // everything's ready and the minimum beat has shown, or at the safety
        // cap so a stalled load can never freeze the intro.
        this.camDepth = C.INTRO_CAM
        Body.setPosition(this.ball, { x: 0, y: C.LANE_LENGTH + 40 }) // hidden in the pit
        const ready = this.sound.isReady() && isLogoReady()
        const elapsed = this.timeMs - this.introLoadStart
        if (
          (ready && elapsed >= C.INTRO_MIN_LOAD_MS) ||
          elapsed >= C.INTRO_MAX_LOAD_MS
        ) {
          this.beginReveal()
        }
      } else if (!this.introPlaying) {
        // parked on the wall branding, waiting for PLAY NOW
        this.camDepth = C.INTRO_CAM
        Body.setPosition(this.ball, { x: 0, y: C.LANE_LENGTH + 40 }) // hidden in the pit
      } else {
        const t = clamp((this.timeMs - this.introStart) / C.INTRO_MS, 0, 1)
        // dramatic pull-back from the branding to the foul line (ease-in-out)
        this.camDepth = C.INTRO_CAM * (1 - smoothstep(t))
        // the ball only rides in once the camera is close enough that the foul
        // line sits ahead of it — then it rolls up-lane and settles at the mark
        if (t < 0.6) {
          Body.setPosition(this.ball, { x: 0, y: C.LANE_LENGTH + 40 })
        } else {
          const u = easeOutCubic((t - 0.6) / 0.4)
          const y = 520 + (C.BALL_START_DEPTH - 520) * u
          Body.setPosition(this.ball, { x: 0, y })
        }
        if (t >= 1) {
          this.camDepth = 0
          resetBall(this.ball)
          // the camera has landed on the sting's accent — shed the rest of the
          // track so it resolves into the aim instead of playing on over it,
          // and swell the lofi bed in underneath: the sting fades out over
          // INTRO_FADE_S while the music fades in, a clean handoff into play
          this.sound.stop('intro', C.INTRO_FADE_S)
          this.sound.startMusic()
          this.aimStart = this.timeMs
          this.phase = PHASE.AIMING
          this.emitUi()
        }
      }
    }

    // sync render positions from physics bodies
    for (const pin of this.pins) {
      if (pin.body) {
        pin.x = pin.body.position.x
        pin.y = pin.body.position.y
      }
    }

    // ball motion trail (newest first); cleared when not actively rolling
    if (this.phase === PHASE.ROLLING && !this.ballParked) {
      this.trail.unshift({ x: this.ball.position.x, depth: this.ball.position.y })
      if (this.trail.length > C.TRAIL_LEN) this.trail.pop()
    } else if (this.trail.length) {
      this.trail.length = 0
    }

    // decay the shake and flash impulses
    this.shake *= C.SHAKE_DECAY
    if (this.shake < 0.3) this.shake = 0
    this.flash *= C.FLASH_DECAY
    if (this.flash < 0.02) this.flash = 0

    const ctx = this.ctx
    const sx = this.shake ? (Math.random() * 2 - 1) * this.shake : 0
    const sy = this.shake ? (Math.random() * 2 - 1) * this.shake : 0
    ctx.setTransform(this.dpr, 0, 0, this.dpr, sx * this.dpr, sy * this.dpr)
    render(ctx, this.layout, {
      phase: this.phase,
      timeMs: this.timeMs,
      aim: this.aim,
      aimLockAt: this.aimLockAt,
      ballX: this.ball.position.x,
      ballDepth: this.ball.position.y,
      camDepth: this.camDepth,
      frame: this.frame,
      totalFrames: C.TOTAL_FRAMES,
      score: this.score,
      frameHistory: this.frameHistory,
      frameRolls: this.frameRolls,
      banner: this.banner,
      pins: this.pins,
      trail: this.trail,
      flash: this.flash,
      loading: this.introLoading, // TV shows the boot board while assets load
      // Bar fills by whichever is slower: the real download or an artificial
      // ramp over INTRO_MIN_LOAD_MS. So it sweeps smoothly on a warm cache
      // (ramp-limited) yet shows honest progress on a slow one (download-limited),
      // and always completes to 100% right as the reveal is released.
      loadProgress: this.introLoading
        ? Math.min(
            this.sound.loadProgress(),
            clamp((this.timeMs - this.introLoadStart) / C.INTRO_MIN_LOAD_MS, 0, 1),
          )
        : 0,
      loadElapsed: this.introLoading ? this.timeMs - this.introLoadStart : 0,
    })

    this.raf = requestAnimationFrame(this.tick)
  }

  /* ---------- UI bridge ---------- */

  emitUi() {
    let mask = 0
    this.pins.forEach((pin, i) => {
      if (pin.standing) mask |= 1 << i
    })
    const ui = {
      phase: this.phase,
      score: this.score,
      frame: this.frame,
      totalFrames: C.TOTAL_FRAMES,
      ballNumber: this.ballNumber,
      standingMask: mask,
      banner: this.banner,
    }
    const prev = this.lastUi
    if (
      prev &&
      prev.phase === ui.phase &&
      prev.score === ui.score &&
      prev.frame === ui.frame &&
      prev.ballNumber === ui.ballNumber &&
      prev.standingMask === ui.standingMask &&
      prev.banner === ui.banner
    ) {
      return
    }
    this.lastUi = ui
    this.onUiState?.(ui)
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

// ease-in-out (slow start + settle) for the camera pull-back
function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

// decelerating ease for the ball rolling into its start position
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}
