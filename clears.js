const CLEARS_KEY = 'apollo7s:cleared';

let clears = {};

function initClears() {
  try {
    const o = JSON.parse(cacheRead(CLEARS_KEY) || '{}');
    clears = o && typeof o === 'object' ? o : {};
  } catch (e) {
    console.warn('通关记录解析失败', e);
    clears = {};
  }
}

function isCleared(key) {
  return clears[key] === true;
}

function markCleared(key) {
  clears[key] = true;
  cacheWrite(CLEARS_KEY, JSON.stringify(clears));
}

initClears();
