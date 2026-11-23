// Draws a bowling pin once, as vectors, onto an offscreen canvas.
// Every on-screen pin is this sprite blitted at a perspective scale,
// so there are zero image assets and per-frame cost is one drawImage.
//
// The scene's light rig is BAKED into the sprite: the architectural lights
// never move, and knocked pins only rotate for ~700ms while fading, so
// re-tinting per pin per frame would recompute a constant. The bake gives
// gloss-white plastic lit from above by the ceiling rows, cyan fill from the
// upper wall strips on the left, a purple rim from the lower strips on the
// right (the same left-cyan/right-purple convention as the ball), and a
// faint cool wash from the pinsetter machine the pins stand inside.

import { LIGHTS } from './lights.js'

export const SPRITE_W = 128
export const SPRITE_H = 400

let sprite = null

export function getPinSprite() {
  if (sprite) return sprite

  const c = document.createElement('canvas')
  c.width = SPRITE_W
  c.height = SPRITE_H
  const ctx = c.getContext('2d')
  const cx = SPRITE_W / 2

  // silhouette (drawn at 2x of a 64x200 design grid)
  const pinPath = new Path2D()
  pinPath.moveTo(cx, 8)
  pinPath.bezierCurveTo(cx + 32, 8, cx + 30, 60, cx + 20, 110) // head → neck
  pinPath.bezierCurveTo(cx + 14, 150, cx + 52, 190, cx + 54, 270) // neck → belly
  pinPath.bezierCurveTo(cx + 54, 330, cx + 36, 360, cx + 34, 392) // belly → base
  pinPath.lineTo(cx - 34, 392)
  pinPath.bezierCurveTo(cx - 36, 360, cx - 54, 330, cx - 54, 270)
  pinPath.bezierCurveTo(cx - 52, 190, cx - 14, 150, cx - 20, 110)
  pinPath.bezierCurveTo(cx - 30, 60, cx - 32, 8, cx, 8)
  pinPath.closePath()

  // gloss-white body, symmetric — both edges roll away from the light equally
  const grad = ctx.createLinearGradient(cx - 54, 0, cx + 54, 0)
  grad.addColorStop(0, '#bcb6aa')
  grad.addColorStop(0.28, '#f6f3ec')
  grad.addColorStop(0.5, '#fdfbf6')
  grad.addColorStop(0.72, '#f6f3ec')
  grad.addColorStop(1, '#bcb6aa')
  ctx.fillStyle = grad
  ctx.fill(pinPath)

  // ceiling rows overhead: bright head and shoulders, dimming down the body,
  // with the base sinking into its own floor shadow
  const top = ctx.createLinearGradient(0, 0, 0, SPRITE_H)
  top.addColorStop(0, 'rgba(255, 255, 255, 0.45)')
  top.addColorStop(0.4, 'rgba(255, 255, 255, 0)')
  top.addColorStop(0.78, 'rgba(0, 0, 0, 0)')
  top.addColorStop(1, 'rgba(0, 0, 0, 0.2)')
  ctx.fillStyle = top
  ctx.fill(pinPath)

  // red neck stripes, clipped to the silhouette
  ctx.save()
  ctx.clip(pinPath)
  ctx.fillStyle = '#d8202f'
  ctx.fillRect(cx - 40, 118, 80, 16)
  ctx.fillRect(cx - 44, 146, 88, 16)
  ctx.restore()

  // wall-strip rims over everything (they tint the stripes too): cyan fill
  // from the upper strips on the left, a tighter purple rim on the right
  const cyan = ctx.createLinearGradient(cx - 54, 0, cx + 54, 0)
  cyan.addColorStop(0, `rgba(${LIGHTS.strips.upper.rgb}, 0.22)`)
  cyan.addColorStop(0.35, `rgba(${LIGHTS.strips.upper.rgb}, 0)`)
  ctx.fillStyle = cyan
  ctx.fill(pinPath)
  const purple = ctx.createLinearGradient(cx - 54, 0, cx + 54, 0)
  purple.addColorStop(0.72, `rgba(${LIGHTS.strips.lower.rgb}, 0)`)
  purple.addColorStop(1, `rgba(${LIGHTS.strips.lower.rgb}, 0.26)`)
  ctx.fillStyle = purple
  ctx.fill(pinPath)

  // faint cool wash from the machine glow filling the tunnel
  ctx.fillStyle = `rgba(${LIGHTS.tunnel.machine}, 0.06)`
  ctx.fill(pinPath)

  // subtle outline so pins read against the light lane
  ctx.strokeStyle = 'rgba(40, 34, 28, 0.45)'
  ctx.lineWidth = 3
  ctx.stroke(pinPath)

  sprite = c
  return sprite
}
