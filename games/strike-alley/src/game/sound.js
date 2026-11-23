// Web Audio sound manager. Buffers decode once; one-shots (hit/scatter/strike/…)
// spawn a fresh source each play so they can overlap. "Managed" sounds (roll,
// gutter) keep a handle so they can fade in on start and out on demand.
//
// Levels live in C.SOUND (see constants.js): MASTER scales the whole mix and
// each sound has its own 0..1 level — edit + reload to tune, no UI needed.
//
// Browsers block audio until a user gesture, so init() must be called from a
// pointer handler (it creates/resumes the AudioContext).
import { C } from './constants.js'
import rollUrl from './sounds/roll.mp3'
import hitUrl from './sounds/hit.mp3'
import scatterUrl from './sounds/scatter.mp3'
import strikeUrl from './sounds/strike.mp3'
import gutterUrl from './sounds/gutter.mp3'
import tapUrl from './sounds/tap.mp3'
import gameoverUrl from './sounds/gameover.mp3'
import introUrl from './sounds/intro.mp3'
import musicUrl from './sounds/music.ogg'

const FILES = {
  roll: rollUrl,
  hit: hitUrl,
  scatter: scatterUrl,
  strike: strikeUrl,
  gutter: gutterUrl,
  tap: tapUrl,
  gameover: gameoverUrl,
  intro: introUrl,
  // Baked as a crossfade loop (tail dissolves into head) so loop=true is
  // seamless; OGG, not MP3, because MP3 encoder padding gaps the loop point.
  music: musicUrl,
}

export class Sound {
  constructor() {
    this.ctx = null
    this.master = null
    this.buffers = {}
    this.muted = false
    this.channels = {} // name -> { src, gain } for managed sounds (roll, gutter)
    this.music = null // { src, gain } for the single looping background bed
    this.musicPending = false // guards decode-on-demand from double-firing
    // name -> play generation. Bumped by every play() and stop(), so a stop()
    // that lands while a sound is still decoding cancels it instead of letting
    // it start afterwards, unstoppable (see play/fire).
    this.gen = {}
    // music download progress (bytes), tracked so the intro loading board can
    // show a real bar — music is ~79% of the payload, so it *is* the bar.
    this.musicLoaded = 0
    this.musicTotal = 0
    // Fetch the encoded bytes right away (no gesture needed) so decoding on the
    // first tap is near-instant — otherwise the very first tap can be silent.
    this.encoded = {}
    for (const [name, url] of Object.entries(FILES)) {
      // music: stream it so we can report byte progress; everything else is
      // small enough to just grab in one shot.
      this.encoded[name] =
        name === 'music'
          ? this.fetchTracked(url).catch(() => null)
          : fetch(url)
              .then((r) => r.arrayBuffer())
              .catch(() => null)
    }
  }

