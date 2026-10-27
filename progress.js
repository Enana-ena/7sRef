const PROGRESS_KEY = 'apollo7s:progress';

let progress = { cleared: {}, slots: null };

function initProgress() {
  let o = null;
  try {
    o = JSON.parse(cacheRead(PROGRESS_KEY) || '{}');
  } catch (e) {
    console.warn('全局记录解析失败', e);
  }
  if (!o || typeof o !== 'object') o = {};
  progress = {
    cleared: o.cleared && typeof o.cleared === 'object' ? o.cleared : {},
    slots: typeof o.slots === 'number' ? o.slots : null,
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

initProgress();
