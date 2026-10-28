const CFG = {
  W: 2048,
  H: 1152,
  rows: 5,
  cols: 10,
  plantCols: 9,
  visibleCols: 9.3,
  grid: { y: 200, cw: 200, ch: 186 },
  milkSlot: { x: 48, y: 24, w: 160, h: 160 },
  cardSlot: { x: 256, y: 24, w: 107, h: 160 },
  cardSlots: 6,
  cardSlotsMax: 10,
  cardGap: 24,
  belt: {
    x: 256, y: 24, cells: 10, speed: 100,
    interval: { normal: 4, over: 10 }, overAt: 8,
    countPenalty: [3, 4], penaltyValues: [5, 1], lastMul: 0.5,
    panelColor: 'rgba(70,50,25,0.65)', stripe: 'rgba(255,255,255,0.08)',
  },
  cardFace: { offset: 8, costFont: 30, costPad: 22, costLow: '#ff4a4a', gray: 'rgba(120,120,120,0.55)', ring: 'rgba(235,235,235,0.7)', ringW: 2, ringR: 10 },
  netSlot: { y: 24, w: 160, h: 160 },
  menu: { btnW: 160, btnH: 64, btnY: 24, btnPad: 24, btnGap: 16 },
  levelName: { font: 26, color: '#ffe14d', padX: 24, padY: 12 },
  meter: { w: 260, padX: 24, padY: 12, gap: 16, anim: 0.6, frame: [2, 2, 155, 19], fill: [7, 33, 143, 11], inset: [5, 4], sync: { h: 47, src: [80, 80], pivot: [39.5, 39.5], dy: 0 }, mark: { h: 64, src: [112, 140], pivot: [55.5, 78], dy: -6, dyDone: -30 }, ranks: ['SSSp', 'SSS', 'SSp', 'SS', 'Sp', 'S'] },
  tip: { font: 26, lineH: 34, padX: 16, padY: 8, r: 10, bg: 'rgba(0,0,0,0.78)', border: 'rgba(255,255,255,0.35)' },
  wave: { div: 3, cap: 8, bigEvery: 10, bigMul: 2.5, bigSeed: 'chunipenguin', first: 19000, gapMin: 25000, gapMax: 31000, bigGap: 52000, hpCut: 0.65, armor1Weight: 1.00, armor2Weight: 0.20, cutGap: 3000, bigCutGap: 9000, bigWarnGap: 7000, rowInit: 0 },
  monster: { bleedGap: 0.033, bleedDmg: 1, slow: 0.5, slowColor: '#3a5c7a', slowAlpha: 0.55, feet: 81, hitFlash: 0.05, hitAlpha: 0.2, hitColor: '#ffffff', death: { fall: 0.3, hold: 0.5, fade: 0.3, angle: 90, slide: 40 }, ash: { dur: 2.5, color: '#000000' } },
  armor: { death: { fall: 0.15, hold: 0.5, fade: 0.3, run: 90, push: 0.45 } },
  reward: {
    defaultKey: 'moneybag',
    rest: { x: 1024, row: 2, dy: -223.2 },
    hitPad: 55,
    halo: { radius: 1.1, alpha: 0.55, color: '255,225,120' },
    burst: { dur: 0.2, hold: 0.2, radius: 130 },
    cer: { dur: 5, fly: 3, white: 2, scaleTo: 3, glowFrom: 260, glowTo: 1180, glowAlpha: 0.55, color: '255,255,255' },
  },
  artPad: { 'images/enemies/enm_chunipenguin.png': [58, 0, 101, 36] },
  bulletSize: 64,
  hitDist: 40,
  bulletSpread: 40,
  footMargin: 12,
  milk: { size: 120, hitPad: 55, fallSpeed: 80, life: 20, fade: 1.2, dropBase: 4250, dropStep: 100, dropCap: 9500, dropRand: 2750, flySpeed: 2400, flyWait: 0.2, arc: { dur: 0.9, h: 150, spread: 70 }, halo: { radius: 0.7, alpha: 0.30, color: '255,255,255' } },
  glow: { time: 1, radius: 0.8, alpha: 0.8, color: '255,225,120' },
  shadow: { color: '0,0,0', alpha: 0.22, squash: 0.22, partner: 0.66, monster: 0.7, gmilk: 0.6, milk: 0.5, bullet: 0.45 },
  deck: { cam: 1400, hold: 1.5, panIn: 1.5, settle: 1, panOut: 1.5, rise: 0.3, fly: 0.18, shift: 0.12, minShow: 5, showPad: 150, showGap: 230, count: 5, milkAt: 1, milkStep: 0.1, milkPan: 0.1, marks: [['3', 2.5, 0.5], ['2', 3, 0.5], ['1', 3.5, 0.5], ['START!', 4, 1]], panel: { x: 40, y: 240, w: 760 }, pool: { rows: 6, cols: 8, w: 76, h: 122, gapX: 12, gapY: 8 } },
  gmilk: { scale: 0.8, speed: 800 },
  banner: { font: 120, color: '#ff4a4a', fade: 0.4, bigHold: 5, lastHold: 1, outline: 8, outlineColor: '#000' },
  bgBlur: 12,
};
CFG.grid.x = CFG.W - CFG.visibleCols * CFG.grid.cw;

