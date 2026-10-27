// Screen flow: title → select → fight → result, all keyboard driven.
import { ROSTER, byId } from "./data.js";
import { Game, Keyboard, AIController, KEYMAPS, loadCharacter, loadImage, loadIndex, sfx } from "./engine.js";

const $ = (s) => document.querySelector(s);
const app = $("#app"), cv = $("#cv");
const screens = ["title", "select", "help", "pause", "result", "loading"];
let state = { mode: "cpu", diff: "normal", p1: 0, p2: 1, lock1: false, lock2: false, game: null, kb: null, current: "title" };

// ---------------------------------------------------------------- layout
function fit() {
  const k = Math.min(innerWidth / 960, innerHeight / 540);
  app.style.transform = `scale(${k})`;
}
addEventListener("resize", fit);
fit();
if (matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches) $("#touch-note").hidden = false;

function show(name) {
  for (const s of screens) $("#" + s).hidden = s !== name && !(name === "pause" && s === "pause");
  if (name === "pause") $("#pause").hidden = false;
  state.current = name;
}

// ---------------------------------------------------------------- menus
const menus = {};
function menu(id, onAct) {
  const ul = $("#" + id), items = [...ul.querySelectorAll("li")];
  const m = { i: 0, items, act: onAct };
  const paint = () => items.forEach((li, k) => li.classList.toggle("on", k === m.i));
  m.move = (d) => { m.i = (m.i + d + items.length) % items.length; paint(); sfx.select(); };
  m.go = () => { sfx.unlock(); sfx.select(); onAct(items[m.i].dataset.act); };
  items.forEach((li, k) => {
    li.addEventListener("mouseenter", () => { m.i = k; paint(); });
    li.addEventListener("click", () => { m.i = k; paint(); m.go(); });
  });
  paint();
  menus[id] = m;
  return m;
}
menu("title-menu", (a) => {
  if (a === "help") { show("help"); return; }
  state.mode = a; openSelect();
});
menu("help-menu", () => show("title"));
menu("pause-menu", (a) => {
  if (a === "resume") return resume();
  endGame();
  if (a === "reselect") openSelect(); else show("title");
});
menu("result-menu", (a) => {
  if (a === "rematch") startFight();
  else if (a === "reselect") openSelect();
  else show("title");
});

const MENU_OF = { title: "title-menu", help: "help-menu", pause: "pause-menu", result: "result-menu" };
addEventListener("keydown", (e) => {
  sfx.unlock();
  const c = state.current;
  if (c === "fight") {
    if (e.code === "Escape" || e.code === "KeyP") pause();
    return;
  }
  if (c === "select") return selectKey(e);
  const m = menus[MENU_OF[c]];
  if (!m) return;
  if (["KeyW", "ArrowUp"].includes(e.code)) m.move(-1);
  else if (["KeyS", "ArrowDown"].includes(e.code)) m.move(1);
  else if (["KeyJ", "Enter", "Space", "Numpad1", "Digit1"].includes(e.code)) m.go();
  else if (e.code === "Escape" && c === "pause") resume();
  else if (e.code === "Escape" && c === "help") show("title");
  else return;
  e.preventDefault();
});

// ---------------------------------------------------------------- select
const grid = $("#grid");
ROSTER.forEach((c, i) => {
  const t = document.createElement("div");
  t.className = "tile";
  t.innerHTML = `<img src="assets/${c.id}_face.webp" alt="${c.name}">`;
  t.addEventListener("click", () => clickTile(i));
  grid.appendChild(t);
});
document.querySelectorAll("#diff button").forEach((b) => b.addEventListener("click", () => { state.diff = b.dataset.d; paintSelect(); }));

