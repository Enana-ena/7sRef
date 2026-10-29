function randAtk(info) {
  return info.atkMin + Math.random() * (info.atkMax - info.atkMin);
}

function randMilkInterval() {
  const m = CFG.milk;
  return Math.min(state.milkDropped * m.dropStep + m.dropBase, m.dropCap) + Math.random() * m.dropRand;
}

function milkSize() {
  const h = CFG.milk.size;
  return { w: h * imgs.milk.width / imgs.milk.height, h };
}

function spawnMilk() {
  const g = CFG.grid;
  const row = 2 + Math.floor(Math.random() * 3);
  const s = milkSize();
  const k = {
    x: g.x + s.w / 2 + Math.random() * (CFG.plantCols * g.cw - s.w),
    y: g.y + s.h / 2,
    bottom: g.y + (row + 1) * g.ch,
    stopped: false,
    age: 0,
  };
  state.milks.push(k);
  state.milkDropped++;
  if (state.opts.autoCollect) collectMilk(k);
}

function collectMilk(k) {
  state.milkClicked = true;
  k.fly = true;
  k.arrived = false;
  k.counted = false;
  k.wait = 0;
  state.milk = Math.min(INFO.milk.cap, state.milk + INFO.milk.value);
}

function randRange(a, b) {
  return a + Math.random() * (b - a);
}

function produceMilk(p) {
  const g = CFG.grid;
  const card = CARDS[p.card];
  const s = plantSize(imgs['ptn_' + card.key], card.info.scale);
  const ms = milkSize();
  const a = CFG.milk.arc;
  const c = cellCenter(p.row, p.col);
  const feetY = g.y + (p.row + 1) * g.ch - CFG.footMargin;
  const sx = c.x;
  const sy = feetY - s.h;
  const tx = Math.min(g.x + CFG.plantCols * g.cw - ms.w / 2, Math.max(g.x + ms.w / 2, c.x + randRange(-a.spread, a.spread)));
  const k = {
    x: sx,
    y: sy,
    stopped: false,
    age: 0,
    arc: { sx, sy, tx, ty: feetY - ms.h / 2, t: 0, dur: a.dur, h: a.h },
  };
  state.milks.push(k);
  if (state.opts.autoCollect) collectMilk(k);
}

function arcPoint(a, u) {
  return { x: a.sx + (a.tx - a.sx) * u, y: a.sy + (a.ty - a.sy) * u - a.h * 4 * u * (1 - u) };
}

function stepArc(o, dt) {
  const a = o.arc;
  a.t += dt;
  const u = Math.min(1, a.t / a.dur);
  const p = arcPoint(a, u);
  o.x = p.x;
  o.y = p.y;
  if (u >= 1) {
    o.x = a.tx;
    o.y = a.ty;
    o.arc = null;
  }
  return u;
}

function rewardSize(key) {
  const h = CFG.milk.size * INFO.rewards[key].scale;
  const img = imgs['rew_' + key];
  return { w: h * img.width / img.height, h };
}

function rewardKey() {
  const lv = INFO.tracklist[state.slot];
  if (lv.firstReward && !isCleared(state.slot)) return lv.firstReward;
  return CFG.reward.defaultKey;
}

function spawnReward(src) {
  const g = CFG.grid;
  const a = CFG.milk.arc;
  const rest = CFG.reward.rest;
  const key = rewardKey();
  const s = rewardSize(key);
  const row = src ? src.row : rest.row;
  const feetY = feetLine(row);
  const sx = src ? src.x : rest.x;
  const b = src ? monsterBox(src) : null;
  const sy = b ? b.y - b.h / 2 : feetY + rest.dy;
  const tx = Math.min(g.x + CFG.plantCols * g.cw - s.w / 2, Math.max(g.x + s.w / 2, sx + randRange(-a.spread, a.spread)));
  state.reward = { key, x: sx, y: sy, arc: { sx, sy, tx, ty: feetY - s.h / 2, t: 0, dur: a.dur, h: a.h } };
}

function rewardHit(p) {
  const r = state.reward;
  if (!r) return false;
  const s = rewardSize(r.key);
  const pad = CFG.reward.hitPad;
  return inRect(p, { x: r.x - s.w / 2 - pad, y: r.y - s.h / 2 - pad, w: s.w + pad * 2, h: s.h + pad * 2 });
}

function pickupReward() {
  const r = state.reward;
  const rw = INFO.rewards[r.key];
  markCleared(state.slot);
  if (rw.unlock) unlockCard(rw.unlock);
  const lvId = INFO.tracklist[state.slot].id;
  if (lvId !== null) markAdvDone(lvId);
  for (const k of state.milks) if (!k.fly) collectMilk(k);
  if (rw.milk) burstReward(r, rw.milk);
  state.ceremony = { key: r.key, t: 0, sx: r.x, sy: r.y };
  state.reward = null;
  bgm.pause();
  playWinMusic();
}

function burstReward(r, value) {
  const b = CFG.reward.burst;
  const n = Math.max(1, Math.round(value / INFO.milk.value));
  for (let i = 0; i < n; i++) {
    const th = Math.PI * (i + 0.5) / n;
    state.milks.push({
      x: r.x,
      y: r.y,
      bottom: r.y,
      stopped: false,
      age: 0,
      arc: { sx: r.x, sy: r.y, tx: r.x - b.radius * Math.cos(th), ty: r.y - b.radius * Math.sin(th), t: 0, dur: b.dur, h: 0 },
      hold: b.hold,
    });
  }
}

function spawnEffect(p) {
  const e = CARDS[p.card].info.effect;
  const c = cellCenter(p.row, p.col);
  state.effects.push({
    key: CARDS[p.card].key,
    x: c.x,
    y: c.y,
    grow: e.grow,
    hold: e.hold,
    fade: e.fade,
    scaleFrom: e.scaleFrom,
    scaleTo: e.scaleTo,
    t: 0,
  });
}

function burstDamage(p) {
  const b = CARDS[p.card].info.burst;
  const g = CFG.grid;
  const x0 = g.x + (p.col - b.radius) * g.cw;
  const y0 = g.y + (p.row - b.radius) * g.ch;
  const x1 = x0 + (b.radius * 2 + 1) * g.cw;
  const y1 = y0 + (b.radius * 2 + 1) * g.ch;
  for (const m of state.monsters) {
    const bx = hitBox(m);
    if (bx.x + bx.w / 2 < x0 || bx.x - bx.w / 2 > x1) continue;
    const fy = bx.y + bx.h / 2;
    if (fy < y0 || fy > y1) continue;
    const nd = state.drops.length;
    hurtArea(m, b.damage, !!CARDS[p.card].info.ash);
    if (m.hp <= 0) {
      m.noCorpse = true;
      state.drops.length = nd;
    }
  }
}

function armPhase(p) {
  const info = CARDS[p.card].info;
  if (!info.charge) return 2;
  if (p.armT < info.charge) return 0;
  return p.armT < info.charge + info.wake ? 1 : 2;
}

function emergeRatio(p) {
  const info = CARDS[p.card].info;
  const ph = armPhase(p);
  if (ph === 2) return 1;
  if (ph === 0) return 0;
  return smooth((p.armT - info.charge) / info.wake);
}

function drawEmerge(img, s, x, feetY, k, flashKey) {
  const v = (1 + k) / 2;
  ctx.drawImage(img, 0, 0, img.width, img.height * v, x - s.w / 2, feetY - s.h * v, s.w, s.h * v);
  if (!flashKey) return;
  const f = flashSprite(flashKey, s);
  ctx.globalAlpha = CFG.monster.hitAlpha;
  ctx.drawImage(f, 0, 0, f.width, f.height * v, x - s.w / 2, feetY - s.h * v, s.w, s.h * v);
  ctx.globalAlpha = 1;
}

function boomDamage(p) {
  const info = CARDS[p.card].info;
  const b = info.boom;
  const g = CFG.grid;
  const c = cellCenter(p.row, p.col);
  const x0 = c.x - b.radius * g.cw;
  const x1 = c.x + b.radius * g.cw;
  const y0 = g.y + p.row * g.ch;
  const y1 = y0 + g.ch;
  for (const m of state.monsters) {
    const bx = hitBox(m);
    if (bx.x + bx.w / 2 < x0 || bx.x - bx.w / 2 > x1) continue;
    const fy = bx.y + bx.h / 2;
    if (fy < y0 || fy > y1) continue;
    const nd = state.drops.length;
    hurtArea(m, b.damage);
    if (m.hp <= 0) {
      m.noCorpse = true;
      state.drops.length = nd;
    }
  }
}

function applyFreeze(m, dur) {
  m.freeze = Math.max(m.freeze || 0, m.slow > 0 ? dur * CFG.monster.freezeResist : dur);
}

function iceBlast(p) {
  const ice = CARDS[p.card].info.ice;
  for (const m of state.monsters) {
    hurtArea(m, ice.damage);
    applyFreeze(m, randRange(ice.freezeMin, ice.freezeMax));
    m.slow = Math.max(m.slow || 0, ice.slow);
  }
  state.flash = { t: 0, fx: ice.flash };
}

function touching(p, m) {
  const info = CARDS[p.card].info;
  const g = CFG.grid;
  const bx = hitBox(m);
  const fy = bx.y + bx.h / 2;
  if (fy < g.y + p.row * g.ch || fy > g.y + (p.row + 1) * g.ch) return false;
  const ps = plantSize(imgs['ptn_' + CARDS[p.card].key], info.scale);
  const c = cellCenter(p.row, p.col);
  return Math.abs(bx.x - c.x) * 2 < ps.w + bx.w;
}

function cellAt(x, y) {
  const g = CFG.grid;
  const col = Math.floor((x - g.x) / g.cw);
  const row = Math.floor((y - g.y) / g.ch);
  if (col < 0 || col >= CFG.cols || row < 0 || row >= CFG.rows) return null;
  return { row, col };
}

function cellCenter(row, col) {
  const g = CFG.grid;
  return { x: g.x + col * g.cw + g.cw / 2, y: g.y + row * g.ch + g.ch / 2 };
}

function slotRect(i) {
  const c = CFG.cardSlot;
  return { x: c.x + i * (c.w + CFG.cardGap), y: c.y, w: c.w, h: c.h };
}

function isConveyor(k) {
  return INFO.tracklist[k === undefined ? state.slot : k].conveyor === true;
}

function slotCount(k) {
  const lv = INFO.tracklist[k === undefined ? state.slot : k];
  return lv.cardSlots === undefined ? getSlots() : lv.cardSlots;
}

function netRect() {
  const n = isConveyor() ? CFG.belt.cells : slotCount();
  const c = CFG.cardSlot;
  return { x: c.x + n * (c.w + CFG.cardGap) + CFG.cardGap, y: CFG.netSlot.y, w: CFG.netSlot.w, h: CFG.netSlot.h };
}

function beltSpan() {
  return CFG.belt.cells * (CFG.cardSlot.w + CFG.cardGap) - CFG.cardGap;
}

function beltX(i) {
  return CFG.belt.x + i * (CFG.cardSlot.w + CFG.cardGap);
}

function beltStartT() {
  return CFG.belt.interval.normal - CFG.belt.first;
}

function beltItemAt(x, y) {
  const b = CFG.belt;
  const s = CFG.cardSlot;
  for (let i = 0; i < state.belt.length; i++) {
    const it = state.belt[i];
    if (inRect({ x, y }, { x: it.x, y: b.y, w: s.w, h: s.h }) && inRect({ x, y }, { x: b.x, y: b.y, w: beltSpan(), h: s.h })) return i;
  }
  return -1;
}

