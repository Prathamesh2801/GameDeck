import { C } from "./constants.js";
import { project, projectH } from "./projection.js";
import { getPinSprite, SPRITE_W, SPRITE_H } from "./pinSprite.js";
import {
  LIGHTS,
  neonPulse,
  ceilingPanels,
  nearestRow,
  rimLights,
  tunnelFalloff,
} from "./lights.js";
import {
  poly,
  drawLEDRail,
  drawBloom,
  drawLightCone,
  drawSpecularStreak,
  drawContactShadow,
  drawAOEdge,
} from "./glow.js";
import logoUrl from "@brand/zeal-logo-white.png";

const easeOut = (t) => 1 - (1 - t) * (1 - t);

// Venue logo, loaded once and reused each frame (null until decoded).
let logoImg = null;
let logoReady = false;
function getLogo() {
  if (!logoImg) {
    logoImg = new Image();
    logoImg.onload = () => {
      logoReady = true;
    };
    logoImg.src = logoUrl;
  }
  return logoReady ? logoImg : null;
}

// Kick off the logo load deterministically (not waiting for the first frame
// that happens to need it), and let the intro gate poll its readiness.
export function ensureLogo() {
  getLogo();
}
export function isLogoReady() {
  return logoReady;
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// Path a closed polygon (any shape — e.g. a perspective trapezoid) with
// rounded corners, so faces that follow the vanishing point can still have the
// soft corners the flat rectangles used to. `rs` may be a per-corner array.
function roundPolyPath(ctx, pts, rs) {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const r = Array.isArray(rs) ? rs[i] : rs;
    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1;
    const d2 = Math.hypot(cur.x - next.x, cur.y - next.y) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = {
      x: cur.x + ((prev.x - cur.x) / d1) * rr,
      y: cur.y + ((prev.y - cur.y) / d1) * rr,
    };
    if (i === 0) ctx.moveTo(a.x, a.y);
    else ctx.lineTo(a.x, a.y);
    ctx.arcTo(cur.x, cur.y, next.x, next.y, rr);
  }
  ctx.closePath();
}

// Lane-enclosure cross-section (lane units, from the lane centre outward):
//   wall ← raised side barrier ← gutter ← wooden lane
// Shared by the gutter and side-barrier renderers so their edges meet exactly
// and the whole thing reads as one continuous piece of architecture. Distances
// here are visual only — the physics/lane width in constants.js is untouched.
const ENC = {
  GUT_DEPTH: 14, // gutter channel depth below the lane plane
  BAR_H: 17, // barrier top height above the lane plane
};

// ── Visual-only environment widths (lane units), DECOUPLED from physics. ──
// Two independent systems: the FIXED rolling surface (lane + gutters + barriers,
// flush with the physics lane) and the TUNABLE pinsetter housing (opening /
// walls / frame). Retuning the housing makes the tunnel wrap the lane wider,
// taller or deeper — it never stretches the lane, gutters or barriers. Physics
// (C.HALF_LANE = 52.5, C.OUTER = 76.5) is never touched by anything here.
const VISUAL = {
  // fixed rolling-surface enclosure — do NOT move when the housing is retuned
  gutterOuterHalf: 80, //  gutter channel outer edge (= the barrier foot)
  barrierInnerHalf: 80, // raised-barrier inner edge (just outside the gutter)
  barrierOuterHalf: 104, // raised-barrier outer edge (blends into the room wall)

  // pinsetter housing — tune these freely; they WRAP the lane, not stretch it
  openingHalf: 95, //   tunnel mouth: half-width of the aperture (widest, front lip)
  tunnelWallHalf: 90, // interior side-wall plane (< openingHalf → funnel taper)
  frameHalf: C.ROOM_HALF, // front-frame face outer extent (meets the room walls)
};

// ============================================================================
// PerspectiveTunnel — the recessed pinsetter housing, rebuilt from scratch to
// docs/ref_bowling_lane.png (the perspective blueprint). One vanishing point
// (the lane's own), and every face is its own perspective polygon:
//   tunnel back wall · tunnel left/right walls · tunnel ceiling ·
//   pin-deck floor (the lane plane itself, in drawLane) ·
//   front frame — a chamfered trapezoidal ARCH with a real reveal thickness.
// The tunnel walls continue the alley enclosure (they sit on the gutters'
// outer edge, where the side barriers arrive), the ceiling slopes down from
// the mouth to a shorter back wall (a pinsetter masking soffit — this is what
// makes its underside visible from the player's eye height), and the floor,
// gutters and lane run straight through the opening with zero seam.
// Blueprint width guide → world units: walls ±118, gutters out to ±80,
// lane ±52.5 — identical to the physics constants, so nothing moves.
// ============================================================================
const PT = {
  FRONT: 1430, // tunnel mouth — the front-frame plane (pins sit 70+ deeper)
  DECK: 1452, // where the lane wood picks up the darker pin-deck tint
  BACK: C.DECK_END, // tunnel back wall (1650)
  // Horizontal half-widths now live in VISUAL (openingHalf / tunnelWallHalf) so
  // the housing width is independent of the lane. The knobs below are the
  // housing's DEPTH + HEIGHT profile.
  TOP: 104, // opening top height at the mouth
  CEIL_B: 52, // ceiling height at the back wall (soffit slopes TOP → CEIL_B)
  BOT: -(ENC.GUT_DEPTH + 2), // cavity floor, below the recessed gutters
  REVEAL: 90, // front-frame thickness — deep, so the reveal jambs are receding
  // surfaces that taper to the vanishing point (not flat vertical posts)
  CHAMFER: 22, // chamfered TOP corners of the arch opening
  LCHAMFER: 10, // chamfered LOWER corners (bottom bevel onto the sill)
};

// The tunnel-opening outline at a given depth plane, as [x, h] pairs. `drop`
// lowers the TOP edge (the reveal's inner lip follows the sloping ceiling).
//
// The outline is built so the frame physically CONNECTS to the enclosure:
//   • top corners are chamfered (indices 1–4),
//   • the jambs come down and CHAMFER onto a sill that rests on the barrier top
//     (indices 5–7 / 16–17) — so the frame visibly sits ON the barriers,
//   • the bottom then traces the exact gutter cross-section (barrier inner face
//     → channel floor → lane lip → lane) using the SAME numbers as drawGutters,
//     so the lane + gutters run through the mouth with no flat floating edge.
// Segments around the arch + sill get a real reveal thickness in drawTunnelFrame;
// the gutter/lane crossing (indices 7→16) is where the floor passes through.
// Clockwise from the lower-left chamfer.
const TUNNEL_REVEAL_SEGS = [
  [17, 0], // left lower chamfer
  [0, 1], //  left jamb
  [1, 2], //  left top chamfer
  [2, 3], //  top soffit
  [3, 4], //  right top chamfer
  [4, 5], //  right jamb
  [5, 6], //  right lower chamfer
  [6, 7], //  right sill (rests on the barrier top)
  [16, 17], // left sill (rests on the barrier top)
];
function tunnelOpeningPts(HW, drop) {
  const { TOP, CHAMFER: CH, LCHAMFER: LCH } = PT;
  // HW = the jamb half-width for this plane. The front lip uses openingHalf;
  // the deep inner outline uses the (narrower) tunnelWallHalf, so the reveal
  // jambs splay inward — a funnel — and meet the interior walls with no seam.
  const HL = C.HALF_LANE;
  const gOut = VISUAL.gutterOuterHalf; // gutter/​barrier boundary (shared)
  const D = ENC.GUT_DEPTH; // gutter channel depth
  const SILL = ENC.BAR_H; // jamb feet rest on the barrier top
  const T = TOP - drop;
  return [
    [-HW, SILL + LCH], //  0 left jamb, above the lower chamfer
    [-HW, T - CH], //       1 left jamb top
    [-HW + CH, T], //       2 left top chamfer → soffit
    [HW - CH, T], //        3 right top chamfer
    [HW, T - CH], //        4 right jamb top
    [HW, SILL + LCH], //    5 right jamb, above the lower chamfer
    [HW - LCH, SILL], //    6 right lower chamfer → sill
    [gOut, SILL], //        7 sill runs in to the barrier-top inner edge
    [gOut, -2], //          8 down the barrier inner face to the gutter foot
    [gOut - 5, -D], //      9 outer slope into the channel floor
    [HL + 8.5, -D], //     10 channel floor → inner slope
    [HL, 0], //            11 up onto the lane top edge (right)
    [-HL, 0], //           12 lane top edge (left)
    [-(HL + 8.5), -D], //  13 inner slope base (left)
    [-(gOut - 5), -D], //  14 channel floor (left)
    [-gOut, -2], //        15 barrier foot (left)
    [-gOut, SILL], //      16 up the barrier inner face to the sill
    [-(HW - LCH), SILL], //17 left sill
  ];
}

function drawBackground(ctx, L) {
  // room — the top cools toward the ceiling rows' blue-white bloom
  const bg = ctx.createLinearGradient(0, 0, 0, L.h);
  bg.addColorStop(0, "#0d1220");
  bg.addColorStop(0.22, "#161a28");
  bg.addColorStop(1, "#232733");
  ctx.fillStyle = bg;
  // overscan so screen-shake never reveals a gap at the edges
  ctx.fillRect(-24, -24, L.w + 48, L.h + 48);
}