const CARDS = Object.keys(INFO.cards).map(key => ({ key, info: INFO.cards[key] }));
const CARDS_BY_ID = {};
for (const c of CARDS) CARDS_BY_ID[c.info.id] = c;

const OPTS = [
  { key: 'fast', label: '快速模式' },
  { key: 'noNatural', label: '关闭自然出怪' },
  { key: 'noCool', label: '无冷却无花费' },
  { key: 'autoCollect', label: '自动收集' },
];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CFG.W;
canvas.height = CFG.H;

const imgs = {};

function loadImage(name, src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = resolve;
    im.onerror = reject;
    im.src = src;
    imgs[name] = im;
  });
}

function levelBgm(key) {
  return INFO.tracklist[key].bgm ?? INFO.bgm;
}

function levelStartMilk(key) {
  return INFO.tracklist[key].startMilk ?? INFO.milk.start;
}

function levelFirstGap(key) {
  return INFO.tracklist[key].firstGap ?? CFG.wave.first;
}

function makeRun(key) {
  return {
    slot: key,
    scene: 'menu',
    notice: false,
    mouse: { x: -200, y: -200 },
    selected: null,
    net: false,
    deck: fullDeck(key),
    deckPhase: null,
    deckT: 0,
    belt: [],
    beltT: 0,
    beltLast: null,
    beltLayers: 0,
    beltPresetAt: 0,
    beltSel: -1,
    beltScroll: 0,
    camX: 0,
    lineup: [],
    flights: [],
    plants: [],
    monsters: [],
    deaths: [],
    drops: [],
    ashes: [],
    reward: null,
    ceremony: null,
    bullets: [],
    milks: [],
    effects: [],
    gmilks: [],
    milk: levelStartMilk(key),
    milkShown: levelStartMilk(key),
    cool: deckCool(fullDeck(key)),
    opts: { fast: false, noNatural: false, noCool: false, autoCollect: false },
    menuOpen: false,
    confirmRestart: false,
    resumeAsk: false,
    result: null,
    loading: false,
    clock: 0,
    wave: 0,
    waveGap: levelFirstGap(key),
    waveHp: 0,
    bigWarned: false,
    banners: [],
    rowLast: Array(CFG.rows).fill(CFG.wave.rowInit),
    rowSecondLast: Array(CFG.rows).fill(CFG.wave.rowInit),
    lastSpawn: 0,
    lastMilk: 0,
    milkInterval: 0,
    milkDropped: 0,
    bgmAt: 0,
  };
}

const SLOTS = { test1: makeRun('test1'), test2: makeRun('test2') };

let state = SLOTS.test1;

const bgm = new Audio(INFO.bgm);
bgm.loop = true;
let bgmSrc = INFO.bgm;

function playBgm() {
  const p = bgm.play();
  if (p && p.catch) p.catch(() => {});
}

function setMenu(open) {
  state.menuOpen = open;
  if (open) bgm.pause();
  else if (!state.deckPhase) playBgm();
}