function openSelect() {
  state.lock1 = state.lock2 = false;
  show("select");
  paintSelect();
}
const COLS = 3;
function moveCursor(which, code) {
  const key = which === 1 ? "p1" : "p2", n = ROSTER.length;
  let i = state[key];
  const d = { left: -1, right: 1, up: -COLS, down: COLS }[code];
  i = (i + d + n) % n;
  state[key] = i; sfx.select(); paintSelect();
}
function selectKey(e) {
  const cpu = state.mode === "cpu";
  const p1Picks2 = cpu && state.lock1; // in 1P mode, P1 also picks the CPU fighter
  const map1 = { KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down" };
  const map2 = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  if (e.code === "Escape") { show("title"); return; }
  if (cpu && (e.code === "KeyQ" || e.code === "KeyE")) {
    const ds = ["easy", "normal", "hard"], i = ds.indexOf(state.diff);
    state.diff = ds[(i + (e.code === "KeyE" ? 1 : 2)) % 3]; paintSelect(); return;
  }
  if (map1[e.code]) {
    if (!state.lock1) moveCursor(1, map1[e.code]);
    else if (p1Picks2 && !state.lock2) moveCursor(2, map1[e.code]);
    e.preventDefault(); return;
  }
  if (!cpu && map2[e.code] && !state.lock2) { moveCursor(2, map2[e.code]); e.preventDefault(); return; }
  if (["KeyJ", "Enter", "Space"].includes(e.code)) {
    if (!state.lock1) state.lock1 = true;
    else if (p1Picks2 && !state.lock2) state.lock2 = true;
    sfx.select(); paintSelect(); maybeStart(); e.preventDefault(); return;
  }
  if (!cpu && ["Numpad1", "Digit1"].includes(e.code)) { state.lock2 = true; sfx.select(); paintSelect(); maybeStart(); return; }
  if (e.code === "KeyK") { if (p1Picks2 && !state.lock2) state.lock1 = false; else state.lock1 = false; paintSelect(); return; }
  if (!cpu && ["Numpad2", "Digit2"].includes(e.code)) { state.lock2 = false; paintSelect(); }
}
function clickTile(i) {
  sfx.unlock();
  if (!state.lock1) { state.p1 = i; state.lock1 = true; }
  else if (!state.lock2) { state.p2 = i; state.lock2 = true; }
  sfx.select(); paintSelect(); maybeStart();
}
function paintSide(el, c, label, locked) {
  el.querySelector(".art img").src = `assets/${c.id}_cutin.webp`;
  el.querySelector(".who").textContent = label;
  el.querySelector(".nm").textContent = c.name;
  el.querySelector(".tt").textContent = `${c.title} · ${c.path}`;
  el.querySelector(".mv").textContent = `${c.special.name} · ${c.ultimate.name}`;
  el.classList.toggle("locked", locked);
}
function paintSelect() {
  const cpu = state.mode === "cpu";
  $("#sel-mode").textContent = cpu ? "1P đấu máy" : "2P đối kháng";
  [...grid.children].forEach((t, i) => {
    t.classList.toggle("c1", i === state.p1);
    t.classList.toggle("c2", i === state.p2);
    t.querySelectorAll(".cur").forEach((x) => x.remove());
    if (i === state.p1) t.insertAdjacentHTML("beforeend", `<span class="cur a">1P</span>`);
    if (i === state.p2) t.insertAdjacentHTML("beforeend", `<span class="cur b">${cpu ? "CPU" : "2P"}</span>`);
  });
  paintSide($("#side-1"), ROSTER[state.p1], "1P", state.lock1);
  paintSide($("#side-2"), ROSTER[state.p2], cpu ? "CPU" : "2P", state.lock2);
  $("#diff").hidden = !cpu;
  document.querySelectorAll("#diff button").forEach((b) => b.classList.toggle("on", b.dataset.d === state.diff));
  $("#sel-hint").textContent = cpu
    ? (state.lock1 ? "Chọn đối thủ cho máy · WASD di chuyển · J xác nhận · K quay lại · Q/E độ khó" : "WASD di chuyển · J chọn tôn giả · Q/E độ khó · Esc về menu")
    : "1P: WASD + J chọn · 2P: phím mũi tên + 1 chọn · Esc về menu";
}
function maybeStart() {
  if (state.lock1 && state.lock2) setTimeout(startFight, 350);
}

// ---------------------------------------------------------------- fight
async function startFight() {
  endGame();
  show("loading");
  try {
    await document.fonts.load("40px 'Dela Gothic One'");
    await document.fonts.load("40px Anton");
    await document.fonts.load("italic 900 20px 'Barlow Condensed'");
  } catch { /* fallback fonts are fine */ }
  const d1 = ROSTER[state.p1], d2 = ROSTER[state.p2];
  const [s1, s2, stage, fx] = await Promise.all([
    loadCharacter(d1.id), loadCharacter(d2.id), loadImage("assets/stage.webp"), loadImage("assets/fx.webp"), loadIndex(),
  ]);
  state.kb = new Keyboard();
  const c1 = DEMO ? new AIController("hard") : state.kb.controller(KEYMAPS.p1);
  const c2 = state.mode === "cpu" ? new AIController(state.diff) : state.kb.controller(KEYMAPS.p2);
  state.game = new Game(cv, {
    p1: { def: d1, sprites: s1 }, p2: { def: d2, sprites: s2 }, c1, c2, stage, fx,
    onEnd: (r) => showResult(r),
  });
  if (DEMO) window.__game = state.game;
  show("fight");
}
function endGame() {
  if (state.game) { state.game.destroy(); state.game = null; }
  if (state.kb) { state.kb.dispose(); state.kb = null; }
}
function pause() {
  if (!state.game) return;
  state.game.paused = true;
  menus["pause-menu"].i = 0; menus["pause-menu"].move(0);
  show("pause");
}
function resume() {
  if (!state.game) return;
  state.game.paused = false; state.game.last = performance.now();
  show("fight");
}
function showResult(r) {
  const c = byId(r.def.id);
  $("#res-art").src = `assets/${c.id}_cutin.webp`;
  $("#res-name").textContent = c.name;
  $("#res-side").textContent = r.winner === 0 ? "1P thắng" : state.mode === "cpu" ? "Máy thắng" : "2P thắng";
  menus["result-menu"].i = 0; menus["result-menu"].move(0);
  setTimeout(() => { if (state.kb) { state.kb.dispose(); state.kb = null; } show("result"); }, 400);
}

// ?demo: two CPUs fight (used for automated checks); ?demo=a,b picks fighters
const DEMO = new URLSearchParams(location.search).has("demo");
if (DEMO) {
  const pick = (new URLSearchParams(location.search).get("demo") || "").split(",");
  const ix = (id, f) => { const k = ROSTER.findIndex((c) => c.id === id); return k >= 0 ? k : f; };
  state.p1 = pick[0] ? ix(pick[0], 0) : Math.floor(Math.random() * ROSTER.length);
  state.p2 = pick[1] ? ix(pick[1], 1) : Math.floor(Math.random() * ROSTER.length);
  state.mode = "cpu"; state.diff = "hard";
  addEventListener("load", () => startFight());
}

// title art: a random venerable each visit
$("#title-art").src = `assets/${ROSTER[Math.floor(Math.random() * ROSTER.length)].id}_cutin.webp`;
loadIndex();
show("title");