function heldCard() {
  if (isConveyor()) return state.beltSel >= 0 ? CARDS_BY_ID[state.belt[state.beltSel].id] : null;
  return state.selected === null ? null : CARDS[state.deck[state.selected]];
}

function slotAt(x, y) {
  for (let i = 0; i < slotCount(); i++) {
    if (state.deck[i] === null) continue;
    if (inRect({ x, y }, slotRect(i))) return i;
  }
  return -1;
}

function milkAt(x, y) {
  const s = milkSize();
  const pad = CFG.milk.hitPad;
  for (let i = state.milks.length - 1; i >= 0; i--) {
    const k = state.milks[i];
    if (k.fly) continue;
    if (inRect({ x, y }, { x: k.x - s.w / 2 - pad, y: k.y - s.h / 2 - pad, w: s.w + pad * 2, h: s.h + pad * 2 })) return i;
  }
  return -1;
}

function monThreshold(m) {
  const mi = INFO.monsters[m.type];
  return mi.threshold ?? Math.floor(mi.hp / 3);
}

function initArmor(m) {
  const mi = INFO.monsters[m.type];
  m.a1hp = mi.armor1 ? INFO.armors[mi.armor1].hp : null;
  m.a2hp = mi.armor2 ? INFO.armors[mi.armor2].hp : null;
}

function feetLine(row) {
  return cellCenter(row, 0).y + CFG.monster.feet;
}

function armorDrop(m, key) {
  if (!key) return;
  const a = INFO.armors[key];
  const s = plantSize(imgs['arm_' + key], a.scale);
  const fy = feetLine(m.row);
  state.drops.push({ key, x: m.x + a.dx, y: fy + a.dy, target: fy - s.h / 2, t: 0 });
}

function makeCorpse(m) {
  return { type: m.type, x: m.x, row: m.row, t: 0, sf: m.slow > 0 ? CFG.monster.slow : 1 };
}

function hurtBody(m, dmg) {
  const hf = CFG.monster.hitFlash;
  m.hitT = hf;
  if (m.a1hp) {
    m.a1t = hf;
    const over = dmg - m.a1hp;
    m.a1hp = over > 0 ? 0 : m.a1hp - dmg;
    if (!m.a1hp) armorDrop(m, INFO.monsters[m.type].armor1);
    if (over > 0) m.hp -= over;
    return;
  }
  m.hp -= dmg;
}

function makeAsh(m) {
  return { type: m.type, x: m.x, row: m.row, t: 0, a1: !!m.a1hp, a2: !!m.a2hp };
}

function ashKill(m) {
  m.hp = 0;
  state.ashes.push(makeAsh(m));
}

function hurtArea(m, dmg, ash) {
  if (ash && dmg > m.hp) { ashKill(m); return; }
  const hf = CFG.monster.hitFlash;
  m.hitT = hf;
  if (m.a2hp) {
    m.a2t = hf;
    m.a2hp = Math.max(0, m.a2hp - dmg);
    if (!m.a2hp) armorDrop(m, INFO.monsters[m.type].armor2);
  }
  hurtBody(m, dmg);
}

function monWaveHp(m) {
  const w = CFG.wave;
  return m.hp + (m.a1hp || 0) * w.armor1Weight + (m.a2hp || 0) * w.armor2Weight;
}

function bodyHit(m, b) {
  return m.row === b.row && Math.abs(b.x - m.x) <= CFG.hitDist;
}

function armor2Hit(m, b) {
  if (!m.a2hp) return false;
  const a = INFO.armors[INFO.monsters[m.type].armor2];
  return m.row === b.row && Math.abs(b.x - (m.x + a.dx)) <= CFG.hitDist * a.hitbox;
}

function bulletHitKind(m, b) {
  if (armor2Hit(m, b)) return 2;
  return bodyHit(m, b) ? 1 : 0;
}

function spawnMonster(row, key, wave) {
  for (let i = 0; i < CFG.rows; i++) {
    if (i === row) {
      state.rowSecondLast[i] = state.rowLast[i];
      state.rowLast[i] = 0;
    } else {
      state.rowLast[i]++;
      state.rowSecondLast[i]++;
    }
  }
  const mi = INFO.monsters[key];
  const m = { row, x: CFG.W + 60, hp: mi.hp, bleedT: 0, hitT: 0, a1t: 0, a2t: 0, type: key, wave, speed: randRange(mi.speedMin, mi.speedMax) };
  initArmor(m);
  state.monsters.push(m);
  return m;
}

function manualSpawn() {
  spawnMonster(pickRow(), INFO.tracklist[state.slot].spawnTable[0], 0);
}

function rowWeight(i) {
  const w = 1 / CFG.rows;
  const pl = (6 * state.rowLast[i] * w + 6 * w - 3) / 4;
  const psl = (state.rowSecondLast[i] * w + w - 1) / 4;
  return w * Math.min(Math.max(pl + psl, 0.01), 100);
}

function pickRow() {
  const lv = INFO.tracklist[state.slot];
  if (lv.rows) return lv.rows[Math.floor(Math.random() * lv.rows.length)];
  const ws = [];
  let total = 0;
  for (let i = 0; i < CFG.rows; i++) {
    const v = rowWeight(i);
    ws.push(v);
    total += v;
  }
  let r = Math.random() * total;
  for (let i = 0; i < ws.length; i++) {
    r -= ws[i];
    if (r < 0) return i;
  }
  return ws.length - 1;
}

function pickMonster(table) {
  let total = 0;
  for (const k of table) total += INFO.monsters[k].weight;
  let r = Math.random() * total;
  for (const k of table) {
    r -= INFO.monsters[k].weight;
    if (r < 0) return k;
  }
  return table[table.length - 1];
}

const BELT_ADJUST = {};

function beltCount(id) {
  let n = 0;
  for (const b of state.belt) if (b.id === id) n++;
  return n;
}

function beltWeight(id) {
  const cp = CFG.belt.countPenalty, pv = CFG.belt.penaltyValues, n = beltCount(id);
  const base = INFO.tracklist[state.slot].beltTable.find(e => e.id === id).weight;
  const tier = n >= cp[1] ? pv[1] : n >= cp[0] ? pv[0] : base;
  const pen = state.beltLast === id ? Math.pow(CFG.belt.lastMul, state.beltLayers) : 1;
  return tier * pen;
}

function pickBeltId() {
  const lv = INFO.tracklist[state.slot];
  const f = BELT_ADJUST[state.slot];
  let total = 0;
  const ws = lv.beltTable.map(e => {
    const bctx = { id: e.id, weight: beltWeight(e.id), belt: state.belt, plants: state.plants, monsters: state.monsters, clock: state.clock, milk: state.milk, count: beltCount };
    const a = f ? f(e.id, bctx) : undefined;
    const wv = a === undefined ? beltWeight(e.id) : a;
    total += wv;
    return wv;
  });
  let r = Math.random() * total;
  for (let i = 0; i < ws.length; i++) {
    r -= ws[i];
    if (r < 0) return lv.beltTable[i].id;
  }
  return lv.beltTable[lv.beltTable.length - 1].id;
}

function beltPush() {
  const lv = INFO.tracklist[state.slot];
  let id;
  if (state.beltPresetAt < lv.beltPreset.length) {
    id = lv.beltPreset[state.beltPresetAt];
    state.beltPresetAt++;
  } else id = pickBeltId();
  if (state.beltLast === id) state.beltLayers++;
  else {
    state.beltLast = id;
    state.beltLayers = 1;
  }
  state.belt.push({ id, x: CFG.belt.x + beltSpan() });
}

function updateBelt(dt) {
  const b = CFG.belt;
  state.beltScroll = (state.beltScroll + b.speed * dt) % (CFG.cardSlot.w + CFG.cardGap);
  for (let i = 0; i < state.belt.length; i++) {
    const it = state.belt[i];
    it.x -= b.speed * dt;
    const lim = beltX(i);
    if (it.x < lim) it.x = lim;
  }
  if (state.belt.length < b.cells) {
    state.beltT += dt;
    if (state.beltT >= (state.belt.length > b.overAt ? b.interval.over : b.interval.normal)) {
      state.beltT = 0;
      beltPush();
    }
  }
}

function showBanner(text, hold) {
  state.banners.push({ text, hold, t: 0 });
}

function showHint(text, hold) {
  if (!INFO.tracklist[state.slot].hintEvents) return;
  state.hintEvent = { text, t: 0, hold: hold === undefined ? null : hold };
}

function hideHint() {
  state.hintEvent = null;
}

const HINT_RULES = {};

HINT_RULES.test2 = () => {
  const n = state.plants.filter(p => CARDS[p.card].key === 'milk').length;
  return n < 3 ? '请至少放置3只咪璐库！' : null;
};

HINT_RULES.lv11 = () => {
  if (state.placeTimes.length === 0) {
    if (state.selected !== null) return '点击格子将其放置在空位上！';
    return '点击伙伴卡片将其选中！';
  }
  if (state.placeTimes.length >= 2) return null;
  if (!state.milkClicked) return state.milkDropped > 0 ? '点击掉落的milk来收集它！' : null;
  return state.milk >= CARDS[cardBySlotId(1)].info.costmilk ? '太棒了！你收集的milk已经足够召集一个伙伴了！' : '继续收集milk！你需要它来召集更多伙伴！';
};

function isBigWave(w) {
  return w % CFG.wave.bigEvery === 0 || w === INFO.tracklist[state.slot].waves;
}

function bigShown() {
  return INFO.tracklist[state.slot].bigWave !== false;
}

function randWaveGap() {
  const g = CFG.wave;
  if (state.wave === 0) return levelFirstGap(state.slot);
  return bigShown() && isBigWave(state.wave + 1) ? g.bigGap : g.gapMin + Math.random() * (g.gapMax - g.gapMin);
}

function spawnWave() {
  const lv = INFO.tracklist[state.slot];
  const unit = Math.min(Math.ceil(state.wave / CFG.wave.div), CFG.wave.cap);
  let budget = unit * lv.spawnMul;
  if (isBigWave(state.wave)) budget *= CFG.wave.bigMul;
  budget = Math.ceil(budget);
  let sum = 0;
  state.waveHp = 0;
  if (state.wave === lv.waves) {
    for (const key of lv.spawnTable) {
      const m = spawnMonster(pickRow(), key, state.wave);
      sum += INFO.monsters[key].level;
      state.waveHp += monWaveHp(m);
    }
  }
  if (isBigWave(state.wave)) {
    const seed = Math.min(unit, budget - sum);
    for (let i = 0; i < seed; i++) {
      const m = spawnMonster(pickRow(), CFG.wave.bigSeed, state.wave);
      sum += INFO.monsters[CFG.wave.bigSeed].level;
      state.waveHp += monWaveHp(m);
    }
  }
  while (sum < budget) {
    const key = pickMonster(lv.spawnTable.filter(k => INFO.monsters[k].level <= budget - sum));
    const m = spawnMonster(pickRow(), key, state.wave);
    sum += INFO.monsters[key].level;
    state.waveHp += monWaveHp(m);
  }
  if (state.wave === lv.waves) showBanner('最后攻势', CFG.banner.lastHold);
}

function cutWaveGap(gap) {
  const passed = state.clock - state.lastSpawn;
  if (state.waveGap - passed > gap) state.waveGap = passed + gap;
}

function waveCutCheck() {
  if (bigShown() && isBigWave(state.wave + 1)) {
    if (state.monsters.length === 0) cutWaveGap(CFG.wave.bigCutGap);
    return;
  }
  let hp = 0;
  for (const m of state.monsters) if (m.wave === state.wave) hp += monWaveHp(m);
  if (hp < state.waveHp * CFG.wave.hpCut) cutWaveGap(CFG.wave.cutGap);
}

