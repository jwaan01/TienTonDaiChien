// Fight engine: fighters, combat, projectiles, effects, HUD and round flow.
// Logical canvas is 960x540; everything runs at a fixed 60 steps per second.
import { byId } from "./data.js";

export const W = 960, H = 540, FLOOR = 472;
const GRAV = 0.78, WALL_L = 40, WALL_R = W - 40;
const COL = {
  ink: "#0b0b0d", ink2: "#1d1d22", red: "#e3203b", redDeep: "#b3121f", white: "#ffffff",
  volt: "#ffd60a", cyan: "#00d2e0", mute: "#b9b9c2", paper: "#fbf8f1",
};

// ------------------------------------------------------------------ assets
const imgCache = new Map();
export function loadImage(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("Không tải được " + src));
      im.src = src;
    }));
  }
  return imgCache.get(src);
}
let spriteIndex = null, fxMeta = null;
export async function loadIndex() {
  if (!spriteIndex) {
    [spriteIndex, fxMeta] = await Promise.all([
      fetch("assets/sprites.json").then((r) => r.json()),
      fetch("assets/fx.json").then((r) => r.json()),
    ]);
  }
  return spriteIndex;
}
export async function loadCharacter(id) {
  const idx = await loadIndex();
  const e = idx[id];
  const [atlas, cutin, face] = await Promise.all([
    loadImage(e.atlas), loadImage(`assets/${id}_cutin.webp`), loadImage(`assets/${id}_face.webp`),
  ]);
  return { anims: e.anims, atlas, cutin, face };
}

// ------------------------------------------------------------------- input
export const KEYMAPS = {
  p1: { left: ["KeyA"], right: ["KeyD"], jump: ["KeyW", "KeyK"], guard: ["KeyS"], atk: ["KeyJ"], dash: ["KeyL"], spc: ["KeyU"], ult: ["KeyI"] },
  p2: { left: ["ArrowLeft"], right: ["ArrowRight"], jump: ["ArrowUp", "Numpad2", "Digit2"], guard: ["ArrowDown"], atk: ["Numpad1", "Digit1"], dash: ["Numpad3", "Digit3"], spc: ["Numpad4", "Digit4"], ult: ["Numpad5", "Digit5"] },
};
export class Keyboard {
  constructor() {
    this.down = new Set();
    this.onDown = (e) => {
      if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
      this.down.add(e.code);
    };
    this.onUp = (e) => this.down.delete(e.code);
    this.onBlur = () => this.down.clear();
    addEventListener("keydown", this.onDown);
    addEventListener("keyup", this.onUp);
    addEventListener("blur", this.onBlur);
  }
  controller(map) {
    return { read: () => Object.fromEntries(Object.entries(map).map(([k, codes]) => [k, codes.some((c) => this.down.has(c))])) };
  }
  dispose() {
    removeEventListener("keydown", this.onDown);
    removeEventListener("keyup", this.onUp);
    removeEventListener("blur", this.onBlur);
  }
}

// ------------------------------------------------------------------- audio
class Sfx {
  constructor() { this.ctx = null; this.muted = false; }
  unlock() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ } }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }
  noise(dur, freq, gain) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = "lowpass"; f.frequency.value = freq; g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination); src.start();
  }
  tone(f0, f1, dur, type = "square", gain = 0.08) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(t + dur);
  }
  hit(heavy) { this.noise(heavy ? 0.22 : 0.1, heavy ? 1400 : 2600, heavy ? 0.5 : 0.32); this.tone(heavy ? 160 : 260, 60, 0.12, "triangle", 0.18); }
  block() { this.tone(900, 500, 0.08, "square", 0.05); this.noise(0.05, 5000, 0.12); }
  whoosh() { this.noise(0.18, 900, 0.14); }
  shoot() { this.tone(520, 180, 0.25, "sawtooth", 0.05); }
  cutin() { this.tone(200, 1400, 0.35, "sawtooth", 0.06); this.noise(0.4, 3000, 0.2); }
  ko() { this.tone(300, 40, 0.9, "sawtooth", 0.12); this.noise(0.8, 600, 0.45); }
  select() { this.tone(660, 990, 0.07, "square", 0.04); }
}
export const sfx = new Sfx();

// --------------------------------------------------------------------- fighter
const ATK = [ // three-hit combo: frames in the combo row, timing, damage
  { frames: [0, 1], wind: 5, active: 6, rec: 9, dmg: 34, reach: [18, 96] },
  { frames: [2, 3], wind: 5, active: 6, rec: 9, dmg: 40, reach: [18, 104] },
  { frames: [4, 5], wind: 7, active: 7, rec: 16, dmg: 72, reach: [18, 118], launch: true },
];

