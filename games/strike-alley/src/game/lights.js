import { C } from "./constants.js";

// ============================================================================
// The scene's architectural light rig — the single source of truth for every
// light in the alley. Renderers never invent their own light colours or
// positions: they read fixtures from LIGHTS and ask the query helpers below
// which light reaches them. Tuning any value here re-lights the whole room
// consistently (ceiling panels, wall strips, lane reflections, ball rims,
// pin shading and the tunnel all follow).
// ============================================================================

export const LIGHTS = {
  // Three rows of rectangular LED ceiling panels running down-lane. Discrete
  // troffers (period = grid pitch, lit = panel length; the rest is gap),
  // anchored to absolute depth so they dolly past the follow-cam smoothly.
  ceiling: {
    rows: [
      { x: -36, intensity: 0.65 },
      { x: 0, intensity: 0.45 }, // centre row ~15% brighter
      { x: 36, intensity: 0.65 },
    ],
    h: C.ROOM_CEIL_H,
    halfW: 9, // lit panel half-width (lane units)
    period: 150, // panel grid pitch along depth
    lit: 110, // lit length within each period (gap = 40)
    core: "246, 250, 255", // near-white LED core
    bloom: "150, 195, 255", // soft blue-white bloom / ceiling bounce
    end: 1430, // rows stop at the tunnel mouth (= PT.FRONT in render.js)
  },

  // Wall LED strips, both side walls. h = height on the wall, t = tube
  // half-thickness (lane units).
  strips: {
    upper: { h: 232, t: 5, rgb: "88, 215, 255", intensity: 0.9 }, // #58D7FF
    lower: { h: 150, t: 5, rgb: "185, 101, 255", intensity: 0.85 }, // #B965FF
    skirt: { h: 12, t: 6, rgb: "150, 90, 255", intensity: 0.6 }, // floor skirt
  },

  // Pinsetter cavity: cool machine glow, service-rail LEDs, and the floor of
  // the entrance→rear brightness falloff (rear never goes fully black).
  tunnel: {
    machine: "78, 158, 255",
    rail: "110, 186, 255",
    dark: 0.15,
  },

  // The branding sign's warm halo — a declared emissive source, not a cheat.
  sign: { warm: "255, 194, 118" },

  // Colour of light the maple bounces upward (warms the ball's underside).
  laneWarm: "255, 200, 130",
};

// The one shared breathing pulse every architectural neon element uses, so
// the whole installation breathes together instead of flickering out of sync.
export const neonPulse = (t) => 0.85 + 0.15 * Math.sin(t / 900);

// Discrete ceiling-panel spans {d0, d1} visible in [near, far). Anchored to
// absolute depth (not camera-relative) so panels hold still in the world.
export function ceilingPanels(near, far) {
  const { period, lit } = LIGHTS.ceiling;
  const pad = (period - lit) / 2;
  const spans = [];
  for (let k = Math.floor(near / period); k * period + pad < far; k++) {
    const d0 = k * period + pad;
    const d1 = d0 + lit;
    if (d1 <= near) continue;
    spans.push({ d0: Math.max(d0, near), d1: Math.min(d1, far) });
  }
  return spans;
}

// The ceiling row nearest a lateral position — an object's key light.
export function nearestRow(x) {
  let best = LIGHTS.ceiling.rows[0];
  for (const row of LIGHTS.ceiling.rows) {
    if (Math.abs(x - row.x) < Math.abs(x - best.x)) best = row;
  }
  return best;
}

// Neon rim light reaching an object at lateral x. Each wall strip lights the
// side of the object facing it (dir = -1 left, +1 right), growing stronger as
// the object nears that wall. Cyan comes from the upper strips, purple from
// the lower — both walls carry both, so the nearer wall dominates.
export function rimLights(x) {
  const k = Math.min(1, Math.abs(x) / C.ROOM_HALF);
  const sgn = x >= 0 ? 1 : -1;
  return {
    cyan: { dir: -sgn, a: 0.1 + 0.1 * k, rgb: LIGHTS.strips.upper.rgb },
    purple: { dir: sgn, a: 0.08 + 0.1 * k, rgb: LIGHTS.strips.lower.rgb },
  };
}

// Brightness falloff inside the tunnel: 1 at the mouth (where the last
// ceiling panels still reach in) easing down to LIGHTS.tunnel.dark at the
// back wall. Drives every interior gradient so entrance-bright / rear-dark
// is derived from the rig, not eyeballed per face.
export function tunnelFalloff(depth) {
  const { end } = LIGHTS.ceiling;
  const t = Math.min(1, Math.max(0, (depth - end) / (C.DECK_END - end)));
  const ease = t * (2 - t); // easeOut — light dies quickly past the mouth
  return 1 - (1 - LIGHTS.tunnel.dark) * ease;
}