  // Fetch an asset while recording how many bytes have arrived (drives the
  // intro load bar). Falls back to a plain buffer read if streaming isn't
  // available. Returns the assembled ArrayBuffer.
  async fetchTracked(url) {
    const res = await fetch(url)
    const len = Number(res.headers.get('content-length')) || 0
    this.musicTotal = len
    if (!res.body || !res.body.getReader) {
      const buf = await res.arrayBuffer()
      this.musicTotal = this.musicLoaded = buf.byteLength
      return buf
    }
    const reader = res.body.getReader()
    const chunks = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      this.musicLoaded = received
    }
    if (!this.musicTotal) this.musicTotal = received // no content-length header
    const out = new Uint8Array(received)
    let off = 0
    for (const c of chunks) {
      out.set(c, off)
      off += c.length
    }
    return out.buffer
  }

  // Fraction (0..1) of the up-front assets loaded, for the intro boot board.
  // Driven by the music download (the long pole); capped below 1 until the
  // buffers are actually decoded so the bar can't read "done" prematurely.
  loadProgress() {
    const total = Object.keys(FILES).length
    const decoded = Object.keys(this.buffers).length
    const p = this.musicTotal
      ? this.musicLoaded / this.musicTotal
      : decoded / total
    return this.isReady() ? 1 : Math.min(0.95, p)
  }

  // Are all the up-front sounds decoded and ready to play? Also true when audio
  // is unsupported/blocked (no ctx) so the intro gate never waits on nothing.
  isReady() {
    if (!this.ctx) return true
    return Object.keys(FILES).every((name) => this.buffers[name])
  }

  // Per-sound level from the constants mix board (MASTER is applied separately).
  vol(name) {
    const v = C.SOUND[name.toUpperCase()]
    return typeof v === 'number' ? v : 1
  }

  // Create/resume the context inside a user gesture, then decode the files.
  init() {
    if (this.ctx) {
      this.resume()
      return
    }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : C.SOUND.MASTER
    this.master.connect(this.ctx.destination)
    this.load()
  }

  async load() {
    await Promise.all(
      Object.entries(this.encoded).map(async ([name, pending]) => {
        try {
          const data = await pending
          if (!data) return
          // slice(0) keeps our copy intact (decodeAudioData detaches the buffer)
          this.buffers[name] = await this.ctx.decodeAudioData(data.slice(0))
        } catch {
          /* a missing/undecodable file just stays silent */
        }
      }),
    )
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
  }

  // Fire a one-shot (optionally delayed a few ms for a natural one-two).
  // opts.managed keeps a handle so the sound can be faded out early with stop().
  // opts.onStart fires the moment the sound is really audible — which is NOT
  // when play() was called if the buffer still had to be decoded. Anything that
  // has to stay in step with the audio must key off that, not off the caller.
  play(name, delay = 0, opts = {}) {
    if (!this.ctx) return
    const { managed = false, onStart } = opts
    const gen = (this.gen[name] = (this.gen[name] || 0) + 1)
    const buf = this.buffers[name]
    if (buf) {
      this.fire(buf, name, delay, managed, gen, onStart)
      return
    }
    // called before load() finished decoding (e.g. the very first sound of the
    // session, fired in the same gesture as init()) — decode on demand from the
    // already-in-flight fetch and fire as soon as it's ready
    const pending = this.encoded[name]
    if (!pending) return
    pending.then(async (data) => {
      if (!data || !this.ctx) return
      if (!this.buffers[name]) {
        this.buffers[name] = await this.ctx.decodeAudioData(data.slice(0))
      }
      this.fire(this.buffers[name], name, 0, managed, gen, onStart)
    })
  }

  fire(buf, name, delay, managed = false, gen = 0, onStart) {
    // a stop() that landed while this was still decoding cancels it — otherwise
    // it would start after the stop and play on with no handle to fade it
    if (managed && gen !== this.gen[name]) return
    this.resume()
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const g = this.ctx.createGain()
    g.gain.value = this.vol(name)
    src.connect(g).connect(this.master)
    src.start(this.ctx.currentTime + delay)
    if (managed) this.channels[name] = { src, gain: g }
    if (onStart) onStart()
  }

  // Start a managed sound (roll/gutter): fades in and stays until stop().
  start(name) {
    if (!this.ctx || !this.buffers[name]) return
    this.resume()
    this.stop(name, 0.03)
    const src = this.ctx.createBufferSource()
    src.buffer = this.buffers[name]
    const g = this.ctx.createGain()
    const now = this.ctx.currentTime
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(this.vol(name), now + 0.08) // fade in
    src.connect(g).connect(this.master)
    src.start()
    this.channels[name] = { src, gain: g }
  }

  // Fade out and stop a managed sound.
  stop(name, fade = 0.18) {
    this.gen[name] = (this.gen[name] || 0) + 1 // cancels an in-flight play()
    const ch = this.channels[name]
    this.channels[name] = null
    if (!ch || !this.ctx) return
    const now = this.ctx.currentTime
    ch.gain.gain.cancelScheduledValues(now)
    ch.gain.gain.setValueAtTime(Math.max(ch.gain.gain.value, 0.0001), now)
    ch.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade)
    try {
      ch.src.stop(now + fade + 0.03)
    } catch {
      /* already stopped */
    }
  }

  // Start the looping lofi bed. Self-guarding: no-ops if it's already going,
  // so callers can fire it from any unlock gesture (PLAY, speaker toggle) and
  // the track stays one continuous loop across throws, frames and restarts.
  // Routed through master, so mute silences it like everything else.
  startMusic() {
    if (!this.ctx || this.music) return
    const buf = this.buffers.music
    if (!buf) {
      // first gesture beat load()'s decode — decode from the in-flight fetch
      // and retry once it's ready
      const pending = this.encoded.music
      if (!pending || this.musicPending) return
      this.musicPending = true
      pending.then(async (data) => {
        try {
          if (data && this.ctx && !this.buffers.music) {
            this.buffers.music = await this.ctx.decodeAudioData(data.slice(0))
          }
        } catch {
          /* undecodable — just never starts */
        }
        this.musicPending = false
        this.startMusic()
      })
      return
    }
    this.resume()
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = this.ctx.createGain()
    const now = this.ctx.currentTime
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(this.vol('music'), now + 1.2) // ease in
    src.connect(g).connect(this.master)
    src.start()
    this.music = { src, gain: g }
  }

  stopMusic(fade = 0.6) {
    const m = this.music
    this.music = null
    if (!m || !this.ctx) return
    const now = this.ctx.currentTime
    m.gain.gain.cancelScheduledValues(now)
    m.gain.gain.setValueAtTime(Math.max(m.gain.gain.value, 0.0001), now)
    m.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade)
    try {
      m.src.stop(now + fade + 0.05)
    } catch {
      /* already stopped */
    }
  }

  setMuted(m) {
    this.muted = m
    if (this.master && this.ctx) {
      const target = m ? 0 : C.SOUND.MASTER
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.015)
    }
  }
}