function enterRun(key) {
  const mouse = state.mouse;
  state.bgmAt = bgm.currentTime;
  const slot = SLOTS[key];
  state = slot;
  slot.mouse = mouse;
  slot.scene = 'game';
  slot.ceremony = null;
  slot.loading = true;
  loadRun(key).then(() => {
    slot.loading = false;
    const src = levelBgm(key);
    if (src !== bgmSrc) {
      bgmSrc = src;
      bgm.src = src;
    }
    bgm.currentTime = slot.bgmAt;
    if (hasRunRecord(slot)) {
      slot.resumeAsk = true;
      return;
    }
    beginRun();
  });
}

function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function toLocal(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * CFG.W / r.width,
    y: (e.clientY - r.top) * CFG.H / r.height,
  };
}

function drawPanel(r) {
  ctx.fillStyle = 'rgba(70,50,25,0.95)';
  roundRect(r.x, r.y, r.w, r.h, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(r, label) {
  ctx.fillStyle = 'rgba(70,50,25,0.65)';
  roundRect(r.x, r.y, r.w, r.h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + Math.min(40, r.h * 0.6) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
}

function drawTip(cx, top, lines) {
  const t = CFG.tip;
  ctx.font = 'bold ' + t.font + 'px sans-serif';
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  w += t.padX * 2;
  const h = lines.length * t.lineH + t.padY * 2;
  const x = cx - w / 2;
  ctx.fillStyle = t.bg;
  roundRect(x, top, w, h, t.r);
  ctx.fill();
  ctx.strokeStyle = t.border;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x + w / 2, top + t.padY + t.lineH * (i + 0.5));
}

canvas.addEventListener('mousemove', e => {
  state.mouse = toLocal(e);
  if (state.scene === 'menu') menuHover(); else testHover();
});

canvas.addEventListener('click', e => {
  const p = toLocal(e);
  if (state.scene === 'menu') menuClick(p); else testClick(p);
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (state.ceremony) return;
  state.selected = null;
  state.beltSel = -1;
  state.net = false;
});

window.addEventListener('keydown', e => {
  if (state.scene === 'menu') return;
  testKey(e);
});

let prev = performance.now();

function loop(t) {
  const raw = Math.min(50, t - prev) / 1000;
  prev = t;
  if (state.scene === 'menu') {
    renderMenu();
    requestAnimationFrame(loop);
    return;
  }
  if (state.deckPhase) {
    updateDeck(raw);
    render();
    requestAnimationFrame(loop);
    return;
  }
  if (!(state.menuOpen || state.resumeAsk || state.loading || state.result)) updateGame(raw);
  render();
  requestAnimationFrame(loop);
}

Promise.all([
  loadImage('bg', 'images/backgrounds/test.png'),
  ...Object.keys(INFO.tracklist).map(k => loadImage('bg_' + k, INFO.tracklist[k].bg)),
  ...Object.keys(INFO.bullets).map(k => loadImage(k, INFO.bullets[k].img)),
  loadImage('milk', INFO.milk.img),
  loadImage('net_err', 'images/others/net_err.png'),
  loadImage('golden_milk', 'images/others/golden_milk.png'),
  loadImage('flag_meter', 'images/others/FlagMeter.png'),
  loadImage('sync', 'images/others/sync.png'),
  ...CFG.meter.ranks.map(r => loadImage('allclear_' + r, 'images/others/UI_MSS_Allclear_Icon_' + r + '.png')),
  ...Object.keys(INFO.monsters).map(k => loadImage('enm_' + k, INFO.monsters[k].img)),
  ...Object.keys(INFO.armors).map(k => loadImage('arm_' + k, INFO.armors[k].img)),
  ...Object.keys(INFO.rewards).map(k => loadImage('rew_' + k, INFO.rewards[k].img)),
  ...CARDS.map(c => loadImage('card_' + c.key, c.info.cardImg)),
  ...CARDS.map(c => loadImage('ptn_' + c.key, c.info.ptnImg)),
  ...CARDS.filter(c => c.info.effect).map(c => loadImage('eff_' + c.key, c.info.effect.img)),
  ...CARDS.filter(c => c.info.place).map(c => loadImage('plc_' + c.key, c.info.place.img)),
]).then(() => {
  for (const s of Object.values(SLOTS)) {
    s.milkInterval = randMilkInterval();
    resetGmilks(s);
  }
  requestAnimationFrame(loop);
});