class Fighter {
  constructor(game, side, def, sprites, ctrl) {
    this.game = game; this.side = side; this.ctrl = ctrl;
    this.base = def; this.baseSprites = sprites;
    this.def = def; this.sprites = sprites;
    this.maxHp = def.hp; this.hp = def.hp; this.ghost = def.hp;
    this.energy = 100; this.wins = 0;
    this.form = null; this.formT = 0;
    this.reset(side);
  }
  reset(side) {
    this.x = side === 0 ? 300 : W - 300; this.y = FLOOR; this.vx = 0; this.vy = 0;
    this.face = side === 0 ? 1 : -1;
    this.state = "idle"; this.t = 0; this.step = 0; this.queued = false; this.hitDone = false;
    this.stun = 0; this.inv = 0; this.prev = {}; this.flash = 0;
    this.hp = this.maxHp; this.ghost = this.maxHp; this.ghostWait = 0;
    if (this.form) this.endForm();
  }
  get scale() { return this.def.drawScale || 1; }
  get opp() { return this.game.fighters[1 - this.side]; }
  get grounded() { return this.y >= FLOOR - 0.01; }
  hurtbox() {
    const s = this.scale, lying = this.state === "down" || this.state === "ko";
    return lying ? { x: this.x - 60, y: this.y - 40, w: 120, h: 40 } : { x: this.x - 28 * s, y: this.y - 140 * s, w: 56 * s, h: 140 * s };
  }
  set(state) { this.state = state; this.t = 0; this.hitDone = false; }

  startForm(id, sprites) {
    this.form = byId(id); this.formT = this.form.duration;
    this.def = { ...this.form, hp: this.base.hp };
    this.sprites = sprites;
  }
  endForm() {
    this.form = null; this.def = this.base; this.sprites = this.baseSprites;
  }

  input() {
    const now = this.game.controlsLive ? this.ctrl.read() : {};
    const edge = {};
    for (const k of ["jump", "atk", "dash", "spc", "ult"]) edge[k] = now[k] && !this.prev[k];
    this.prev = now;
    return { held: now, edge };
  }

  update() {
    const g = this.game;
    const { held, edge } = this.input();
    this.t++;
    if (this.inv > 0) this.inv--;
    if (this.flash > 0) this.flash--;
    if (this.form && --this.formT <= 0 && this.grounded && ["idle", "walk", "guard"].includes(this.state)) {
      this.endForm(); g.spawnFx("speedring", this.x, this.y - 80, 1.4); g.banner("HỒN THỂ TAN", 50);
    }
    this.energy = Math.min(300, this.energy + 0.07);
    if (this.ghostWait > 0) this.ghostWait--; else if (this.ghost > this.hp) this.ghost = Math.max(this.hp, this.ghost - 6);

    const free = ["idle", "walk", "guard"].includes(this.state);
    if (free || this.state === "air") this.face = this.opp.x >= this.x ? 1 : -1;

    switch (this.state) {
      case "idle": case "walk": case "guard": {
        const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
        if (edge.ult && this.energy >= 300) return this.startUltimate();
        if (edge.spc && this.energy >= 100) { this.energy -= 100; return this.set("special"); }
        if (edge.atk) { this.step = 0; this.queued = false; return this.set("attack"); }
        if (edge.dash) { this.dashDir = dir || this.face; g.sfx.whoosh(); g.spawnFx("dust", this.x - this.dashDir * 30, this.y - 20, 0.5, this.dashDir < 0); return this.set("dash"); }
        if (edge.jump) { this.vx = dir * this.def.speed * 1.1; return this.set("jumpStart"); }
        if (held.guard) { this.vx = 0; if (this.state !== "guard") this.set("guard"); break; }
        if (dir) { this.vx = dir * this.def.speed; if (this.state !== "walk") this.set("walk"); }
        else { this.vx = 0; if (this.state !== "idle") this.set("idle"); }
        break;
      }
      case "jumpStart":
        if (this.t >= 4) { this.vy = -15.5; this.y -= 1; this.set("air"); }
        break;
      case "air":
        if (edge.atk && !this.airAtk) { this.airAtk = true; this.set("airAttack"); }
        break;
      case "airAttack":
        if (this.t >= 4 && this.t <= 12 && !this.hitDone) this.tryHit({ dmg: 38, reach: [10, 92], yr: [-150, 10] }, false);
        if (this.grounded && this.t > 2) this.land();
        break;
      case "dash":
        this.vx = this.dashDir * 13; if (this.t <= 9) this.inv = 2;
        if (this.t >= 13) { this.vx = 0; this.set("idle"); }
        break;
      case "attack": {
        const a = ATK[this.step], total = a.wind + a.active + a.rec;
        if (edge.atk && this.t > a.wind) this.queued = true;
        this.vx = this.t < a.wind + a.active ? this.face * 1.6 : 0;
        if (this.t > a.wind && this.t <= a.wind + a.active && !this.hitDone)
          this.tryHit({ dmg: a.dmg, reach: a.reach, yr: [-130, -30], launch: a.launch, heavy: a.launch }, true);
        if (this.t >= a.wind + a.active + 3 && this.queued && this.step < 2) {
          this.step++; this.queued = false; this.set("attack");
        } else if (this.t >= total) { this.vx = 0; this.set("idle"); }
        break;
      }
      case "special":
        this.vx = 0;
        if (this.t === 13) this.fireProjectile();
        if (this.t >= 34) this.set("idle");
        break;
      case "ultimate": {
        this.vx = 0;
        if (this.t === 28) this.ultimateHit();
        if (this.t >= 58) this.set("idle");
        break;
      }
      case "hurt": case "block":
        this.vx *= 0.82;
        if (--this.stun <= 0) this.set("idle");
        break;
      case "launched":
        if (this.grounded && this.t > 3) {
          this.vy = 0; this.vx = 0; this.set(this.hp <= 0 ? "ko" : "down");
          g.shake = Math.max(g.shake, 6); g.spawnFx("dust", this.x, this.y - 18, 0.8); g.sfx.hit(false);
        }
        break;
      case "down":
        if (this.t >= 38) { this.inv = 26; this.set("getup"); }
        break;
      case "getup":
        if (this.t >= 18) this.set("idle");
        break;
      case "win": case "ko":
        this.vx = 0;
        break;
    }

    // physics
    if (!this.grounded || this.vy < 0) {
      this.vy += GRAV; this.y += this.vy;
      if (this.y >= FLOOR) {
        this.y = FLOOR;
        if (this.state === "air") this.land();
        if (this.state === "launched") { /* handled above next frame */ }
      }
    }
    this.x += this.vx;
    this.x = Math.max(WALL_L, Math.min(WALL_R, this.x));
  }
  land() {
    this.vy = 0; this.vx = 0; this.airAtk = false; this.set("idle");
    this.game.spawnFx("dust", this.x, this.y - 14, 0.45);
  }

