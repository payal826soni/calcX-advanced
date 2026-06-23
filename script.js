/* =====================================================
   CALC — Advanced Calculator  |  script.js
   ===================================================== */

// ── Theme definitions ──────────────────────────────
const THEMES = [
  {
    name: 'Void',
    dot:  '#1e1e26',
    shell:'#0e0e11', disp:'#17171c', num:'#1e1e26', numTx:'#e8e8f0',
    fn:   '#252530', fnTx:'#a0a0b8', op:'#ff6b35',  opTx:'#fff',
    eq:   '#ff6b35', eqTx:'#fff',    tx:'#e8e8f0',  histB:'#13131a'
  },
  {
    name: 'Midnight',
    dot:  '#161b22',
    shell:'#0d1117', disp:'#0d1117', num:'#161b22', numTx:'#c9d1d9',
    fn:   '#21262d', fnTx:'#8b949e', op:'#1f6feb',  opTx:'#fff',
    eq:   '#238636', eqTx:'#fff',    tx:'#c9d1d9',  histB:'#090c10'
  },
  {
    name: 'Sakura',
    dot:  '#fce4ec',
    shell:'#fff0f5', disp:'#fce4ec', num:'#ffffff', numTx:'#4a2030',
    fn:   '#fce4ec', fnTx:'#a0345a', op:'#e91e63',  opTx:'#fff',
    eq:   '#c2185b', eqTx:'#fff',    tx:'#4a2030',  histB:'#fff0f5'
  },
  {
    name: 'Forest',
    dot:  '#233227',
    shell:'#1b2b1e', disp:'#121e14', num:'#233227', numTx:'#c8e6c9',
    fn:   '#2e4034', fnTx:'#a5d6a7', op:'#4caf50',  opTx:'#fff',
    eq:   '#388e3c', eqTx:'#fff',    tx:'#c8e6c9',  histB:'#121e14'
  },
  {
    name: 'Amber',
    dot:  '#2a2000',
    shell:'#1c1400', disp:'#110e00', num:'#2a2000', numTx:'#ffecb3',
    fn:   '#3a2e00', fnTx:'#ffe082', op:'#ffb300',  opTx:'#1c1400',
    eq:   '#ff8f00', eqTx:'#fff',    tx:'#ffecb3',  histB:'#1c1400'
  },
  {
    name: 'Ice',
    dot:  '#d0eaf5',
    shell:'#e8f4f8', disp:'#d0eaf5', num:'#ffffff', numTx:'#1a3a4a',
    fn:   '#d0eaf5', fnTx:'#1a5c7e', op:'#0288d1',  opTx:'#fff',
    eq:   '#01579b', eqTx:'#fff',    tx:'#1a3a4a',  histB:'#e8f4f8'
  }
];

// ── Unit converter data ────────────────────────────
const UNIT_DEFS = {
  length: { units: ['m','km','cm','mm','ft','in','yd','mi'], factor: [1,1000,0.01,0.001,0.3048,0.0254,0.9144,1609.34] },
  weight: { units: ['kg','g','lb','oz','t'],                 factor: [1,0.001,0.453592,0.0283495,1000] },
  temp:   { units: ['°C','°F','K'] }
};

// ── State ──────────────────────────────────────────
let cur       = '';
let expr      = '';
let histLine  = '';
let history   = [];
let mode      = 'std';
let useDeg    = true;
let justCalc  = false;
let activeTheme = 0;
let audioCtx  = null;

// ── DOM refs ───────────────────────────────────────
const mainEl   = document.getElementById('mainLine');
const exprEl   = document.getElementById('exprLine');
const histElD  = document.getElementById('histLine');
const liveEl   = document.getElementById('liveLine');
const fracEl   = document.getElementById('fracLine');
const histList = document.getElementById('histList');
const sciPanel = document.getElementById('sciPanel');
const progPanel= document.getElementById('progPanel');
const unitPanel= document.getElementById('unitPanel');
const graphPanel=document.getElementById('graphPanel');
const presetsBar=document.getElementById('presetsBar');

