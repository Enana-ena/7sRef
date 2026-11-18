let rewardPage = null;

function rewardRects() {
  const pg = CFG.reward.page;
  const panel = { x: (CFG.W - pg.panel.w) / 2, y: (CFG.H - pg.panel.h) / 2, w: pg.panel.w, h: pg.panel.h };
  return {
    panel,
    btn: { x: panel.x + (panel.w - pg.btn.w) / 2, y: panel.y + pg.btn.dy, w: pg.btn.w, h: pg.btn.h },
  };
}

function openRewardPage(key, slot) {
  const lv = INFO.tracklist[slot];
  const adv = lv.test !== true && key === lv.firstReward;
  rewardPage = { key, slot, adv };
  state.scene = 'reward';
  winMusic.pause();
  clearBgm.currentTime = 0;
  const p = clearBgm.play();
  if (p && p.catch) p.catch(() => {});
}

function renderReward() {
  const pg = CFG.reward.page;
  const m = rewardRects();
  const rw = INFO.rewards[rewardPage.key];
  ctx.drawImage(imgs.reward_base, 0, 0, CFG.W, CFG.H);
  ctx.drawImage(imgs.chara_left, 0, 0);
  ctx.drawImage(imgs.chara_right, CFG.W - imgs.chara_right.width, 0);
  ctx.fillStyle = pg.panel.fill;
  roundRect(m.panel.x, m.panel.y, m.panel.w, m.panel.h, pg.panel.r);
  ctx.fill();
  ctx.strokeStyle = pg.panel.border;
  ctx.lineWidth = pg.panel.borderW;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = m.panel.x + m.panel.w / 2;
  if (rewardPage.adv) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + pg.topFont + 'px sans-serif';
    ctx.fillText(pg.advTop, cx, m.panel.y + pg.topDy);
  }
  const cy = m.panel.y + pg.imgDy;
  if (rewardPage.key === 'moneybag') {
    const img = imgs['rew_' + rewardPage.key];
    ctx.drawImage(img, cx - img.width / 2, cy - img.height / 2, img.width, img.height);
  } else {
    drawRewardFace(cx, cy, rewardPage.key, pg.imgH / rewardSize(rewardPage.key).h);
  }
  const desc = rewardPage.adv ? (rw.unlock ? INFO.cards[CARDS_BY_ID[rw.unlock].key].desc : rw.desc) : '';
  if (desc) {
    ctx.fillStyle = '#fff';
    ctx.font = pg.descFont + 'px sans-serif';
    ctx.fillText(desc, cx, m.panel.y + pg.descDy);
  }
  drawButton(m.btn, rewardPage.adv ? pg.advBtn : pg.testBtn);
}

function rewardHover() {
  canvas.style.cursor = inRect(state.mouse, rewardRects().btn) ? 'pointer' : 'default';
}

function rewardClick(p) {
  if (!inRect(p, rewardRects().btn)) return;
  if (rewardPage.adv) {
    clearBgm.pause();
    const k = advKey();
    if (k) enterRun(k); else { state.scene = 'menu'; playMenuBgm(); }
  } else {
    clearBgm.pause();
    state.scene = 'testlist';
    playMenuBgm();
  }
}