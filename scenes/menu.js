function menuRects() {
  const panel = { x: (CFG.W - 640) / 2, y: (CFG.H - 530) / 2, w: 640, h: 530 };
  const notice = { x: (CFG.W - 640) / 2, y: (CFG.H - 260) / 2, w: 640, h: 260 };
  const mb = CFG.menu;
  const ex = { x: CFG.W - mb.btnPad - mb.btnW, y: mb.btnY, w: mb.btnW, h: mb.btnH };
  const im = { x: ex.x - mb.btnGap - mb.btnW, y: mb.btnY, w: mb.btnW, h: mb.btnH };
  return {
    panel,
    notice,
    start: { x: panel.x + (panel.w - 320) / 2, y: panel.y + 120, w: 320, h: 64 },
    test1: { x: panel.x + (panel.w - 320) / 2, y: panel.y + 230, w: 320, h: 64 },
    test2: { x: panel.x + (panel.w - 320) / 2, y: panel.y + 340, w: 320, h: 64 },
    back: { x: notice.x + (notice.w - 320) / 2, y: notice.y + 150, w: 320, h: 64 },
    importBtn: im,
    exportBtn: ex,
  };
}

function menuHover() {
  const m = menuRects();
  const ptr = inRect(state.mouse, m.importBtn) || inRect(state.mouse, m.exportBtn) ||
    (state.notice ? inRect(state.mouse, m.back)
      : inRect(state.mouse, m.start) || inRect(state.mouse, m.test1) || inRect(state.mouse, m.test2));
  canvas.style.cursor = ptr ? 'pointer' : 'default';
}

function menuClick(p) {
  const m = menuRects();
  if (inRect(p, m.importBtn)) {
    importRuns();
    return;
  }
  if (inRect(p, m.exportBtn)) {
    exportRuns();
    return;
  }
  if (state.notice) {
    if (inRect(p, m.back)) state.notice = false;
    return;
  }
  if (inRect(p, m.start)) state.notice = true;
  else if (inRect(p, m.test1)) enterRun('test1');
  else if (inRect(p, m.test2)) enterRun('test2');
}

function renderMenu() {
  const m = menuRects();
  ctx.drawImage(imgs.bg, 0, 0, CFG.W, CFG.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawButton(m.importBtn, '导入');
  drawButton(m.exportBtn, '导出');
  if (state.notice) {
    drawPanel(m.notice);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('该内容还未开发', m.notice.x + m.notice.w / 2, m.notice.y + 80);
    drawButton(m.back, '返回');
    return;
  }
  drawPanel(m.panel);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('主菜单', m.panel.x + m.panel.w / 2, m.panel.y + 60);
  drawButton(m.start, '开始游戏');
  drawButton(m.test1, '测试场景1');
  drawButton(m.test2, '测试场景2');
}
