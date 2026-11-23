import { GAME, SOUNDS } from './constants';

/**
 * Playback helpers shared by RunScene and Player. Centralizes the "missing
 * asset → silence, never a crash" guard (same philosophy as BootScene's
 * generated-placeholder fallback for textures) so call sites never repeat it.
 * Music lives as `scene.music`, a property on the RunScene instance — the
 * scene is created once and never destroyed between runs (resetToIdle resets
 * state in place), so a Sound object there has exactly the right lifetime.
 */

/**
 * Fire-and-forget SFX. No-ops if the key never loaded or audio is locked.
 * Volume = GAME.SFX_VOLUME (master) × GAME.SFX_VOLUMES[key] (per-sound, 1 if
 * unlisted) — tune an individual sound (e.g. a too-loud coin chime) without
 * touching the master level. `opts.volume`, if passed, overrides both.
 */
export function playSfx(scene, key, opts = {}) {
  if (!scene?.sound || scene.sound.locked) return; // AudioContext not unlocked yet
  if (!scene.cache.audio.exists(key)) return; // file missing/404'd — silent by design
  const perSound = GAME.SFX_VOLUMES?.[key] ?? 1;
  try {
    scene.sound.play(key, { volume: GAME.SFX_VOLUME * perSound, ...opts });
  } catch {
    // Defensive: never let a sound failure interrupt gameplay.
  }
}

/** Start the looping run music (idempotent — no-op if already playing). */
export function startMusic(scene) {
  if (!scene?.sound || scene.music?.isPlaying) return;
  if (!scene.cache.audio.exists(SOUNDS.MUSIC_RUN)) return;
  if (!scene.music) {
    scene.music = scene.sound.add(SOUNDS.MUSIC_RUN, { loop: true, volume: 0 });
  }
  scene.music.play();
  scene.tweens.add({ targets: scene.music, volume: GAME.MUSIC_VOLUME, duration: GAME.MUSIC_FADE_MS });
}

/** Fade the run music out, then stop it (run ended / reset to idle). */
export function stopMusic(scene) {
  if (!scene?.music?.isPlaying) return;
  scene.tweens.add({
    targets: scene.music,
    volume: 0,
    duration: GAME.MUSIC_FADE_MS,
    onComplete: () => scene.music?.stop(),
  });
}

/** Fade the run music down to a quiet level (kept playing, e.g. under pause). */
export function duckMusic(scene) {
  if (!scene?.music?.isPlaying) return;
  scene.tweens.add({ targets: scene.music, volume: GAME.MUSIC_DUCK_VOLUME, duration: GAME.MUSIC_FADE_MS });
}

/** Fade the run music back up to full volume (resume from pause). */
export function restoreMusic(scene) {
  if (!scene?.music?.isPlaying) return;
  scene.tweens.add({ targets: scene.music, volume: GAME.MUSIC_VOLUME, duration: GAME.MUSIC_FADE_MS });
}