// The rig's primary lights: LIGHTS.ceiling.rows of discrete LED troffers
// running down-lane. Per row — a continuous bloom (light bouncing off the
// ceiling around the row), then each visible panel as a blue-white surround
// with a near-white core and a white-hot centre stripe. Panels are anchored
// to absolute depth (via ceilingPanels), so they hold still in the world and
// dolly past the follow-cam.
function drawCeilingLights(ctx, L) {
  const { h: H, halfW, core, bloom, rows, end } = LIGHTS.ceiling;
  const near = L.camDepth;
  const panels = ceilingPanels(near, end);

  for (const row of rows) {
    const lx = row.x;
    const I = row.intensity;

    // ceiling bounce — soft continuous glow the row throws onto the ceiling
    const bN = projectH(lx - halfW * 2.2, near, H, L);
    const bF = projectH(lx, end, H, L);
    poly(ctx, [
      bN,
      projectH(lx + halfW * 2.2, near, H, L),
      projectH(lx + halfW * 2.2, end, H, L),
      projectH(lx - halfW * 2.2, end, H, L),
    ]);
    const bounce = ctx.createLinearGradient(0, bN.y, 0, bF.y);
    bounce.addColorStop(0, `rgba(${bloom}, ${0.3 * I})`);
    bounce.addColorStop(1, `rgba(${bloom}, 0)`);
    ctx.fillStyle = bounce;
    ctx.fill();

    // the discrete panels: bloom-coloured surround, bright core, hot stripe
    for (const { d0, d1 } of panels) {
      const quad = (hw) =>
        poly(ctx, [
          projectH(lx - hw, d0, H, L),
          projectH(lx + hw, d0, H, L),
          projectH(lx + hw, d1, H, L),
          projectH(lx - hw, d1, H, L),
        ]);
      quad(halfW);
      ctx.fillStyle = `rgba(${bloom}, ${0.5 * I})`;
      ctx.fill();
      quad(halfW * 0.55);
      ctx.fillStyle = `rgba(${core}, ${0.92 * I})`;
      ctx.fill();
      quad(halfW * 0.18);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, 0.98 * I)})`;
      ctx.fill();
    }
  }
}

// Volumetric shafts under the nearest ceiling panels — dusty air catching the
// light between the troffers and the lane. Drawn AFTER the scene architecture
// (from render(), not drawRoom): the shafts hang in the air in front of the
// lane and the tunnel frame, so painter's order puts them on top.
function drawLightShafts(ctx, L) {
  const { h: H, halfW, bloom, rows, end } = LIGHTS.ceiling;
  const panels = ceilingPanels(L.camDepth, end).slice(0, 3);
  for (const row of rows) {
    for (const { d0, d1 } of panels) {
      drawLightCone(ctx, L, {
        x: row.x,
        d0,
        d1,
        topH: H,
        botH: H * 0.45,
        spreadX: halfW * 2.1,
        rgb: bloom,
        alpha: 0.05 * row.intensity,
      });
    }
  }
}

// Enclosed neon corridor modelled on docs/ref_gemini.jpg: panelled ceiling
// with light strips running toward the pins, dark side walls with cyan/purple
// neon rails and a glowing floor skirt, and a dark back wall. Everything uses
// the lane's projection, so the whole room tracks the follow-cam.
function drawRoom(ctx, L, timeMs) {
  const near = L.camDepth;
  const far = PT.FRONT; // corridor ends at the tunnel mouth (front frame)
  const H = C.ROOM_CEIL_H;
  const W = C.ROOM_HALF;

  // (no flat back wall — the recessed tunnel + front frame close off the corridor)

  // --- ceiling ---
  const cNL = projectH(-W, near, H, L);
  const cNR = projectH(W, near, H, L);
  const cFR = projectH(W, far, H, L);
  const cFL = projectH(-W, far, H, L);
  poly(ctx, [cNL, cNR, cFR, cFL]);
  const cg = ctx.createLinearGradient(0, Math.max(cNL.y, -24), 0, cFL.y);
  cg.addColorStop(0, "#171c2d");
  cg.addColorStop(1, "#0a0d17");
  ctx.fillStyle = cg;
  ctx.fill();

  // ceiling panel seams (cross beams)
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 1.5;
  const seam0 = Math.ceil((near + 60) / 240) * 240;
  for (let d = seam0; d < far; d += 240) {
    const a = projectH(-W, d, H, L);
    const b = projectH(W, d, H, L);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // ceiling light panels — the rig's three rows of discrete LED troffers
  drawCeilingLights(ctx, L);

  // --- side walls with neon rails ---
  const pulse = neonPulse(timeMs);
  for (const s of [-1, 1]) {
    const x = s * W;
    const nT = projectH(x, near, H, L);
    const nB = projectH(x, near, 0, L);
    const fB = projectH(x, far, 0, L);
    const fT = projectH(x, far, H, L);
    poly(ctx, [nT, nB, fB, fT]);
    const wg = ctx.createLinearGradient(0, fT.y, 0, nB.y);
    wg.addColorStop(0, "#151a29");
    wg.addColorStop(1, "#0d101a");
    ctx.fillStyle = wg;
    ctx.fill();

    // wall panel seams
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1;
    for (let d = seam0; d < far; d += 240) {
      const a = projectH(x, d, 0, L);
      const b = projectH(x, d, H, L);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // wall LED strips from the rig — first the light each strip throws onto
    // the wall panelling (soft wash above and below the tube), then the
    // emissive tube itself, all breathing on the shared pulse
    for (const key of ["upper", "lower", "skirt"]) {
      const st = LIGHTS.strips[key];
      const a = st.intensity * pulse;
      const wash = 26;
      const hHi = st.h + wash;
      const hLo = Math.max(st.h - wash, 0); // skirt wash stops at the floor
      const w1 = projectH(x, near, hHi, L);
      const w2 = projectH(x, near, hLo, L);
      poly(ctx, [w1, w2, projectH(x, far, hLo, L), projectH(x, far, hHi, L)]);
      const wig = ctx.createLinearGradient(0, w1.y, 0, w2.y);
      wig.addColorStop(0, `rgba(${st.rgb}, 0)`);
      wig.addColorStop(0.5, `rgba(${st.rgb}, ${0.14 * a})`);
      wig.addColorStop(1, `rgba(${st.rgb}, 0)`);
      ctx.fillStyle = wig;
      ctx.fill();
      drawLEDRail(ctx, L, {
        x,
        h: st.h,
        near,
        far,
        t: st.t,
        rgb: st.rgb,
        alpha: a,
      });
    }
  }
}

// Zeal Interactive venue branding mounted high on the back wall: the logo sits
// inside a premium dark sign panel set into an architectural niche, lit by
// warm indirect light. It reads as part of the building (constant depth =
// DECK_END, so it recedes with the room), the top of a top-down hierarchy of
// branding → scoreboard → pins, all sharing the lane centre.
function drawBackWallBranding(ctx, L) {
  const logo = getLogo();
  const d = PT.FRONT; // mounted on the tunnel's front frame, above the monitor
  const cx = L.cx;

  // frame geometry in world units (0 = floor, ceiling = ROOM_CEIL_H)
  const logoHW = 40; // logo half-width (frame is nearer now, so a touch smaller)
  const logoCY = 268; // logo vertical centre (above the scoreboard, below ceiling)
  const panePadX = 10; // → panel ~22% wider than the logo
  const panePadY = 10;
  const framePad = 9; // architectural niche around the panel

  const paneHW = logoHW + panePadX;
  const paneTop = logoCY + logoHW + panePadY;
  const paneBot = logoCY - logoHW - panePadY;
  const frameHW = paneHW + framePad;
  const frameTop = paneTop + framePad;
  const frameBot = paneBot - framePad;

  // a centred back-wall box → axis-aligned screen rect (constant depth)
  const rect = (xHalf, hTop, hBot) => {
    const tl = projectH(-xHalf, d, hTop, L);
    const br = projectH(xHalf, d, hBot, L);
    return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y, s: tl.s };
  };

  const fr = rect(frameHW, frameTop, frameBot);
  if (fr.s < 0.02) return; // behind the camera / vanishingly small
  const pn = rect(paneHW, paneTop, paneBot);
  const lg = rect(logoHW, logoCY + logoHW, logoCY - logoHW);
  const cyPix = pn.y + pn.h / 2;
  const bevel = Math.max(1, 1.4 * fr.s);
  const fRad = Math.max(3, 8 * fr.s);
  const pRad = Math.max(2, 6 * fr.s);

  ctx.save();

  // --- warm indirect light spilling from behind the sign onto the wall ---
  // the sign is a declared emissive source in the rig (LIGHTS.sign)
  drawBloom(ctx, cx, cyPix, pn.w * 1.05, LIGHTS.sign.warm, 0.2);

  // --- architectural niche frame (dark premium, matching the room) ---
  roundRectPath(ctx, fr.x, fr.y, fr.w, fr.h, fRad);
  const fg = ctx.createLinearGradient(0, fr.y, 0, fr.y + fr.h);
  fg.addColorStop(0, "#20263a");
  fg.addColorStop(0.5, "#141a2b");
  fg.addColorStop(1, "#0a0e18");
  ctx.fillStyle = fg;
  ctx.fill();
  // bevel: top/left catches light, bottom/right falls into shadow
  ctx.lineWidth = bevel;
  ctx.strokeStyle = "rgba(150, 176, 236, 0.22)";
  ctx.beginPath();
  ctx.moveTo(fr.x + fRad, fr.y + bevel * 0.5);
  ctx.lineTo(fr.x + fr.w - fRad, fr.y + bevel * 0.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.beginPath();
  ctx.moveTo(fr.x + fRad, fr.y + fr.h - bevel * 0.5);
  ctx.lineTo(fr.x + fr.w - fRad, fr.y + fr.h - bevel * 0.5);
  ctx.stroke();

  // --- sign panel: recessed plaque the logo mounts on ---
  roundRectPath(ctx, pn.x, pn.y, pn.w, pn.h, pRad);
  const pg = ctx.createLinearGradient(0, pn.y, 0, pn.y + pn.h);
  pg.addColorStop(0, "#0c1120");
  pg.addColorStop(1, "#05070e");
  ctx.fillStyle = pg;
  ctx.fill();
  // warm indirect rim light around the sign's edges: a soft wide halo stroke
  // under a bright core stroke (layered geometry instead of shadowBlur)
  ctx.save();
  roundRectPath(ctx, pn.x, pn.y, pn.w, pn.h, pRad);
  ctx.clip();
  for (const [lw, aa] of [
    [3.2, 0.16], // soft spread
    [1, 0.5], // bright rim
  ]) {
    ctx.lineWidth = Math.max(1.5, lw * 3 * fr.s);
    ctx.strokeStyle = `rgba(${LIGHTS.sign.warm}, ${aa})`;
    roundRectPath(ctx, pn.x, pn.y, pn.w, pn.h, pRad);
    ctx.stroke();
  }
  ctx.restore();

  // --- soft premium glow behind the logo, then the logo itself ---
  drawBloom(ctx, cx, cyPix, lg.w * 0.72, "255, 238, 214", 0.24);

  if (logo) {
    ctx.drawImage(logo, lg.x, lg.y, lg.w, lg.h);
    // illuminated sheen so the sign reads as softly lit, not a flat sticker
    const sheen = ctx.createRadialGradient(
      cx,
      lg.y + lg.h * 0.3,
      0,
      cx,
      lg.y + lg.h * 0.3,
      lg.w * 0.85,
    );
    sheen.addColorStop(0, "rgba(255, 246, 226, 0.18)");
    sheen.addColorStop(0.6, "rgba(255, 240, 214, 0.05)");
    sheen.addColorStop(1, "rgba(255, 240, 214, 0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(lg.x, lg.y, lg.w, lg.h);
  }

  ctx.restore();
}

// Recessed pinsetter tunnel interior — the four faces of the cavity behind the
// front frame: back wall, ceiling and both side walls. Every face is a real
// projected polygon converging to the shared vanishing point; light falls off
// toward the back and ambient occlusion darkens the deep corners, so the depth
// is geometric, not a flat gradient. Drawn before the floor/frame so the pins
// (rendered later) sit visibly inside it.
function drawTunnelInterior(ctx, L, timeMs) {
  const { FRONT: F, BACK: B, TOP, CEIL_B: CB, BOT } = PT;
  const HW = VISUAL.tunnelWallHalf; // interior wall plane (independent of mouth)
  const probe = projectH(0, F, TOP, L);
  if (probe.s < 0.02) return;
  const pulse = neonPulse(timeMs);
  const P = (x, d, h) => projectH(x, d, h, L);
  // brightness the rig delivers at the mouth vs. the back wall — every face
  // gradient below derives its light side from fMouth and its dark side from
  // fBack, so entrance-bright / rear-dark comes from the light layout
  const fMouth = tunnelFalloff(F);
  const fBack = tunnelFalloff(B);
  const fill = "170, 205, 255"; // cool ceiling light reaching into the cavity

  // the four interior polygons' shared corners — blueprint components 8–11
  const fTL = P(-HW, F, TOP); // ceiling front edge (at the mouth)
  const fTR = P(HW, F, TOP);
  const bTL = P(-HW, B, CB); // ceiling back edge = back-wall top
  const bTR = P(HW, B, CB);
  const bBL = P(-HW, B, BOT); // back-wall foot, under the gutters
  const bBR = P(HW, B, BOT);

  ctx.save();

  // ---- component 11 · tunnel back wall (faces the camera) ----
  // the rear stays dark: it only receives the falloff floor (fBack)
  poly(ctx, [bTL, bTR, bBR, bBL]);
  const kg = ctx.createLinearGradient(0, bTL.y, 0, bBL.y);
  kg.addColorStop(0, "#0d1322");
  kg.addColorStop(1, "#04060d");
  ctx.fillStyle = kg;
  ctx.fill();
  // the machine inside: cool blue glow + a dim service-light bar
  const mg = ctx.createLinearGradient(0, bTL.y, 0, bBL.y);
  mg.addColorStop(0, `rgba(${LIGHTS.tunnel.machine}, ${0.26 * pulse})`);
  mg.addColorStop(0.55, `rgba(${LIGHTS.tunnel.machine}, 0)`);
  ctx.fillStyle = mg;
  ctx.fill();
  const barY = bTL.y + (bBL.y - bTL.y) * 0.16;
  const barX0 = bTL.x + (bTR.x - bTL.x) * 0.14;
  const barX1 = bTR.x - (bTR.x - bTL.x) * 0.14;
  for (const [lw, aa] of [
    [5, 0.18], // glow spread
    [2, 0.55], // bright bar
  ]) {
    ctx.strokeStyle = `rgba(${LIGHTS.tunnel.rail}, ${aa * pulse})`;
    ctx.lineWidth = Math.max(1, lw * bTL.s * L.pxPerUnit);
    ctx.beginPath();
    ctx.moveTo(barX0, barY);
    ctx.lineTo(barX1, barY);
    ctx.stroke();
  }

  // ---- components 9 & 10 · tunnel side walls (converging trapezoids) ----
  // They continue the alley enclosure: same lateral plane the side barriers
  // arrive on, running mouth → back, top edges following the sloping ceiling.
  for (const sgn of [-1, 1]) {
    const nT = P(sgn * HW, F, TOP);
    const nB = P(sgn * HW, F, 0);
    const fB = P(sgn * HW, B, BOT);
    const fT = P(sgn * HW, B, CB);
    poly(ctx, [nT, nB, fB, fT]);
    ctx.fillStyle = "#0a0e18"; // unlit base
    ctx.fill();
    // ceiling light reaching in through the mouth, dying toward the machine
    poly(ctx, [nT, nB, fB, fT]);
    const wg = ctx.createLinearGradient(nB.x, 0, fB.x, 0);
    wg.addColorStop(0, `rgba(${fill}, ${0.14 * fMouth})`);
    wg.addColorStop(1, `rgba(${fill}, ${0.14 * fBack})`);
    ctx.fillStyle = wg;
    ctx.fill();
    // ambient occlusion pooling where the wall meets the deck floor
    const aoN = P(sgn * HW, F, 18);
    const aoF = P(sgn * HW, B, 14);
    drawAOEdge(
      ctx,
      [aoN, nB, fB, aoF],
      { x: 0, y: aoN.y },
      { x: 0, y: nB.y },
      0.5,
    );
    // blue LED service rail, converging with the ceiling line
    drawLEDRail(ctx, L, {
      x: sgn * HW,
      h: TOP - 9,
      hFar: CB - 7,
      near: F,
      far: B,
      t: 1.2,
      rgb: LIGHTS.tunnel.rail,
      alpha: 0.7 * pulse,
    });
  }

  // ---- component 8 · tunnel ceiling (masking soffit) ----
  // Slopes DOWN from the mouth (TOP) to the back-wall top (CB): with the
  // player's eye above the opening this is the only way its underside is
  // genuinely visible — and it is exactly how real masking units hang.
  poly(ctx, [fTL, fTR, bTR, bTL]);
  ctx.fillStyle = "#0a0e18"; // unlit base
  ctx.fill();
  poly(ctx, [fTL, fTR, bTR, bTL]);
  const cg = ctx.createLinearGradient(0, fTL.y, 0, bTL.y);
  cg.addColorStop(0, `rgba(${fill}, ${0.18 * fMouth})`);
  cg.addColorStop(1, `rgba(${fill}, ${0.18 * fBack})`);
  ctx.fillStyle = cg;
  ctx.fill();
  // panel-joint seams on the soffit, converging to the vanishing point
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 1;
  for (const sx of [-HW * 0.5, 0, HW * 0.5]) {
    const a = P(sx, F, TOP);
    const b = P(sx, B, CB);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // crisp wall↔ceiling corner edges (define the roof planes)
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = Math.max(1, 2 * bTL.s * L.pxPerUnit);
  for (const [a, b] of [
    [fTL, bTL],
    [fTR, bTR],
  ]) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // ---- deep-corner AO ring where every face meets the back wall ----
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = Math.max(1.5, 4 * bTL.s * L.pxPerUnit);
  poly(ctx, [bTL, bTR, bBR, bBL]);
  ctx.stroke();

  ctx.restore();
}

// Front frame of the tunnel: the flat wall (facing the camera) that closes off
// the corridor, with an opening cut into it around the pins. The opening has a
// real recessed REVEAL — soffit + jamb polygons receding into the cavity — so
// it reads as a thick machine housing, not a printed rectangle. Drawn after the
// corridor + floor so it caps them cleanly.
// Component 12 · the front frame: a flat wall facing the camera that closes
// off the corridor, with the chamfered trapezoidal ARCH opening cut into it.
// Between the front lip and the cavity sit real reveal planes (soffit, two
// chamfer facets, two jambs) that recede REVEAL units — the frame's visible
// thickness is geometry, not a stroke. The bottom of the opening follows the
// lane floor and drops over the gutters, so floor + gutters pass through
// unbroken. Drawn after the corridor + floor so it caps them cleanly.
function drawTunnelFrame(ctx, L) {
  const { FRONT: F, BACK: B, TOP, CEIL_B, REVEAL: REV } = PT;
  const W = VISUAL.frameHalf;
  const CEIL = C.ROOM_CEIL_H;

  const oTL = projectH(-W, F, CEIL, L); // outer top-left (meets ceiling)
  const oBR = project(W, F, L); // outer bottom-right (meets floor)
  if (oTL.s < 0.02) return;
  const s = oTL.s;

  // arch outline on the front plane, and again REVEAL deeper with the top
  // lowered to meet the sloping tunnel ceiling (the reveal's inner lip)
  const drop = ((TOP - CEIL_B) * REV) / (B - F);
  const lip = tunnelOpeningPts(VISUAL.openingHalf, 0).map(([x, h]) =>
    projectH(x, F, h, L),
  );
  const inner = tunnelOpeningPts(VISUAL.tunnelWallHalf, drop).map(([x, h]) =>
    projectH(x, F + REV, h, L),
  );

  ctx.save();

  // frame face = outer rectangle minus the arch (even-odd fill)
  ctx.beginPath();
  ctx.rect(oTL.x, oTL.y, oBR.x - oTL.x, oBR.y - oTL.y);
  ctx.moveTo(lip[0].x, lip[0].y);
  for (let i = 1; i < lip.length; i++) ctx.lineTo(lip[i].x, lip[i].y);
  ctx.closePath();
  const fg = ctx.createLinearGradient(0, oTL.y, 0, oBR.y);
  fg.addColorStop(0, "#1a2134");
  fg.addColorStop(0.6, "#111627");
  fg.addColorStop(1, "#0a0d18");
  ctx.fillStyle = fg;
  ctx.fill("evenodd");

  // reveal planes between the lip and the inner outline — a real recessed
  // thickness receding REVEAL units into the cavity, wrapping the whole arch
  // AND the lower sill (so the frame reads as a heavy structure resting on the
  // barriers). The gutter/lane crossing is skipped: the floor runs through it.
  // Lit by the ceiling rows overhead → symmetric: both jambs equal, the
  // down-facing soffit darkest, the up-facing sills catching ceiling bounce.
  const revealCols = [
    "#20283e", // left lower chamfer
    "#252e48", // left jamb
    "#1e2539", // left top chamfer
    "#161c2e", // top soffit (faces down — light-starved)
    "#1e2539", // right top chamfer
    "#252e48", // right jamb
    "#20283e", // right lower chamfer
    "#28314a", // right sill (faces up — catches ceiling bounce)
    "#28314a", // left sill
  ];
  TUNNEL_REVEAL_SEGS.forEach(([a, b], k) => {
    poly(ctx, [lip[a], lip[b], inner[b], inner[a]]);
    ctx.fillStyle = revealCols[k];
    ctx.fill();
  });

  // crisp front lip, lit symmetrically from above: the arch head catches the
  // ceiling rows hardest, both jambs fall off evenly toward the floor
  ctx.lineWidth = Math.max(1.2, 2 * s);
  ctx.strokeStyle = "rgba(170, 196, 244, 0.34)";
  ctx.beginPath();
  ctx.moveTo(lip[1].x, lip[1].y);
  for (const i of [2, 3, 4]) ctx.lineTo(lip[i].x, lip[i].y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(150, 176, 232, 0.16)";
  ctx.beginPath();
  ctx.moveTo(lip[17].x, lip[17].y);
  for (const i of [0, 1]) ctx.lineTo(lip[i].x, lip[i].y);
  ctx.moveTo(lip[4].x, lip[4].y);
  for (const i of [5, 6, 7]) ctx.lineTo(lip[i].x, lip[i].y);
  ctx.stroke();

  ctx.restore();
}

// Standard bowling scoresheet notation for one frame's rolls: "X" for a
// strike, "/" for a spare's second ball, "-" for a gutter ball, otherwise the
// pin count. `base` tracks pins still standing within the current sub-frame,
// resetting after a strike — so the last frame's up-to-three-ball combos
// (X X X, X 9/, 7/ 5 …) read correctly, not just a plain two-ball frame.
function frameSymbols(rolls) {
  const out = [];
  let base = 10;
  for (const p of rolls) {
    if (p === 10) {
      out.push("X");
      base = 10;
      continue;
    }
    if (base === 10) {
      out.push(p === 0 ? "-" : String(p));
      base = 10 - p;
    } else {
      out.push(p === base ? "/" : p === 0 ? "-" : String(p));
      base = 10;
    }
  }
  return out;
}

// One frame's notation split into the two shot cells the scoresheet shows.
// s2 also carries any 3rd (last-frame fill) ball so nothing is dropped.
function frameShots(rolls) {
  const syms = frameSymbols(rolls);
  return { s1: syms[0] || "", s2: syms.slice(1).join("") };
}

// The TV's default (non-banner) state: a full bowling scoresheet — a frame-
// number header over SHOT 1 / SHOT 2 / running-score rows down a labelled
// left column, exactly the layout a real overhead lane monitor uses. Drawn in
// the room's own palette (cyan grid + headers, gold strikes, purple live
// frame) on a dark screen so the light text stays crisp and readable. Every
// size derives from the already-projected screen rect, so it scales cleanly
// across phone resolutions; frames not yet bowled show dim dashes like unlit
// segments, so nothing is invented for them.
function drawScoreboard(ctx, { left, right, top, H }, view, timeMs) {
  const { frame, totalFrames, frameHistory, frameRolls } = view;
  const pulse = neonPulse(timeMs);

  const CYAN = LIGHTS.strips.upper.rgb; // #58D7FF
  const PURPLE = LIGHTS.strips.lower.rgb; // #B965FF
  const GOLD = "255, 215, 106";
  const INK = "228, 240, 252"; // readable near-white
  const DIM = "120, 150, 185"; // unplayed placeholders

  // natural breathing space inside the screen
  const padX = (right - left) * 0.06;
  const padY = H * 0.13;
  const gx0 = left + padX;
  const gx1 = right - padX;
  const gy0 = top + padY;
  const gy1 = top + H - padY;
  const gw = gx1 - gx0;
  const gh = gy1 - gy0;

  const labelW = gw * 0.2;
  const colX0 = gx0 + labelW;
  const colW = (gw - labelW) / totalFrames;
  const headerH = gh * 0.2;
  const rowH = (gh - headerH) / 3;
  const rowMid = (r) => gy0 + headerH + rowH * (r + 0.5);
  const colMid = (i) => colX0 + colW * (i + 0.5);

  const fData = Math.min(rowH * 0.6, colW * 0.5);
  const fHead = Math.min(headerH * 0.62, colW * 0.5);
  const fLabel = Math.min(rowH * 0.34, labelW * 0.24);
  const ai = frame - 1; // active-frame column index

  // fData is sized for the 1-2 character shot cells, but the running total runs
  // to 4 digits (2000 on a perfect game), which at that size sits right up
  // against the gridlines and the thick live-frame box. Measure the widest
  // total this game can reach and shrink the score row until it clears them,
  // using one size for every cell so the row stays visually even as digits grow.
  ctx.font = `900 ${fData}px system-ui, sans-serif`;
  const widest = ctx.measureText(String(C.TOTAL_FRAMES * C.STRIKE_SCORE)).width;
  const fitW = colW * 0.64;
  const fScore = widest > fitW ? fData * (fitW / widest) : fData;

  ctx.textBaseline = "middle";

  // active-frame column wash (purple, like the reference highlight)
  if (ai >= 0 && ai < totalFrames) {
    ctx.fillStyle = `rgba(${PURPLE}, ${0.09 + 0.06 * pulse})`;
    ctx.fillRect(colX0 + colW * ai, gy0, colW, gh);
  }

  // faint cyan grid
  ctx.strokeStyle = `rgba(${CYAN}, 0.15)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= totalFrames; i++) {
    const x = colX0 + colW * i;
    ctx.moveTo(x, gy0);
    ctx.lineTo(x, gy1);
  }
  ctx.moveTo(gx0, gy0);
  ctx.lineTo(gx0, gy1);
  for (let r = 0; r <= 3; r++) {
    const y = gy0 + headerH + rowH * r;
    ctx.moveTo(gx0, y);
    ctx.lineTo(gx1, y);
  }
  ctx.moveTo(gx0, gy0);
  ctx.lineTo(gx1, gy0);
  ctx.stroke();

  // frame-number header
  ctx.textAlign = "center";
  ctx.font = `800 ${fHead}px system-ui, sans-serif`;
  const headY = gy0 + headerH * 0.5;
  for (let i = 0; i < totalFrames; i++) {
    ctx.fillStyle =
      i === ai ? `rgba(${PURPLE}, 0.98)` : `rgba(${CYAN}, 0.9)`;
    ctx.fillText(String(i + 1), colMid(i), headY);
  }

  // row labels down the left column
  ctx.textAlign = "left";
  ctx.font = `700 ${fLabel}px system-ui, sans-serif`;
  ctx.fillStyle = `rgba(${CYAN}, 0.62)`;
  ["SHOT 1", "SHOT 2", "SCORE"].forEach((t, r) =>
    ctx.fillText(t, gx0 + labelW * 0.12, rowMid(r)),
  );

  // per-frame cells. Bowled data always renders full-strength (a miss "-" is
  // real data); only frames not yet reached fade to dim placeholder dashes.
  ctx.textAlign = "center";
  const shotCol = (s) => (s === "X" ? GOLD : s === "/" ? CYAN : INK);

  for (let i = 0; i < totalFrames; i++) {
    const done = i < frameHistory.length;
    const isCur = i === ai;
    const hasData = done || (isCur && frameRolls.length > 0);
    const cxc = colMid(i);

    ctx.font = `800 ${fData}px system-ui, sans-serif`;
    if (hasData) {
      const { s1, s2 } = frameShots(done ? frameHistory[i].rolls : frameRolls);
      ctx.fillStyle = `rgba(${shotCol(s1)}, 0.96)`;
      ctx.fillText(s1, cxc, rowMid(0));
      ctx.fillStyle = `rgba(${shotCol(s2)}, 0.96)`;
      ctx.fillText(s2, cxc, rowMid(1));
    } else if (!isCur) {
      // a frame not yet reached — dim dashes, like unlit segments
      ctx.fillStyle = `rgba(${DIM}, 0.4)`;
      ctx.fillText("-", cxc, rowMid(0));
      ctx.fillText("-", cxc, rowMid(1));
    } // else: the live frame before its first ball → leave the cells blank

    // score commits per frame: only completed frames show a cumulative total,
    // so a number only ever appears, never changes. the live frame (still
    // being bowled) is marked by its purple box, not a provisional score.
    ctx.font = `900 ${fScore}px system-ui, sans-serif`;
    if (done) {
      ctx.fillStyle = `rgba(${INK}, 0.96)`;
      ctx.fillText(String(frameHistory[i].score), cxc, rowMid(2));
    } else {
      ctx.fillStyle = `rgba(${DIM}, 0.4)`;
      ctx.fillText("-", cxc, rowMid(2));
    }
  }

  // purple frame highlight box, drawn last so it reads as the live cursor
  if (ai >= 0 && ai < totalFrames) {
    ctx.strokeStyle = `rgba(${PURPLE}, ${0.65 + 0.3 * pulse})`;
    ctx.lineWidth = Math.max(1.2, H * 0.014);
    ctx.strokeRect(colX0 + colW * ai, gy0, colW, gh);
  }
}

