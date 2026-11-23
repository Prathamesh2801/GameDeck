import { C } from './constants.js'

// Layout depends only on canvas CSS size; recomputed on resize.
export function makeLayout(w, h) {
  return {
    w,
    h,
    cx: w / 2,
    horizonY: h * C.HORIZON_FRAC,
    baseY: h * C.BASE_FRAC,
    pxPerUnit: (w * C.NEAR_HALF_FRAC) / C.OUTER,
    camDepth: 0, // set per-frame; the camera's position down the lane
  }
}

// The whole fake-3D trick: classic 1/z perspective.
// Depth is measured relative to the camera (L.camDepth) so the view can
// dolly down-lane. Returns screen position and a scale factor for sprites.
export function project(x, depth, L) {
  const rel = Math.max(depth - L.camDepth, C.NEAR_CLIP)
  const p = C.NEAR / (C.NEAR + rel)
  return {
    x: L.cx + x * L.pxPerUnit * p,
    y: L.horizonY + (L.baseY - L.horizonY) * p,
    s: p,
  }
}

// Project a point at height h (lane units) above the floor at (x, depth).
export function projectH(x, depth, h, L) {
  const p = project(x, depth, L)
  return { x: p.x, y: p.y - h * L.pxPerUnit * p.s, s: p.s }
}