// ══════════════════════════════════════════════════
// AUDIO
// ══════════════════════════════════════════════════
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq = 600, dur = 0.05, type = 'sine') {
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch (e) { /* AudioContext blocked — silent fail */ }
}

const playClick  = (f = 600) => playTone(f, 0.045);
const playEquals = ()        => { playTone(880, 0.07); setTimeout(() => playTone(1100, 0.06), 75); };
const playError  = ()        => { playTone(200, 0.15); setTimeout(() => playTone(160, 0.2), 120); };

// ══════════════════════════════════════════════════
// RENDERING
// ══════════════════════════════════════════════════

/** Tokenise expression string into coloured HTML */
function colorExpr(s) {
  return s
    .replace(/([0-9]+\.?[0-9]*)/g,   '<span class="num-tok">$1</span>')
    .replace(/([+\-*\/÷×−^])/g,      '<span class="op-tok">$1</span>')
    .replace(/(sin|cos|tan|sqrt|log|ln|Math\.PI|Math\.E)/g, '<span class="fn-tok">$1</span>');
}

/** Try to simplify a decimal to a unicode fraction */
function toFraction(dec) {
  if (!isFinite(dec) || Number.isInteger(dec)) return '';
  const map = {
    '0.5':'½','0.25':'¼','0.75':'¾',
    '0.333':'⅓','0.667':'⅔',
    '0.2':'⅕','0.4':'⅖','0.6':'⅗','0.8':'⅘',
    '0.125':'⅛','0.375':'⅜','0.625':'⅝','0.875':'⅞'
  };
  const k = parseFloat(Math.abs(dec).toFixed(3)).toString();
  return map[k] ? (dec < 0 ? '−' : '') + map[k] : '';
}

/** Attempt live preview of the current expression */
function liveCalc() {
  const full = (expr + (cur || '')).replace(/Math\.PI/g, Math.PI).replace(/Math\.E/g, Math.E);
  if (!full.trim() || !cur || !expr) return null;
  try { return Function('"use strict"; return (' + full + ')')(); } catch { return null; }
}

function render() {
  const display = cur || '0';

  // Main number — shrink font for long numbers
  mainEl.textContent = display;
  mainEl.style.fontSize =
    display.length > 15 ? '20px' :
    display.length > 11 ? '28px' :
    display.length >  7 ? '36px' : '44px';

  // Expression with syntax highlighting
  exprEl.innerHTML = colorExpr(expr);
  histElD.textContent = histLine;

  // Live preview
  const lv = liveCalc();
  if (lv !== null && isFinite(lv) && String(lv) !== cur) {
    liveEl.textContent = '= ' + parseFloat(lv.toFixed(10));
  } else {
    liveEl.textContent = '';
  }

  // Fraction badge
  const v = parseFloat(cur);
  const frac = (!isNaN(v) && isFinite(v)) ? toFraction(v) : '';
  fracEl.textContent = frac ? '≈ ' + frac : '';

  // Secondary panels
  if (mode === 'prog')   updateProg();
  if (mode === 'unit')   updateUnitResult();
}

// ══════════════════════════════════════════════════
// ODOMETER ANIMATION
// ══════════════════════════════════════════════════
function odometer(from, to, el) {
  const STEPS = 14, DUR = 380;
  const diff  = to - from;
  let step = 0;
  const id = setInterval(() => {
    step++;
    const t = step / STEPS;
    const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
    const val = from + diff * eased;
    el.textContent = parseFloat(val.toFixed(8)).toString();
    if (step >= STEPS) { clearInterval(id); el.textContent = String(to); }
  }, DUR / STEPS);
}

// ══════════════════════════════════════════════════
// ANIMATIONS
// ══════════════════════════════════════════════════
function popAnim()   { mainEl.classList.remove('pop');   void mainEl.offsetWidth; mainEl.classList.add('pop'); }
function shakeAnim() { mainEl.classList.remove('shake'); void mainEl.offsetWidth; mainEl.classList.add('shake'); }

