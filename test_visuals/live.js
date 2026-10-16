const D = __DATA__;
const root = document.querySelector(".m1d");
const stage = root.querySelector(".m1d-stage");
const front = stage.querySelector(".m1d-front");
const engine = front.querySelector(".m1d-engine");
const canvas = stage.querySelector(".m1d-plume");
const veilCanvas = stage.querySelector(".m1d-veil");
const glowGroup = stage.querySelector(".m1d-glow-g");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const fireButton = root.querySelector("[data-fire]");
const fireLabel = root.querySelector("[data-fire-label]");
const partButtons = [...root.querySelectorAll(".m1d-part")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIGHT = document.body.dataset.theme === "light" ? 1 : 0;

const nodes = [...engine.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  ride: el.dataset.ride || el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  lever: el.dataset.lever === "1",
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);
const knob = nodes.find((node) => node.lever);

const IDS = Object.keys(D.pieces);
const STAGGER = D.stagger;
const SPRING = D.spring;
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
const E = D.engine;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

let clock = 0;
let apart = false;
let selected = null;
let phi = 1;
let phiTarget = 1;
let touring = !still.matches;
let tourClock = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let phase = "cold";
const burn = { on: false, armed: false, t: -1, pc: 0, v: 0, dump: 0, dumpV: 0, mainAt: -99 };

const FRAGMENT = `
uniform float uFire;
uniform float uDump;
uniform float uLight;
uniform vec3 uDumpAt;
float ground(float r){
  if(r>=58.) return 0.;
  if(r>=54.) return 5.;
  return 5.+32.*(54.-r)/50.;
}
float plume(vec3 p){
  float z=p.z;
  float lim=ground(length(p.xy));
  if(z>uZExit||z<lim) return 0.;
  float down=(uZExit-z)/max(uZExit-lim,1.);
  float rad=uExitR*(0.92+0.22*down);
  float rr=length(p.xy)/rad;
  float body=exp(-rr*rr*1.35);
  float edge=smoothstep(1.05,0.72,rr);
  float core=exp(-rr*rr*6.5)*exp(-down*1.1);
  float axial=mix(1.,1.25-0.55*smoothstep(0.,1.,rr),uLight);
  return (body*edge*axial+core*1.4)*(1.-smoothstep(0.82,1.,down));
}
float diamonds(vec3 p){
  float z=p.z;
  float lim=ground(length(p.xy));
  float span=uZExit-lim;
  float acc=0.;
  for(int i=0;i<3;i++){
    float s=0.22+float(i)*0.18;
    float zz=uZExit-span*s;
    float rad=uExitR*(0.28+0.08*float(i));
    float dz=(z-zz);
    float rr=length(p.xy);
    float disc=exp(-(rr*rr)/(rad*rad))*exp(-(dz*dz)/(2.2*2.2));
    acc+=disc*(1.-0.22*float(i));
  }
  return acc;
}
float dumpPlume(vec3 p){
  vec3 q=p-uDumpAt;
  float down=-q.z;
  if(down<0.||down>42.) return 0.;
  float rad=uDumpR*(0.85+0.35*down/42.);
  float rr=length(q.xy)/rad;
  return exp(-rr*rr*1.6)*exp(-down/28.)*smoothstep(42.,30.,down);
}
vec3 hot(float e){
  vec3 ember=vec3(0.55,0.12,0.03);
  vec3 body=vec3(0.95,0.42,0.08);
  vec3 yellow=vec3(1.0,0.78,0.28);
  vec3 pale=vec3(1.0,0.96,0.90);
  vec3 c=mix(ember,body,smoothstep(0.02,0.28,e));
  c=mix(c,yellow,smoothstep(0.28,0.62,e));
  c=mix(c,pale,smoothstep(0.62,0.9,e));
  return c;
}
vec4 inkFor(vec3 seen,float cover){
  vec3 absorbed=1.-seen;
  float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);
  return vec4(vec3(a)-absorbed,a);
}
vec4 over(vec4 a,vec4 b){return a+b*(1.-a.a);}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 o=rayOf(vb);
  vec3 V=towardViewer();
  float tG=-o.z/V.z;
  float tLim=tG;
  if(length(o.xy)<60.){
    float ta=(40.-o.z)/max(V.z,1e-4);
    float prev=ta;
    for(int i=1;i<=24;i++){
      float t=mix(ta,tG,float(i)/24.);
      vec3 p=o+t*V;
      if(p.z<ground(length(p.xy))){
        float lo=t;float hi=prev;
        for(int j=0;j<6;j++){float m=(lo+hi)*.5;vec3 q=o+m*V;if(q.z<ground(length(q.xy)))lo=m;else hi=m;}
        tLim=hi;break;
      }
      prev=t;
    }
  }
  float tExit=(uZExit-o.z)/V.z;
  float t0=min(tExit,tLim);
  float t1=max(tExit,tLim);
  vec3 fire=vec3(0.);
  vec3 side=vec3(0.);
  float steps=22.;
  float dt=(t1-t0)/steps;
  if(uFire>0.001&&dt>0.){
    for(int i=0;i<22;i++){
      float t=t0+(float(i)+hash12(gl_FragCoord.xy+float(i)))*dt;
      vec3 p=o+t*V;
      float w=plume(p);
      float dia=diamonds(p)*0.45;
      fire+=hot(clamp(w*1.15,0.,1.))*(w+dia)*dt*8.5;
    }
    fire*=uFire;
  }
  if(uDump>0.001){
    vec3 p=o+dot(uDumpAt-o,V)*V;
    float w=dumpPlume(p);
    side=hot(clamp(w,0.,1.))*w*uDump*1.6;
  }
  vec3 col=fire+side;
  float energy=max(col.r,max(col.g,col.b));
  if(uLight>0.5){
    if(energy<0.004){gl_FragColor=vec4(0.);return;}
    float e=1.-exp(-energy*1.5);
    vec3 seen=hot(clamp(e,0.12,1.));
    float cover=0.78*smoothstep(0.28,0.82,e);
    vec4 ink=inkFor(seen,cover)*smoothstep(0.0,0.1,e);
    float n=(hash12(gl_FragCoord.xy+fract(uTime*0.37)*40.)-0.5)/255.;
    ink.rgb=min(ink.rgb+n*smoothstep(0.,1.5/255.,ink.a),ink.a);
    if(ink.a<1./255.){gl_FragColor=vec4(0.);return;}
    gl_FragColor=ink;
    return;
  }
  col=tonemap(col,1.15);
  float m=max(col.r,max(col.g,col.b));
  float n=(hash12(gl_FragCoord.xy+fract(uTime*0.61)*91.)-0.5)/255.;
  col=max(col+n*smoothstep(0.,1.5/255.,m),0.);
  float a=max(col.r,max(col.g,col.b));
  gl_FragColor=vec4(col,a);
}
`;

const FIXED = {
  uZExit: D.zExit,
  uExitR: D.exitR,
  uDumpR: D.dumpR,
  uLight: LIGHT,
};
let layer = null;
let veil = null;
function mountGL() {
  if (layer || !canvas) return;
  layer = glLayer({ canvas, fragment: `uniform float uZExit;uniform float uExitR;uniform float uDumpR;${FRAGMENT}`, view: [D.W, D.H], camera: D.camera, uniforms: ["uFire", "uDump", "uDumpAt"], fixed: FIXED, maxRatio: 1.5 });
  if (layer) stage.dataset.gl = "1";
}

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function announce(text) {
  if (live.textContent !== text) live.textContent = text;
}
function numbers(share) {
  const thrust = E.thrust * share;
  const mdot = (thrust * 1000) / (E.isp * E.g0);
  const pc = E.pc * share;
  return { thrust, mdot, pc };
}
function readoutOf() {
  const moving = IDS.some((id) => Math.abs(piece[id].x - piece[id].target) > 2e-3 || piece[id].v !== 0 || piece[id].pending);
  if (moving && apart) return "taking apart";
  if (moving && !apart) return "closing up";
  if (selected && apart) return D.pieces[selected].say;
  const n = numbers(phi);
  if (burn.on && burn.pc > 0.04) return `firing · ${n.thrust.toFixed(0)} kN · ${n.mdot.toFixed(0)} kg/s · Pc ${n.pc.toFixed(1)} MPa · throat Mach 1`;
  return `cold · ${E.mass} kg · throttle ${(phi * 100).toFixed(0)}% · would be ${n.thrust.toFixed(0)} kN`;
}
function describe() {
  const text = selected ? D.pieces[selected].name : burn.on ? "Firing" : apart ? "Apart" : `Throttle ${(phi * 100).toFixed(0)} percent`;
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  stage.setAttribute("aria-valuenow", String(Math.round(phi * 100)));
}

function setApart(on) {
  if (apart === on) return;
  apart = on;
  const goal = on ? 1 : 0;
  let index = 0;
  for (const id of on ? STAGGER : [...STAGGER].reverse()) {
    if (piece[id].target === goal) piece[id].pending = null;
    else piece[id].pending = { value: goal, at: clock + (still.matches ? 0 : index++ * SPRING.stagger) };
  }
  describe();
  run();
}
function select(id) {
  if (id === "stand") id = null;
  if (selected === id && id) return;
  selected = id;
  for (const node of nodes) {
    if (id && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  describe();
}
function steerSpring(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  for (let index = 0; index < SPRING.substeps; index++) {
    const h = dt / SPRING.substeps;
    state.v += ((state.target - state.x) * SPRING.stiffness - state.v * SPRING.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  return true;
}
function knobShift() {
  const span = D.knob.to - D.knob.from;
  const dx = (D.knob.from - D.knob.to) * ((1 - phi) / (1 - E.throttle[0]));
  return [D.EX[0] * dx, D.EX[1] * dx];
}
function place() {
  const shift = knob ? knobShift() : [0, 0];
  for (const node of nodes) {
    const share = piece[node.ride].x;
    let tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    let ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    if (node.lever) {
      tx += shift[0];
      ty += shift[1];
    }
    const text = Math.abs(tx) < 0.01 && Math.abs(ty) < 0.01 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].key + nodes[a].lift * piece[nodes[a].ride].x - (nodes[b].key + nodes[b].lift * piece[nodes[b].ride].x));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    engine.appendChild(fragment);
    order = next;
  }
}
function springTo(state, target, dt, calm) {
  if (calm) {
    state.x = target;
    state.v = 0;
    return false;
  }
  const w = 1 / 0.45;
  for (let i = 0; i < 4; i++) {
    const h = dt / 4;
    state.v += (w * w * (target - state.x) - 2 * w * state.v) * h;
    state.x += state.v * h;
  }
  if (Math.abs(target - state.x) < 1e-4 && Math.abs(state.v) < 1e-4) {
    state.x = target;
    state.v = 0;
    return false;
  }
  return true;
}
function drawFire() {
  const fire = burn.pc;
  const dump = burn.dump;
  glowGroup.style.setProperty("--rim", fire.toFixed(3));
  glowGroup.style.setProperty("--dump", dump.toFixed(3));
  mountGL();
  if (!layer) return;
  if (fire < 1e-3 && dump < 1e-3) {
    layer.clear();
    return;
  }
  layer.draw({ uFire: fire, uDump: dump, uDumpAt: D.dump }, still.matches ? 0.8 : clock);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring && !burn.on) {
    tourClock += dt;
    const lap = tourClock % 28;
    if (lap < 8) phiTarget = 1 - (1 - E.throttle[0]) * (0.5 - 0.5 * Math.cos((Math.PI * lap) / 8));
    else if (lap < 16) phiTarget = E.throttle[0] + (1 - E.throttle[0]) * (0.5 - 0.5 * Math.cos((Math.PI * (lap - 8)) / 8));
    else if (lap < 18) phiTarget = 1;
    else if (lap < 26) {
      if (!apart) setApart(true);
    } else if (apart) setApart(false);
  }
  phi += (phiTarget - phi) * (calm ? 1 : 1 - Math.exp(-dt / 0.28));
  if (Math.abs(phiTarget - phi) < 1e-3) phi = phiTarget;
  let moving = false;
  for (const id of IDS) if (steerSpring(piece[id], dt, calm)) moving = true;
  if (burn.armed && !IDS.some((id) => piece[id].x > 1e-3 || piece[id].pending)) {
    burn.armed = false;
    burn.on = true;
    burn.t = clock;
    burn.mainAt = clock;
    fireButton.dataset.state = "on";
    fireLabel.textContent = "Shut down";
    if (phase !== "firing") {
      phase = "firing";
      announce("Ignition. Main chamber firing.");
    }
  }
  const age = burn.on ? clock - burn.t : 1e9;
  const dumpTarget = burn.on ? (age > 0.15 ? phi : 0) : 0;
  const fireTarget = burn.on ? (age > 0.45 ? phi : 0) : 0;
  if (springTo(burn, fireTarget, dt, calm)) moving = true;
  burn.pc = burn.x ?? burn.pc;
  if (burn.x === undefined) burn.x = burn.pc;
  const dumpState = { x: burn.dump, v: burn.dumpV };
  if (springTo(dumpState, dumpTarget, dt, calm)) moving = true;
  burn.dump = dumpState.x;
  burn.dumpV = dumpState.v;
  if (!burn.on && burn.pc < 1e-3 && burn.dump < 1e-3 && phase === "firing") {
    phase = "cold";
    announce("Shutdown. Chamber cold.");
    fireButton.dataset.state = "";
    fireLabel.textContent = "Ignite";
  }
  place();
  drawFire();
  say(readoutOf());
  const settled = !moving && !touring && phi === phiTarget && !burn.on && burn.pc === 0 && burn.dump === 0;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
function takeOver() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    touring = !still.matches;
    tourClock = 0;
    run();
  }, 3600);
  run();
}
function ignite() {
  takeOver();
  if (burn.on) {
    burn.on = false;
    burn.armed = false;
    return;
  }
  if (apart || IDS.some((id) => piece[id].x > 0.02 || piece[id].pending)) {
    burn.armed = true;
    setApart(false);
    select(null);
    fireButton.dataset.state = "armed";
    announce("Closing up, then ignition.");
    return;
  }
  burn.armed = true;
  fireButton.dataset.state = "armed";
  run();
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const hit = event.target.closest?.(".it");
  if (hit && hit.dataset.piece && hit.dataset.piece !== "stand") {
    select(hit.dataset.piece);
    setApart(true);
    takeOver();
    return;
  }
  const box = front.getBoundingClientRect();
  const share = clamp((event.clientX - box.left) / box.width, 0.08, 0.92);
  phiTarget = E.throttle[0] + ((share - 0.08) / 0.84) * (1 - E.throttle[0]);
  takeOver();
});
stage.addEventListener("pointerleave", () => {
  setApart(false);
  select(null);
});
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") phiTarget = clamp(phi - (event.shiftKey ? 0.2 : 0.05), E.throttle[0], 1);
  else if (event.key === "ArrowRight") phiTarget = clamp(phi + (event.shiftKey ? 0.2 : 0.05), E.throttle[0], 1);
  else if (event.key === "Home") phiTarget = E.throttle[0];
  else if (event.key === "End") phiTarget = 1;
  else if (event.key === "i" || event.key === "I" || event.key === "Enter") ignite();
  else if (event.key === "Escape") {
    burn.on = false;
    burn.armed = false;
    setApart(false);
    select(null);
  } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const ids = D.order;
    const here = Math.max(0, ids.indexOf(selected));
    const next = event.key === "ArrowDown" ? Math.min(ids.length - 1, here + 1) : Math.max(0, here - 1);
    select(ids[next]);
    setApart(true);
  } else return;
  event.preventDefault();
  takeOver();
});
fireButton.addEventListener("click", (event) => {
  event.stopPropagation();
  ignite();
});
partButtons.forEach((button) => button.addEventListener("click", () => {
  select(button.dataset.part);
  setApart(true);
  takeOver();
}));
if (still.matches) touring = false;
burn.x = 0;
say(readoutOf());
describe();
run();