  tryHit(a, ground) {
    const o = this.opp, s = this.scale;
    const hb = { x: this.face > 0 ? this.x + a.reach[0] * s : this.x - a.reach[1] * s, y: this.y + a.yr[0] * s, w: (a.reach[1] - a.reach[0]) * s, h: (a.yr[1] - a.yr[0]) * s };
    if (overlap(hb, o.hurtbox())) {
      this.hitDone = true;
      this.game.resolveHit(this, o, { dmg: a.dmg * this.def.power, launch: a.launch || !o.grounded, heavy: a.heavy, x: o.x - this.face * 10, y: this.y - 90 * s });
    }
  }
  fireProjectile() {
    const sp = this.def.special, frame = this.sprites.anims.special[5] || this.sprites.anims.special[4];
    const ground = sp.ground || frame.h > 110;
    this.game.projectiles.push({
      owner: this, x: this.x + this.face * 60, y: ground ? FLOOR : this.y - 82 * this.scale, vx: this.face * sp.speed,
      dmg: sp.dmg * this.def.power, frame, img: this.sprites.atlas, face: this.face, ground, life: 140, size: sp.size || 1,
    });
    this.game.sfx.shoot();
  }
  startUltimate() {
    this.energy -= 300;
    this.set("ultimate");
    this.game.startCutin(this);
  }
  ultimateHit() {
    const g = this.game, o = this.opp, u = this.def.ultimate;
    g.shake = 16; g.flash = 10;
    const dx = (o.x - this.x) * this.face;
    if (dx > -40 && dx < u.range && o.state !== "down" && o.state !== "ko" && o.inv <= 0)
      g.resolveHit(this, o, { dmg: u.dmg, launch: true, heavy: true, ultimate: true, x: o.x, y: o.y - 80 });
    if (this.base.transform && !this.form) g.transform(this);
  }

