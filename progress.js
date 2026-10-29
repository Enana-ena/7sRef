const PROGRESS_KEY = 'apollo7s:progress';

let progress = { cleared: {}, slots: null, cards: [], net: false, adv: { id: 101, status: 0 } };

function initProgress() {
  let o = null;
  try {
    o = JSON.parse(cacheRead(PROGRESS_KEY) || '{}');
  } catch (e) {
    console.warn('全局记录解析失败', e);
  }
  if (!o || typeof o !== 'object') o = {};
  const firstCards = [];
  firstCards[1] = true;
  const a = o.adv && typeof o.adv === 'object' ? o.adv : {};
  progress = {
    cleared: o.cleared && typeof o.cleared === 'object' ? o.cleared : {},
    slots: typeof o.slots === 'number' ? o.slots : null,
    cards: Array.isArray(o.cards) ? o.cards : firstCards,
    net: o.net === true,
    adv: { id: typeof a.id === 'number' ? a.id : 101, status: typeof a.status === 'number' ? a.status : 0 },
  };
}

function isCleared(key) {
  return progress.cleared[key] === true;
}

function markCleared(key) {
  progress.cleared[key] = true;
  cacheWrite(PROGRESS_KEY, JSON.stringify(progress));
}

function getSlots() {
  return progress.slots === null ? CFG.cardSlots : progress.slots;
}

function setSlots(n) {
  progress.slots = Math.min(Math.max(n, CFG.cardSlots), CFG.cardSlotsMax);
  cacheWrite(PROGRESS_KEY, JSON.stringify(progress));
}

function isCardUnlocked(id) {
  return progress.cards[id] === true;
}

function unlockCard(id) {
  progress.cards[id] = true;
  cacheWrite(PROGRESS_KEY, JSON.stringify(progress));
}

function netUnlocked() {
  return progress.net === true || INFO.tracklist[state.slot].test === true;
}

function markAdvDone(id) {
  if (progress.adv.id === id) progress.adv.status = 1;
  cacheWrite(PROGRESS_KEY, JSON.stringify(progress));
}

initProgress();
