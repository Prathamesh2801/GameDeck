import { project, projectH } from "./projection.js";

// ============================================================================
// Reusable lighting primitives. Every glow, bloom, reflection and shadow in
// the renderer is built from these, so light behaves the same everywhere and
// none of it uses ctx.shadowBlur (the most expensive Canvas 2D feature) —
// blooms are layered geometry instead.
// ============================================================================

export function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

// An emissive LED tube running down a wall plane at lateral x, height h
// (optionally sloping to hFar at the far end): nested perspective bands —
// wide outer glow, inner glow, colour core and a white-hot centre line — all
// fading along depth like a real strip receding from the viewer.
export function drawLEDRail(ctx, L, { x, h, hFar = h, near, far, t, rgb, alpha }) {
  const bands = [
    [t * 4, alpha * 0.22, rgb], // outer glow
    [t * 2, alpha * 0.5, rgb], // inner glow
    [t, alpha, rgb], // bright core
    [t * 0.4, alpha * 0.75, "255, 255, 255"], // white-hot centre
  ];
  for (const [tt, aa, col] of bands) {
    const a1 = projectH(x, near, h + tt, L);
    const a2 = projectH(x, near, h - tt, L);
    const b2 = projectH(x, far, hFar - tt, L);
    const b1 = projectH(x, far, hFar + tt, L);
    if (b1.s < 0.02) return;
    poly(ctx, [a1, a2, b2, b1]);
    const g = ctx.createLinearGradient(a1.x, a1.y, b1.x, b1.y);
    g.addColorStop(0, `rgba(${col}, ${aa})`);
    g.addColorStop(1, `rgba(${col}, ${aa * 0.12})`);
    ctx.fillStyle = g;
    ctx.fill();
  }
}

// Screen-space radial bloom around an emissive element (sign halo, TV glow,
// pocket marker…). Additive so overlapping blooms sum like light.
export function drawBloom(ctx, x, y, r, rgb, alpha) {
  if (r <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  g.addColorStop(0.55, `rgba(${rgb}, ${alpha * 0.35})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A volumetric light cone hanging under one ceiling panel: a perspective
// trapezoid widening from the panel's footprint (topH) toward the floor
// (botH), fading to nothing on the way down — dusty air catching the light.
export function drawLightCone(
  ctx,
  L,
  { x, d0, d1, topH, botH, spreadX, rgb, alpha },
) {
  const mid = (d0 + d1) / 2;
  const a = projectH(x - spreadX * 0.35, mid, topH, L);
  const b = projectH(x + spreadX * 0.35, mid, topH, L);
  const c = projectH(x + spreadX, mid, botH, L);
  const d = projectH(x - spreadX, mid, botH, L);
  if (a.s < 0.04) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  poly(ctx, [a, b, c, d]);
  const g = ctx.createLinearGradient(0, a.y, 0, c.y);
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

// A light source reflected in a glossy floor: a soft-edged streak running
// down-lane at lateral x, brightest along its centre line and feathering to
// nothing at the sides. Additive — this is the varnish, not paint.
export function drawSpecularStreak(
  ctx,
  L,
  { x, dNear, dFar, halfW, rgb, alpha },
) {
  const a = project(x - halfW, dNear, L);
  const b = project(x + halfW, dNear, L);
  const c = project(x + halfW, dFar, L);
  const d = project(x - halfW, dFar, L);
  if (b.x - a.x < 0.5) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  poly(ctx, [a, b, c, d]);
  const g = ctx.createLinearGradient(a.x, 0, b.x, 0);
  g.addColorStop(0, `rgba(${rgb}, 0)`);
  g.addColorStop(0.5, `rgba(${rgb}, ${alpha})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

// Soft contact shadow pooling under an object standing on the floor.
// rx/ry are the screen-space semi-axes of the shadow ellipse.
export function drawContactShadow(ctx, x, y, rx, ry, alpha) {
  if (rx <= 0 || ry <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
  g.addColorStop(0.55, `rgba(0, 0, 0, ${alpha * 0.5})`);
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Ambient occlusion along one edge of a face: fills the polygon with darkness
// that ramps from nothing at screen point `from` to `alpha` at `to` — light
// starved out of a corner or a foot line.
export function drawAOEdge(ctx, pts, from, to, alpha) {
  poly(ctx, pts);
  const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  g.addColorStop(0, "rgba(0, 0, 0, 0)");
  g.addColorStop(1, `rgba(0, 0, 0, ${alpha})`);
  ctx.fillStyle = g;
  ctx.fill();
}