function waveWarnCheck() {
  if (state.bigWarned || !bigShown() || !isBigWave(state.wave + 1)) return;
  if (state.waveGap - (state.clock - state.lastSpawn) > CFG.wave.bigWarnGap) return;
  state.bigWarned = true;
  showBanner('一大波敌人正在靠近', CFG.banner.bigHold);
}

function resultCheck() {
  if (state.result) return;
  if (state.monsters.some(m => { const b = monsterBox(m); return b.x - b.w / 2 <= 0; })) {
    state.result = 'lose';
    return;
  }
}

function lastWaveSettled() {
  const lv = INFO.tracklist[state.slot];
  return state.wave === lv.waves && !state.monsters.some(m => m.wave === lv.waves && m.hp >= monThreshold(m));
}

function rewardCheck() {
  if (state.reward || state.ceremony || state.result) return;
  if (!lastWaveSettled()) return;
  const dying = state.monsters.filter(m => m.hp < monThreshold(m));
  if (dying.length > 0) state.monsters = state.monsters.filter(m => m.hp >= monThreshold(m));
  if (state.monsters.length > 0) return;
  let src = null;
  for (const m of dying) if (!src || m.x > src.x) src = m;
  spawnReward(src);
}

function gmilkRestX() {
  return CFG.grid.x - plantSize(imgs.golden_milk, CFG.gmilk.scale).w / 2;
}

function resetGmilks(s) {
  s.gmilks = [];
  const rows = INFO.tracklist[s.slot].rows || Array.from({ length: CFG.rows }, (_, r) => r);
  for (const r of rows) s.gmilks.push({ row: r, x: gmilkRestX(), launched: false });
}

function gmilkRect(b) {
  const g = CFG.grid;
  const s = plantSize(imgs.golden_milk, CFG.gmilk.scale);
  return { x: b.x, y: g.y + (b.row + 1) * g.ch - CFG.footMargin - s.h / 2, w: s.w, h: s.h };
}

function gmilkHit(m, r) {
  const b = hitBox(m);
  const fy = b.y + b.h / 2;
  return Math.abs(b.x - r.x) <= r.w / 2 + b.w / 2 && fy >= r.y - r.h / 2 && fy <= r.y + r.h / 2;
}

function uiRects() {
  const menuBtn = { x: CFG.W - 160, y: 24, w: 136, h: 72 };
  const panel = { x: (CFG.W - 960) / 2, y: (CFG.H - 620) / 2, w: 960, h: 620 };
  const rowY = panel.y + panel.h - 96;
  const btnW = 280;
  const total = btnW * 3 + 40 * 2;
  const bx = (CFG.W - total) / 2;
  const confirm = { x: (CFG.W - 640) / 2 + 60, y: (CFG.H - 260) / 2 + 150, w: 240, h: 64 };
  const rp = { x: (CFG.W - 1040) / 2, y: (CFG.H - 260) / 2, w: 1040, h: 260 };
  const ep = { x: (CFG.W - 640) / 2, y: (CFG.H - 260) / 2, w: 640, h: 260 };
  const rbW = 260;
  const rbX = (CFG.W - (rbW * 3 + 30 * 2)) / 2;
  const rbY = rp.y + 150;
  return {
    menuBtn,
    panel,
    optRow: i => ({ x: panel.x + 60, y: panel.y + 140 + i * 100, w: panel.w - 120, h: 60 }),
    quitBtn: { x: bx, y: rowY, w: btnW, h: 64 },
    restartBtn: { x: bx + btnW + 40, y: rowY, w: btnW, h: 64 },
    resumeBtn: { x: bx + (btnW + 40) * 2, y: rowY, w: btnW, h: 64 },
    confirmPanel: { x: (CFG.W - 640) / 2, y: (CFG.H - 260) / 2, w: 640, h: 260 },
    confirmYes: confirm,
    confirmNo: { x: confirm.x + confirm.w + 40, y: confirm.y, w: 240, h: 64 },
    resumePanel: rp,
    resumeBack: { x: rbX, y: rbY, w: rbW, h: 64 },
    resumeRestart: { x: rbX + rbW + 30, y: rbY, w: rbW, h: 64 },
    resumeGo: { x: rbX + (rbW + 30) * 2, y: rbY, w: rbW, h: 64 },
    resultPanel: ep,
    loseBack: { x: ep.x + 60, y: ep.y + 150, w: 240, h: 64 },
    loseRetry: { x: ep.x + 60 + 240 + 40, y: ep.y + 150, w: 240, h: 64 },
  };
}

function hasRunRecord(s) {
  return s.clock > 0 || s.plants.length > 0 || s.monsters.length > 0 ||
    s.milks.length > 0 || s.effects.length > 0;
}

function resetRun() {
  state.plants = [];
  state.monsters = [];
  state.deaths = [];
  state.drops = [];
  state.ashes = [];
  state.flash = null;
  state.reward = null;
  state.ceremony = null;
  state.bullets = [];
  state.milks = [];
  state.effects = [];
  state.milk = levelStartMilk(state.slot);
  state.milkShown = levelStartMilk(state.slot);
  state.deck = fullDeck();
  state.cool = deckCool(state.deck);
  state.deckPhase = null;
  state.deckT = 0;
  state.camX = 0;
  state.lineup = [];
  state.flights = [];
  state.belt = [];
  state.beltT = beltStartT();
  state.beltLast = null;
  state.beltLayers = 0;
  state.beltPresetAt = 0;
  state.beltSel = -1;
  state.beltScroll = 0;
  state.clock = 0;
  state.wave = 0;
  state.waveGap = levelFirstGap(state.slot);
  state.waveHp = 0;
  state.bigWarned = false;
  state.banners = [];
  state.hintRule = null;
  state.hintEvent = null;
  state.result = null;
  state.rowLast = Array(CFG.rows).fill(CFG.wave.rowInit);
  state.rowSecondLast = Array(CFG.rows).fill(CFG.wave.rowInit);
  state.lastSpawn = 0;
  state.lastMilk = 0;
  state.milkDropped = 0;
  state.placeTimes = [];
  state.milkClicked = false;
  state.milkInterval = randMilkInterval();
  resetGmilks(state);
  state.selected = null;
  state.net = false;
  bgm.currentTime = 0;
  state.bgmAt = 0;
}

function coolStart(info) {
  return info.cd === 'slow' || info.cd === 'very slow' ? INFO.cdTiers[info.cd] * INFO.cdFirst : 0;
}

function usableCards(k) {
  const lv = INFO.tracklist[k === undefined ? state.slot : k];
  const out = [];
  for (let i = 0; i < CARDS.length; i++) if (lv.test === true || isCardUnlocked(CARDS[i].info.id)) out.push(i);
  return out;
}

function fullDeck(k) {
  const d = [];
  const u = usableCards(k);
  for (let i = 0; i < slotCount(k); i++) d.push(i < u.length ? u[i] : null);
  return d;
}

function emptyDeck(k) {
  return Array(slotCount(k)).fill(null);
}

function deckCool(d) {
  return d.map(ci => (ci === null ? 0 : coolStart(CARDS[ci].info)));
}

function deckTarget() {
  return Math.min(slotCount(), usableCards().length);
}

function deckPicked() {
  return state.deck.filter(ci => ci !== null).length;
}

function deckFull() {
  return deckPicked() >= deckTarget();
}

function deckRise() {
  const u = Math.min(1, state.deckT / CFG.deck.rise);
  const dist = CFG.H - CFG.deck.panel.y;
  return state.deckPhase === 'out' ? smooth(u) * dist : (1 - smooth(u)) * dist;
}

function deckMark(t) {
  for (const m of CFG.deck.marks) {
    if (t >= m[1] && t < m[1] + m[2]) return m[0];
  }
  return null;
}

function buildLineup() {
  const keys = [];
  const ws = [];
  for (const k of INFO.tracklist[state.slot].spawnTable) {
    const at = keys.indexOf(k);
    if (at < 0) {
      keys.push(k);
      ws.push(INFO.monsters[k].weight);
    } else ws[at] += INFO.monsters[k].weight;
  }
  const total = Math.max(CFG.deck.minShow, keys.length);
  const extra = total - keys.length;
  const sum = ws.reduce((a, b) => a + b, 0);
  const raw = ws.map(w => (extra * w) / sum);
  const add = raw.map(v => Math.floor(v));
  let rest = extra - add.reduce((a, b) => a + b, 0);
  const byRemainder = raw.map((v, i) => [v - add[i], i]).sort((a, b) => b[0] - a[0]);
  for (const p of byRemainder) {
    if (rest <= 0) break;
    add[p[1]]++;
    rest--;
  }
  const types = [];
  for (let i = 0; i < keys.length; i++) for (let j = 0; j < 1 + add[i]; j++) types.push(keys[i]);
  const d = CFG.deck;
  const g = CFG.grid;
  const bx0 = g.x + CFG.cols * g.cw;
  const bx1 = d.cam + CFG.W - d.showPad;
  const n = types.length;
  const nc = Math.min(n, Math.max(1, Math.ceil(Math.sqrt((n * (bx1 - bx0)) / (g.ch * (CFG.rows - 1))))));
  const nr = Math.ceil(n / nc);
  const cellW = (bx1 - bx0) / nc;
  const cellR = (CFG.rows - 1) / nr;
  const jx = Math.max(0, (cellW - d.showGap) / 2);
  const jy = Math.max(0, (cellR * g.ch - d.showGap) / 2);
  const cells = [];
  for (let i = 0; i < nc * nr; i++) cells.push(i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = 1 + Math.floor(Math.random() * i);
    const t = cells[i];
    cells[i] = cells[j];
    cells[j] = t;
  }
  return types.map((k, i) => {
    const c = cells[i];
    const m = {
      type: k,
      x: bx0 + (c % nc + 0.5) * cellW + randRange(-jx, jx),
      row: (Math.floor(c / nc) + 0.5) * cellR + randRange(-jy / g.ch, jy / g.ch),
    };
    initArmor(m);
    return m;
  });
}

function needPick() {
  if (isConveyor()) return false;
  return INFO.tracklist[state.slot].deckSelect !== false && slotCount() < usableCards().length;
}

function beginRun() {
  if (INFO.tracklist[state.slot].showMonsters === false) {
    playBgm();
    return;
  }
  beginDeck(needPick());
}

function beginDeck(pick) {
  playPickMusic();
  state.deck = (pick || isConveyor()) ? emptyDeck() : fullDeck();
  state.cool = deckCool(state.deck);
  state.lineup = buildLineup();
  state.camX = 0;
  state.deckT = 0;
  state.deckPhase = 'in';
  state.flights = [];
  state.selected = null;
  state.net = false;
}

function smooth(p) {
  return p * p * (3 - 2 * p);
}

function updateDeck(raw) {
  const d = CFG.deck;
  state.deckT += raw;
  for (const f of state.flights) f.t += raw;
  state.flights = state.flights.filter(f => f.t < f.dur);
  if (state.deckPhase === 'in') {
    const t = state.deckT;
    state.camX = t <= d.hold ? 0 : d.cam * smooth(Math.min(1, (t - d.hold) / d.panIn));
    if (t >= d.hold + d.panIn + d.settle) {
      state.camX = d.cam;
      state.deckPhase = needPick() ? 'pick' : 'out';
      state.deckT = 0;
    }
    return;
  }
  if (state.deckPhase === 'out') {
    const u = Math.min(1, state.deckT / d.panOut);
    state.camX = d.cam * (1 - smooth(u));
    if (u >= 1) {
      state.camX = 0;
      state.lineup = [];
      state.deckPhase = 'count';
      state.deckT = 0;
    }
  }
  if (state.deckPhase === 'count') {
    const w = plantSize(imgs.golden_milk, CFG.gmilk.scale).w;
    for (let i = 0; i < state.gmilks.length; i++) {
      const u = Math.min(1, Math.max(0, (state.deckT - d.milkAt - i * d.milkStep) / d.milkPan));
      state.gmilks[i].x = -w / 2 + CFG.grid.x * smooth(u);
    }
    if (state.deckT >= d.count) {
      resetGmilks(state);
      state.deckPhase = null;
      state.deckT = 0;
      stopPickMusic();
      playBgm();
    }
  }
}

