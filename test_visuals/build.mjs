import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/raoabdul/.agents/skills/anatomy/kit/iso-kit.mjs";
import * as G from "/Users/raoabdul/.agents/skills/anatomy/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "/Users/raoabdul/.agents/skills/anatomy/kit/tube.mjs";
import * as A from "/Users/raoabdul/.agents/skills/anatomy/kit/audit.mjs";
import { glCamera } from "/Users/raoabdul/.agents/skills/anatomy/kit/gl.mjs";
import { glScript, kitScript } from "/Users/raoabdul/.agents/skills/anatomy/scripts/inline-kit.mjs";
import * as M from "./model.mjs";

// A Merlin 1D hung bell-down in a test stand, chamber opened toward the camera.
// What moves: the throttle sets chamber pressure, and the cutaway pintle is the
// place the two propellants meet. Taking it apart follows the gas-generator cycle:
// the nozzle drops, the turbine exhaust slides out, the pumps leave, and the pintle
// lifts out of the injector once the dome has cleared it.

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--dark") ? "dark" : "light";
const DEG = Math.PI / 180;
const W = 900;
const H = 980;
const AZ = 36;
const EL = 31;
const Z0 = 156;
const RO = M.outerR(M.S_CYL);
const PUMP_DEG = 152;
const GAP = 50 * DEG;
const OPEN = AZ * DEG;

const info = M.checkContour();
const Z_CYL = Z0 + M.S_CYL;
const Z_INJ = Z0 + M.S_INJ;
const Z_CAP = Z_INJ + M.PLATE + M.DOME * 0.86;
const Z_GIMBAL = Z_CAP;
const Z_GIMBAL_TOP = Z_GIMBAL + 12;
const BEAM_Z = Z_GIMBAL_TOP + 58;
const BEAM_H = 20;
const PUMP_Z = (Z_CYL + Z_INJ) / 2;

const DECK = { x: -168, y: -168, w: 336, d: 336, r: 12 };
const COLS = [[118, -118], [-118, 118]];

const P = k.fitProjection(
  [
    ...k.boxCorners(DECK, -22, 0),
    [0, 0, BEAM_Z + BEAM_H],
    [150, 40, BEAM_Z + BEAM_H],
    [-150, 20, PUMP_Z],
    [0, 0, 0],
  ],
  W,
  H,
  { pad: 28, azimuth: AZ, elevation: EL },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const Faded = (list, style) => k.fadedSvg(list, style);
const AXIS = G.frameOf([0, 0, Z0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const polar = (deg, r, z) => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG), z];
const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG), 0];

const PIECES = {
  nozzle: { name: "Nozzle", say: "de Laval bell · throat Mach 1 · area ratio 16, over-expanded at sea level", move: [0, 0, -72] },
  exhaust: { name: "Turbine exhaust", say: "open cycle · gas that spun the turbine is dumped beside the bell", move: [...dir(PUMP_DEG).map((v) => v * 40), 0] },
  jacket: { name: "Fuel jacket", say: "RP-1 enters low on the bell and climbs the wall before it is burned", move: [...dir(PUMP_DEG).map((v) => v * 40), 0] },
  lox: { name: "Oxygen duct", say: "LOX leaves the pump and arrives at the injector above the pintle", move: [...dir(PUMP_DEG).map((v) => v * 40), 0] },
  pump: { name: "Turbopump", say: "one shaft · LOX impeller, RP-1 impeller, turbine", move: [...dir(PUMP_DEG).map((v) => v * 40), 0] },
  gg: { name: "Gas generator", say: "a small fuel-rich burner · about 3% of the flow, enough to spin the shaft", move: [...dir(PUMP_DEG).map((v) => v * 40), 0] },
  pintle: { name: "Pintle", say: "one element · LOX down the post, RP-1 in the sleeve, they meet in a sheet", move: [...dir(AZ).map((v) => v * 40), 0] },
  dome: { name: "Injector dome", say: "the oxygen manifold above the pintle", move: [0, 0, 0] },
  gimbal: { name: "Gimbal", say: "the engine hangs here and can tilt · Merlin steers with RP-1 hydraulics", move: [0, 0, 0] },
  chamber: { name: "Chamber", say: "the burn lives here · the wall is a jacket of RP-1 channels", move: [0, 0, 0] },
  controller: { name: "Controller", say: "triple-redundant engine computer · one box per Merlin", move: [...dir(AZ + 70).map((v) => v * 36), 8] },
  stand: { name: "Stand", say: "", move: [0, 0, 0] },
};

const STAGGER = ["nozzle", "exhaust", "jacket", "lox", "controller", "gg", "pump", "gimbal", "dome", "pintle", "chamber", "stand"];
const SPRING = { stagger: 0.035, stiffness: 64, damping: 14.2, substeps: 4 };
const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const { items, nameFor } = R;
const record = R.solid;

function put(piece, ref, svg, { bias = 0, move, ride, shapes = [], name, route, chunk } = {}) {
  const id = name ?? nameFor(`${piece}.item`);
  R.put({
    piece,
    ride: ride ?? piece,
    at: ref,
    bias,
    svg,
    move: move ?? PIECES[piece].move,
    shapes,
    name: id,
    route,
    chunk,
  });
  return id;
}