// Scoreboard "TV" mounted on the tunnel's front frame above the opening: shows
// the frame + score, and the result (STRIKE / SPARE / N PINS / GUTTER) when a
// throw resolves. Flashes on a strike. The top edge leans back so it follows the
// perspective and reads as fixed to the frame, not floating on a flat wall.
function drawTvScreen(ctx, L, view) {
  const d = PT.FRONT;
  const dTop = PT.FRONT + 26; // top edge sits deeper → a slight trapezoid
  const w = 90; // screen half-width — wide landscape, like a lane monitor
  const hw = 97; // housing half-width (the mount extends past the screen)
  const sB = 118; // screen bottom / top heights, clear of the opening below
  const sT = 190;
  const hB = 112; // housing bottom / top — a margin around the screen
  const hT = 196;

  // mount housing (the physical frame the screen is set into)
  const kbl = projectH(-hw, d, hB, L);
  const kbr = projectH(hw, d, hB, L);
  const ktr = projectH(hw, dTop, hT, L);
  const ktl = projectH(-hw, dTop, hT, L);
  if (ktl.s < 0.02) return;

  // screen quad, inset within the housing
  const bl = projectH(-w, d, sB, L);
  const br = projectH(w, d, sB, L);
  const tr = projectH(w, dTop, sT, L);
  const tl = projectH(-w, dTop, sT, L);
  const sc = tl.s;
  const cx = L.cx;
  const top = tl.y;
  const H = bl.y - tl.y;
  const fl = view.flash || 0;

  ctx.save();

  // --- mount housing: dark bevelled frame, lit from above like the room ---
  poly(ctx, [ktl, ktr, kbr, kbl]);
  const hg = ctx.createLinearGradient(0, ktl.y, 0, kbl.y);
  hg.addColorStop(0, "#222a40");
  hg.addColorStop(0.5, "#141a2b");
  hg.addColorStop(1, "#0a0e18");
  ctx.fillStyle = hg;
  ctx.fill();
  // top edge catches the ceiling light; bottom falls into shadow
  ctx.lineWidth = Math.max(1, 1.4 * sc);
  ctx.strokeStyle = "rgba(150, 190, 240, 0.28)";
  ctx.beginPath();
  ctx.moveTo(ktl.x, ktl.y);
  ctx.lineTo(ktr.x, ktr.y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.moveTo(kbl.x, kbl.y);
  ctx.lineTo(kbr.x, kbr.y);
  ctx.stroke();

  // --- screen: dark navy display so the light scoresheet text pops ---
  poly(ctx, [tl, tr, br, bl]);
  const g = ctx.createLinearGradient(0, top, 0, bl.y);
  g.addColorStop(0, "#0f1e36");
  g.addColorStop(1, "#080f1f");
  ctx.fillStyle = g;
  ctx.fill();
  // soft cyan backlight from the centre, like a lit display
  const glow = ctx.createRadialGradient(
    cx,
    top + H * 0.5,
    0,
    cx,
    top + H * 0.5,
    H * 0.85,
  );
  glow.addColorStop(0, `rgba(${LIGHTS.tunnel.rail}, 0.22)`);
  glow.addColorStop(1, `rgba(${LIGHTS.tunnel.rail}, 0)`);
  ctx.fillStyle = glow;
  ctx.fill();
  // neon bezel — an LED edge in the upper wall-strip cyan (no shadowBlur)
  for (const [lw, aa] of [
    [8, 0.18 + 0.3 * fl],
    [2.5, 0.7 + 0.25 * fl],
  ]) {
    ctx.strokeStyle = `rgba(${LIGHTS.strips.upper.rgb}, ${Math.min(1, aa)})`;
    ctx.lineWidth = Math.max(1.4, lw * sc);
    poly(ctx, [tl, tr, br, bl]);
    ctx.stroke();
  }

  // content, clipped to the screen. Normally the scoresheet; during the opening
  // load it's the "booting up" board (the per-throw floating feedback — N PINS /
  // STRIKE! / SPARE! — lives in the HUD over the lane, not here).
  poly(ctx, [tl, tr, br, bl]);
  ctx.clip();
  ctx.textAlign = "center";
  const rect = { left: bl.x, right: br.x, top, H };
  if (view.loading) drawLoadingBoard(ctx, rect, view);
  else drawScoreboard(ctx, rect, view, view.timeMs);
  ctx.restore();
}

// Themed "getting the house ready" status lines, cycled while assets load — the
// alley crew prepping the lanes and the room dressing itself up.
const LOAD_MSGS = [
  "POLISHING THE LANES",
  "OILING THE APPROACH",
  "RACKING THE PINS",
  "DIMMING THE HOUSE LIGHTS",
  "LIGHTING THE NEON",
  "SHINING THE CROWN",
];

// The scoreboard "powering up" while the opening assets load: a rotating themed
// status line with a live ellipsis, a cyan LED bar with a specular shimmer, and
// the percentage — same navy screen + cyan bezel language as the live scoresheet.
function drawLoadingBoard(ctx, { left, right, top, H }, view) {
  const CYAN = LIGHTS.strips.upper.rgb; // #58D7FF
  const INK = "228, 240, 252";
  const p = Math.max(0, Math.min(1, view.loadProgress || 0));
  const el = view.loadElapsed || 0;
  const t = view.timeMs;
  const pulse = neonPulse(t);

  const cx = (left + right) / 2;
  const w = right - left;

  // rotating themed status line + breathing ellipsis (., .., ...)
  const msg = LOAD_MSGS[Math.floor(el / 1300) % LOAD_MSGS.length];
  const dots = ".".repeat(1 + (Math.floor(t / 350) % 3));
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.min(H * 0.17, w * 0.052)}px system-ui, sans-serif`;
  ctx.fillStyle = `rgba(${CYAN}, ${0.82 + 0.18 * pulse})`;
  ctx.fillText(msg + dots, cx, top + H * 0.28);

  // progress track + fill
  const barW = w * 0.74;
  const barH = Math.max(3, H * 0.06);
  const bx = cx - barW / 2;
  const by = top + H * 0.56;
  const r = barH / 2;
  // track
  ctx.fillStyle = `rgba(${CYAN}, 0.13)`;
  roundRectPath(ctx, bx, by, barW, barH, r);
  ctx.fill();
  // fill (min one cap-width so a tiny value still reads), with a shimmer sweep
  const fillW = Math.max(barH, barW * p);
  ctx.save();
  roundRectPath(ctx, bx, by, fillW, barH, r);
  ctx.clip();
  const fg = ctx.createLinearGradient(bx, 0, bx + barW, 0);
  fg.addColorStop(0, `rgba(${CYAN}, 0.72)`);
  fg.addColorStop(1, `rgba(${CYAN}, 1)`);
  ctx.fillStyle = fg;
  ctx.fillRect(bx, by, fillW, barH);
  // specular highlight sweeping left→right across the filled portion
  const span = fillW + barH * 4;
  const sx = bx - barH * 2 + ((t % 1300) / 1300) * span;
  const sg = ctx.createLinearGradient(sx - barH * 2, 0, sx + barH * 2, 0);
  sg.addColorStop(0, "rgba(255, 255, 255, 0)");
  sg.addColorStop(0.5, "rgba(255, 255, 255, 0.45)");
  sg.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sg;
  ctx.fillRect(bx, by, fillW, barH);
  ctx.restore();
  // leading-edge glow
  ctx.strokeStyle = `rgba(${CYAN}, ${0.5 + 0.4 * pulse})`;
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, bx, by, fillW, barH, r);
  ctx.stroke();

  // percentage
  ctx.font = `700 ${Math.min(H * 0.13, w * 0.04)}px system-ui, sans-serif`;
  ctx.fillStyle = `rgba(${INK}, 0.7)`;
  ctx.fillText(`${Math.round(p * 100)}%`, cx, by + barH + H * 0.15);
}

// soft darkening at the edges to frame the scene and focus the eye
function drawVignette(ctx, L) {
  const g = ctx.createRadialGradient(
    L.cx,
    L.h * 0.5,
    L.h * 0.34,
    L.cx,
    L.h * 0.5,
    L.h * 0.9,
  );
  g.addColorStop(0, "rgba(4, 6, 14, 0)");
  g.addColorStop(1, "rgba(4, 6, 14, 0.46)");
  ctx.fillStyle = g;
  ctx.fillRect(-24, -24, L.w + 48, L.h + 48);
}

// Recessed bowling gutters. On each side the surface drops below the raised
// lane into a channel and rises again toward the wall, built entirely from
// perspective trapezoids (projectH with negative height = below the lane).
// Cross-section outward from the lane edge; heights < 0 are recessed.
function drawGutters(ctx, L) {
  const near = L.camDepth;
  const far = C.DECK_END;
  const HL = C.HALF_LANE;
  const EDGE = 5; // raised lane thickness
  const DEPTH = ENC.GUT_DEPTH; // channel depth below the lane plane
  const BIN = VISUAL.gutterOuterHalf; // channel ends at the fixed gutter edge

  // profile points [x, height] — surfaces span each consecutive pair. The
  // channel now stops at the barrier's inner edge (the raised barrier sits
  // outside the gutter, so the gutter no longer runs flat to the wall).
  const prof = [
    [HL, 0], //           0 lane top edge
    [HL + 2, -EDGE], //   1 lane lip (side face)
    [HL + 8.5, -DEPTH], // 2 inner slope → channel floor
    [BIN - 5, -DEPTH], // 3 channel floor → outer
    [BIN, -EDGE * 0.4], // 4 outer slope up to the barrier foot
  ];
  // [nearColour, farColour] per surface (i → prof[i]..prof[i+1])
  const cols = [
    ["#5a3d1e", "#38250f"], // lane lip: wooden side face (reads as raised)
    ["#0e1119", "#070910"], // inner slope: deep shadow
    ["#181c28", "#0c0f18"], // channel floor: dark metallic
    ["#141821", "#0a0d15"], // outer slope: rises to the barrier foot
  ];

  for (const sgn of [-1, 1]) {
    // dark base under the whole cross-section so no seam reveals the background
    const nearPts = prof.map(([x, h]) => projectH(sgn * x, near, h, L));
    const farPts = prof.map(([x, h]) => projectH(sgn * x, far, h, L));
    poly(ctx, [...nearPts, ...farPts.slice().reverse()]);
    ctx.fillStyle = "#090b12";
    ctx.fill();

    // shaded surfaces
    for (let i = 0; i < prof.length - 1; i++) {
      poly(ctx, [nearPts[i], nearPts[i + 1], farPts[i + 1], farPts[i]]);
      const g = ctx.createLinearGradient(0, L.baseY, 0, farPts[i].y);
      g.addColorStop(0, cols[i][0]);
      g.addColorStop(1, cols[i][1]);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // soft shadow the raised lane edge casts down into the channel
    const la = nearPts[1];
    const ld = farPts[1];
    const oa = projectH(sgn * (HL + 7), near, -DEPTH * 0.85, L);
    const od = projectH(sgn * (HL + 7), far, -DEPTH * 0.85, L);
    drawAOEdge(ctx, [la, oa, od, ld], { x: oa.x, y: 0 }, { x: la.x, y: 0 }, 0.5);

    // glossy streak down the channel floor — the cyan wall strip above it,
    // caught in the channel's dark gloss
    const chx = (prof[2][0] + prof[3][0]) / 2;
    const ca = projectH(sgn * chx, near, -DEPTH + 0.5, L);
    const cf = projectH(sgn * chx, far, -DEPTH + 0.5, L);
    ctx.strokeStyle = `rgba(${LIGHTS.strips.upper.rgb}, 0.14)`;
    ctx.lineWidth = Math.max(0.75, 2 * cf.s * L.pxPerUnit);
    ctx.beginPath();
    ctx.moveTo(ca.x, ca.y);
    ctx.lineTo(cf.x, cf.y);
    ctx.stroke();

    // ceiling light glancing off the lane's raised top edge (warmed by the wood)
    ctx.strokeStyle = `rgba(${LIGHTS.laneWarm}, 0.4)`;
    ctx.lineWidth = Math.max(0.75, 1.4 * farPts[0].s * L.pxPerUnit);
    ctx.beginPath();
    ctx.moveTo(nearPts[0].x, nearPts[0].y);
    ctx.lineTo(farPts[0].x, farPts[0].y);
    ctx.stroke();
  }
}

// Raised side barriers — the corridor enclosure outside the gutters (wall →
// barrier → gutter → lane). Constant cross-section running from the foul line
// to the tunnel mouth (PT.FRONT), where it meets the front frame; inside the
// cavity the tunnel walls take over. Constant-x/constant-h edges project as
// straight lines, so two depth samples per edge suffice and every edge
// converges to the shared vanishing point.
function drawSideBarriers(ctx, L) {
  const near = L.camDepth;
  const far = PT.FRONT;
  const WALL = C.ROOM_HALF;
  const { BAR_H, GUT_DEPTH } = ENC;
  const BAR_IN = VISUAL.barrierInnerHalf; // fixed — just outside the gutter
  const BAR_OUT = VISUAL.barrierOuterHalf;

  for (const sgn of [-1, 1]) {
    const inTopN = projectH(sgn * BAR_IN, near, BAR_H, L);
    const inTopF = projectH(sgn * BAR_IN, far, BAR_H, L);
    const inBaseN = projectH(sgn * BAR_IN, near, -2, L);
    const inBaseF = projectH(sgn * BAR_IN, far, -2, L);
    const outTopN = projectH(sgn * BAR_OUT, near, BAR_H, L);
    const outTopF = projectH(sgn * BAR_OUT, far, BAR_H, L);
    const outBaseN = projectH(sgn * WALL, near, 0, L);
    const outBaseF = projectH(sgn * WALL, far, 0, L);
    const shN = projectH(sgn * (BAR_IN - 8), near, -GUT_DEPTH + 1, L);
    const shF = projectH(sgn * (BAR_IN - 8), far, -GUT_DEPTH + 1, L);

    // soft shadow the barrier casts along its foot into the gutter
    drawAOEdge(
      ctx,
      [inBaseN, shN, shF, inBaseF],
      { x: shN.x, y: 0 },
      { x: inBaseN.x, y: 0 },
      0.45,
    );

    // outer face — slopes back to the wall base, blending into the room wall
    poly(ctx, [outTopN, outBaseN, outBaseF, outTopF]);
    const og = ctx.createLinearGradient(0, L.baseY, 0, outTopF.y);
    og.addColorStop(0, "#141a29");
    og.addColorStop(1, "#0b0e18");
    ctx.fillStyle = og;
    ctx.fill();

    // top face — beveled cap
    poly(ctx, [inTopN, outTopN, outTopF, inTopF]);
    const tg = ctx.createLinearGradient(0, L.baseY, 0, inTopF.y);
    tg.addColorStop(0, "#2e3038");
    tg.addColorStop(1, "#15171d");
    ctx.fillStyle = tg;
    ctx.fill();

    // inner face — the graphite riser facing the gutter/lane
    poly(ctx, [inTopN, inBaseN, inBaseF, inTopF]);
    const ig = ctx.createLinearGradient(0, L.baseY, 0, inTopF.y);
    ig.addColorStop(0, "#23262f");
    ig.addColorStop(1, "#0c0d12");
    ctx.fillStyle = ig;
    ctx.fill();

    // the wall strips glancing off the beveled inner top edge — the neon
    // line that flanks the lane in the reference
    ctx.strokeStyle = `rgba(${LIGHTS.strips.upper.rgb}, 0.5)`;
    ctx.lineWidth = Math.max(0.7, 1.4 * inTopF.s * L.pxPerUnit);
    ctx.beginPath();
    ctx.moveTo(inTopN.x, inTopN.y);
    ctx.lineTo(inTopF.x, inTopF.y);
    ctx.stroke();
  }
}

// The varnish pass — polished maple reflecting the light rig. Three long soft
// streaks mirror the ceiling rows (converging with the lane toward the pins),
// and the wall strips tint the lane's outer boards cyan and purple. Additive
// and feathered: varnish sheen, not a mirror.
function drawLaneReflections(ctx, L, timeMs) {
  const near = L.camDepth;
  const far = PT.DECK;
  const pulse = neonPulse(timeMs);

  // ceiling rows mirrored in the varnish — a wide soft base under a tighter
  // brighter pass, the centre row 15% stronger like its source
  for (const row of LIGHTS.ceiling.rows) {
    drawSpecularStreak(ctx, L, {
      x: row.x,
      dNear: near,
      dFar: far,
      halfW: 14,
      rgb: LIGHTS.ceiling.bloom,
      alpha: 0.06 * row.intensity,
    });
    drawSpecularStreak(ctx, L, {
      x: row.x,
      dNear: near,
      dFar: far,
      halfW: 7,
      rgb: LIGHTS.ceiling.core,
      alpha: 0.13 * row.intensity,
    });
  }

  // wall strips reflected in the outer boards: cyan hugs each edge, purple
  // just inboard of it — both breathing on the strips' shared pulse
  for (const sgn of [-1, 1]) {
    drawSpecularStreak(ctx, L, {
      x: sgn * (C.HALF_LANE - 4),
      dNear: near,
      dFar: far,
      halfW: 7,
      rgb: LIGHTS.strips.upper.rgb,
      alpha: 0.15 * pulse,
    });
    drawSpecularStreak(ctx, L, {
      x: sgn * (C.HALF_LANE - 12),
      dNear: near,
      dFar: far,
      halfW: 6,
      rgb: LIGHTS.strips.lower.rgb,
      alpha: 0.11 * pulse,
    });
  }

  // the last ceiling panels spilling through the tunnel mouth onto the deck —
  // the entrance stays brighter than the machine's dark rear
  const s0 = project(-C.HALF_LANE, PT.FRONT, L);
  const s1 = project(C.HALF_LANE, PT.FRONT, L);
  const s2 = project(C.HALF_LANE, PT.FRONT + 120, L);
  const s3 = project(-C.HALF_LANE, PT.FRONT + 120, L);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  poly(ctx, [s0, s1, s2, s3]);
  const spill = ctx.createLinearGradient(0, s0.y, 0, s2.y);
  spill.addColorStop(0, `rgba(${LIGHTS.ceiling.core}, 0.06)`);
  spill.addColorStop(1, `rgba(${LIGHTS.ceiling.core}, 0)`);
  ctx.fillStyle = spill;
  ctx.fill();
  ctx.restore();
}

function drawLane(ctx, L, timeMs) {
  const near = L.camDepth; // near edge sits at the camera as it dollies forward
  const nearL = project(-C.HALF_LANE, near, L);
  const nearR = project(C.HALF_LANE, near, L);
  const farL = project(-C.HALF_LANE, C.DECK_END, L);
  const farR = project(C.HALF_LANE, C.DECK_END, L);

  drawGutters(ctx, L);

  // wood surface
  poly(ctx, [nearL, nearR, farR, farL]);
  const wood = ctx.createLinearGradient(0, L.baseY, 0, farL.y);
  wood.addColorStop(0, "#c8873f");
  wood.addColorStop(0.5, "#dda45c");
  wood.addColorStop(1, "#ecc98f");
  ctx.fillStyle = wood;
  ctx.fill();

  // board seams converging to the vanishing point
  ctx.strokeStyle = "rgba(122, 72, 24, 0.22)";
  ctx.lineWidth = 1;
  const boards = 9;
  for (let i = 1; i < boards; i++) {
    const x = -C.HALF_LANE + (i * (2 * C.HALF_LANE)) / boards;
    const a = project(x, near, L);
    const b = project(x, C.DECK_END, L);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // the light rig reflected in the varnish (markings drawn after sit on top)
  drawLaneReflections(ctx, L, timeMs);

  // pin deck: the lane wood stays BRIGHT and continuous straight through to the
  // pins — no dark break (per the reference). Only a whisper of warmth in the
  // deck zone so it still reads as one unbroken plane.
  const dNearL = project(-C.HALF_LANE, PT.DECK, L);
  const dNearR = project(C.HALF_LANE, PT.DECK, L);
  poly(ctx, [dNearL, dNearR, farR, farL]);
  const deck = ctx.createLinearGradient(0, dNearL.y, 0, farL.y);
  deck.addColorStop(0, "rgba(60, 38, 14, 0)");
  deck.addColorStop(1, "rgba(60, 38, 14, 0.16)");
  ctx.fillStyle = deck;
  ctx.fill();

  // the pit shadow lives ONLY in the last sliver at the very back wall, behind
  // the pins — the bright wood carries the eye all the way in, then drops off
  const pitStart = C.DECK_END - 42;
  const psl = project(-C.HALF_LANE, pitStart, L);
  const psr = project(C.HALF_LANE, pitStart, L);
  poly(ctx, [psl, psr, farR, farL]);
  const pit = ctx.createLinearGradient(0, psl.y, 0, farL.y);
  pit.addColorStop(0, "rgba(6, 7, 12, 0)");
  pit.addColorStop(1, "rgba(6, 7, 12, 0.5)");
  ctx.fillStyle = pit;
  ctx.fill();

  // range-finder dots (~1/6 down the lane) — hidden once the camera passes them
  ctx.fillStyle = "rgba(70, 40, 12, 0.55)";
  if (260 > near) {
    for (let i = -2; i <= 2; i++) {
      const p = project(i * 13.1, 260, L);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6 * p.s * (L.w / 200), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // the 7 lane arrows in a V pointing down-lane (~1/4 down the lane)
  ctx.fillStyle = "rgba(70, 40, 12, 0.7)";
  for (let i = -3; i <= 3; i++) {
    const depth = 380 - Math.abs(i) * 30;
    if (depth <= near) continue; // behind the camera
    const p = project(i * 13.1, depth, L);
    const s = p.s * L.pxPerUnit;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 9 * s);
    ctx.lineTo(p.x - 3.2 * s, p.y + 4 * s);
    ctx.lineTo(p.x + 3.2 * s, p.y + 4 * s);
    ctx.closePath();
    ctx.fill();
  }

  // raised side barriers outside the gutters, forming the lane enclosure
  drawSideBarriers(ctx, L);
}

// ============================================================================
// Projected aiming system — a "lane-projected" targeting rail: a row of glowing
// markers, energy pulses flowing ball -> target, and a breathing reticle that
// sits on the wood. All glow is drawBloom (additive) + geometry — no shadowBlur.
// The aim value (view.aim) is owned by the game loop; this only draws it.
// ============================================================================

const AIM = {
  RGB: "88, 215, 255", // cyan, matches the room LED strips
  START_DEPTH: C.BALL_START_DEPTH, // rail begins just ahead of the ball
  END_DEPTH: 460, // short enough the reticle stays on the wood at full swing
  MARKERS: 7, // dots along the rail
  PULSE_MS: 1100, // period of one energy pulse ball -> reticle
  PULSES: 2, // concurrent pulses, phase-offset
  LOCK_MS: 220, // lock flourish / fade-out duration
  SQUASH: 0.4, // vertical flatten so the reticle lies on the floor
};

// World -> screen point on the aim rail at depth d. aim is an angle from the
// ball, so lateral offset grows with depth: x = ballX + tan(aim)·(d - start).
// `s` is the world-unit -> pixel scale at that point (perspective-correct).
function aimPathPoint(ballX, aim, d, L) {
  const x = ballX + Math.tan(aim) * (d - AIM.START_DEPTH);
  const p = project(x, d, L);
  return { x: p.x, y: p.y, s: p.s * L.pxPerUnit };
}

// Faint additive spill on the wood beneath the rail — the projector's light.
function drawLaneReflection(ctx, L, cfg, fade) {
  const span = AIM.END_DEPTH - AIM.START_DEPTH;
  for (let i = 1; i <= 5; i++) {
    const pt = aimPathPoint(cfg.ballX, cfg.aim, AIM.START_DEPTH + span * (i / 5), L);
    drawBloom(ctx, pt.x, pt.y, 11 * pt.s, AIM.RGB, 0.045 * fade);
  }
}

// The rail: evenly spaced glowing markers, perspective-scaled, dim near the
// ball and building toward the reticle so the rail "emerges" from the ball.
function drawProjectedTrajectory(ctx, L, cfg, fade) {
  const span = AIM.END_DEPTH - AIM.START_DEPTH;
  for (let i = 0; i < AIM.MARKERS; i++) {
    const f = (i + 1) / AIM.MARKERS; // 0 -> 1, ball -> reticle
    const pt = aimPathPoint(cfg.ballX, cfg.aim, AIM.START_DEPTH + span * f, L);
    const a = (0.28 + 0.72 * f) * fade; // opacity envelope
    const wobble = 0.88 + 0.12 * Math.sin(i * 1.7); // slight size variation
    const r = (2.1 + 0.6 * f) * pt.s * wobble; // world radius -> px
    drawBloom(ctx, pt.x, pt.y, r * 2.7, AIM.RGB, 0.18 * a); // bloom on the wood
    ctx.fillStyle = `rgba(${AIM.RGB}, ${0.9 * a})`; // crisp core dot
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(0.7, r * 0.62), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * a})`; // white-hot centre
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(0.5, r * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
}

// Bright blooms travelling ball -> reticle on a loop — the "living energy".
// opts.u drives a single pulse externally (the lock sweep); otherwise it loops.
function drawEnergyPulse(ctx, L, cfg, fade, opts = {}) {
  const span = AIM.END_DEPTH - AIM.START_DEPTH;
  const count = opts.count ?? AIM.PULSES;
  const scale = opts.scale ?? 1;
  for (let k = 0; k < count; k++) {
    const u = opts.u != null ? opts.u : ((cfg.timeMs / AIM.PULSE_MS) + k / count) % 1;
    const bright = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI); // ease at ends
    if (bright <= 0.01) continue;
    const pt = aimPathPoint(cfg.ballX, cfg.aim, AIM.START_DEPTH + span * u, L);
    drawBloom(ctx, pt.x, pt.y, 3.6 * pt.s * scale, AIM.RGB, 0.5 * bright * fade);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * bright * fade})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(0.8, 1.25 * pt.s * scale), 0, Math.PI * 2);
    ctx.fill();
  }
}