function confirmDeck() {
  state.cool = deckCool(state.deck);
  state.deckPhase = 'out';
  state.deckT = 0;
  state.flights = [];
}

function deckRects() {
  const p = CFG.deck.panel;
  const q = CFG.deck.pool;
  const rowW = q.cols * q.w + (q.cols - 1) * q.gapX;
  const x0 = Math.round(p.x + (p.w - rowW) / 2);
  const poolY = p.y + 20;
  const btnY = poolY + q.rows * (q.h + q.gapY) - q.gapY + 22;
  return {
    panel: { x: p.x, y: p.y, w: p.w, h: btnY + 86 - p.y },
    slots: i => slotRect(i),
    pool: i => ({ x: x0 + (i % q.cols) * (q.w + q.gapX), y: poolY + Math.floor(i / q.cols) * (q.h + q.gapY), w: q.w, h: q.h }),
    start: { x: Math.round(p.x + (p.w - 360) / 2), y: btnY, w: 360, h: 64 },
  };
}

function cardBySlotId(id) {
  for (let i = 0; i < CARDS.length; i++) {
    if (CARDS[i].info.id === id) return i;
  }
  return -1;
}

function poolCard(ui, pt) {
  const q = CFG.deck.pool;
  const u = usableCards();
  for (let i = 0; i < q.rows * q.cols; i++) {
    const ci = cardBySlotId(i + 1);
    if (ci >= 0 && !u.includes(ci)) continue;
    if (ci >= 0 && inRect(pt, ui.pool(i))) return ci;
  }
  return -1;
}

function flying(ci) {
  return state.flights.some(f => f.ci === ci);
}

function deckFly(ci, from, to, dur) {
  state.flights.push({ ci, x0: from.x, y0: from.y, w0: from.w, h0: from.h, x1: to.x, y1: to.y, w1: to.w, h1: to.h, t: 0, dur });
}

function poolCellRect(ui, ci) {
  const r = ui.pool(CARDS[ci].info.id - 1);
  return { x: r.x, y: r.y + deckRise(), w: r.w, h: r.h };
}

function deckRemove(ui, at) {
  const back = state.deck[at];
  state.deck[at] = null;
  deckFly(back, ui.slots(at), poolCellRect(ui, back), CFG.deck.fly);
  for (let k = at + 1; k < slotCount(); k++) {
    const ci = state.deck[k];
    if (ci === null) continue;
    state.deck[k] = null;
    state.deck[k - 1] = ci;
    deckFly(ci, ui.slots(k), ui.slots(k - 1), CFG.deck.shift);
  }
}

function drawFlights() {
  for (const f of state.flights) {
    const p = smooth(Math.min(1, f.t / f.dur));
    drawCardFace({
      x: f.x0 + (f.x1 - f.x0) * p,
      y: f.y0 + (f.y1 - f.y0) * p,
      w: f.w0 + (f.w1 - f.w0) * p,
      h: f.h0 + (f.h1 - f.h0) * p
    }, CARDS[f.ci]);
  }
}

function drawEmptySlot(r) {
  ctx.strokeStyle = CFG.cardFace.ring;
  ctx.lineWidth = CFG.cardFace.ringW;
  roundRect(r.x, r.y, r.w, r.h, CFG.cardFace.ringR);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawCardFace(r, card) {
  ctx.drawImage(imgs['card_' + card.key], r.x, r.y + CFG.cardFace.offset, r.w, r.w);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + CFG.cardFace.costFont + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(card.info.costmilk), r.x + r.w / 2, r.y + r.h - CFG.cardFace.costPad);
  ctx.strokeStyle = CFG.cardFace.ring;
  ctx.lineWidth = CFG.cardFace.ringW;
  roundRect(r.x, r.y, r.w, r.h, CFG.cardFace.ringR);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawPickRing(r) {
  ctx.strokeStyle = '#ffe14a';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#ffe14a';
  ctx.shadowBlur = 24;
  roundRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 16);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
}

function drawMenuBtn(active) {
  const r = uiRects().menuBtn;
  drawButton(r, '菜单');
  if (!active) {
    ctx.fillStyle = CFG.cardFace.gray;
    roundRect(r.x, r.y, r.w, r.h, 16);
    ctx.fill();
  }
}

function drawMenuPanel(ui) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.fillStyle = 'rgba(70,50,25,0.95)';
  roundRect(ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('选项设置', ui.panel.x + ui.panel.w / 2, ui.panel.y + 70);
  const vo = visibleOpts();
  for (let i = 0; i < vo.length; i++) {
    const r = ui.optRow(i);
    const on = state.opts[vo[i].key];
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x, r.y + 10, 40, 40);
    if (on) {
      ctx.beginPath();
      ctx.moveTo(r.x + 8, r.y + 30);
      ctx.lineTo(r.x + 17, r.y + 40);
      ctx.lineTo(r.x + 32, r.y + 20);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(vo[i].label, r.x + 56, r.y + 30);
  }
  drawButton(ui.menuBtn, '菜单');
  ctx.lineWidth = 1;
  drawButton(ui.quitBtn, '退出');
  drawButton(ui.restartBtn, '重新开始');
  drawButton(ui.resumeBtn, '继续游戏');
}

function drawConfirmPanel(ui) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  drawPanel(ui.confirmPanel);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('你确定要重新开始这个游戏吗？', ui.confirmPanel.x + ui.confirmPanel.w / 2, ui.confirmPanel.y + 80);
  drawButton(ui.confirmYes, '确定');
  drawButton(ui.confirmNo, '返回');
}

function renderDeck() {
  const camX = state.camX;
  drawFieldBg(camX);
  ctx.save();
  ctx.translate(-camX, 0);
  drawGrid(CFG.grid);
  for (const m of state.lineup) {
    const b = monsterBox(m);
    drawShadow(b.x, b.y + b.h / 2, b.w * CFG.shadow.monster);
  }
  for (const m of state.lineup) drawMonster(m);
  ctx.restore();

  if (!needPick() || state.deckPhase === 'in') return;

  const ui = deckRects();
  drawTopHud(state.deckPhase === 'pick');

  const picking = state.deckPhase === 'pick';
  drawMenuBtn(picking);
  const off = deckRise();
  ctx.save();
  ctx.translate(0, off);
  const hov = { x: state.mouse.x, y: state.mouse.y - off };
  drawPanel(ui.panel);

  const q = CFG.deck.pool;
  const usable = usableCards();
  for (let i = 0; i < q.rows * q.cols; i++) {
    const r = ui.pool(i);
    const ci = cardBySlotId(i + 1);
    if (ci >= 0 && !usable.includes(ci)) continue;
    if (ci < 0) {
      drawEmptySlot(r);
      continue;
    }
    drawCardFace(r, CARDS[ci]);
    if (state.deck.includes(ci)) {
      ctx.fillStyle = CFG.cardFace.gray;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    } else if (picking && inRect(hov, r)) drawPickRing(r);
  }

  drawButton(ui.start, '开始游戏');
  if (!deckFull()) {
    ctx.fillStyle = CFG.cardFace.gray;
    roundRect(ui.start.x, ui.start.y, ui.start.w, ui.start.h, 16);
    ctx.fill();
  }
  ctx.restore();
  drawFlights();
  const ru = uiRects();
  if (state.menuOpen) drawMenuPanel(ru);
  if (state.confirmRestart) drawConfirmPanel(ru);
}

function deckClick(p) {
  if (state.deckPhase !== 'pick') return;
  const ui = deckRects();
  if (inRect(p, uiRects().menuBtn)) {
    setMenu(true);
    return;
  }
  const q = { x: p.x, y: p.y - deckRise() };
  if (deckFull() && inRect(q, ui.start)) {
    confirmDeck();
    return;
  }
  for (let i = 0; i < slotCount(); i++) {
    if (state.deck[i] !== null && !flying(state.deck[i]) && inRect(p, ui.slots(i))) {
      deckRemove(ui, i);
      return;
    }
  }
  const ci = poolCard(ui, q);
  if (ci < 0) return;
  if (state.deck.includes(ci)) return;
  const empty = state.deck.indexOf(null);
  if (empty < 0) return;
  state.deck[empty] = ci;
  deckFly(ci, poolCellRect(ui, ci), ui.slots(empty), CFG.deck.fly);
}

function deckHover() {
  const ui = deckRects();
  let ptr = false;
  if (state.deckPhase === 'pick') {
    const m = { x: state.mouse.x, y: state.mouse.y - deckRise() };
    const at = poolCard(ui, m);
    ptr = inRect(state.mouse, uiRects().menuBtn) ||
      (deckFull() && inRect(m, ui.start)) ||
      state.deck.some((ci, i) => ci !== null && !flying(ci) && inRect(state.mouse, ui.slots(i))) ||
      (at >= 0 && !state.deck.includes(at));
  }
  canvas.style.cursor = ptr ? 'pointer' : 'default';
}

function plantAt(row, col) {
  return state.plants.some(p => p.row === row && p.col === col);
}

function plantAtPoint(x, y) {
  const g = CFG.grid;
  for (let i = state.plants.length - 1; i >= 0; i--) {
    const p = state.plants[i];
    const card = CARDS[p.card];
    const s = plantSize(imgs['ptn_' + card.key], card.info.scale);
    const c = cellCenter(p.row, p.col);
    const cy = g.y + (p.row + 1) * g.ch - CFG.footMargin - s.h / 2;
    if (Math.abs(x - c.x) <= s.w / 2 && Math.abs(y - cy) <= s.h / 2) return i;
  }
  return -1;
}

function rowAllowed(row) {
  const rows = INFO.tracklist[state.slot].rows;
  return !rows || rows.includes(row);
}

function canPlant(cell) {
  return !!cell && cell.col < CFG.plantCols && !plantAt(cell.row, cell.col) && rowAllowed(cell.row);
}

function plantSize(img, scale) {
  const h = CFG.grid.ch * scale;
  return { w: h * img.width / img.height, h };
}

function effectSize(img, scale) {
  const w = CFG.grid.cw * scale;
  return { w, h: w * img.height / img.width };
}

function drawPartner(x, y, alpha, img, scale, flip, flashKey) {
  const s = plantSize(img, scale);
  ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -s.w / 2, -s.h / 2, s.w, s.h);
    if (flashKey) {
      ctx.globalAlpha = alpha * CFG.monster.hitAlpha;
      ctx.drawImage(flashSprite(flashKey, s), -s.w / 2, -s.h / 2, s.w, s.h);
    }
    ctx.restore();
  } else {
    ctx.drawImage(img, x - s.w / 2, y - s.h / 2, s.w, s.h);
    if (flashKey) {
      ctx.globalAlpha = alpha * CFG.monster.hitAlpha;
      ctx.drawImage(flashSprite(flashKey, s), x - s.w / 2, y - s.h / 2, s.w, s.h);
    }
  }
  ctx.globalAlpha = 1;
}