function tubeItems(piece, route, r, { name, tone = "hi", bias = 0, move, ride, maxLength = 28, spacing, gaps = [], caps = true, ends = [true, true], rims, free = [false, false], touch } = {}) {
  const id = nameFor(name ?? `${piece}.tube`);
  const rideId = ride ?? piece;
  R.route(id, route, r, { owner: id, touch, gaps, ends, rims, free, piece, move: move ?? PIECES[rideId].move, ride: rideId });
  tubePieces(route, r, P, { maxLength, spacing: spacing ?? Math.max(0.8, Math.min(2.2, r * 0.2)), gaps, caps }).forEach((part, index) =>
    put(piece, part.mid, tubeSvg(part, { tone }), { bias, move: move ?? PIECES[rideId].move, ride: rideId, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
  );
  return id;
}

function flangeAt(piece, centre, axis, r, thick, { bolts = 6, tone = "hi", move, ride, name, owner } = {}) {
  const F = G.frameAlong(centre, axis);
  const id = nameFor(name ?? `${piece}.flange`);
  const paths = G.disc(-thick / 2, thick / 2, r, F, P);
  const faces = [];
  const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
  if (Math.abs(G.dot3(F.a, V)) > 0.12 && bolts) faces.push(Dots(G.dotsOf(F, towards, r * 0.72, bolts, P, { all: true }), { size: 0.4, tone: "mid" }));
  put(piece, centre, S(paths, { tone }) + faces.join(""), { move, ride, name: id, shapes: [record(A.disc(F, -thick / 2, thick / 2, r, { name: id, owner }))] });
  return id;
}

function pipe(piece, control, r, { bend = 2.8, tone = "hi", flanges = [true, true], flangeR = 1.6, move, ride, name, free, touch, valve = null } = {}) {
  const line = G.fillet(control, Math.max(r * bend, 3.2), r > 3 ? 20 : 12, { P, tube: r });
  const total = G.pathLength(line);
  const gaps = [];
  const collars = [];
  [[0, -1], [total, 1]].forEach(([along, sign], index) => {
    if (!flanges[index]) return;
    const thick = Math.max(1, r * 0.55);
    const tangent = G.tangentAlong(line, along);
    const centre = G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2));
    collars.push({ centre, tangent, radius: r * flangeR, thick });
    gaps.push(sign < 0 ? [0, thick] : [total - thick, total]);
  });
  let valveName = null;
  if (valve) {
    const along = total * valve;
    const radius = r * 1.75;
    const tangent = G.tangentAlong(line, along);
    const side = G.unit3(Math.abs(tangent[2]) > 0.65 ? [tangent[1], -tangent[0], 0] : [0, 0, 1]);
    const d = Math.sqrt(Math.max(0.2, radius * radius - r * r));
    gaps.push([along - d, along + d]);
    const centre = G.pointAlong(line, along);
    const id = nameFor(`${name ?? piece}.valve`);
    valveName = id;
    put(piece, centre, S(G.sphereOf(centre, radius, P), { tone: "hi" }), { move, ride, name: id, shapes: [record(A.ball(centre, radius, { name: id }))] });
    const neckF = G.frameAlong(centre, side);
    const neckFrom = Math.sqrt(Math.max(0.2, radius * radius - (r * 0.55) ** 2));
    put(piece, G.pointOf(neckF, neckFrom + r * 0.7, 0, 0), S(G.disc(neckFrom, neckFrom + r * 1.5, r * 0.62, neckF, P), { tone: "mid" }), {
      move,
      ride,
      name: `${id}.neck`,
      shapes: [record(A.disc(neckF, neckFrom, neckFrom + r * 1.5, r * 0.62, { name: `${id}.neck`, owner: id }))],
    });
  }
  const owner = tubeItems(piece, line, r, { name: name ?? `${piece}.pipe`, tone, move, ride, gaps, free, rims: flanges.map((on) => (on ? r * flangeR : r)), touch: [touch, valveName].flat().filter(Boolean) });
  for (const collar of collars) flangeAt(piece, collar.centre, collar.tangent, collar.radius, collar.thick, { bolts: r > 2.4 ? 6 : 0, tone, move: move ?? (ride ? PIECES[ride].move : undefined), ride, name: `${owner}.flange`, owner });
  return line;
}

