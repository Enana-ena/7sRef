function listRects() {
  const all = Object.keys(INFO.tracklist);
  const cols = [all.filter(k => INFO.tracklist[k].test === true), all.filter(k => INFO.tracklist[k].test !== true)];
  const keys = cols[0].concat(cols[1]);
  const ph = 130 + (Math.max(cols[0].length, cols[1].length) - 1) * 100 + 64 + 36;
  const panel = { x: (CFG.W - 800) / 2, y: (CFG.H - ph) / 2, w: 800, h: ph };
  const back = { x: CFG.menu.btnPad, y: CFG.menu.btnY, w: CFG.menu.btnW, h: CFG.menu.btnH };
  const rows = [];
  for (let c = 0; c < cols.length; c++) {
    for (let i = 0; i < cols[c].length; i++) rows.push({ x: panel.x + 60 + c * 360, y: panel.y + 130 + i * 100, w: 320, h: 64 });
  }
  return { keys, panel, back, rows };
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
