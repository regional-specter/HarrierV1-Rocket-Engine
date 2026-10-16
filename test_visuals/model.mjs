// Merlin 1D, sea-level, as a single set of numbers.
// Published figures (Wikipedia, Merlin 1D, the Block 5 card):
//   845 kN and 282 s at sea level, 981 kN and 311 s in vacuum,
//   9.7 MPa chamber pressure, area ratio 16, exit diameter 0.92 m,
//   470 kg dry, throttle from 100% down to 40%.
// The geometry below is drawn from the exit diameter and the area ratio.
// Thrust, flow and pressure are drawn from the thrust, the specific impulse
// and the chamber pressure. Those two sets do not close. performance()
// reports the gap, because that is the first sum a designer has to make close.

export const G0 = 9.80665;
export const PA = 101325;

export const F_SL = 845e3;
export const F_VAC = 981e3;
export const ISP_SL = 282;
export const ISP_VAC = 311;
export const PC = 9.7e6;
export const EPS = 16;
export const D_EXIT = 0.92;
export const MASS = 470;
export const THROTTLE = [0.4, 1];

// Operating mixture. Fuel-rich of stoichiometric on purpose: the exhaust
// molecules stay lighter, and the chamber runs cooler than a perfect burn.
// Stoichiometric is for C12H26 + 18.5 O2 → 12 CO2 + 13 H2O.
export const OF = 2.36;
export const OF_STOICH = (18.5 * 32) / (12 * 12 + 26);

// Not a published Merlin split. A gas-generator engine sends a few percent
// of its propellant through the turbine and dumps it. Three percent is the
// teaching estimate used on the card.
export const GG_SHARE = 0.03;

export const GAMMA = 1.2;
export const CSTAR_HEALTHY = 1770;

export const RE = (D_EXIT * 100) / 2;
export const RT = RE / Math.sqrt(EPS);
export const RC = 20;
export const WALL = 3.4;

const DEG = Math.PI / 180;
const RHO = 16;
const DIV_ANG = 30 * DEG;
const CON_ANG = 24 * DEG;
const EXIT_ANG = 10 * DEG;

const arcOf = (theta) => ({
  d: RHO * Math.sin(theta),
  r: RT + RHO * (1 - Math.cos(theta)),
  slope: Math.tan(theta),
});

const div = arcOf(DIV_ANG);
const con = arcOf(CON_ANG);
const SLOPE_E = Math.tan(EXIT_ANG);

export const S_BELL = (RE - div.r) / ((div.slope + SLOPE_E) / 2);
export const S_THROAT = S_BELL + div.d;
const S_ARC = S_THROAT + con.d;
export const S_BLEND = (RC - con.r) / (con.slope / 2);
export const S_CYL = S_ARC + S_BLEND;
export const CYL_H = 28;
export const S_INJ = S_CYL + CYL_H;
export const PLATE = 3.2;
export const DOME = 15.4;
export const S_CROWN = S_INJ + PLATE + DOME;

const bellR = (s) => {
  const delta = S_BELL - s;
  return div.r + div.slope * delta + ((SLOPE_E - div.slope) * delta * delta) / (2 * S_BELL);
};
const bellSlope = (s) => {
  const delta = S_BELL - s;
  return -(div.slope + ((SLOPE_E - div.slope) * delta) / S_BELL);
};
const arcR = (d) => RT + RHO - Math.sqrt(RHO * RHO - d * d);
const arcSlope = (d) => d / Math.sqrt(RHO * RHO - d * d);

export function innerR(s) {
  if (s <= S_BELL) return bellR(s);
  if (s <= S_THROAT) return arcR(S_THROAT - s);
  if (s <= S_ARC) return arcR(s - S_THROAT);
  if (s <= S_CYL) {
    const q = s - S_ARC;
    return con.r + con.slope * q - (con.slope * q * q) / (2 * S_BLEND);
  }
  return RC;
}

export function innerSlope(s) {
  if (s <= S_BELL) return bellSlope(s);
  if (s <= S_THROAT) return -arcSlope(S_THROAT - s);
  if (s <= S_ARC) return arcSlope(s - S_THROAT);
  if (s <= S_CYL) return con.slope * (1 - (s - S_ARC) / S_BLEND);
  return 0;
}

export const outerR = (s) => innerR(s) + WALL;
export const outerSlope = innerSlope;

export function areaMach(mach, gamma = GAMMA) {
  const term = (1 + 0.5 * (gamma - 1) * mach * mach) / ((gamma + 1) / 2);
  return (1 / mach) * term ** ((gamma + 1) / (2 * (gamma - 1)));
}

function machAt(eps, gamma = GAMMA) {
  let lo = 1.01;
  let hi = 6;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (areaMach(mid, gamma) < eps) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const EXIT_MACH = machAt(EPS);

export function pressureRatio(mach, gamma = GAMMA) {
  return (1 + 0.5 * (gamma - 1) * mach * mach) ** (-gamma / (gamma - 1));
}

export const PE = PC * pressureRatio(EXIT_MACH);

const AT = Math.PI * (RT / 100) ** 2;
const MDOT_SL = F_SL / (ISP_SL * G0);

export const CSTAR_IMPLIED = (PC * AT) / MDOT_SL;

export function performance(phi) {
  const share = Math.min(THROTTLE[1], Math.max(THROTTLE[0], phi));
  const thrust = (F_SL * share) / 1000;
  const mdot = thrust / (ISP_SL * G0 / 1000);
  const pc = (PC * share) / 1e6;
  const ox = (mdot * OF) / (1 + OF);
  const fuel = mdot - ox;
  const gg = mdot * GG_SHARE;
  const chamber = mdot - gg;
  return {
    phi: share,
    thrust,
    mdot,
    pc,
    ox,
    fuel,
    gg,
    chamber,
    of: OF,
    throatMach: pc * 1e6 / PA > 1.8 ? 1 : 0,
    exitMach: EXIT_MACH,
    overExpanded: PE < PA,
    cStar: CSTAR_IMPLIED,
  };
}

export function checkContour() {
  const faults = [];
  const pairs = [
    [0, RE],
    [S_BELL, div.r],
    [S_THROAT, RT],
    [S_ARC, con.r],
    [S_CYL, RC],
    [S_INJ, RC],
  ];
  for (const [s, r] of pairs) if (Math.abs(innerR(s) - r) > 1e-6) faults.push(`r(${s}) ${innerR(s)} != ${r}`);
  for (const s of [S_BELL, S_THROAT, S_ARC, S_CYL]) {
    const jump = innerR(s + 1e-4) - innerR(s - 1e-4);
    if (Math.abs(jump) > 1e-3) faults.push(`step at ${s}: ${jump}`);
  }
  if (faults.length) throw new Error(faults.join("; "));
  return {
    sThroat: S_THROAT,
    sCyl: S_CYL,
    sInj: S_INJ,
    sCrown: S_CROWN,
    exitMach: EXIT_MACH,
    peBar: PE / 1e5,
    cStar: CSTAR_IMPLIED,
    mdot: MDOT_SL,
    ofStoich: OF_STOICH,
  };
}