  frame() {
    const A = this.sprites.anims, t = this.t;
    const loop = (arr, d) => arr[Math.floor(t / d) % arr.length];
    const seq = (arr, d) => arr[Math.min(arr.length - 1, Math.floor(t / d))];
    switch (this.state) {
      case "idle": return loop(A.idle, 9);
      case "walk": return loop(A.run, 6);
      case "guard": case "block": return A.move[3];
      case "jumpStart": return A.move[0];
      case "air": return this.vy < 0 ? A.move[1] : A.move[2];
      case "airAttack": return A.combo[t < 4 ? 0 : 1];
      case "dash": return A.move[4 + (Math.floor(t / 6) % 2)];
      case "attack": { const a = ATK[this.step]; return A.combo[a.frames[t < a.wind ? 0 : 1]]; }
      case "special": return seq(A.special.slice(0, 5), 7);
      case "ultimate": return seq(A.ultimate, 10);
      case "hurt": return A.damage[Math.floor(t / 6) % 2];
      case "launched": return A.damage[2];
      case "down": case "ko": return A.damage[3];
      case "getup": return A.damage[4];
      case "win": return A.damage[5];
    }
    return A.idle[0];
  }
  draw(ctx) {
    const f = this.frame();
    if (!f) return;
    const s = this.scale;
    // ground shadow
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(this.x, FLOOR + 2, 46 * s * (1 - Math.min(0.5, (FLOOR - this.y) / 400)), 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    if (this.inv > 0 && this.state === "getup" && (this.t >> 2) % 2) ctx.globalAlpha = 0.55;
    ctx.translate(this.x, 0);
    if (this.face < 0) ctx.scale(-1, 1);
    const dw = f.w * s, dh = f.h * s;
    ctx.drawImage(this.sprites.atlas, f.x, f.y, f.w, f.h, -f.ax * s, this.y - f.ay * s, dw, dh);
    ctx.restore();
  }
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// --------------------------------------------------------------------- AI
const LEVELS = { easy: { react: 24, guard: 0.15, aggr: 0.45 }, normal: { react: 14, guard: 0.38, aggr: 0.65 }, hard: { react: 7, guard: 0.62, aggr: 0.85 } };
export class AIController {
  constructor(level = "normal") { this.L = LEVELS[level] || LEVELS.normal; this.hold = {}; this.timer = 0; this.press = {}; }
  bind(me) { this.me = me; }
  read() {
    const out = { left: false, right: false, jump: false, guard: false, atk: false, dash: false, spc: false, ult: false };
    const me = this.me;
    if (!me) return out;
    const o = me.opp, L = this.L, g = me.game;
    const dx = o.x - me.x, d = Math.abs(dx), toward = dx > 0 ? "right" : "left", away = dx > 0 ? "left" : "right";
    // keep pressing attack during a combo
    if (me.state === "attack" && me.t % 6 === 0 && Math.random() < L.aggr + 0.1) out.atk = true;
    if (--this.timer > 0) { Object.assign(out, this.hold); return out; }
    this.timer = L.react + Math.floor(Math.random() * L.react);
    this.hold = {};
    const threat = (["attack", "airAttack"].includes(o.state) && d < 150) || (o.state === "ultimate" && d < 400) ||
      g.projectiles.some((p) => p.owner === o && Math.sign(p.vx) === Math.sign(me.x - p.x) && Math.abs(p.x - me.x) < 260);
    const r = Math.random();
    if (threat && r < L.guard) { this.hold = { guard: true }; this.timer = 18; }
    else if (threat && r < L.guard + 0.12) { this.hold = { jump: true, [toward]: true }; this.timer = 4; }
    else if (me.energy >= 300 && d < me.def.ultimate.range * 0.8 && r < 0.55) { this.hold = { ult: true }; this.timer = 3; }
    else if (me.energy >= 100 && d > 200 && r < 0.4) { this.hold = { spc: true }; this.timer = 3; }
    else if (d > 115) {
      if (r < 0.14) { this.hold = { dash: true, [toward]: true }; this.timer = 3; }
      else if (r < 0.22) { this.hold = { jump: true, [toward]: true }; this.timer = 4; }
      else this.hold = { [toward]: true };
    } else if (r < L.aggr) { this.hold = { atk: true }; this.timer = 3; }
    else if (r < L.aggr + 0.15) { this.hold = { [away]: true }; }
    else this.hold = { guard: true };
    Object.assign(out, this.hold);
    return out;
  }
}

// ----------------------------------------------------------------------- game
export class Game {
  constructor(canvas, { p1, p2, c1, c2, stage, fx, onEnd, rounds = 2 }) {
    this.cv = canvas; this.ctx = canvas.getContext("2d");
    this.stage = stage; this.fxImg = fx; this.fxMeta = fxMeta; this.onEnd = onEnd; this.toWin = rounds;
    this.sfx = sfx;
    this.fighters = [new Fighter(this, 0, p1.def, p1.sprites, c1), new Fighter(this, 1, p2.def, p2.sprites, c2)];
    for (const f of this.fighters) if (f.ctrl.bind) f.ctrl.bind(f);
    this.formSprites = {};
    this.round = 1; this.particles = []; this.projectiles = []; this.texts = [];
    this.shake = 0; this.flash = 0; this.hitstop = 0; this.cutin = null; this.paused = false;
    this.startRound();
    this.last = performance.now(); this.acc = 0; this.running = true;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }
  preloadForms() {
    for (const f of this.fighters) {
      const t = f.base.transform;
      if (t && !this.formSprites[t]) loadCharacter(t).then((s) => { this.formSprites[t] = s; });
    }
  }
  startRound() {
    this.preloadForms();
    for (const f of this.fighters) f.reset(f.side);
    this.projectiles = []; this.particles = [];
    this.timer = 99 * 60; this.phase = "intro"; this.phaseT = 0;
    this.banner(`HIỆP ${this.round}`, 70);
  }
  get controlsLive() { return this.phase === "fight" && !this.cutin; }
  banner(text, life, big = true) { this.texts.push({ text, life, max: life, big }); }
  spawnFx(name, x, y, scale = 1, flip = false) {
    if (!this.fxMeta[name]) return;
    this.particles.push({ name, x, y, scale, life: 18, max: 18, flip, rot: (Math.random() - 0.5) * 0.6 });
  }
  transform(f) {
    const id = f.base.transform, s = this.formSprites[id];
    if (!s) return;
    f.startForm(id, s);
    this.spawnFx("speedring", f.x, f.y - 90, 2.2);
    this.banner("HÓA HỒN THÚ!", 60);
  }
  startCutin(f) {
    this.cutin = { f, t: 0, img: f.sprites.cutin, name: f.def.ultimate.name, side: f.side };
    this.sfx.cutin();
  }
  resolveHit(att, def, h) {
    if (def.inv > 0 || ["ko", "down", "getup"].includes(def.state)) return;
    const facingAtt = def.face === -att.face || Math.sign(att.x - def.x) === def.face;
    const blocking = (def.state === "guard" || def.state === "block") && def.grounded && facingAtt && !h.ultimate;
    if (blocking) {
      const chip = h.dmg * 0.12;
      def.hp = Math.max(1, def.hp - chip); def.ghostWait = 40;
      def.set("block"); def.stun = 12; def.vx = att.face * 5;
      def.energy = Math.min(300, def.energy + 8);
      this.spawnFx("guard", def.x - att.face * 18, h.y, 0.55, att.face < 0);
      this.sfx.block(); this.hitstop = 4;
      return;
    }
    def.hp = Math.max(0, def.hp - h.dmg); def.ghostWait = 40;
    att.energy = Math.min(300, att.energy + (h.ultimate ? 0 : 14));
    def.energy = Math.min(300, def.energy + 9);
    if (att.def.steal && h.projectile) { const st = Math.min(40, def.energy); def.energy -= st; att.energy = Math.min(300, att.energy + st); }
    def.flash = 6; def.airAtk = false;
    if (h.launch || def.hp <= 0) {
      def.set("launched"); def.vy = h.ultimate ? -12 : -9; def.vx = att.face * (h.ultimate ? 7 : 5.5); def.y -= 2;
    } else {
      def.set("hurt"); def.stun = h.projectile ? 22 : 18; def.vx = att.face * (h.heavy ? 6 : 3.5);
    }
    this.hitstop = h.ultimate ? 12 : h.heavy ? 8 : 5;
    this.shake = Math.max(this.shake, h.ultimate ? 14 : h.heavy ? 8 : 4);
    this.spawnFx(h.ultimate || h.heavy ? "crit" : "impact", h.x, h.y, h.ultimate ? 1.1 : h.heavy ? 0.7 : 0.45, att.face < 0);
    if (h.heavy) this.spawnFx("slash", h.x, h.y, 0.55, att.face < 0);
    this.sfx.hit(h.heavy || h.ultimate);
    if (def.hp <= 0 && this.phase === "fight") this.ko(att);
  }
  ko(winner) {
    this.phase = "ko"; this.phaseT = 0; this.winner = winner;
    winner.wins++;
    this.banner("K.O.!!", 110); this.sfx.ko(); this.flash = 16;
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(100, now - this.last); this.last = now;
    if (!this.paused) {
      this.acc += dt;
      while (this.acc >= 1000 / 60) { this.step(); this.acc -= 1000 / 60; }
    }
    this.render();
    requestAnimationFrame(this.loop);
  }
  step() {
    if (this.cutin) {
      if (++this.cutin.t >= 72) this.cutin = null;
      return;
    }
    if (this.hitstop > 0) { this.hitstop--; this.decay(); return; }
    const slow = this.phase === "ko" && this.phaseT < 50 && this.phaseT % 3 !== 0;
    this.phaseT++;
    if (this.phase === "intro") {
      if (this.phaseT === 72) this.banner("CHIẾN!", 44);
      if (this.phaseT >= 110) { this.phase = "fight"; this.phaseT = 0; }
    } else if (this.phase === "fight") {
      if (--this.timer <= 0) {
        const [a, b] = this.fighters;
        const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
        this.phase = "ko"; this.phaseT = 60; this.winner = ra === rb ? null : ra > rb ? a : b;
        if (this.winner) this.winner.wins++;
        this.banner("HẾT GIỜ", 90);
      }
    } else if (this.phase === "ko") {
      if (this.phaseT === 90 && this.winner) this.winner.set("win");
      if (this.phaseT >= 200) return this.nextRound();
    }
    if (slow) { this.decay(); return; }
    for (const f of this.fighters) f.update();
    this.separate();
    this.updateProjectiles();
    this.decay();
  }
  decay() {
    if (this.shake > 0) this.shake *= 0.86;
    if (this.shake < 0.4) this.shake = 0;
    if (this.flash > 0) this.flash--;
    this.particles = this.particles.filter((p) => --p.life > 0);
    this.texts = this.texts.filter((t) => --t.life > 0);
  }
  separate() {
    const [a, b] = this.fighters;
    if (!a.grounded || !b.grounded || a.state === "dash" || b.state === "dash") return;
    if (["down", "ko", "launched"].includes(a.state) || ["down", "ko", "launched"].includes(b.state)) return;
    const min = 52, d = b.x - a.x;
    if (Math.abs(d) < min) {
      const push = (min - Math.abs(d)) / 2 * (d >= 0 ? 1 : -1);
      a.x -= push; b.x += push;
      a.x = Math.max(WALL_L, Math.min(WALL_R, a.x)); b.x = Math.max(WALL_L, Math.min(WALL_R, b.x));
    }
  }
  updateProjectiles() {
    for (const p of this.projectiles) {
      p.x += p.vx; p.life--;
      const o = p.owner.opp, s = p.size;
      const box = { x: p.x - 40 * s, y: p.ground ? FLOOR - 110 * s : p.y - 34 * s, w: 80 * s, h: p.ground ? 110 * s : 68 * s };
      if (o.inv <= 0 && !["down", "ko"].includes(o.state) && overlap(box, o.hurtbox())) {
        p.life = 0;
        this.resolveHit(p.owner, o, { dmg: p.dmg, projectile: true, heavy: true, x: o.x - p.face * 10, y: p.ground ? FLOOR - 70 : p.y });
      }
      for (const q of this.projectiles) {
        if (q !== p && q.owner !== p.owner && q.life > 0 && p.life > 0 && Math.abs(q.x - p.x) < 50 && Math.abs(q.y - p.y) < 90) {
          q.life = p.life = 0; this.spawnFx("impact", (p.x + q.x) / 2, (p.y + q.y) / 2 - (p.ground ? 60 : 0), 0.6); this.sfx.hit(false);
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0 && p.x > -200 && p.x < W + 200);
  }
  nextRound() {
    const champ = this.fighters.find((f) => f.wins >= this.toWin);
    if (champ) {
      this.running = false;
      this.onEnd && this.onEnd({ winner: champ.side, def: champ.base });
      return;
    }
    this.round++;
    this.startRound();
  }

  // -------------------------------------------------------------------- draw
  render() {
    const c = this.ctx;
    c.save();
    c.clearRect(0, 0, W, H);
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    c.translate(sx, sy);
    c.drawImage(this.stage, -10, -6, W + 20, H + 12);
    const order = [...this.fighters].sort((a, b) => (["attack", "special", "ultimate"].includes(a.state) ? 1 : 0) - (["attack", "special", "ultimate"].includes(b.state) ? 1 : 0));
    for (const f of order) f.draw(c);
    for (const p of this.projectiles) this.drawProjectile(c, p);
    for (const p of this.particles) this.drawParticle(c, p);
    c.restore();
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash / 30})`; c.fillRect(0, 0, W, H); }
    this.drawHud(c);
    this.drawTexts(c);
    if (this.cutin) this.drawCutin(c);
  }
  drawProjectile(c, p) {
    const f = p.frame, s = p.size;
    c.save();
    c.translate(p.x, 0);
    if (p.face < 0) c.scale(-1, 1);
    const w = f.w * s, h = f.h * s;
    const y = p.ground ? FLOOR - h + 6 : p.y - h / 2;
    c.drawImage(p.img, f.x, f.y, f.w, f.h, -w / 2, y, w, h);
    c.restore();
  }
  drawParticle(c, p) {
    const m = this.fxMeta[p.name], k = 1 - p.life / p.max;
    c.save();
    c.globalAlpha = Math.min(1, p.life / 8);
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    if (p.flip) c.scale(-1, 1);
    const s = p.scale * (0.7 + k * 0.6);
    c.drawImage(this.fxImg, m.x, m.y, m.w, m.h, -m.w * s / 2, -m.h * s / 2, m.w * s, m.h * s);
    c.restore();
  }
  drawHud(c) {
    const [a, b] = this.fighters;
    this.drawBar(c, a, 0); this.drawBar(c, b, 1);
    // timer
    c.save();
    c.translate(W / 2, 40);
    c.rotate(-0.06);
    c.fillStyle = COL.red; c.fillRect(-38 + 6, -26 + 6, 76, 52);
    c.fillStyle = COL.white; c.fillRect(-38, -26, 76, 52);
    c.fillStyle = COL.ink; c.font = "44px Anton, Impact, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(Math.max(0, Math.ceil(this.timer / 60))), 0, 3);
    c.restore();
  }
  drawBar(c, f, side) {
    const left = side === 0, x0 = left ? 104 : W - 104, dir = left ? 1 : -1, len = 300, y = 22, h = 22;
    const par = (x, w, yy, hh, sk = 10) => {
      c.beginPath();
      if (left) { c.moveTo(x + sk, yy); c.lineTo(x + w, yy); c.lineTo(x + w - sk, yy + hh); c.lineTo(x, yy + hh); }
      else { c.moveTo(x - sk, yy); c.lineTo(x - w, yy); c.lineTo(x - w + sk, yy + hh); c.lineTo(x, yy + hh); }
      c.closePath();
    };
    // portrait
    c.save();
    c.translate(left ? 52 : W - 52, 44);
    c.rotate(left ? -0.07 : 0.07);
    c.fillStyle = COL.red; c.fillRect(-38 + 5, -38 + 5, 76, 76);
    c.fillStyle = COL.white; c.fillRect(-40, -40, 80, 80);
    c.save(); if (!left) c.scale(-1, 1);
    c.drawImage(f.sprites.face, -36, -36, 72, 72);
    c.restore();
    c.restore();
    // hp
    par(x0, len + 8, y - 4, h + 8); c.fillStyle = COL.white; c.fill();
    par(x0 + dir * 3, len, y, h); c.fillStyle = COL.ink2; c.fill();
    const g = Math.max(0, f.ghost / f.maxHp), hp = Math.max(0, f.hp / f.maxHp);
    c.save(); par(x0 + dir * 3, len, y, h); c.clip();
    c.fillStyle = "#ffc7cf"; c.fillRect(left ? x0 + 3 : x0 - 3 - len * g, y, len * g, h);
    const low = hp < 0.25 && (performance.now() >> 7) % 2;
    c.fillStyle = low ? COL.volt : COL.red; c.fillRect(left ? x0 + 3 : x0 - 3 - len * hp, y, len * hp, h);
    c.fillStyle = "rgba(255,255,255,0.28)"; c.fillRect(left ? x0 : x0 - len - 6, y, len + 6, 6);
    c.restore();
    // name + wins
    c.font = "italic 900 19px 'Barlow Condensed', 'Arial Narrow', sans-serif"; c.textBaseline = "alphabetic";
    c.textAlign = left ? "left" : "right"; c.lineJoin = "round";
    c.lineWidth = 5; c.strokeStyle = COL.ink; c.strokeText(f.def.name.toUpperCase(), x0 + dir * 8, y + h + 22);
    c.fillStyle = COL.white; c.fillText(f.def.name.toUpperCase(), x0 + dir * 8, y + h + 22);
    for (let i = 0; i < this.toWin; i++) {
      const wx = x0 + dir * (len - 12 - i * 22), wy = y + h + 14;
      c.save(); c.translate(wx, wy); c.rotate(Math.PI / 4);
      c.fillStyle = i < f.wins ? COL.volt : COL.ink2; c.strokeStyle = COL.white; c.lineWidth = 2;
      c.fillRect(-6, -6, 12, 12); c.strokeRect(-6, -6, 12, 12); c.restore();
    }
    if (f.form) {
      c.fillStyle = COL.cyan; c.font = "italic 900 15px 'Barlow Condensed', sans-serif";
      c.lineWidth = 4; c.strokeStyle = COL.ink; c.strokeText(`HỒN THỂ ${Math.ceil(f.formT / 60)}s`, x0 + dir * 8, y + h + 42);
      c.fillText(`HỒN THỂ ${Math.ceil(f.formT / 60)}s`, x0 + dir * 8, y + h + 42);
    }
    // energy (bottom)
    const ex = left ? 30 : W - 30, ey = H - 34, seg = 74;
    c.font = "30px Anton, Impact, sans-serif"; c.textAlign = left ? "left" : "right";
    c.fillStyle = COL.volt; c.fillText(String(Math.floor(f.energy / 100)), ex, ey + 22);
    for (let i = 0; i < 3; i++) {
      const sx = left ? ex + 30 + i * (seg + 6) : ex - 30 - i * (seg + 6);
      par(sx, seg, ey, 16, 6); c.fillStyle = COL.ink2; c.fill(); c.strokeStyle = COL.white; c.lineWidth = 2; c.stroke();
      const fill = Math.max(0, Math.min(1, f.energy / 100 - i));
      if (fill > 0) {
        c.save(); par(sx, seg, ey, 16, 6); c.clip();
        c.fillStyle = fill >= 1 ? COL.cyan : "#0b7f88";
        c.fillRect(left ? sx : sx - seg * fill, ey, seg * fill, 16);
        c.restore();
      }
    }
  }
  drawTexts(c) {
    for (const t of this.texts) {
      const k = 1 - t.life / t.max;
      const sc = k < 0.15 ? 1.8 - k / 0.15 * 0.8 : 1;
      c.save();
      c.globalAlpha = Math.min(1, t.life / 12);
      c.translate(W / 2, H / 2 - 30);
      c.rotate(-0.08);
      c.scale(sc, sc);
      c.font = `${t.big ? 86 : 46}px 'Dela Gothic One', 'Arial Black', sans-serif`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.lineJoin = "round";
      c.lineWidth = 22; c.strokeStyle = COL.white; c.strokeText(t.text, 0, 0);
      c.lineWidth = 10; c.strokeStyle = COL.ink; c.strokeText(t.text, 0, 0);
      c.fillStyle = t.text.startsWith("K.O") ? COL.red : COL.volt; c.fillText(t.text, 0, 0);
      c.restore();
    }
  }
  drawCutin(c) {
    const ct = this.cutin, t = ct.t, left = ct.side === 0;
    const ease = (v) => 1 - Math.pow(1 - Math.min(1, v), 3);
    const inK = ease(t / 12), outK = t > 60 ? ease((t - 60) / 12) : 0;
    c.save();
    c.fillStyle = `rgba(11,11,13,${0.72 * inK * (1 - outK)})`; c.fillRect(0, 0, W, H);
    // band
    const bandY = 120, bandH = 300;
    c.translate((left ? -1 : 1) * W * (1 - inK) + (left ? 1 : -1) * W * outK, 0);
    c.beginPath(); c.moveTo(0, bandY + 30); c.lineTo(W, bandY); c.lineTo(W, bandY + bandH - 30); c.lineTo(0, bandY + bandH); c.closePath();
    c.fillStyle = COL.white; c.fill();
    c.save(); c.clip();
    c.beginPath(); c.moveTo(0, bandY + 38); c.lineTo(W, bandY + 8); c.lineTo(W, bandY + bandH - 38); c.lineTo(0, bandY + bandH - 8); c.closePath(); c.clip();
    const iw = W, ih = iw * 9 / 16;
    c.save();
    if (!left) { c.translate(W, 0); c.scale(-1, 1); }
    c.drawImage(ct.img, 0, bandY + bandH / 2 - ih / 2 + (t % 4 < 2 ? 1 : -1), iw, ih);
    c.restore();
    // speed lines
    c.globalAlpha = 0.5; c.fillStyle = COL.white;
    for (let i = 0; i < 14; i++) { const ly = bandY + 20 + ((i * 53 + t * 11) % (bandH - 40)); c.fillRect(((i * 97 + t * 40) % (W + 300)) - 300, ly, 160 + (i % 3) * 60, 2); }
    c.restore();
    // move name
    c.globalAlpha = 1;
    c.font = "56px 'Dela Gothic One', 'Arial Black', sans-serif";
    c.textAlign = left ? "left" : "right"; c.textBaseline = "middle";
    const nx = left ? 40 : W - 40, ny = bandY + bandH - 50;
    c.lineJoin = "round"; c.lineWidth = 18; c.strokeStyle = COL.white; c.strokeText(ct.name, nx, ny);
    c.lineWidth = 8; c.strokeStyle = COL.ink; c.strokeText(ct.name, nx, ny);
    c.fillStyle = COL.red; c.fillText(ct.name, nx, ny);
    c.restore();
  }
  destroy() { this.running = false; for (const f of this.fighters) f.ctrl.dispose && f.ctrl.dispose(); }
}