function showError(msg) {
  const t = document.getElementById('errorToast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ══════════════════════════════════════════════════
// INPUT HANDLERS
// ══════════════════════════════════════════════════
function resetIfJustCalc() {
  if (justCalc) { cur = ''; expr = ''; histLine = ''; justCalc = false; }
}

function appendDigit(d) {
  playClick(590 + parseInt(d) * 18);
  resetIfJustCalc();
  cur = (cur === '0' && d !== '.') ? d : cur + d;
  render();
}

function appendDot() {
  playClick(540);
  resetIfJustCalc();
  if (!cur.includes('.')) cur += cur ? '.' : '0.';
  render();
}

function appendOp(op) {
  playClick(700);
  justCalc = false;
  if (cur) {
    expr += cur + ' ' + op + ' ';
    cur = '';
  } else if (expr) {
    expr = expr.trimEnd().slice(0, -1) + op + ' ';
  }
  render();
}

function appendRaw(v) {
  playClick(640);
  resetIfJustCalc();
  cur += v;
  render();
}

function doBackspace() {
  playClick(400);
  if (cur.length > 0) cur = cur.slice(0, -1);
  render();
}

function doAction(a) {
  playClick(500);
  if (a === 'ac')  { cur = ''; expr = ''; histLine = ''; justCalc = false; }
  if (a === 'pct') { if (cur) try { cur = String(parseFloat(cur) / 100); } catch (e) {} }
  render();
}

// ══════════════════════════════════════════════════
// EQUALS
// ══════════════════════════════════════════════════
function doEquals() {
  const full = expr + (cur || '0');
  if (!full.trim()) return;

  const evalStr = full
    .replace(/Math\.PI/g, Math.PI)
    .replace(/Math\.E/g,  Math.E);

  try {
    const result = Function('"use strict"; return (' + evalStr + ')')();

    if (!isFinite(result)) {
      if (result === Infinity || result === -Infinity) showError('Result is Infinity');
      else showError('Invalid expression');
      throw new Error('non-finite');
    }

    const rStr    = parseFloat(result.toFixed(10)).toString();
    const prevNum = parseFloat(cur || '0');

    histLine = full + ' =';
    history.unshift({ expr: full, result: rStr });
    if (history.length > 30) history.pop();
    updateHistPanel();

    playEquals();
    cur = rStr; expr = ''; justCalc = true;
    popAnim();
    odometer(isNaN(prevNum) ? 0 : prevNum, parseFloat(rStr), mainEl);
    render();

  } catch (e) {
    if (!e.message.includes('non-finite')) {
      if (evalStr.includes('/0')) showError('Division by zero');
      else showError('Invalid input — check your expression');
    }
    playError(); shakeAnim();
    cur = 'Error'; expr = '';
    render();
  }
}

// ══════════════════════════════════════════════════
// SCIENTIFIC OPERATIONS
// ══════════════════════════════════════════════════
function sciOp(op) {
  playClick(680);
  const val    = parseFloat(cur || '0');
  const toRad  = useDeg ? Math.PI / 180 : 1;
  let res;

  switch (op) {
    case 'sin':  res = Math.sin(val * toRad); break;
    case 'cos':  res = Math.cos(val * toRad); break;
    case 'tan':
      if (useDeg && val % 180 === 90) { showError('tan(90°) is undefined'); shakeAnim(); playError(); return; }
      res = Math.tan(val * toRad);
      break;
    case 'sqrt':
      if (val < 0) { showError('√ of a negative number is complex'); shakeAnim(); playError(); return; }
      res = Math.sqrt(val);
      break;
    case 'log':
      if (val <= 0) { showError('log requires a positive number'); shakeAnim(); playError(); return; }
      res = Math.log10(val);
      break;
    case 'ln':
      if (val <= 0) { showError('ln requires a positive number'); shakeAnim(); playError(); return; }
      res = Math.log(val);
      break;
    case 'sq':   res = val * val; break;
    default:     res = NaN;
  }

  if (!isFinite(res) || isNaN(res)) {
    showError('Math error'); shakeAnim(); playError(); cur = 'Error';
  } else {
    histLine = op + '(' + val + ') =';
    const prev = val;
    cur = parseFloat(res.toFixed(10)).toString();
    popAnim();
    odometer(prev, parseFloat(cur), mainEl);
  }
  render();
}

function doFactorial() {
  playClick(750);
  const n = parseInt(cur || '0');
  if (n < 0 || n > 20) { showError('n! is defined for 0 – 20 only'); shakeAnim(); playError(); return; }
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  histLine = n + '! =';
  const prev = parseFloat(cur);
  cur = String(f);
  popAnim();
  odometer(prev, f, mainEl);
  render();
}

function startPower() {
  playClick(680);
  if (!cur) return;
  expr += cur + '**';
  cur = '';
  render();
}

function autoBalance() {
  playClick(720);
  resetIfJustCalc();
  const opens  = (cur.match(/\(/g) || []).length;
  const closes = (cur.match(/\)/g) || []).length;
  cur += opens > closes ? ')'.repeat(opens - closes) : '(';
  render();
}

// ══════════════════════════════════════════════════
// MODE & DEGREE TOGGLE
// ══════════════════════════════════════════════════
function setMode(m) {
  mode = m;
  playClick(550);

  sciPanel.classList.toggle('open',  m === 'sci');
  progPanel.classList.toggle('open', m === 'prog');
  unitPanel.classList.toggle('open', m === 'unit');
  graphPanel.classList.toggle('open',m === 'graph');

  ['modeStd','modeSci','modeProg','modeUnit','modeGraph'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
  const map = { std:'modeStd', sci:'modeSci', prog:'modeProg', unit:'modeUnit', graph:'modeGraph' };
  if (map[m]) document.getElementById(map[m]).classList.add('active');

  if (m === 'unit')  updateUnitSelects();
  if (m === 'graph') plotGraph();
  render();
}

function toggleDeg() {
  useDeg = !useDeg;
  document.getElementById('degLabel').textContent = useDeg ? 'DEG' : 'RAD';
  playClick(500);
}

// ══════════════════════════════════════════════════
// HISTORY PANEL
// ══════════════════════════════════════════════════
function updateHistPanel() {
  if (!history.length) {
    histList.innerHTML = '<li class="hist-empty">No history yet</li>';
    return;
  }
  histList.innerHTML = history.slice(0, 10).map(h =>
    `<li class="hist-item" onclick="recallHist('${h.result}')">${h.expr} = <strong>${h.result}</strong></li>`
  ).join('');
}

function recallHist(val) {
  cur = val; justCalc = false; render();
}

// ══════════════════════════════════════════════════
// PROGRAMMER MODE
// ══════════════════════════════════════════════════
function updateProg() {
  const v = parseInt(cur || '0');
  if (isNaN(v)) {
    ['pBin','pOct','pHex','pDec'].forEach(id => document.getElementById(id).textContent = '—');
    return;
  }
  document.getElementById('pBin').textContent = v.toString(2);
  document.getElementById('pOct').textContent = v.toString(8);
  document.getElementById('pHex').textContent = v.toString(16).toUpperCase();
  document.getElementById('pDec').textContent = v.toString(10);
}

// ══════════════════════════════════════════════════
// UNIT CONVERTER
// ══════════════════════════════════════════════════
function updateUnitSelects() {
  const cat = document.getElementById('unitCat').value;
  const def = UNIT_DEFS[cat];
  const fromSel = document.getElementById('unitFrom');
  const toSel   = document.getElementById('unitTo');
  fromSel.innerHTML = def.units.map(u => `<option>${u}</option>`).join('');
  toSel.innerHTML   = def.units.map((u, i) => `<option ${i === 1 ? 'selected' : ''}>${u}</option>`).join('');
  fromSel.onchange  = updateUnitResult;
  toSel.onchange    = updateUnitResult;
  updateUnitResult();
}

function updateUnitResult() {
  const v = parseFloat(cur);
  const resEl = document.getElementById('unitResult');
  if (isNaN(v)) { resEl.textContent = 'Enter a value first'; return; }

  const cat  = document.getElementById('unitCat').value;
  const from = document.getElementById('unitFrom').value;
  const to   = document.getElementById('unitTo').value;
  let result;

  if (cat === 'temp') {
    let c;
    if (from === '°C')      c = v;
    else if (from === '°F') c = (v - 32) * 5 / 9;
    else                    c = v - 273.15;
    if (to === '°C')        result = c;
    else if (to === '°F')   result = c * 9 / 5 + 32;
    else                    result = c + 273.15;
  } else {
    const def = UNIT_DEFS[cat];
    const fi  = def.units.indexOf(from);
    const ti  = def.units.indexOf(to);
    const base = v * def.factor[fi];
    result = base / def.factor[ti];
  }

  resEl.textContent = parseFloat(result.toFixed(6)) + ' ' + to;
}

// ══════════════════════════════════════════════════
// GRAPH MODE
// ══════════════════════════════════════════════════
function plotGraph() {
  const canvas = document.getElementById('graphCanvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const exprInput = document.getElementById('graphExpr').value.trim();

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(0, 0, W, H);

  const xMin = -6, xMax = 6, yMin = -5, yMax = 5;
  const toCanX = x  => (x - xMin) / (xMax - xMin) * W;
  const toCanY = y  => (yMax - y) / (yMax - yMin) * H;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth   = 0.5;
  for (let x = Math.ceil(xMin); x <= xMax; x++) {
    ctx.beginPath(); ctx.moveTo(toCanX(x), 0); ctx.lineTo(toCanX(x), H); ctx.stroke();
  }
  for (let y = Math.ceil(yMin); y <= yMax; y++) {
    ctx.beginPath(); ctx.moveTo(0, toCanY(y)); ctx.lineTo(W, toCanY(y)); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(0, toCanY(0)); ctx.lineTo(W, toCanY(0)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(toCanX(0), 0); ctx.lineTo(toCanX(0), H); ctx.stroke();

  // Curve
  const t = THEMES[activeTheme];
  ctx.strokeStyle = t.op;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  let penDown = false;

  for (let px = 0; px < W; px++) {
    const x = xMin + (px / W) * (xMax - xMin);
    try {
      const y = Function('"use strict"; const x = ' + x + '; return (' + exprInput + ')')();
      if (isFinite(y) && Math.abs(y) < 1e6) {
        const cy = toCanY(y);
        if (!penDown) { ctx.moveTo(px, cy); penDown = true; }
        else ctx.lineTo(px, cy);
      } else { penDown = false; }
    } catch { penDown = false; }
  }
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font      = '11px JetBrains Mono, monospace';
  ctx.fillText('y = ' + exprInput, 8, 16);
}

// ══════════════════════════════════════════════════
// QUICK PRESETS: TIP & BMI
// ══════════════════════════════════════════════════
function openPreset(type) {
  presetsBar.style.display = 'flex';
  playClick(600);

  if (type === 'tip') {
    const bill = parseFloat(cur || '0');
    presetsBar.innerHTML =
      `<span class="presets-label">Tip on ${bill}:</span>` +
      [10, 15, 18, 20, 25].map(p =>
        `<button class="preset-chip" onclick="calcTip(${p})">${p}%</button>`
      ).join('');
  } else {
    const w = parseFloat(cur || '0');
    presetsBar.innerHTML =
      `<span class="presets-label">BMI for ${w} kg:</span>` +
      ['1.55','1.60','1.65','1.70','1.75','1.80','1.85','1.90'].map(h =>
        `<button class="preset-chip" onclick="calcBMI(${h})">${h} m</button>`
      ).join('');
  }
}

function calcTip(pct) {
  const bill = parseFloat(cur || '0');
  histLine = bill + ' × ' + pct + '% tip =';
  cur = parseFloat((bill * pct / 100).toFixed(2)).toString();
  justCalc = true; popAnim(); render();
  presetsBar.style.display = 'none';
}

function calcBMI(h) {
  const w = parseFloat(cur || '0');
  const bmi = w / (h * h);
  histLine = 'BMI(' + w + 'kg, ' + h + 'm) =';
  cur = parseFloat(bmi.toFixed(1)).toString();
  justCalc = true; popAnim(); render();
  presetsBar.style.display = 'none';
}

// ══════════════════════════════════════════════════
// RIPPLE
// ══════════════════════════════════════════════════
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  btn.style.setProperty('--rx', ((e.clientX - rect.left) / rect.width  * 100) + '%');
  btn.style.setProperty('--ry', ((e.clientY - rect.top)  / rect.height * 100) + '%');
  btn.classList.remove('ripple');
  void btn.offsetWidth;
  btn.classList.add('ripple');
  setTimeout(() => btn.classList.remove('ripple'), 400);
});

// ══════════════════════════════════════════════════
// KEYBOARD SUPPORT
// ══════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key >= '0' && e.key <= '9') { appendDigit(e.key); return; }
  switch (e.key) {
    case '.':         appendDot();            break;
    case '+':         appendOp('+');          break;
    case '-':         appendOp('-');          break;
    case '*':         appendOp('*');          break;
    case '/':         e.preventDefault(); appendOp('/'); break;
    case '^':         startPower();           break;
    case 'Enter':
    case '=':         doEquals();             break;
    case 'Escape':    doAction('ac');         break;
    case 'Backspace': doBackspace();          break;
    case '%':         doAction('pct');        break;
    case '(':         appendRaw('(');         break;
    case ')':         appendRaw(')');         break;
  }
});

// ══════════════════════════════════════════════════
// THEME ENGINE
// ══════════════════════════════════════════════════
function applyTheme(i, customOp) {
  activeTheme = i;
  const t = { ...THEMES[i] };
  if (customOp) { t.op = customOp; t.eq = customOp; }

  const R = document.documentElement;
  R.style.setProperty('--shell',  t.shell);
  R.style.setProperty('--disp',   t.disp);
  R.style.setProperty('--num',    t.num);
  R.style.setProperty('--numTx',  t.numTx);
  R.style.setProperty('--fn',     t.fn);
  R.style.setProperty('--fnTx',   t.fnTx);
  R.style.setProperty('--op',     t.op);
  R.style.setProperty('--opTx',   t.opTx);
  R.style.setProperty('--eq',     t.eq);
  R.style.setProperty('--eqTx',   t.eqTx);
  R.style.setProperty('--tx',     t.tx);
  R.style.setProperty('--histB',  t.histB);
  R.style.setProperty('--accent', customOp || t.op);

  document.querySelectorAll('.theme-dot').forEach((b, idx) =>
    b.classList.toggle('active', idx === i)
  );

  // Replot graph with new accent colour if graph is open
  if (mode === 'graph') plotGraph();
}

function buildThemeBar() {
  const bar = document.getElementById('themeBar');
  THEMES.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className       = 'theme-dot';
    btn.style.background = t.dot;
    btn.title           = t.name;
    btn.setAttribute('aria-label', t.name + ' theme');
    btn.addEventListener('click', () => applyTheme(i));
    bar.appendChild(btn);
  });

  document.getElementById('customColor').addEventListener('input', e => {
    applyTheme(activeTheme, e.target.value);
  });
}

// ══════════════════════════════════════════════════
// SYSTEM DARK / LIGHT PREFERENCE
// ══════════════════════════════════════════════════
function autoThemeFromSystem() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    applyTheme(5); // Ice — light theme
  } else {
    applyTheme(0); // Void — dark theme
  }
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  applyTheme(e.matches ? 0 : 5);
});

// ══════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════
buildThemeBar();
autoThemeFromSystem();
updateUnitSelects();
updateHistPanel();
render();