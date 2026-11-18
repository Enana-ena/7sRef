let splash = { phase: 1, t: 0, loaded: false, logoT: 0, clicked: false, ready: false };

function splashUpdate(real) {
  splash.t += real;
  if (splash.phase === 1) {
    if (!splash.ready && splash.clicked && !titleBgm.paused) splash.ready = true;
    return;
  }
  if (splash.loaded) splash.logoT += real;
}

function drawSplashHint(text) {
  const sp = CFG.splash;
  const hy = CFG.H / 2 + imgs.splash_logo.height / 2 + sp.hintGap;
  ctx.font = sp.hintFont + 'px sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = sp.hintOutline;
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, CFG.W / 2, hy);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, CFG.W / 2, hy);
  ctx.lineWidth = 1;
}

function renderSplash() {
  const sp = CFG.splash;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (splash.phase === 1) {
    ctx.globalAlpha = Math.min(1, splash.t / sp.fadeIn);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + sp.titleFont + 'px sans-serif';
    ctx.fillText(sp.titleText, CFG.W / 2, CFG.H / 2);
    ctx.globalAlpha = 1;
    if (splash.ready) drawSplashHint(sp.startText);
    return;
  }
  const bg = imgs.splash_bg;
  const h = bg.height * CFG.W / bg.width;
  ctx.drawImage(bg, 0, (CFG.H - h) / 2, CFG.W, h);
  if (!splash.loaded) {
    ctx.fillStyle = '#fff';
    ctx.font = sp.loadFont + 'px sans-serif';
    ctx.fillText(sp.loadText, CFG.W / 2, CFG.H / 2);
    return;
  }
  const logo = imgs.splash_logo;
  ctx.globalAlpha = Math.min(1, splash.logoT / sp.logoFade);
  ctx.drawImage(logo, CFG.W / 2 - logo.width / 2, CFG.H / 2 - logo.height / 2);
  drawSplashHint(sp.hintText);
  ctx.globalAlpha = 1;
}

function splashHover() {
  canvas.style.cursor = splash.loaded ? 'pointer' : 'default';
}

function splashClick() {
  if (splash.phase === 1) {
    splash.clicked = true;
    if (!splash.ready) return;
    splash.phase = 2;
    titleBgm.pause();
    playMenuBgm();
    loadAllAssets().then(() => { splash.loaded = true; splash.logoT = 0; });
    return;
  }
  if (!splash.loaded) return;
  state.scene = 'menu';
}