function box(piece, plan, z, h, { tone = "mid", bevel = 0.6, name, move, extra = "", owner } = {}) {
  const id = nameFor(name ?? `${piece}.box`);
  const centre = [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
  put(piece, centre, S(k.slabOf(plan, z, h, P, 4, bevel), { tone }) + extra, {
    move,
    name: id,
    shapes: [record(A.box([plan.x, plan.y, z], [plan.x + plan.w, plan.y + plan.d, z + h], { name: id, owner }))],
  });
  return id;
}

const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(DECK, -20, 14, P)}"/>`);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of byDepth(k.corners(DECK, 28))) {
  back.push(S(k.cylinder(x, y, 8, -22, 2, P, 24), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 5.6, -20, 6, P, 24), { tone: "mid" }));
}
back.push(S(k.slabOf(DECK, -14, 14, P, 8, 1.4), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(DECK, 6), 0, P), { tone: "lo" }));
const screws = k.corners(DECK, 12);
back.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
const strip = { x: -120, y: DECK.y + DECK.d - 18, w: 150, d: 8, r: 1 };
back.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.6, 0.7, [2.2, 4], P);
back.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
const label = { x: -146, y: -150, w: 42, d: 16, r: 1.4 };
back.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
back.push(Ln(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
back.push(Ln([0, 1, 2].map((row) => k.lineOnTop([label.x + 4, label.y + 4 + row * 3], [label.x + (row === 1 ? 24 : 32), label.y + 4 + row * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
back.push(k.faceTextSvg(k.topMatrix([label.x + 21, label.y + 8], 0.9, P, "x"), "M1D", { size: 3.2, tone: "mid", anchor: "middle" }));

const coneR = (s) => 54 + ((4 - 54) * s) / 32;
const coneSlope = () => (4 - 54) / 32;
const coneProf = [0, 8, 16, 24, 32].map((s, i, all) => [s, coneR(s), i && i < all.length - 1 ? 1 : 0]);
back.push(S(k.cylinder(0, 0, 58, 0, 5, P, 48), { tone: "lo" }));
back.push(S(G.solidOf(coneProf, G.frameOf([0, 0, 5], [0, 0, 1], [1, 0, 0], [0, 1, 0]), P, { smooth: { slope: coneSlope, radius: coneR, rows: 5 } }), { tone: "mid", className: "m1d-cone" }));
for (const [x, y] of COLS) {
  back.push(S(k.cylinder(x, y, 11, 0, 6, P, 24), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 8, 6, BEAM_Z - 6, P, 28), { tone: "mid", crease: "none" }));
  back.push(Ln([40, 120, 200, 280].filter((z) => z < BEAM_Z).map((z) => k.sideArc(x, y, 8, z, P, 16)).join(""), { tone: "faint" }));
}

const FLOOR = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
function stavePoly(rIn, rOut, a0, a1) {
  return [
    [rOut * Math.cos(a0), rOut * Math.sin(a0)],
    [rOut * Math.cos(a1), rOut * Math.sin(a1)],
    [rIn * Math.cos(a1), rIn * Math.sin(a1)],
    [rIn * Math.cos(a0), rIn * Math.sin(a0)],
  ];
}
const metal = [];
{
  let a = OPEN + GAP;
  const end = OPEN + Math.PI * 2 - GAP;
  const count = 14;
  const step = (end - a) / count;
  for (let i = 0; i < count; i++) metal.push([a + step * i, a + step * (i + 1)]);
}
function staves(piece, z0, z1, rIn, rOut, { name, tone = "hi" } = {}) {
  for (const [a0, a1] of metal) {
    const poly = stavePoly(rIn, rOut, a0, a1);
    const id = nameFor(name ?? `${piece}.stave`);
    const midA = (a0 + a1) / 2;
    const centre = [((rIn + rOut) / 2) * Math.cos(midA), ((rIn + rOut) / 2) * Math.sin(midA), (z0 + z1) / 2];
    const groove = Ln(k.segment([rOut * Math.cos(midA), rOut * Math.sin(midA), z0], [rOut * Math.cos(midA), rOut * Math.sin(midA), z1], P), { tone: "faint" });
    put(piece, centre, S(G.prismOf(FLOOR, poly, z0, z1, P), { tone, inner: groove }), { name: id, shapes: [record(A.prism(FLOOR, poly, z0, z1, { name: id }))] });
  }
}

const LIP = 2.8;
const bellFrom = LIP;
const cuts = [bellFrom, 22, 44, 66, M.S_THROAT - 8, M.S_THROAT, M.S_THROAT + 10, M.S_ARC, M.S_CYL];
const BELL = G.bandsOf(
  [
    [bellFrom, M.outerR(bellFrom)],
    [M.S_CYL, M.outerR(M.S_CYL)],
  ],
  cuts.slice(1, -1),
  AXIS,
  P,
  { radius: M.outerR, slope: M.outerSlope, rows: 6 },
);
BELL.bands.forEach((band, index) => {
  const samples = [0, 0.25, 0.5, 0.75, 1].map((t) => band.s0 + (band.s1 - band.s0) * t);
  const inner = samples.map((s) => [s, M.innerR(s)]);
  const outer = [...samples].reverse().map((s) => [s, M.outerR(s)]);
  const id = nameFor("nozzle.bell");
  const ribs = band.s0 >= 20 && band.s1 <= 70 ? Faded(G.ribsOf(AXIS, band.s0, band.s1, M.outerR(band.s0), 16, P, { r1: M.outerR(band.s1), fade: [0.08, 0.5], seams: true }), { tone: "lo" }) : "";
  const seam = index === 3 || index === 5 ? Ln(band.seam, { tone: "faint" }) : "";
  put("nozzle", [0, 0, Z0 + (band.s0 + band.s1) / 2], S(band.paths, { tone: "hi", inner: seam }) + ribs, {
    name: id,
    shapes: [record(A.body(AXIS, [...inner, ...outer], { name: id, owner: "nozzle.shell" }))],
  });
});
const sides = BELL.sidesOf(bellFrom, M.S_CYL, { ends: false, count: 64 });
put("nozzle", [0, 0, Z0 + M.S_THROAT], Ln(sides.d, { tone: "hi" }), { bias: 0.15, name: "nozzle.sides", shapes: sides.points.map((points) => A.tube(points, 0.35 / KS, { owner: "nozzle.shell" })) });
put(
  "nozzle",
  [0, 0, Z0 + LIP / 2],
  S(G.ringBand(0, LIP, M.RE - 0.4, M.outerR(0) + 2.2, AXIS, P), { tone: "hi" }) +
    `<path class="m1d-void" d="${G.circleOf(AXIS, 0, M.RE - 0.6, P)}"/>` +
    Dots(G.dotsOf(AXIS, LIP, M.outerR(0) + 1.1, 28, P, { fade: [0.04, 0.42] }), { size: 0.38, tone: "mid" }),
  { name: "nozzle.lip", shapes: [record(A.ring(AXIS, 0, LIP, M.RE - 0.4, M.outerR(0) + 2.2, { name: "nozzle.lip", owner: "nozzle.shell" }))] },
);
record(A.box([DECK.x, DECK.y, -14], [DECK.x + DECK.w, DECK.y + DECK.d, 0], { name: "stand.deck" }));
record(A.cylinder(0, 0, 58, 0, 5, { name: "stand.pad" }));
record(A.solid(G.frameOf([0, 0, 5], [0, 0, 1], [1, 0, 0], [0, 1, 0]), coneProf, { radius: coneR, name: "stand.cone" }));
for (const [x, y] of COLS) record(A.cylinder(x, y, 8, 0, BEAM_Z, { name: "stand.column" }));

staves("chamber", Z_CYL, Z_CYL + 3.2, M.RC - 0.2, RO + 1.6, { name: "chamber.foot" });
staves("chamber", Z_CYL + 3.2, Z_INJ - 3.2, M.RC, RO, { name: "chamber.wall" });
staves("chamber", Z_INJ - 3.2, Z_INJ, M.RC - 0.2, RO + 1.6, { name: "chamber.head" });

const PLATE_R_IN = 8.6;
const PLATE_R = RO + 2.4;
put(
  "dome",
  [0, 0, Z_INJ + M.PLATE / 2],
  S(G.ringBand(M.S_INJ, M.S_INJ + M.PLATE, PLATE_R_IN, PLATE_R, AXIS, P), { tone: "hi" }) + Dots(G.dotsOf(AXIS, M.S_INJ + M.PLATE, PLATE_R - 1.4, 20, P, { all: true, fade: [0.04, 0.4] }), { size: 0.4, tone: "mid" }),
  { name: "dome.plate", shapes: [record(A.ring(AXIS, M.S_INJ, M.S_INJ + M.PLATE, PLATE_R_IN, PLATE_R, { name: "dome.plate" }))] },
);

const domeR = (s) => Math.sqrt(Math.max(0, M.DOME * M.DOME - s * s));
const domeSlope = (s) => -s / Math.max(0.2, domeR(s));
const domeKnots = Array.from({ length: 14 }, (_, i) => {
  const s = (M.DOME * 0.86 * i) / 13;
  return [s, domeR(s), i && i < 13 ? 1 : 0];
});
const DOME_F = G.frameOf([0, 0, Z_INJ + M.PLATE], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
put("dome", [0, 0, Z_INJ + M.PLATE + 6], S(G.solidOf(domeKnots, DOME_F, P, { smooth: { slope: domeSlope, radius: domeR, rows: 5 } }), { tone: "hi" }), {
  name: "dome.body",
  shapes: [record(A.solid(DOME_F, domeKnots, { radius: domeR, name: "dome.body" }))],
});

const TIP_R = 5.1;
const STEM_R = 2.45;
const SLEEVE_IN = 6.3;
const SLEEVE_OUT = 7.7;
const FLANGE_R = 11.4;
put(
  "pintle",
  [0, 0, Z_INJ - 5],
  S(G.disc(M.S_INJ - 10.6, M.S_INJ - 8.2, TIP_R, AXIS, P), { tone: "hi", lit: true }) +
    Dots(G.dotsOf(AXIS, M.S_INJ - 9.4, TIP_R, 14, P, { all: true }), { size: 0.42, tone: "mid" }) +
    S(G.disc(M.S_INJ - 8.2, M.S_INJ - 1.5, STEM_R, AXIS, P), { tone: "hi", crease: "none" }) +
    S(G.ringBand(M.S_INJ - 6.4, M.S_INJ - 1.5, SLEEVE_IN, SLEEVE_OUT, AXIS, P), { tone: "hi" }) +
    Ln(G.arcOf(AXIS, M.S_INJ - 6.4, SLEEVE_OUT, P), { tone: "faint" }) +
    S(G.disc(M.S_INJ - 1.5, M.S_INJ, FLANGE_R, AXIS, P), { tone: "hi" }) +
    Dots(G.dotsOf(AXIS, M.S_INJ, FLANGE_R - 1.3, 10, P, { all: true }), { size: 0.36, tone: "mid" }),
  {
    name: "pintle.body",
    shapes: [
      record(A.disc(AXIS, M.S_INJ - 10.6, M.S_INJ - 8.2, TIP_R, { name: "pintle.tip", owner: "pintle.body" })),
      record(A.disc(AXIS, M.S_INJ - 8.2, M.S_INJ - 1.5, STEM_R, { name: "pintle.stem", owner: "pintle.body" })),
      record(A.ring(AXIS, M.S_INJ - 6.4, M.S_INJ - 1.5, SLEEVE_IN, SLEEVE_OUT, { name: "pintle.sleeve", owner: "pintle.body" })),
      record(A.disc(AXIS, M.S_INJ - 1.5, M.S_INJ, FLANGE_R, { name: "pintle.flange", owner: "pintle.body" })),
    ],
  },
);

put("gimbal", [0, 0, (Z_GIMBAL + Z_GIMBAL_TOP) / 2], S(k.cylinder(0, 0, 6.6, Z_GIMBAL, Z_GIMBAL_TOP - Z_GIMBAL, P, 36, 0.5), { tone: "hi" }) + Ln(k.sideArc(0, 0, 6.6, Z_GIMBAL + 3.5, P, 24), { tone: "faint" }) + Dots(G.dotsOf(FLOOR, Z_GIMBAL_TOP, 5.2, 8, P, { fade: [0.05, 0.4] }), { size: 0.4 }), {
  name: "gimbal.puck",
  shapes: [record(A.cylinder(0, 0, 6.6, Z_GIMBAL, Z_GIMBAL_TOP - Z_GIMBAL, { name: "gimbal.puck" }))],
});
put("stand", [0, 0, (Z_GIMBAL_TOP + BEAM_Z) / 2], S(k.cylinder(0, 0, 6.5, Z_GIMBAL_TOP, BEAM_Z - Z_GIMBAL_TOP, P, 24), { tone: "mid" }) + Ln(k.knurl(0, 0, 6.5, Z_GIMBAL_TOP + 3, Z_GIMBAL_TOP + 8, 28, P), { tone: "lo" }), {
  name: "stand.loadcell",
  shapes: [record(A.cylinder(0, 0, 6.5, Z_GIMBAL_TOP, BEAM_Z - Z_GIMBAL_TOP, { name: "stand.loadcell" }))],
});

const along = G.unit3([1, -1, 0]);
const across = G.unit3([1, 1, 0]);
const beamEnd = 188;
const beamHalf = 16;
const beamRing = [
  G.add3(G.mul3(along, -beamEnd), G.mul3(across, -beamHalf)),
  G.add3(G.mul3(along, beamEnd), G.mul3(across, -beamHalf)),
  G.add3(G.mul3(along, beamEnd), G.mul3(across, beamHalf)),
  G.add3(G.mul3(along, -beamEnd), G.mul3(across, beamHalf)),
].map(([x, y]) => [x, y]);
const beamTop = BEAM_Z + BEAM_H;
put("stand", [0, 0, BEAM_Z + BEAM_H / 2], S(k.extrude(beamRing, BEAM_Z, BEAM_H, P, { bevel: 0.8 }), { tone: "mid" }) + Dots([-160, -80, 0, 80, 160].flatMap((t) => [-1, 1].map((side) => at([...G.add3(G.mul3(along, t), G.mul3(across, side * 9)).slice(0, 2), beamTop]))), { size: 0.42 }), {
  name: "stand.beam",
  shapes: [record(A.orientedBox([0, 0, BEAM_Z + BEAM_H / 2], [along, across, [0, 0, 1]], [beamEnd, beamHalf, BEAM_H / 2], { name: "stand.beam" }))],
});

const u = dir(PUMP_DEG);
const tang = [-u[1], u[0], 0];
const atPump = (radial, z, side = 0) => [u[0] * radial + tang[0] * side, u[1] * radial + tang[1] * side, z];
const TURB_R = 8;
const TURB_C = 64;
const FUEL_C = 86;
const FUEL_R = 7;
const LOX_C = 108;
const LOX_R = 10.5;
const PF = G.frameAlong(atPump(0, PUMP_Z), u);

function pumpBody(name, c, r, s0, s1) {
  const centre = atPump((s0 + s1) / 2 + 0, PUMP_Z);
  const id = nameFor(name);
  put("pump", centre, S(G.disc(s0, s1, r, PF, P), { tone: "hi" }) + Ln(G.arcOf(PF, (s0 + s1) / 2, r, P), { tone: "faint" }), {
    name: id,
    shapes: [record(A.disc(PF, s0, s1, r, { name: id, owner: "pump.train" }))],
  });
}
pumpBody("pump.turbine", TURB_C, TURB_R, TURB_C - TURB_R, TURB_C + TURB_R * 0.8);
put("pump", atPump((RO + TURB_C - TURB_R) / 2, PUMP_Z), S(G.disc(RO - 0.04, TURB_C - TURB_R, 2.6, PF, P), { tone: "mid" }), {
  name: "pump.neck",
  shapes: [record(A.disc(PF, RO - 0.04, TURB_C - TURB_R, 2.6, { name: "pump.neck", owner: "pump.train" }))],
});
put("pump", atPump((TURB_C + TURB_R * 0.8 + FUEL_C - FUEL_R) / 2, PUMP_Z), S(G.disc(TURB_C + TURB_R * 0.8, FUEL_C - FUEL_R, 2.4, PF, P), { tone: "mid" }), {
  name: "pump.shaft-f",
  shapes: [record(A.disc(PF, TURB_C + TURB_R * 0.8, FUEL_C - FUEL_R, 2.4, { name: "pump.shaft-f", owner: "pump.train" }))],
});
pumpBody("pump.fuel", FUEL_C, FUEL_R, FUEL_C - FUEL_R, FUEL_C + FUEL_R);
put("pump", atPump((FUEL_C + FUEL_R + LOX_C - LOX_R) / 2, PUMP_Z), S(G.disc(FUEL_C + FUEL_R, LOX_C - LOX_R, 2.4, PF, P), { tone: "mid" }), {
  name: "pump.shaft-o",
  shapes: [record(A.disc(PF, FUEL_C + FUEL_R, LOX_C - LOX_R, 2.4, { name: "pump.shaft-o", owner: "pump.train" }))],
});
pumpBody("pump.lox", LOX_C, LOX_R, LOX_C - LOX_R, LOX_C + LOX_R);

const GG_R = 4.6;
const GG = atPump(TURB_C, PUMP_Z, TURB_R + GG_R);
put("gg", [GG[0], GG[1], PUMP_Z + 2], S(k.cylinder(GG[0], GG[1], GG_R, PUMP_Z - 4, 14, P, 28, 0.4), { tone: "hi" }) + Ln(k.knurl(GG[0], GG[1], GG_R, PUMP_Z + 6, PUMP_Z + 10, 22, P), { tone: "lo" }) + Ln(k.sideArc(GG[0], GG[1], GG_R, PUMP_Z + 6, P, 18), { tone: "faint" }), {
  name: "gg.can",
  ride: "pump",
  move: PIECES.pump.move,
  shapes: [record(A.cylinder(GG[0], GG[1], GG_R, PUMP_Z - 4, 14, { name: "gg.can" }))],
});

const dumpRadial = TURB_C;
const exBoss = G.frameAlong(atPump(dumpRadial, PUMP_Z - TURB_R), [0, 0, -1]);
const inletZ = PUMP_Z - TURB_R - 34;
const DUMP_F = G.frameAlong(atPump(dumpRadial, inletZ), [0, 0, -1]);
const dumpProf = [[0, 4.8], [3, 4.8], [14, 7.4], [16.5, 7.4]];
put("exhaust", atPump(dumpRadial, inletZ - 8), S(G.solidOf(dumpProf, DUMP_F, P), { tone: "hi" }), {
  name: "exhaust.bell",
  ride: "pump",
  move: PIECES.pump.move,
  shapes: [record(A.solid(DUMP_F, dumpProf, { name: "exhaust.bell" }))],
});
put("pump", G.pointOf(exBoss, 1.4, 0, 0), S(G.disc(0, 2.8, 4.8, exBoss, P), { tone: "hi" }), {
  name: "pump.exhaust-port",
  shapes: [record(A.disc(exBoss, 0, 2.8, 4.8, { name: "pump.exhaust-port", owner: "pump.train" }))],
});
pipe("exhaust", [G.pointOf(exBoss, 2.8, 0, 0), atPump(dumpRadial, inletZ)], 2.4, { flangeR: 1.45, name: "exhaust.duct", ride: "pump", free: [false, false] });

const headZ = PUMP_Z + LOX_R + 22;
function head(radial, name) {
  const p = atPump(radial, headZ);
  put("stand", [p[0], p[1], headZ + 3.5], S(k.cylinder(p[0], p[1], 5.4, headZ, 7, P, 20), { tone: "mid" }), {
    name,
    shapes: [record(A.cylinder(p[0], p[1], 5.4, headZ, 7, { name }))],
  });
}
head(LOX_C, "stand.lox-head");
head(FUEL_C, "stand.fuel-head");
function topPort(pipeR, radial, pumpR, name) {
  const F = G.frameAlong(atPump(radial, PUMP_Z + pumpR), [0, 0, 1]);
  const face = pipeR * 1.45 + 1.1;
  put("pump", G.pointOf(F, 1.4, 0, 0), S(G.disc(0, 2.8, face, F, P), { tone: "hi" }), {
    name,
    shapes: [record(A.disc(F, 0, 2.8, face, { name, owner: "pump.train" }))],
  });
  pipe("stand", [atPump(radial, headZ), G.pointOf(F, 2.8, 0, 0)], pipeR, { flangeR: 1.45, name: `stand.${name}`, free: [false, true] });
}
topPort(3.2, LOX_C, LOX_R, "lox-inlet");
topPort(2.5, FUEL_C, FUEL_R, "fuel-inlet");

const portLocal = 5;
const portR = domeR(portLocal);
const portZ = Z_INJ + M.PLATE + portLocal;
const domeNormal = G.unit3([u[0], u[1], -domeSlope(portLocal)]);
const domeBoss = G.frameAlong(atPump(portR, portZ), domeNormal);
put("dome", G.pointOf(domeBoss, 1.5, 0, 0), S(G.disc(0, 3, 5.6, domeBoss, P), { tone: "hi" }), {
  name: "dome.port",
  shapes: [record(A.disc(domeBoss, 0, 3, 5.6, { name: "dome.port", owner: "dome.body" }))],
});
const loxSide = G.frameAlong(atPump(LOX_C, PUMP_Z, LOX_R), tang);
put("pump", G.pointOf(loxSide, 1.4, 0, 0), S(G.disc(0, 2.8, 5.8, loxSide, P), { tone: "hi" }), {
  name: "pump.lox-port",
  shapes: [record(A.disc(loxSide, 0, 2.8, 5.8, { name: "pump.lox-port", owner: "pump.train" }))],
});
const rise = LOX_R + 18;
pipe(
  "lox",
  [
    G.pointOf(loxSide, 2.8, 0, 0),
    atPump(LOX_C, PUMP_Z, rise),
    atPump(LOX_C, headZ + 36, rise),
    atPump(42, headZ + 36, rise),
    atPump(42, portZ + 16, rise),
    G.pointOf(domeBoss, 22, 0, 0),
    G.pointOf(domeBoss, 3, 0, 0),
  ],
  3.2,
  { name: "lox.discharge", flangeR: 1.45, ride: "pump", free: [false, true], valve: 0.38 },
);

const bossS = 52;
const bossR = M.outerR(bossS);
const bossNormal = G.unit3([...dir(PUMP_DEG).slice(0, 2), -M.outerSlope(bossS)]);
const bossF = G.frameAlong(polar(PUMP_DEG, bossR, Z0 + bossS), bossNormal);
put("nozzle", G.pointOf(bossF, 1.5, 0, 0), S(G.disc(0, 3, 5.2, bossF, P), { tone: "hi" }), {
  name: "nozzle.fuel-port",
  shapes: [record(A.disc(bossF, 0, 3, 5.2, { name: "nozzle.fuel-port", owner: "nozzle.shell" }))],
});
const fuelBoss = G.frameAlong(atPump(FUEL_C, PUMP_Z - FUEL_R), [0, 0, -1]);
put("pump", G.pointOf(fuelBoss, 1.4, 0, 0), S(G.disc(0, 2.8, 5.1, fuelBoss, P), { tone: "hi" }), {
  name: "pump.fuel-port",
  shapes: [record(A.disc(fuelBoss, 0, 2.8, 5.1, { name: "pump.fuel-port", owner: "pump.train" }))],
});
pipe(
  "jacket",
  [G.pointOf(fuelBoss, 2.8, 0, 0), atPump(FUEL_C, Z0 + bossS - 8), G.pointOf(bossF, 20, 0, 0), G.pointOf(bossF, 3, 0, 0)],
  2.6,
  { name: "jacket.downcomer", flangeR: 1.45, ride: "pump", free: [false, true], valve: 0.42 },
);

const CTRL = { x: 78, y: 96, w: 28, d: 16, r: 1.6 };
box("controller", CTRL, 0, 16, {
  name: "controller.box",
  tone: "hi",
  bevel: 0.7,
  extra:
    Ln(k.planOutline(k.insetPlan(CTRL, 2), 16, P), { tone: "faint" }) +
    Ln([0, 1, 2].map((row) => k.lineOnTop([CTRL.x + 4, CTRL.y + 4 + row * 2.6], [CTRL.x + (row === 1 ? 14 : 20), CTRL.y + 4 + row * 2.6], 16, P)).join(""), { tone: "lo", free: true }) +
    Dots(k.corners(CTRL, 2.2).map(([x, y]) => at([x, y, 16])), { size: 0.4 }),
});
const ignZ = Z_CYL + 14;
const ignDeg = AZ + 78;
const ignF = G.frameAlong(polar(ignDeg, RO, ignZ), dir(ignDeg));
put("chamber", G.pointOf(ignF, 1.2, 0, 0), S(G.disc(-0.2, 2.6, 1.7, ignF, P), { tone: "hi" }), {
  name: "chamber.igniter",
  shapes: [record(A.disc(ignF, -0.2, 2.6, 1.7, { name: "chamber.igniter" }))],
});
const bottle = polar(ignDeg, RO + 16, ignZ);
put("chamber", bottle, S(k.cylinder(bottle[0], bottle[1], 2.3, ignZ - 5, 10, P, 16), { tone: "hi" }) + Ln(k.knurl(bottle[0], bottle[1], 2.3, ignZ + 2, ignZ + 5, 14, P), { tone: "lo" }), {
  name: "chamber.teateb",
  shapes: [record(A.cylinder(bottle[0], bottle[1], 2.3, ignZ - 5, 10, { name: "chamber.teateb" }))],
});
const bottleNeck = G.frameAlong(polar(ignDeg, RO, ignZ), dir(ignDeg));
put("chamber", G.pointOf(bottleNeck, 8, 0, 0), S(G.disc(2.4, 13.9, 1.15, bottleNeck, P), { tone: "mid" }), {
  name: "chamber.tea-neck",
  shapes: [record(A.disc(bottleNeck, 2.4, 13.9, 1.15, { name: "chamber.tea-neck", owner: "chamber.igniter" }))],
});

const leverY = -132;
const lever = { x: -70, y: leverY, w: 78, d: 8, r: 1 };
box("stand", lever, 0, 3.2, { name: "stand.rail", tone: "mid", bevel: 0.3 });
const leverTicks = k.topTicks(lever.x + 6, lever.x + lever.w - 6, 7.2, 5, lever.y + 7.2, 3.2, [1.6, 3], P);
put("stand", [lever.x + 39, leverY + 4, 4], Ln(leverTicks.minor, { tone: "lo" }) + Ln(leverTicks.major, { tone: "mid" }), { name: "stand.rail-ticks", shapes: [record(A.box([lever.x, lever.y, 3], [lever.x + lever.w, lever.y + lever.d, 3.4], { name: "stand.rail-ticks", owner: "stand.rail" }))] });
const KNOB_X = lever.x + lever.w - 10;
put("stand", [KNOB_X, leverY + 4, 8], S(k.cylinder(KNOB_X, leverY + 4, 4.2, 3.2, 5, P, 24), { tone: "hi" }) + Ln(k.knurl(KNOB_X, leverY + 4, 4.2, 3.6, 8.2, 22, P), { tone: "lo" }) + Ln(k.lineOnTop([KNOB_X - 2.2, leverY + 4], [KNOB_X + 2.2, leverY + 4], 8.2, P), { tone: "hi" }), {
  name: "stand.knob",
  shapes: [record(A.cylinder(KNOB_X, leverY + 4, 4.2, 3.2, 5, { name: "stand.knob", owner: "stand.rail" }))],
});

const LIP_ARC = G.arcOf(AXIS, 0, M.outerR(0) + 2.2, P, { least: -0.04 });
const DUMP_ARC = G.circleOf(DUMP_F, 16.5, 7.4, P, 28);

items.sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => {
  const [mx, my, mz] = item.move;
  const leverAttr = item.name === "stand.knob" ? ` data-lever="1"` : "";
  return `<g class="it" data-piece="${item.piece}"${item.ride !== item.piece ? ` data-ride="${item.ride}"` : ""} data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(2)},${my.toFixed(2)},${mz.toFixed(2)}" data-i="${index}"${leverAttr}>${item.svg}</g>`;
});

const full = M.performance(1);
const DATA = {
  W,
  H,
  V,
  EX: (() => {
    const o = at([0, 0, 0]);
    const p = at([1, 0, 0]);
    return [p[0] - o[0], p[1] - o[1]];
  })(),
  EY: (() => {
    const o = at([0, 0, 0]);
    const p = at([0, 1, 0]);
    return [p[0] - o[0], p[1] - o[1]];
  })(),
  EZ: (() => {
    const o = at([0, 0, 0]);
    const p = at([0, 0, 1]);
    return [p[0] - o[0], p[1] - o[1]];
  })(),
  camera: glCamera(P),
  zExit: Z0,
  exitR: M.RE,
  coneBase: 5,
  coneTip: 37,
  coneR: 54,
  coneTipR: 4,
  dump: atPump(dumpRadial, inletZ - 16.5),
  dumpR: 7.2,
  knob: { x: KNOB_X, y: leverY + 4, from: lever.x + 8, to: lever.x + lever.w - 10 },
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, piece]) => [id, { name: piece.name, say: piece.say }])),
  stagger: STAGGER,
  spring: SPRING,
  order: ["pintle", "chamber", "nozzle", "pump", "gg", "exhaust", "jacket", "lox", "gimbal", "controller"],
  engine: {
    thrust: full.thrust,
    isp: M.ISP_SL,
    pc: full.pc,
    of: M.OF,
    ofStoich: M.OF_STOICH,
    gg: M.GG_SHARE,
    mass: M.MASS,
    eps: M.EPS,
    exitMach: M.EXIT_MACH,
    cStar: M.CSTAR_IMPLIED,
    cHealthy: M.CSTAR_HEALTHY,
    throttle: M.THROTTLE,
    g0: M.G0,
  },
};

const LABEL =
  "A Merlin 1D hung in a test stand with the chamber wall opened toward you. Liquid oxygen and RP-1 are pumped on one shaft. A small gas generator spins that shaft and dumps its exhaust beside the bell. The rest of the fuel climbs the cooling jacket. Both propellants meet at the pintle, choke at the throat, and leave through a bell of area ratio 16.";

const backSvg = k.figureSvg({
  width: W,
  height: H,
  label: LABEL,
  className: "m1d-back",
  body: back.join("") + `<g class="m1d-fallback" aria-hidden="true"><path d="${G.circleOf(AXIS, -2, M.RE * 0.72, P)}"/></g>`,
});
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg m1d-front" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="m1d-engine">${groups.join("")}</g></svg>`;
const glowSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg m1d-glow" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="m1d-glow-g"><path class="m1d-rim m1d-rim-soft" d="${LIP_ARC}"/><path class="m1d-rim" d="${LIP_ARC}"/><path class="m1d-rim m1d-rim-dump" d="${DUMP_ARC}"/></g></svg>`;

const PARTS = DATA.order.map((id, index) => `<button type="button" class="m1d-part" data-part="${id}"><span class="m1d-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Merlin 1D · gas generator</span><span class="iso-plate-corner" data-corner="readout" data-readout>cold · 470 kg · throttle 100%</span></div>`;
const controls = `<div class="m1d-controls"><button type="button" class="m1d-fire" data-fire><span class="m1d-lamp" aria-hidden="true"></span><span data-fire-label>Ignite</span></button><span class="m1d-hint">Drag sideways to throttle · hover a part · I to ignite</span><span class="m1d-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="m1d-stage" tabindex="0" role="group" aria-label="Merlin 1D on a test stand. Drag sideways or use the left and right arrow keys to throttle from 40 to 100 percent. Hover a part or use the up and down keys to take the engine apart. Press I to ignite, Escape to shut down and close it up." aria-valuemin="40" aria-valuemax="100" aria-valuenow="100" aria-valuetext="Cold, throttle 100 percent">${backSvg}<canvas class="m1d-plume" aria-hidden="true"></canvas>${frontSvg}${glowSvg}<canvas class="m1d-veil" aria-hidden="true"></canvas></div>`;
const caption = `Merlin 1D burns liquid oxygen and RP-1 in an open gas-generator cycle. One shaft carries both pumps. About 3% of the propellant (a teaching estimate, not a published split) burns fuel-rich in the gas generator, spins the turbine, and leaves through the side duct. That dumped stream is what “open” means. The rest of the RP-1 enters low on the bell, climbs channels in the wall, and comes out through the sleeve around the pintle. Oxygen comes down the pintle post. The two sheets meet in the chamber. The throat chokes the gas at Mach 1 no matter where the throttle sits between 40% and 100%. The bell’s area ratio is 16, so at sea level the exit pressure is about ${(info.peBar).toFixed(2)} bar, below the 1.01 bar around it: the plume is over-expanded and a firing shows shock diamonds. The metal is drawn from the published 0.92 m exit and area ratio 16. Thrust and flow come from the published 845 kN and 282 s, so the flow is ${full.mdot.toFixed(0)} kg/s at an oxidiser-to-fuel ratio of 2.36 (stoichiometric for this kerosene is ${M.OF_STOICH.toFixed(2)}, and the engine runs fuel-rich on purpose). Together with the published 9.7 MPa those figures imply a characteristic velocity near ${M.CSTAR_IMPLIED.toFixed(0)} m/s. A LOX/RP-1 chamber usually makes closer to ${M.CSTAR_HEALTHY} m/s, so a designer has to move pressure, throat or thrust until the three agree. That sum is where an engine of your own begins. The gimbal is here because Merlin steers; a more agile nozzle comes later.`;

const body = `<figure class="iso-figure m1d"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="m1d-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;
const CSS = readFileSync(join(HERE, "merlin.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Merlin 1D", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + glScript() + LIVE, width: 980 });
const file = THEME === "light" ? "merlin.html" : "merlin-dark.html";
writeFileSync(join(HERE, file), page);
console.log("wrote", file, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, info);

A.auditOrExit(R, P);
