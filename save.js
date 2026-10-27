const SAVE_KEYS = ['clock', 'wave', 'waveGap', 'waveHp', 'bigWarned', 'banners', 'rowLast', 'rowSecondLast', 'lastSpawn', 'lastMilk', 'milkInterval', 'milkDropped', 'milk', 'milkShown',
  'deck', 'cool', 'plants', 'bullets', 'milks', 'effects', 'gmilks', 'bgmAt', 'reward'];

const LS_PREFIX = 'apollo7s:save:';

function cacheRead(key) {
  try {
    return localStorage.getItem(LS_PREFIX + key);
  } catch (e) {
    console.warn('浏览器缓存读取失败 ' + key, e);
    return null;
  }
}

function cacheWrite(key, text) {
  try {
    localStorage.setItem(LS_PREFIX + key, text);
  } catch (e) {
    console.warn('浏览器缓存写入失败 ' + key, e);
  }
}

function snapshotRun(s) {
  const o = { slot: s.slot };
  for (const k of SAVE_KEYS) o[k] = s[k];
  o.monsters = s.monsters.map(m => {
    const rec = {};
    for (const k of Object.keys(m)) if (k !== 'eat') rec[k] = m[k];
    return rec;
  });
  return o;
}

function writeRun() {
  cacheWrite(state.slot, JSON.stringify(snapshotRun(state), null, 2));
}

function applyRunText(key, text) {
  if (!text) return false;
  let o;
  try {
    o = JSON.parse(text);
  } catch (e) {
    console.warn('存档解析失败 ' + key, e);
    return false;
  }
  if (!o || !Array.isArray(o.plants) || !Array.isArray(o.monsters) || !o.plants.every(p => CARDS[p.card]) || !o.monsters.every(m => INFO.monsters[m.type] && typeof m.speed === 'number') ||
    !Array.isArray(o.deck) || o.deck.length !== CFG.cardSlots || !o.deck.every(ci => ci === null || CARDS[ci])) {
    console.warn('存档数据无效 ' + key);
    return false;
  }
  const s = SLOTS[key];
  for (const k of SAVE_KEYS) if (o[k] !== undefined) s[k] = o[k];
  if (!s.reward || !INFO.rewards[s.reward.key] || typeof s.reward.x !== 'number' || typeof s.reward.y !== 'number') s.reward = null;
  if (s.reward && s.reward.arc) {
    s.reward.x = s.reward.arc.tx;
    s.reward.y = s.reward.arc.ty;
    s.reward.arc = null;
  }
  s.monsters = o.monsters.map(m => Object.assign({}, m));
  return true;
}

function loadRun(key) {
  return Promise.resolve().then(() => {
    applyRunText(key, cacheRead(key));
  });
}

function chooseDir(mode) {
  if (!window.showDirectoryPicker) {
    console.warn('该浏览器不支持选择文件夹');
    return Promise.resolve(null);
  }
  return window.showDirectoryPicker({ mode: mode }).catch(() => null);
}

function exportRuns() {
  return chooseDir('readwrite').then(dir => {
    if (!dir) return;
    return Promise.all(Object.keys(SLOTS).filter(key => hasRunRecord(SLOTS[key])).map(key => dir
      .getFileHandle('save_' + key + '.json', { create: true })
      .then(fh => fh.createWritable())
      .then(w => w.write(JSON.stringify(snapshotRun(SLOTS[key]), null, 2)).then(() => w.close()))));
  }).catch(e => console.warn('导出失败', e));
}

function importRuns() {
  return chooseDir('read').then(dir => {
    if (!dir) return;
    const keys = Object.keys(SLOTS);
    return Promise.all(keys.map(key => dir.getFileHandle('save_' + key + '.json')
      .then(fh => fh.getFile())
      .then(f => f.text())
      .catch(() => null))).then(texts => {
      for (let i = 0; i < keys.length; i++) {
        if (applyRunText(keys[i], texts[i])) cacheWrite(keys[i], texts[i]);
      }
    });
  }).catch(e => console.warn('导入失败', e));
}
