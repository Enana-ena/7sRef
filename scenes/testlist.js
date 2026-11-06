function listRects() {
  const keys = Object.keys(INFO.tracklist);
  const ph = 130 + (keys.length - 1) * 100 + 64 + 36;
  const panel = { x: (CFG.W - 640) / 2, y: (CFG.H - ph) / 2, w: 640, h: ph };
  const back = { x: CFG.menu.btnPad, y: CFG.menu.btnY, w: CFG.menu.btnW, h: CFG.menu.btnH };
  return { keys, panel, back, rows: keys.map((k, i) => ({ x: panel.x + (panel.w - 320) / 2, y: panel.y + 130 + i * 100, w: 320, h: 64 })) };
}

function listHover() {
  const m = listRects();
  const ptr = inRect(state.mouse, m.back) || m.rows.some(r => inRect(state.mouse, r));
  canvas.style.cursor = ptr ? 'pointer' : 'default';
}

function listClick(p) {
  const m = listRects();
  if (inRect(p, m.back)) {
    state.scene = 'menu';
    return;
  }
  for (let i = 0; i < m.rows.length; i++) {
    if (inRect(p, m.rows[i])) {
      enterRun(m.keys[i]);
      return;
    }
  }
}

function renderTestList() {
  const m = listRects();
  ctx.drawImage(imgs.bg, 0, 0, CFG.W, CFG.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawPanel(m.panel);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('测试关卡', m.panel.x + m.panel.w / 2, m.panel.y + 60);
  for (let i = 0; i < m.rows.length; i++) drawButton(m.rows[i], INFO.tracklist[m.keys[i]].name);
  drawButton(m.back, '返回');
}