function drawShadow(cx, groundY, w) {
  const sh = CFG.shadow;
  ctx.save();
  ctx.fillStyle = 'rgba(' + sh.color + ',' + sh.alpha + ')';
  ctx.beginPath();
  ctx.ellipse(cx, groundY, w / 2, (w / 2) * sh.squash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function monsterBox(m) {
  const s = plantSize(imgs['enm_' + m.type], INFO.monsters[m.type].scale);
  return { x: m.x, y: cellCenter(m.row, 0).y + CFG.monster.feet - s.h / 2, w: s.w, h: s.h };
}

function hitBox(m) {
  const b = monsterBox(m);
  const f = INFO.monsters[m.type].hitbox || 1;
  const h = b.h * f;
  return { x: b.x, y: b.y + b.h / 2 - h / 2, w: b.w * f, h };
}

const slowImgs = {};

function slowSprite(key) {
  if (slowImgs[key]) return slowImgs[key];
  const img = imgs['enm_' + key];
  const s = plantSize(img, INFO.monsters[key].scale);
  const c = document.createElement('canvas');
  c.width = Math.ceil(s.w);
  c.height = Math.ceil(s.h);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = CFG.monster.slowAlpha;
  g.fillStyle = CFG.monster.slowColor;
  g.fillRect(0, 0, c.width, c.height);
  slowImgs[key] = c;
  return c;
}

const armorImgs = {};

function armorSprite(key) {
  if (armorImgs[key]) return armorImgs[key];
  const img = imgs['arm_' + key];
  const s = plantSize(img, INFO.armors[key].scale);
  const c = document.createElement('canvas');
  c.width = Math.ceil(s.w);
  c.height = Math.ceil(s.h);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = CFG.monster.slowAlpha;
  g.fillStyle = CFG.monster.slowColor;
  g.fillRect(0, 0, c.width, c.height);
  armorImgs[key] = c;
  return c;
}

const flashImgs = {};

function flashSprite(key, s) {
  if (flashImgs[key]) return flashImgs[key];
  const c = document.createElement('canvas');
  c.width = Math.ceil(s.w);
  c.height = Math.ceil(s.h);
  const g = c.getContext('2d');
  g.drawImage(imgs[key], 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = CFG.monster.hitColor;
  g.fillRect(0, 0, c.width, c.height);
  flashImgs[key] = c;
  return c;
}

const ashImgs = {};

function ashSprite(key, s) {
  if (ashImgs[key]) return ashImgs[key];
  const c = document.createElement('canvas');
  c.width = Math.ceil(s.w);
  c.height = Math.ceil(s.h);
  const g = c.getContext('2d');
  g.drawImage(imgs[key], 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = CFG.monster.ash.color;
  g.fillRect(0, 0, c.width, c.height);
  ashImgs[key] = c;
  return c;
}

function drawArmor(m, key, hp, tint, flash) {
  if (!key || !hp) return;
  const a = INFO.armors[key];
  const b = monsterBox(m);
  const s = plantSize(imgs['arm_' + key], a.scale);
  const cx = b.x + a.dx;
  const cy = b.y + b.h / 2 + a.dy;
  ctx.drawImage(tint ? armorSprite(key) : imgs['arm_' + key], cx - s.w / 2, cy - s.h / 2, s.w, s.h);
  if (flash) {
    ctx.globalAlpha = CFG.monster.hitAlpha;
    ctx.drawImage(flashSprite('arm_' + key, s), cx - s.w / 2, cy - s.h / 2, s.w, s.h);
    ctx.globalAlpha = 1;
  }
}

function drawArmors(m) {
  const mi = INFO.monsters[m.type];
  drawArmor(m, mi.armor1, m.a1hp, m.slow > 0 || m.freeze > 0, m.a1t > 0);
  drawArmor(m, mi.armor2, m.a2hp, false, m.a2t > 0);
}

function drawFreezeTrap(m) {
  const tp = CFG.monster.freezeTrap;
  const w = imgs['icetrap'].width * tp.scale;
  const h = imgs['icetrap'].height * tp.scale;
  ctx.drawImage(imgs['icetrap'], m.x - w / 2, feetLine(m.row) - h + tp.dy, w, h);
}

function drawMonster(m) {
  const b = monsterBox(m);
  const bite = 0.3;
  const k = m.eat && m.biteT > bite ? (m.biteT - bite) / 0.3 : 0;
  ctx.save();
  ctx.translate(b.x - 8 * k, b.y + b.h / 2);
  ctx.scale(1 + 0.15 * k, 1 - 0.12 * k);
  ctx.drawImage(m.slow > 0 || m.freeze > 0 ? slowSprite(m.type) : imgs['enm_' + m.type], -b.w / 2, -b.h, b.w, b.h);
  if (m.hitT > 0) {
    ctx.globalAlpha = CFG.monster.hitAlpha;
    ctx.drawImage(flashSprite('enm_' + m.type, b), -b.w / 2, -b.h, b.w, b.h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawArmors(m);
  if (m.freeze > 0) drawFreezeTrap(m);
}

function drawCorpse(c) {
  const d = CFG.monster.death;
  const u = Math.min(1, c.t / d.fall);
  const k = u * u;
  const img = imgs['enm_' + c.type];
  const s = plantSize(img, INFO.monsters[c.type].scale);
  const pd = CFG.artPad[INFO.monsters[c.type].img] ?? [0, 0, 0, 0];
  const px = pd[0] * s.w / img.width, py = pd[3] * s.h / img.height;
  let a = 1;
  if (c.t >= d.fall + d.hold) a = Math.max(0, 1 - (c.t - d.fall - d.hold) / d.fade);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(c.x - s.w / 2 + px - d.slide * k, feetLine(c.row) - py);
  ctx.rotate(-k * d.angle * Math.PI / 180);
  ctx.drawImage(img, -px, py - s.h, s.w, s.h);
  ctx.restore();
}

function drawAsh(a) {
  const mi = INFO.monsters[a.type];
  const s = plantSize(imgs['enm_' + a.type], mi.scale);
  ctx.drawImage(ashSprite('enm_' + a.type, s), a.x - s.w / 2, feetLine(a.row) - s.h, s.w, s.h);
  const b = monsterBox(a);
  for (const key of [a.a1 && mi.armor1, a.a2 && mi.armor2]) {
    if (!key) continue;
    const ar = INFO.armors[key];
    const as = plantSize(imgs['arm_' + key], ar.scale);
    ctx.drawImage(ashSprite('arm_' + key, as), b.x + ar.dx - as.w / 2, b.y + b.h / 2 + ar.dy - as.h / 2, as.w, as.h);
  }
}

function drawDrop(f) {
  const d = CFG.armor.death;
  const s = plantSize(imgs['arm_' + f.key], INFO.armors[f.key].scale);
  const u = Math.min(1, f.t / d.fall);
  let a = 1;
  if (f.t >= d.fall + d.hold) a = Math.max(0, 1 - (f.t - d.fall - d.hold) / d.fade);
  const h = f.target - f.y;
  ctx.globalAlpha = a;
  ctx.drawImage(imgs['arm_' + f.key], f.x + d.run * u - s.w / 2, f.y + h * (d.push * u + (1 - d.push) * u * u) - s.h / 2, s.w, s.h);
  ctx.globalAlpha = 1;
}

function drawReward() {
  const r = state.reward;
  const hl = CFG.reward.halo;
  const s = rewardSize(r.key);
  const rad = Math.max(s.w, s.h) * hl.radius;
  const gr = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, rad);
  gr.addColorStop(0, 'rgba(' + hl.color + ',' + hl.alpha + ')');
  gr.addColorStop(1, 'rgba(' + hl.color + ',0)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(imgs['rew_' + r.key], r.x - s.w / 2, r.y - s.h / 2, s.w, s.h);
}

function drawCeremony() {
  const c = state.ceremony;
  const ce = CFG.reward.cer;
  const u = Math.min(1, c.t / ce.dur);
  const k = smooth(Math.min(1, c.t / ce.fly));
  const x = c.sx + (CFG.W / 2 - c.sx) * k;
  const y = c.sy + (CFG.H / 2 - c.sy) * k;
  const sc = 1 + (ce.scaleTo - 1) * u;
  const s = rewardSize(c.key);
  const w = s.w * sc;
  const h = s.h * sc;
  const rad = ce.glowFrom + (ce.glowTo - ce.glowFrom) * u;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, 'rgba(' + ce.color + ',' + ce.glowAlpha + ')');
  gr.addColorStop(1, 'rgba(' + ce.color + ',0)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(imgs['rew_' + c.key], x - w / 2, y - h / 2, w, h);
  const white = Math.max(0, Math.min(1, (c.t - (ce.dur - ce.white)) / ce.white));
  if (white > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + white + ')';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
  }
}

function drawFieldBg(camX) {
  const bl = CFG.bgBlur;
  const img = imgs['bg_' + state.slot];
  const w = CFG.W;
  ctx.save();
  ctx.filter = 'blur(' + bl + 'px)';
  for (let t = Math.floor(camX / w); t <= Math.floor((camX + w) / w); t++) {
    const l = t * w - camX;
    if (l >= w || l + w <= 0) continue;
    ctx.save();
    if (t % 2) {
      ctx.translate(l + w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, -bl, -bl, w + bl * 2, CFG.H + bl * 2);
    ctx.restore();
  }
  ctx.filter = 'none';
  ctx.restore();
}

function drawGrid(g) {
  const rows = INFO.tracklist[state.slot].rows;
  ctx.strokeStyle = 'rgba(0,0,0,0.20)';
  ctx.lineWidth = 1;
  for (let r = 0; r <= CFG.rows; r++) {
    if (rows && !rows.includes(r) && !rows.includes(r - 1)) continue;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y + r * g.ch);
    ctx.lineTo(g.x + CFG.plantCols * g.cw, g.y + r * g.ch);
    ctx.stroke();
  }
  const top = rows ? g.y + Math.min(...rows) * g.ch : g.y;
  const bottom = rows ? g.y + (Math.max(...rows) + 1) * g.ch : g.y + CFG.rows * g.ch;
  for (let c = 0; c <= CFG.plantCols; c++) {
    ctx.beginPath();
    ctx.moveTo(g.x + c * g.cw, top);
    ctx.lineTo(g.x + c * g.cw, bottom);
    ctx.stroke();
  }
}

function drawCardHud(pick) {
  const s0 = slotRect(0);
  const s1 = slotRect(slotCount() - 1);
  const mp = CFG.milkSlot;
  ctx.fillStyle = 'rgba(70,50,25,0.65)';
  roundRect(mp.x - 16, mp.y - 12, mp.w + 32, mp.h + 24, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(70,50,25,0.65)';
  roundRect(s0.x - 16, s0.y - 12, s1.x + s1.w - s0.x + 32, s0.h + 24, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  const iconH = 92;
  const iconW = iconH * imgs.milk.width / imgs.milk.height;
  ctx.drawImage(imgs.milk, mp.x + mp.w / 2 - iconW / 2, mp.y + 14, iconW, iconH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(state.milkShown), mp.x + mp.w / 2, mp.y + mp.h - 34);
  const live = !state.deckPhase;
  for (let i = 0; i < slotCount(); i++) {
    const s = slotRect(i);
    const ci = state.deck[i];
    if (pick) {
      if (ci === null || flying(ci)) {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        roundRect(s.x, s.y, s.w, s.h, CFG.cardFace.ringR);
        ctx.fill();
        ctx.strokeStyle = CFG.cardFace.ring;
        ctx.lineWidth = CFG.cardFace.ringW;
        ctx.stroke();
        ctx.lineWidth = 1;
      } else {
        drawCardFace(s, CARDS[ci]);
        if (inRect(state.mouse, s)) drawPickRing(s);
      }
      continue;
    }
    if (ci === null) continue;
    const card = CARDS[ci];
    const short = live && state.milk < card.info.costmilk;
    const cooling = live && state.cool[i] > 0;
    ctx.drawImage(imgs['card_' + card.key], s.x, s.y + CFG.cardFace.offset, s.w, s.w);
    ctx.fillStyle = state.opts.noCool || !short ? '#fff' : CFG.cardFace.costLow;
    ctx.font = 'bold ' + CFG.cardFace.costFont + 'px sans-serif';
    ctx.fillText(String(card.info.costmilk), s.x + s.w / 2, s.y + s.h - CFG.cardFace.costPad);
    if (!state.opts.noCool && (short || cooling)) {
      ctx.fillStyle = CFG.cardFace.gray;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    if (cooling && !state.opts.noCool) {
      const k = state.cool[i] / INFO.cdTiers[card.info.cd];
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(s.x, s.y + s.h * (1 - k), s.w, s.h * k);
    }
    ctx.strokeStyle = CFG.cardFace.ring;
    ctx.lineWidth = CFG.cardFace.ringW;
    roundRect(s.x, s.y, s.w, s.h, CFG.cardFace.ringR);
    ctx.stroke();
    ctx.lineWidth = 1;
    if (state.selected === i) {
      ctx.strokeStyle = '#ffe14a';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#ffe14a';
      ctx.shadowBlur = 24;
      roundRect(s.x - 6, s.y - 6, s.w + 12, s.h + 12, 16);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
    }
  }
}

function drawBelt() {
  const b = CFG.belt;
  const s = CFG.cardSlot;
  const span = beltSpan();
  const step = s.w + CFG.cardGap;
  ctx.fillStyle = b.panelColor;
  roundRect(b.x - 16, b.y - 12, span + 32, s.h + 24, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, span, s.h);
  ctx.clip();
  ctx.fillStyle = b.stripe;
  for (let x = b.x + step - state.beltScroll; x < b.x + span; x += step) ctx.fillRect(x, b.y, 2, s.h);
  for (const it of state.belt) {
    const card = CARDS_BY_ID[it.id];
    ctx.drawImage(imgs['card_' + card.key], it.x, b.y + CFG.cardFace.offset, s.w, s.w);
    ctx.strokeStyle = CFG.cardFace.ring;
    ctx.lineWidth = CFG.cardFace.ringW;
    roundRect(it.x, b.y, s.w, s.h, CFG.cardFace.ringR);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  if (state.beltSel >= 0) drawPickRing({ x: state.belt[state.beltSel].x, y: b.y, w: s.w, h: s.h });
  ctx.restore();
}

function drawTopHud(pick) {
  if (isConveyor()) drawBelt(); else drawCardHud(pick);
  if (!netUnlocked()) return;
  const ns = netRect();
  ctx.fillStyle = 'rgba(70,50,25,0.65)';
  roundRect(ns.x - 16, ns.y - 12, ns.w + 32, ns.h + 24, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.drawImage(imgs.net_err, ns.x, ns.y, ns.w, ns.h);
  ctx.strokeStyle = CFG.cardFace.ring;
  ctx.lineWidth = CFG.cardFace.ringW;
  roundRect(ns.x, ns.y, ns.w, ns.h, CFG.cardFace.ringR);
  ctx.stroke();
  ctx.lineWidth = 1;
  if (state.net) {
    ctx.strokeStyle = '#ffe14a';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#ffe14a';
    ctx.shadowBlur = 24;
    roundRect(ns.x - 6, ns.y - 6, ns.w + 12, ns.h + 12, 16);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
  }
}

function drawBannerText(text, a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = 'bold ' + CFG.banner.font + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = CFG.banner.outline;
  ctx.strokeStyle = CFG.banner.outlineColor;
  ctx.fillStyle = CFG.banner.color;
  ctx.strokeText(text, CFG.W / 2, CFG.H / 2);
  ctx.fillText(text, CFG.W / 2, CFG.H / 2);
  ctx.restore();
}

function drawHint(text) {
  const h = CFG.hint;
  const bh = h.font * h.lineH;
  const cy = CFG.H * h.centerY;
  ctx.save();
  ctx.globalAlpha = h.barAlpha;
  ctx.fillStyle = h.barColor;
  ctx.fillRect(0, cy - bh / 2, CFG.W, bh);
  ctx.globalAlpha = h.textAlpha;
  ctx.font = 'bold ' + h.font + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = h.outline;
  ctx.strokeStyle = h.outlineColor;
  ctx.fillStyle = h.textColor;
  ctx.strokeText(text, CFG.W / 2, cy);
  ctx.fillText(text, CFG.W / 2, cy);
  ctx.restore();
}

function drawMeterIcon(im, ic, x, y) {
  const s = ic.h / ic.src[1];
  ctx.drawImage(im, x - ic.pivot[0] * s, y - ic.pivot[1] * s, ic.src[0] * s, ic.h);
}

function render() {
  if (state.deckPhase && state.deckPhase !== 'count') {
    renderDeck();
    return;
  }
  const g = CFG.grid;
  drawFieldBg(state.camX);
  drawGrid(g);

  const held = heldCard();
  if (held) {
    const cell = cellAt(state.mouse.x, state.mouse.y);
    if (cell && cell.col < CFG.plantCols && rowAllowed(cell.row)) {
      ctx.fillStyle = canPlant(cell) ? 'rgba(80,255,120,0.30)' : 'rgba(255,70,70,0.30)';
      ctx.fillRect(g.x + cell.col * g.cw, g.y + cell.row * g.ch, g.cw, g.ch);
    }
  }

  if (state.net) {
    const cell = cellAt(state.mouse.x, state.mouse.y);
    if (cell && plantAtPoint(state.mouse.x, state.mouse.y) >= 0) {
      ctx.fillStyle = 'rgba(255,225,74,0.30)';
      ctx.fillRect(g.x + cell.col * g.cw, g.y + cell.row * g.ch, g.cw, g.ch);
    }
  }

  for (const p of state.plants) {
    const cs = plantSize(imgs['ptn_' + CARDS[p.card].key], CARDS[p.card].info.scale);
    drawShadow(cellCenter(p.row, p.col).x, g.y + (p.row + 1) * g.ch - CFG.footMargin, cs.w * CFG.shadow.partner);
  }
  for (const m of state.monsters) {
    const b = monsterBox(m);
    drawShadow(b.x, b.y + b.h / 2, b.w * CFG.shadow.monster);
  }
  for (const b of state.gmilks) {
    const r = gmilkRect(b);
    drawShadow(r.x, r.y + r.h / 2, r.w * CFG.shadow.gmilk);
  }
  for (const b of state.bullets) {
    drawShadow(b.x, g.y + (b.row + 1) * g.ch - CFG.footMargin, CFG.bulletSize * CFG.shadow.bullet);
  }

  for (const p of state.plants) {
    const card = CARDS[p.card];
    const img = imgs['ptn_' + card.key];
    const s = plantSize(img, card.info.scale);
    const c = cellCenter(p.row, p.col);
    const feetY = g.y + (p.row + 1) * g.ch - CFG.footMargin;
    const cy = feetY - s.h / 2;
    if (card.info.produce && p.prodT > 0 && p.prodT <= CFG.glow.time) {
      const k = 1 - p.prodT / CFG.glow.time;
      const r = Math.max(s.w, s.h) * CFG.glow.radius;
      const gr = ctx.createRadialGradient(c.x, cy, 0, c.x, cy, r);
      gr.addColorStop(0, 'rgba(' + CFG.glow.color + ',' + CFG.glow.alpha * k + ')');
      gr.addColorStop(1, 'rgba(' + CFG.glow.color + ',0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(c.x, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (card.info.place && p.placeT < card.info.place.dur) {
      const pi = imgs['plc_' + card.key];
      const ps = effectSize(pi, card.info.place.scale);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(c.x, cy);
      ctx.arc(c.x, cy, Math.hypot(ps.w, ps.h) / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.placeT / card.info.place.dur));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(pi, c.x - ps.w / 2, cy - ps.h / 2, ps.w, ps.h);
      ctx.restore();
    }
    const fk = p.hitT > 0 ? 'ptn_' + card.key : null;
    if (card.info.charge) drawEmerge(img, s, c.x, feetY, emergeRatio(p), fk);
    else drawPartner(c.x, cy, 1, img, card.info.scale, card.info.flip, fk);
  }

  for (const m of state.monsters) drawMonster(m);

  for (const f of state.drops) drawDrop(f);
  for (const c of state.deaths) drawCorpse(c);
  for (const a of state.ashes) drawAsh(a);

  for (const b of state.gmilks) {
    const r = gmilkRect(b);
    drawPartner(r.x, r.y, 1, imgs.golden_milk, CFG.gmilk.scale);
  }

  const bs = CFG.bulletSize;
  for (const b of state.bullets) ctx.drawImage(imgs[b.type] || imgs.tap, b.x - bs / 2, b.y - bs / 2, bs, bs);

  const ms = milkSize();
  for (const k of state.milks) {
    const left = CFG.milk.life - k.age;
    ctx.globalAlpha = k.fly ? 1 : (left < CFG.milk.fade ? Math.max(0, left / CFG.milk.fade) : 1);
    const hl = CFG.milk.halo;
    const rad = Math.max(ms.w, ms.h) * hl.radius;
    const gr = ctx.createRadialGradient(k.x, k.y, 0, k.x, k.y, rad);
    gr.addColorStop(0, 'rgba(' + hl.color + ',' + hl.alpha + ')');
    gr.addColorStop(1, 'rgba(' + hl.color + ',0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(k.x, k.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(imgs.milk, k.x - ms.w / 2, k.y - ms.h / 2, ms.w, ms.h);
  }
  ctx.globalAlpha = 1;

  for (const f of state.effects) {
    const img = imgs['eff_' + f.key];
    let sc = f.scaleTo;
    let a = 1;
    if (f.t < f.grow) {
      sc = f.scaleFrom + (f.scaleTo - f.scaleFrom) * (f.t / f.grow);
    } else if (f.t >= f.grow + f.hold) {
      a = Math.max(0, 1 - (f.t - f.grow - f.hold) / f.fade);
    }
    const s = effectSize(img, sc);
    ctx.globalAlpha = a;
    ctx.drawImage(img, f.x - s.w / 2, f.y - s.h / 2, s.w, s.h);
  }
  ctx.globalAlpha = 1;

  if (held) {
    ctx.strokeStyle = 'rgba(255,40,40,0.9)';
    ctx.lineWidth = 4;
    for (const m of state.monsters) {
      const b = hitBox(m);
      if (Math.abs(state.mouse.x - b.x) <= b.w / 2 && Math.abs(state.mouse.y - b.y) <= b.h / 2) {
        ctx.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      }
    }
  }

  if (state.deckPhase !== 'count' || needPick() || state.deckT >= CFG.deck.milkAt) drawTopHud(false);

  if (held) {
    drawPartner(state.mouse.x, state.mouse.y, 0.6, imgs['ptn_' + held.key], held.info.scale, held.info.flip);
  }

  if (!state.menuOpen) {
    const nr = netRect();
    const hi = slotAt(state.mouse.x, state.mouse.y);
    const bi = beltItemAt(state.mouse.x, state.mouse.y);
    if (hi >= 0) {
      const s = slotRect(hi);
      const lines = [CARDS[state.deck[hi]].info.name];
      if (!state.opts.noCool && state.cool[hi] > 0) lines.push('重新装填中...' + Math.ceil(state.cool[hi]) + ' s');
      drawTip(s.x + s.w / 2, s.y + s.h + 8, lines);
    } else if (bi >= 0) {
      const s = CFG.cardSlot;
      const b = CFG.belt;
      drawTip(state.belt[bi].x + s.w / 2, b.y + s.h + 8, [CARDS_BY_ID[state.belt[bi].id].info.name]);
    } else if (inRect(state.mouse, nr)) {
      drawTip(nr.x + nr.w / 2, nr.y + nr.h + 8, ['断网']);
    }
  }

  if (state.net) {
    const nr = netRect();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(imgs.net_err, state.mouse.x - nr.w / 2, state.mouse.y - nr.h / 2, nr.w, nr.h);
    ctx.globalAlpha = 1;
  }

  const ui = uiRects();
  drawMenuBtn(!state.deckPhase);

  if (!state.deckPhase) {
    const ln = CFG.levelName;
    const mt = CFG.meter;
    const sc = mt.w / mt.frame[2];
    const mx = CFG.W - mt.padX - mt.w;
    const my = CFG.H - mt.padY - mt.frame[3] * sc;
    const shown = state.wave > 0;
    if (shown) {
      const u = smooth(Math.min(1, (state.clock - state.lastSpawn) / (mt.anim * 1000)));
      const pct = Math.min(1, (state.wave - 1 + u) / INFO.tracklist[state.slot].waves);
      const fx = mx + mt.inset[0] * sc;
      const fy = my + mt.inset[1] * sc;
      const fw = mt.fill[2] * sc;
      const fh = mt.fill[3] * sc;
      ctx.drawImage(imgs.flag_meter, mt.frame[0], mt.frame[1], mt.frame[2], mt.frame[3], mx, my, mt.w, mt.frame[3] * sc);
      ctx.drawImage(imgs.flag_meter, mt.fill[0] + mt.fill[2] * (1 - pct), mt.fill[1], mt.fill[2] * pct, mt.fill[3],
        fx + fw * (1 - pct), fy, fw * pct, fh);
      const cy = my + mt.frame[3] * sc * 0.5;
      const total = INFO.tracklist[state.slot].waves;
      let rank = 0;
      for (let w = total; w >= 1; w--) {
        if (!bigShown() || !isBigWave(w)) continue;
        const k = w < state.wave ? 1 : w === state.wave ? u : 0;
        drawMeterIcon(imgs['allclear_' + mt.ranks[Math.min(rank++, mt.ranks.length - 1)]], mt.mark, fx + fw * (1 - w / total), cy + mt.mark.dy + (mt.mark.dyDone - mt.mark.dy) * k);
      }
      drawMeterIcon(imgs.sync, mt.sync, fx + fw * (1 - pct), cy + mt.sync.dy);
    }
    ctx.font = 'bold ' + ln.font + 'px sans-serif';
    ctx.fillStyle = ln.color;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(INFO.tracklist[state.slot].name, shown ? mx - mt.gap : CFG.W - ln.padX, CFG.H - ln.padY);
  }

  for (const b of state.banners) {
    const f = CFG.banner.fade;
    const a = b.t < f ? b.t / f : (b.t < f + b.hold ? 1 : Math.max(0, 1 - (b.t - f - b.hold) / f));
    drawBannerText(b.text, a);
  }
  const htxt = state.hintEvent ? state.hintEvent.text : state.hintRule;
  if (htxt) drawHint(htxt);
  if (state.deckPhase === 'count') {
    const mark = deckMark(state.deckT);
    if (mark) drawBannerText(mark, 1);
  }

  if (state.reward) drawReward();
  if (state.ceremony) drawCeremony();

  if (state.flash) {
    const fx = state.flash.fx;
    const k = state.flash.t < fx.hold ? 1 : Math.max(0, 1 - (state.flash.t - fx.hold) / fx.fade);
    ctx.globalAlpha = fx.alpha * k;
    ctx.fillStyle = fx.color;
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.globalAlpha = 1;
  }

  if (state.menuOpen) drawMenuPanel(ui);

  if (state.confirmRestart) drawConfirmPanel(ui);

  if (state.resumeAsk) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    drawPanel(ui.resumePanel);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('你想继续这个游戏，还是重新开始一个新的游戏？', ui.resumePanel.x + ui.resumePanel.w / 2, ui.resumePanel.y + 80);
    drawButton(ui.resumeBack, '返回');
    drawButton(ui.resumeRestart, '重新开始游戏');
    drawButton(ui.resumeGo, '继续');
  }

  if (state.result) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    drawPanel(ui.resultPanel);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('失败', ui.resultPanel.x + ui.resultPanel.w / 2, ui.resultPanel.y + 80);
    drawButton(ui.loseBack, '返回');
    drawButton(ui.loseRetry, '重试');
  }
  ctx.lineWidth = 1;
}

function testHover() {
  if (state.ceremony) {
    canvas.style.cursor = 'default';
    return;
  }
  if (state.deckPhase && !state.menuOpen) {
    deckHover();
    return;
  }
  const ui = uiRects();
  let ptr = slotAt(state.mouse.x, state.mouse.y) >= 0 || inRect(state.mouse, ui.menuBtn) || inRect(state.mouse, netRect()) || beltItemAt(state.mouse.x, state.mouse.y) >= 0 || milkAt(state.mouse.x, state.mouse.y) >= 0 || rewardHit(state.mouse);
  if (state.menuOpen) ptr = inRect(state.mouse, ui.menuBtn) || inRect(state.mouse, ui.resumeBtn) || inRect(state.mouse, ui.restartBtn) || inRect(state.mouse, ui.quitBtn) || visibleOpts().some((o, i) => inRect(state.mouse, ui.optRow(i)));
  if (state.confirmRestart) ptr = inRect(state.mouse, ui.confirmYes) || inRect(state.mouse, ui.confirmNo);
  if (state.resumeAsk) ptr = inRect(state.mouse, ui.resumeBack) || inRect(state.mouse, ui.resumeRestart) || inRect(state.mouse, ui.resumeGo);
  if (state.result) ptr = inRect(state.mouse, ui.loseBack) || inRect(state.mouse, ui.loseRetry);
  canvas.style.cursor = ptr ? 'pointer' : 'default';
}

function testClick(p) {
  const ui = uiRects();
  if (state.loading) return;
  if (state.deckPhase && !state.menuOpen) {
    deckClick(p);
    return;
  }
  if (state.result) {
    if (inRect(p, ui.loseBack)) {
      state.scene = 'menu';
      state.result = null;
      bgm.pause();
      writeRun();
    } else if (inRect(p, ui.loseRetry)) {
      resetRun();
      beginRun();
      writeRun();
    }
    return;
  }
  if (state.ceremony) return;
  if (!state.menuOpen && !state.resumeAsk && bgm.paused) playBgm();
  if (state.resumeAsk) {
    if (inRect(p, ui.resumeBack)) {
      state.scene = 'menu';
      state.resumeAsk = false;
      writeRun();
    } else if (inRect(p, ui.resumeRestart)) {
      resetRun();
      state.resumeAsk = false;
      beginRun();
      writeRun();
    } else if (inRect(p, ui.resumeGo)) {
      state.resumeAsk = false;
      playBgm();
    }
    return;
  }
  if (inRect(p, ui.menuBtn)) {
    setMenu(!state.menuOpen);
    return;
  }
  if (state.confirmRestart) {
    if (inRect(p, ui.confirmYes)) {
      resetRun();
      state.confirmRestart = false;
      state.menuOpen = false;
      writeRun();
      beginRun();
    } else if (inRect(p, ui.confirmNo)) {
      state.confirmRestart = false;
    }
    return;
  }
  if (state.menuOpen) {
    if (inRect(p, ui.quitBtn)) {
      state.scene = 'menu';
      state.menuOpen = false;
      bgm.pause();
      writeRun();
      return;
    }
    if (inRect(p, ui.restartBtn)) {
      state.confirmRestart = true;
      return;
    }
    if (inRect(p, ui.resumeBtn)) {
      setMenu(false);
      return;
    }
    const vo = visibleOpts();
    for (let i = 0; i < vo.length; i++) {
      if (!inRect(p, ui.optRow(i))) continue;
      const key = vo[i].key;
      state.opts[key] = !state.opts[key];
      if (key === 'autoCollect' && state.opts[key]) {
        for (const k of state.milks) if (!k.fly) collectMilk(k);
      }
    }
    return;
  }
  if (state.net) {
    const pi = plantAtPoint(p.x, p.y);
    if (pi >= 0) state.plants.splice(pi, 1);
    state.net = false;
    return;
  }
  if (rewardHit(p)) {
    pickupReward();
    return;
  }
  const mi = milkAt(p.x, p.y);
  if (mi >= 0) {
    collectMilk(state.milks[mi]);
    return;
  }
  if (netUnlocked() && inRect(p, netRect())) {
    state.net = !state.net;
    state.selected = null;
    state.beltSel = -1;
    return;
  }
  if (isConveyor()) {
    const bi = beltItemAt(p.x, p.y);
    if (bi >= 0) {
      state.beltSel = state.beltSel === bi ? -1 : bi;
      state.net = false;
      return;
    }
    if (state.beltSel < 0) return;
    const cell = cellAt(p.x, p.y);
    if (canPlant(cell)) {
      const ci = cardBySlotId(state.belt[state.beltSel].id);
      const info = CARDS[ci].info;
      state.plants.push({ row: cell.row, col: cell.col, card: ci, atkT: info.bullet ? randAtk(info) : 0, prodT: info.produce ? randRange(info.produce.firstMin, info.produce.firstMax) : 0, lifeT: info.life || 0, placeT: 0, armT: 0, hitT: 0, hp: info.hp });
      state.placeTimes.push(state.clock);
      if (state.placeTimes.length === 1) showHint('做的不错！', 3);
      else if (state.placeTimes.length === 2) showHint('别让中二企鹅到达7sRef！', 3);
      state.belt.splice(state.beltSel, 1);
      state.beltSel = -1;
    }
    return;
  }
  const si = slotAt(p.x, p.y);
  if (si >= 0) {
    const info = CARDS[state.deck[si]].info;
    if (state.opts.noCool || (state.milk >= info.costmilk && state.cool[si] <= 0)) {
      state.selected = state.selected === si ? null : si;
      state.net = false;
    } else if (state.cool[si] > 0) showHint('伙伴需要一段时间才能再次召集！', 3);
    else showHint('你需要更多的milk才能召集！', 3);
    return;
  }
  if (state.selected === null) return;
  const cell = cellAt(p.x, p.y);
  if (canPlant(cell)) {
    const info = CARDS[state.deck[state.selected]].info;
    if (!state.opts.noCool) {
      state.milk -= info.costmilk;
      state.milkShown -= info.costmilk;
      if (state.milks.some(k => k.fly && !k.counted)) {
        for (const k of state.milks) if (k.fly && !k.counted) k.counted = true;
        state.milkShown = state.milk;
      }
    }
    state.plants.push({ row: cell.row, col: cell.col, card: state.deck[state.selected], atkT: info.bullet ? randAtk(info) : 0, prodT: info.produce ? randRange(info.produce.firstMin, info.produce.firstMax) : 0, lifeT: info.life || 0, placeT: 0, armT: 0, hitT: 0, hp: info.hp });
    state.placeTimes.push(state.clock);
    if (state.placeTimes.length === 1) showHint('做的不错！', 3);
    else if (state.placeTimes.length === 2) showHint('别让中二企鹅到达7sRef！', 3);
    if (!state.opts.noCool) state.cool[state.selected] = INFO.cdTiers[info.cd];
    state.selected = null;
  }
}

function testKey(e) {
  if (state.deckPhase) return;
  if (e.key === 'Escape') {
    state.selected = null;
    state.beltSel = -1;
    state.net = false;
    return;
  }
  if (e.repeat || state.loading || state.menuOpen || state.resumeAsk || state.confirmRestart || state.result || state.ceremony) return;
  if (e.key >= '1' && e.key <= '6') {
    if (isConveyor()) return;
    const si = Number(e.key) - 1;
    if (si >= slotCount() || state.deck[si] === null) return;
    const info = CARDS[state.deck[si]].info;
    if (state.opts.noCool || (state.milk >= info.costmilk && state.cool[si] <= 0)) {
      state.selected = state.selected === si ? null : si;
      state.net = false;
    } else if (state.cool[si] > 0) showHint('伙伴需要一段时间才能再次召集！', 3);
    else showHint('你需要更多的milk才能召集！', 3);
    return;
  }
  if (e.key === '`' && netUnlocked()) {
    state.net = !state.net;
    state.selected = null;
    state.beltSel = -1;
  }
}

function gateOpen(spec) {
  if (!spec) return true;
  const at = state.placeTimes[spec.plants - 1];
  return at !== undefined && state.clock >= at + spec.delay;
}

function updateGame(raw) {
  const dt = raw * (state.opts.fast ? 2 : 1);
  state.clock += dt * 1000;
  state.bgmAt = bgm.currentTime;
  const lv = INFO.tracklist[state.slot];
  const stopped = !!(state.reward || state.ceremony);
  if (!state.opts.noNatural && state.wave < lv.waves && state.clock - state.lastSpawn > state.waveGap && gateOpen(lv.spawnGate)) {
    state.lastSpawn = state.clock;
    state.wave++;
    state.waveGap = randWaveGap();
    state.bigWarned = false;
    spawnWave();
  }
  if (!stopped && isConveyor()) updateBelt(dt);
  if (!stopped && !isConveyor() && state.clock - state.lastMilk > state.milkInterval && gateOpen(lv.milkGate)) {
    state.lastMilk = state.clock;
    state.milkInterval = randMilkInterval();
    spawnMilk();
  }
  const msk = milkSize();
  const mt = { x: CFG.milkSlot.x + CFG.milkSlot.w / 2, y: CFG.milkSlot.y + CFG.milkSlot.h / 2 };
  for (const k of state.milks) {
    if (k.fly) {
      if (k.arrived) {
        k.wait -= dt;
        continue;
      }
      const dx = mt.x - k.x;
      const dy = mt.y - k.y;
      const d = Math.hypot(dx, dy);
      const step = CFG.milk.flySpeed * dt;
      if (d <= step) {
        k.x = mt.x;
        k.y = mt.y;
        k.arrived = true;
        k.wait = CFG.milk.flyWait;
        if (!k.counted) {
          k.counted = true;
          state.milkShown = Math.min(INFO.milk.cap, state.milkShown + INFO.milk.value);
        }
      } else {
        k.x += dx / d * step;
        k.y += dy / d * step;
      }
      continue;
    }
    k.age += dt;
    if (k.arc) {
      if (stepArc(k, dt) >= 1) k.stopped = true;
      continue;
    }
    if (k.hold !== undefined) {
      k.hold -= dt;
      if (k.hold <= 0) collectMilk(k);
      continue;
    }
    if (!k.stopped) {
      k.y += CFG.milk.fallSpeed * dt;
      if (k.y + msk.h / 2 >= k.bottom) {
        k.y = k.bottom - msk.h / 2;
        k.stopped = true;
      }
    }
  }
  state.milks = state.milks.filter(k => k.fly ? !(k.arrived && k.wait <= 0) : k.age < CFG.milk.life);
  if (state.reward && state.reward.arc) stepArc(state.reward, dt);
  const g = CFG.grid;
  for (const m of state.monsters) {
    if (m.slow > 0) m.slow = Math.max(0, m.slow - dt);
    if (m.freeze > 0) m.freeze = Math.max(0, m.freeze - dt);
    if (m.hitT) m.hitT = Math.max(0, m.hitT - dt);
    if (m.a1t) m.a1t = Math.max(0, m.a1t - dt);
    if (m.a2t) m.a2t = Math.max(0, m.a2t - dt);
    const sf = m.slow > 0 ? CFG.monster.slow : 1;
    const fz = m.freeze > 0;
    const col = Math.floor((m.x - g.x) / g.cw);
    if (m.hp < monThreshold(m)) {
      if (m.eat) m.frozen = true;
      m.eat = null;
    } else {
      m.eat = state.plants.find(p => p.row === m.row && p.col === col) || null;
    }
    if (m.eat) {
      if (m.eatT === undefined) {
        m.eatT = INFO.monsters[m.type].atkInterval / sf;
        m.biteT = 0.6;
      }
      if (!fz) {
        m.biteT -= dt;
        if (m.biteT <= 0) {
          m.biteT += 0.6;
          m.eat.hitT = CFG.monster.hitFlash;
        }
      }
    } else {
      m.eatT = undefined;
      if (!m.frozen && !fz) m.x -= m.speed * sf * dt;
    }
  }
  for (const m of state.monsters) {
    if (!m.eat) continue;
    if (m.freeze > 0) continue;
    m.eatT -= dt;
    if (m.eatT <= 0) {
      const mi = INFO.monsters[m.type];
      m.eatT += mi.atkInterval / (m.slow > 0 ? CFG.monster.slow : 1);
      if (!CARDS[m.eat.card].info.immune && armPhase(m.eat) !== 1) m.eat.hp -= mi.atkDamage;
    }
  }
  state.plants = state.plants.filter(p => p.hp > 0);
  for (const p of state.plants) if (p.hitT) p.hitT = Math.max(0, p.hitT - dt);
  state.cool = state.cool.map(c => Math.max(0, c - dt));

  for (const p of state.plants) {
    const info = CARDS[p.card].info;
    if (stopped || !info.produce) continue;
    p.prodT -= dt;
    if (p.prodT <= 0) {
      p.prodT = randRange(info.produce.min, info.produce.max);
      produceMilk(p);
    }
  }

  for (const p of state.plants) {
    if (CARDS[p.card].info.place) p.placeT += dt;
  }

  for (const p of state.plants) {
    if (CARDS[p.card].info.charge) p.armT += dt;
  }

  for (let i = state.plants.length - 1; i >= 0; i--) {
    const p = state.plants[i];
    if (!CARDS[p.card].info.life) continue;
    p.lifeT -= dt;
    if (p.lifeT <= 0) {
      if (CARDS[p.card].info.effect) spawnEffect(p);
      if (CARDS[p.card].info.burst) burstDamage(p);
      if (CARDS[p.card].info.ice) iceBlast(p);
      state.plants.splice(i, 1);
    }
  }

  for (let i = state.plants.length - 1; i >= 0; i--) {
    const p = state.plants[i];
    if (!CARDS[p.card].info.charge || armPhase(p) !== 2) continue;
    if (!state.monsters.some(m => touching(p, m))) continue;
    spawnEffect(p);
    boomDamage(p);
    state.plants.splice(i, 1);
  }
  for (const f of state.effects) f.t += dt;
  state.effects = state.effects.filter(f => f.t < f.grow + f.hold + f.fade);
  if (state.flash) {
    state.flash.t += dt;
    if (state.flash.t >= state.flash.fx.hold + state.flash.fx.fade) state.flash = null;
  }
  for (const b of state.banners) b.t += dt;
  state.banners = state.banners.filter(b => b.t < CFG.banner.fade * 2 + b.hold);
  if (state.hintEvent && state.hintEvent.hold !== null) {
    state.hintEvent.t += dt;
    if (state.hintEvent.t >= state.hintEvent.hold) state.hintEvent = null;
  }
  state.hintRule = HINT_RULES[state.slot] ? HINT_RULES[state.slot]() : null;

  const viewX = CFG.grid.x + CFG.visibleCols * CFG.grid.cw;
  for (const p of state.plants) {
    const info = CARDS[p.card].info;
    if (!info.bullet) continue;
    p.atkT -= dt;
    if (p.atkT <= 0) {
      p.atkT = randAtk(info);
      const c = cellCenter(p.row, p.col);
      const seen = state.monsters.some(m => m.row === p.row && m.x >= c.x && m.x <= viewX);
      if (seen) {
        const bi = INFO.bullets[info.bullet];
        const offs = info.shots === 2 ? [-CFG.bulletSpread, CFG.bulletSpread] : [0];
        for (const o of offs) {
          state.bullets.push({ row: p.row, x: c.x + 40, y: c.y + o, speed: info.bulletSpeed, dmg: bi.damage, slow: bi.slow, type: info.bullet });
        }
      }
    }
  }
  for (const b of state.bullets) b.x += b.speed * CFG.grid.cw * dt;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    let hit = null;
    let kind = 0;
    for (const m of state.monsters) {
      kind = bulletHitKind(m, b);
      if (kind) { hit = m; break; }
    }
    if (hit) {
      if (kind === 2) {
        hit.a2t = CFG.monster.hitFlash;
        hit.a2hp = Math.max(0, hit.a2hp - b.dmg);
        if (!hit.a2hp) armorDrop(hit, INFO.monsters[hit.type].armor2);
      } else {
        hurtBody(hit, b.dmg);
        if (b.slow) hit.slow = Math.max(hit.slow || 0, b.slow);
      }
      state.bullets.splice(i, 1);
    } else if (b.x > CFG.W + 60) {
      state.bullets.splice(i, 1);
    }
  }

  for (const m of state.monsters) {
    if (m.hp < monThreshold(m)) {
      m.bleedT += dt;
      while (m.bleedT >= CFG.monster.bleedGap) {
        m.bleedT -= CFG.monster.bleedGap;
        m.hp -= CFG.monster.bleedDmg;
      }
    }
  }
  const alive = [];
  for (const m of state.monsters) {
    if (m.hp <= 0) {
      if (!m.noCorpse) state.deaths.push(makeCorpse(m));
      continue;
    }
    if (m.x <= -60) continue;
    alive.push(m);
  }
  state.monsters = alive;

  const dd = CFG.monster.death;
  for (const c of state.deaths) c.t += dt * c.sf;
  state.deaths = state.deaths.filter(c => c.t < dd.fall + dd.hold + dd.fade);
  const ash = CFG.monster.ash;
  for (const a of state.ashes) a.t += dt;
  state.ashes = state.ashes.filter(a => a.t < ash.dur);
  const ad = CFG.armor.death;
  for (const f of state.drops) f.t += dt;
  state.drops = state.drops.filter(f => f.t < ad.fall + ad.hold + ad.fade);

  for (let i = state.gmilks.length - 1; i >= 0; i--) {
    const b = state.gmilks[i];
    if (!b.launched) {
      const r = gmilkRect(b);
      if (state.monsters.some(m => m.hp >= monThreshold(m) && gmilkHit(m, r))) b.launched = true;
      continue;
    }
    b.x += CFG.gmilk.speed * dt;
    const r = gmilkRect(b);
    state.monsters = state.monsters.filter(m => !gmilkHit(m, r));
    if (r.x - r.w / 2 > CFG.W) state.gmilks.splice(i, 1);
  }
  waveCutCheck();
  waveWarnCheck();
  resultCheck();
  rewardCheck();
  if (state.ceremony) {
    state.ceremony.t += dt;
    if (state.ceremony.t >= CFG.reward.cer.dur) {
      resetRun();
      writeRun();
      state.scene = 'menu';
    }
  }
}