// Futuristic reticle at the rail's end, drawn as a floor-projected ellipse so
// it reads as painted on the lane: halo + outer ring + inner ring + centre dot,
// breathing softly with slowly rotating tick marks (the shimmer).
function drawTargetReticle(ctx, L, cfg, fade, flare) {
  const pt = aimPathPoint(cfg.ballX, cfg.aim, AIM.END_DEPTH, L);
  const { x: cx, y: cy, s } = pt;
  const sq = AIM.SQUASH;
  const breathe = 0.5 + 0.5 * Math.sin(cfg.timeMs / 520);
  const base = (0.72 + 0.28 * breathe + 0.4 * flare) * fade;
  const ring = (rx, w, alpha) => {
    ctx.lineWidth = Math.max(1, w * s);
    ctx.strokeStyle = `rgba(${AIM.RGB}, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, rx * sq, 0, 0, Math.PI * 2);
    ctx.stroke();
  };

  drawBloom(ctx, cx, cy, (9 + 2 * breathe) * s, AIM.RGB, (0.14 + 0.3 * flare) * fade);

  const rOuter = (7 + 0.7 * breathe) * s;
  ring(rOuter, 0.7, base);
  ring(rOuter * 0.5, 0.6, base * 0.85);

  // rotating tick marks around the outer ring (subtle shimmer)
  ctx.lineWidth = Math.max(1, 0.6 * s);
  ctx.strokeStyle = `rgba(${AIM.RGB}, ${base})`;
  const rot = cfg.timeMs / 2600;
  for (let i = 0; i < 4; i++) {
    const th = rot + (i * Math.PI) / 2;
    const ux = Math.cos(th);
    const uy = Math.sin(th) * sq;
    ctx.beginPath();
    ctx.moveTo(cx + ux * rOuter * 0.82, cy + uy * rOuter * 0.82);
    ctx.lineTo(cx + ux * rOuter * 1.18, cy + uy * rOuter * 1.18);
    ctx.stroke();
  }

  // centre dot
  ctx.fillStyle = `rgba(255, 255, 255, ${(0.7 + 0.3 * flare) * fade})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 1.5 * s, 1.5 * s * sq, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Orchestrator. Full living rail while AIMING; a brief lock flourish (reticle
// flare + one fast pulse sweep + fade-out) in the ~220ms after the lock tap.
function drawAimGuide(ctx, L, view) {
  const { aim, ballX, timeMs, phase, aimLockAt } = view;
  const cfg = { ballX, aim, timeMs };

  let fade = 1;
  let flare = 0; // reticle flash, 0..1
  let lockU = null; // when set, drives the single rapid lock-sweep pulse
  if (phase !== "AIMING") {
    const t = (timeMs - aimLockAt) / AIM.LOCK_MS;
    if (t < 0 || t > 1) return; // outside the brief lock window: draw nothing
    fade = 1 - t; // rail fades out
    flare = 1 - t; // reticle flares then settles
    lockU = Math.min(1, t * 1.6); // pulse races ahead of the fade
  }

  ctx.save();
  drawLaneReflection(ctx, L, cfg, fade);
  drawProjectedTrajectory(ctx, L, cfg, fade);
  if (lockU != null) drawEnergyPulse(ctx, L, cfg, fade, { u: lockU, count: 1, scale: 1.7 });
  else drawEnergyPulse(ctx, L, cfg, 1);
  drawTargetReticle(ctx, L, cfg, fade, flare);
  ctx.restore();
}

function drawPin(ctx, L, pin, timeMs) {
  const p = project(pin.x, pin.y, L);
  const s = p.s * L.pxPerUnit;
  const h = C.PIN_H * s;
  const w = h * (SPRITE_W / SPRITE_H) * 1.35; // pins read better slightly wide

  let rot = 0;
  let alpha = 1;
  if (!pin.standing) {
    const t = Math.min(1, (timeMs - pin.knockedAt) / C.KNOCK_ANIM_MS);
    rot = easeOut(Math.min(1, t * 2.1)) * (Math.PI / 2) * pin.dir;
    alpha = 1 - Math.max(0, (t - 0.55) / 0.45);
    if (alpha <= 0) return;
  }

  // contact shadow pooling under the pin
  drawContactShadow(ctx, p.x, p.y, w * 0.55, w * 0.2, 0.35 * alpha);

  // the pin mirrored in the varnished deck — a squashed, flipped, faint blit
  if (pin.standing) {
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(p.x, p.y);
    ctx.scale(1, -0.40);
    ctx.drawImage(getPinSprite(), -w / 2, -h, w, h);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(rot);
  ctx.drawImage(getPinSprite(), -w / 2, -h, w, h);
  ctx.restore();
}

function drawBallShadow(ctx, p, r, hx) {
  // The shadow pools opposite the key light (the nearest ceiling row, whose
  // lean is hx). Two layers plant the ball on the lane: a broad soft ambient
  // pool plus a tight dark contact core hugging the base.
  const ox = p.x - hx * r * 0.3;
  drawContactShadow(ctx, ox, p.y + r * 0.85, r * 1.4, r * 0.56, 0.24);
  drawContactShadow(ctx, ox, p.y + r * 0.94, r * 0.92, r * 0.3, 0.45);
}

// ---- procedural rolling bowling ball ----
// Surface features (finger holes + marble specks) are fixed points on a unit
// sphere. Each frame we rotate them about the horizontal axis by an angle set
// by distance rolled, so the texture rolls top→bottom (a real forward roll)
// instead of spinning in-plane. Flip the sign in rotX to reverse the roll.

function norm3(x, y, z) {
  const m = Math.hypot(x, y, z) || 1;
  return { x: x / m, y: y / m, z: z / m };
}

// a few large soft marble veins over the sphere (no small specks — those
// twinkle as they rotate; big soft blobs read as swirl and roll smoothly)
const BALL_VEINS = (() => {
  const pts = [];
  const N = 6;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = (1 - (i / (N - 1)) * 2) * 0.82; // keep off the exact poles
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * golden + 1.3;
    pts.push({
      x: Math.cos(phi) * rad,
      y,
      z: Math.sin(phi) * rad,
      s: 0.26 + (0.08 * ((i * 5) % 3)) / 3, // blob radius (fraction of r)
      light: i % 2 === 0, // alternate light / dark veins
    });
  }
  return pts;
})();

// The three grip holes as sphere points, built from the tunable span/gap so
// they sit at a realistic bowling grip: two finger holes up top a small gap
// apart, and the thumb hole a span below them.
function ballHoles() {
  const hs = C.BALL_HOLE_SPAN * 0.5;
  const hg = C.BALL_FINGER_GAP * 0.5;
  return [
    norm3(-hg, -hs, 1), // middle finger
    norm3(hg, -hs, 1), // ring finger
    norm3(0, hs, 1), // thumb
  ];
}

// rotate a sphere point about the x-axis so front points travel top → bottom
function rotX(pt, cos, sin) {
  return {
    x: pt.x,
    y: pt.y * cos + pt.z * sin,
    z: -pt.y * sin + pt.z * cos,
  };
}

function drawBall(ctx, L, view) {
  const { ballX, ballDepth } = view;
  if (ballDepth > C.DECK_END + 20) return; // fell into the pit

  const p = project(ballX, ballDepth, L);
  const r = C.BALL_DRAW_R * p.s * L.pxPerUnit;
  if (r < 0.5) return;

  // key light = the nearest ceiling row: the highlight sits top-centre under
  // the centre row and leans toward whichever row is closest as the ball
  // drifts across the lane
  const row = nearestRow(ballX);
  const hx = Math.max(-0.45, Math.min(0.45, (row.x - ballX) / 60)) * 0.9;
  const hy = -0.52;

  drawBallShadow(ctx, p, r, hx);

  // idle shows the 3 holes head-on (theta 0), then rolls top→bottom as it moves
  const theta = (ballDepth - C.BALL_START_DEPTH) * C.BALL_ROLL;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // this game frame's ball colour [highlight, mid, dark rim]
  const palette = C.BALL_COLORS;
  const [litCol, midCol, darkCol] =
    palette[((view.frame || 1) - 1) % palette.length];

  // everything on the ball is clipped to its circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.clip();

  // base sphere shading — lit from the nearest ceiling row, offset so the far
  // side falls into shadow (this is the core "roundness" of the sphere)
  const bg = ctx.createRadialGradient(
    p.x + hx * r,
    p.y + hy * r * 0.88,
    r * 0.05,
    p.x - r * 0.05,
    p.y - r * 0.05,
    r * 1.3,
  );
  bg.addColorStop(0, litCol);
  bg.addColorStop(0.42, midCol);
  bg.addColorStop(0.85, darkCol);
  bg.addColorStop(1, darkCol);
  ctx.fillStyle = bg;
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);

  // rolling marble veins — soft radial blobs so nothing sparkles
  for (const v of BALL_VEINS) {
    const q = rotX(v, cos, sin);
    if (q.z <= 0.05) continue; // on the far hemisphere
    const sx = p.x + q.x * r;
    const sy = p.y + q.y * r;
    const rr = v.s * r;
    const a = 0.12 * q.z;
    const tint = v.light ? "255, 255, 255" : "0, 0, 0";
    const vg = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    vg.addColorStop(0, `rgba(${tint}, ${a})`);
    vg.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = vg;
    ctx.beginPath();
    ctx.arc(sx, sy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  // ambient occlusion — darken toward the rim so the edge turns away from you
  const occ = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r);
  occ.addColorStop(0, "rgba(0, 0, 0, 0)");
  occ.addColorStop(0.8, "rgba(0, 0, 0, 0.1)");
  occ.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = occ;
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);

  // fresnel lip — a thin bright rim at the very edge (glossy sphere hallmark),
  // tinted by the ceiling's blue-white bloom filling the room
  const fres = ctx.createRadialGradient(p.x, p.y, r * 0.86, p.x, p.y, r);
  fres.addColorStop(0, `rgba(${LIGHTS.ceiling.bloom}, 0)`);
  fres.addColorStop(0.86, `rgba(${LIGHTS.ceiling.bloom}, 0)`);
  fres.addColorStop(0.97, `rgba(${LIGHTS.ceiling.bloom}, 0.16)`);
  fres.addColorStop(1, `rgba(${LIGHTS.ceiling.bloom}, 0.04)`);
  ctx.fillStyle = fres;
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);

  // neon rim lights from the wall strips — cyan facing one wall, purple the
  // other, both strengthening as the ball nears that wall
  const rims = rimLights(ballX);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const rim of [rims.cyan, rims.purple]) {
    const rx = p.x + rim.dir * r * 0.92;
    const ry = p.y - r * 0.1;
    const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, r * 0.7);
    rg.addColorStop(0, `rgba(${rim.rgb}, ${rim.a})`);
    rg.addColorStop(1, `rgba(${rim.rgb}, 0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }
  ctx.restore();

  // warm maple bounce light on the underside
  const wb = ctx.createRadialGradient(
    p.x,
    p.y + r * 1.05,
    0,
    p.x,
    p.y + r * 1.05,
    r * 0.9,
  );
  wb.addColorStop(0, `rgba(${LIGHTS.laneWarm}, 0.12)`);
  wb.addColorStop(1, `rgba(${LIGHTS.laneWarm}, 0)`);
  ctx.fillStyle = wb;
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);

  // rolling finger holes — drilled look: lit lip + recessed dark interior
  const hr = C.BALL_HOLE_R * r;
  for (const h of ballHoles()) {
    const q = rotX(h, cos, sin);
    if (q.z <= 0.03) continue;
    const sx = p.x + q.x * r;
    const sy = p.y + q.y * r;
    const rx = hr * (0.5 + 0.5 * q.z);
    const ry = hr * Math.max(0.18, q.z);
    const vis = Math.min(1, q.z * 1.6);
    // lit drilled lip (slightly larger, behind the hole)
    ctx.fillStyle = `rgba(236, 239, 246, ${0.12 * vis})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * 1.18, ry * 1.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // recessed interior, offset down a touch so the top lip stays lit
    const hg = ctx.createRadialGradient(
      sx - rx * 0.3,
      sy - ry * 0.3,
      ry * 0.1,
      sx,
      sy + ry * 0.2,
      rx,
    );
    hg.addColorStop(0, `rgba(34, 34, 40, ${vis})`);
    hg.addColorStop(0.5, `rgba(9, 9, 12, ${vis})`);
    hg.addColorStop(1, `rgba(0, 0, 0, ${vis})`);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(sx, sy + ry * 0.12, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // end clip

  // broad soft sheen under the key light
  const shx = p.x + hx * r * 0.95;
  const shy = p.y + hy * r * 0.85;
  const sheen = ctx.createRadialGradient(shx, shy, 0, shx, shy, r * 0.95);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.22)");
  sheen.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();

  // tight specular hotspot — the ceiling panel itself glinting off the
  // urethane, brighter under the centre row like its source
  const htx = p.x + hx * r * 1.05;
  const hty = p.y + hy * r * 0.96;
  const hot = ctx.createRadialGradient(htx, hty, 0, htx, hty, r * 0.34);
  hot.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, 0.78 * row.intensity)})`);
  hot.addColorStop(0.55, "rgba(255, 255, 255, 0.22)");
  hot.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Soft pulsing glow on the pocket to guide the aim.
function drawPocketGlow(ctx, L, timeMs) {
  const p = project(C.POCKET_X, C.HEAD_PIN_DEPTH, L);
  const r = 22 * p.s * L.pxPerUnit;
  if (r <= 0) return;
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 380);
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  g.addColorStop(0, `rgba(255, 215, 106, ${0.1 + 0.22 * pulse})`);
  g.addColorStop(1, "rgba(255, 215, 106, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Fading streak of the ball's recent positions (newest first in the array).
function drawTrail(ctx, L, trail) {
  if (!trail || trail.length < 2) return;
  for (let i = trail.length - 1; i >= 1; i--) {
    const t = trail[i];
    if (t.depth > C.DECK_END + 20) continue;
    const p = project(t.x, t.depth, L);
    const f = 1 - i / trail.length; // 0 at tail → ~1 near the ball
    const r = C.BALL_DRAW_R * p.s * L.pxPerUnit * (0.35 + 0.55 * f);
    // soft silver motion-blur matching the neutral ball (subtle, not coloured)
    ctx.fillStyle = `rgba(220, 222, 230, ${0.13 * f})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Full-screen gold flash on a strike.
