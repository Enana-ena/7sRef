let splash = { phase: 1, t: 0, loaded: false, logoT: 0 };

function splashUpdate(real) {
  splash.t += real;
  if (splash.phase === 1 && splash.t >= CFG.splash.switchAt) {
    splash.phase = 2;
    titleBgm.pause();
    playMenuBgm();
    loadAllAssets().then(() => { splash.loaded = true; splash.logoT = 0; });
  }
  if (splash.loaded) splash.logoT += real;
}

function renderSplash() {
  const sp = CFG.splash;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (splash.phase === 1) {
    const t = splash.t;
    let a = 0;
    if (t < sp.fadeIn) a = t / sp.fadeIn;
    else if (t < sp.fadeIn + sp.hold) a = 1;
    else if (t < sp.fadeIn + sp.hold + sp.fadeOut) a = 1 - (t - sp.fadeIn - sp.hold) / sp.fadeOut;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + sp.titleFont + 'px sans-serif';
    ctx.fillText(sp.titleText, CFG.W / 2, CFG.H / 2);
    ctx.globalAlpha = 1;
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
  const hy = CFG.H / 2 + logo.height / 2 + sp.hintGap;
  ctx.font = sp.hintFont + 'px sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = sp.hintOutline;
  ctx.strokeStyle = '#000';
  ctx.strokeText(sp.hintText, CFG.W / 2, hy);
  ctx.fillStyle = '#fff';
  ctx.fillText(sp.hintText, CFG.W / 2, hy);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
}

function splashHover() {
  canvas.style.cursor = splash.loaded ? 'pointer' : 'default';
}

function splashClick() {
  if (!splash.loaded) return;
  state.scene = 'menu';
}