function drawFlash(ctx, L, flash) {
  if (!flash) return;
  ctx.fillStyle = `rgba(255, 225, 150, ${flash * 0.4})`;
  ctx.fillRect(-24, -24, L.w + 48, L.h + 48);
}

export function render(ctx, L, view) {
  L.camDepth = view.camDepth || 0;
  drawBackground(ctx, L);
  drawTunnelInterior(ctx, L, view.timeMs); // recessed cavity (deepest — behind all)
  drawRoom(ctx, L, view.timeMs); // corridor up to the tunnel mouth
  drawLane(ctx, L, view.timeMs); // floor: lane, gutters, barriers, pit (into the cavity)
  drawTunnelFrame(ctx, L); // front frame with the opening, caps the corridor
  drawTvScreen(ctx, L, view); // scoreboard on the frame
  drawBackWallBranding(ctx, L); // logo on the frame
  drawLightShafts(ctx, L); // volumetric air under the near ceiling panels

  if (view.phase === "AIMING" || view.phase === "POWER") {
    drawPocketGlow(ctx, L, view.timeMs);
    drawAimGuide(ctx, L, view);
  }

  // pins farthest-first so nearer pins overlap them correctly
  const pins = [...view.pins].sort((a, b) => b.y - a.y);
  for (const pin of pins) drawPin(ctx, L, pin, view.timeMs);

  drawTrail(ctx, L, view.trail);
  drawBall(ctx, L, view);

  drawVignette(ctx, L);
  drawFlash(ctx, L, view.flash);
}
