/* Retro Snake — modernized
   - Responsive canvas and cell sizing
   - Mobile touch + D-pad controls
   - Top scorer stored as single object in localStorage
   - Simple WebAudio sound effects and eat animation
*/

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');
const bestNameEl = document.getElementById('bestName');
const speedDisplay = document.getElementById('speedDisplay');
const newGameBtn = document.getElementById('newGame');
const pauseBtn = document.getElementById('pauseBtn');
const showScoresBtn = document.getElementById('showScores');
const closeScoresBtn = document.getElementById('closeScores');
const scoresPanel = document.getElementById('scoresPanel');
const scoresList = document.getElementById('scoresList');
const clearScoresBtn = document.getElementById('clearScores');
const nameModal = document.getElementById('nameModal');
const playerNameInput = document.getElementById('playerName');
const saveNameBtn = document.getElementById('saveName');
const skipSaveBtn = document.getElementById('skipSave');
const finalScoreEl = document.getElementById('finalScore');
const dpad = document.getElementById('dpad');
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

// Configuration
const GRID_SIZE = 20; // cells
let CELL_SIZE = 24; // will be computed
const TICK_BASE_MS = 140;
const SPEED_INCREASE_PER_FOOD = 2;
const LS_KEY = 'retro_snake_top_v1'; // single top scorer

// Game state
let snake = [{x: 9, y:9}];
let dir = {x: 1, y: 0};
let nextDir = {x: 1, y: 0};
let food = null;
let score = 0;
let speed = 1;
let tickTimer = null;
let isRunning = false;
let isPaused = false;
let eatPulse = 0; // animation counter

// Particles for eat animation
const particles = [];
function spawnParticles(cellX, cellY, count=18){
  const cx = cellX*CELL_SIZE + CELL_SIZE/2; const cy = cellY*CELL_SIZE + CELL_SIZE/2;
  for(let i=0;i<count;i++){
    const angle = Math.random()*Math.PI*2; const s = 1 + Math.random()*2.2;
    particles.push({ x: cx, y: cy, vx: Math.cos(angle)*s, vy: Math.sin(angle)*s - 1.2, life: 0.9 + Math.random()*0.9, size: 2 + Math.random()*4, color: `hsl(${Math.floor(320+Math.random()*40)},80%,60%)` });
  }
  // visual beat pulse
  triggerBeatPulse(0.14);
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.vy += 6 * dt; // gravity
    p.vx *= 0.995; p.vy *= 0.995;
    p.x += p.vx * CELL_SIZE * dt * 12; p.y += p.vy * CELL_SIZE * dt * 12;
    p.life -= dt * 1.2;
    if(p.life <= 0) particles.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// Beat / music pulse animation
let beatPulse = 0;
function triggerBeatPulse(amount=0.12){ beatPulse = Math.max(beatPulse, amount); }
function updateBeatPulse(dt){ beatPulse = Math.max(0, beatPulse - dt * 1.4); }

// Audio (WebAudio)
let audioCtx = null;
function ensureAudio(){
  if(audioCtx) return;
  try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ audioCtx = null; }
}
function playBeep(freq=440, duration=0.08, type='sine', gain=0.08){
  if(!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + duration + 0.02);
}
function playEat(){ ensureAudio(); playBeep(780, 0.09, 'sawtooth', 0.08); }
function playGameOver(){ ensureAudio(); playBeep(160, 0.2, 'sine', 0.12); playBeep(120, 0.15, 'sine', 0.10); }

// Simple WebAudio background music loop + beat (scheduler)
let music = { running:false, intervalId:null, bpm:100, masterGain:null, musicGain:null };
function setupMusicNodes(){
  if(!audioCtx) return;
  if(music.masterGain) return;
  music.masterGain = audioCtx.createGain(); music.musicGain = audioCtx.createGain();
  music.masterGain.gain.value = 0.9; music.musicGain.gain.value = 0.12;
  music.musicGain.connect(music.masterGain); music.masterGain.connect(audioCtx.destination);
}
function playKick(time){ if(!audioCtx) return; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, time); o.frequency.exponentialRampToValueAtTime(40, time + 0.14); g.gain.setValueAtTime(0.9, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.18); o.connect(g); g.connect(music.masterGain); o.start(time); o.stop(time + 0.18); }
function playSynthNote(time, freq, dur=0.18){ if(!audioCtx) return; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, time); g.gain.setValueAtTime(0.0, time); g.gain.linearRampToValueAtTime(0.12, time + 0.01); g.gain.exponentialRampToValueAtTime(0.001, time + dur); o.connect(g); g.connect(music.musicGain); o.start(time); o.stop(time + dur + 0.02); }
function scheduleMusic(){ if(!audioCtx || !music.masterGain) return; const lookAhead = 0.06; const now = audioCtx.currentTime; const beatInterval = 60 / music.bpm; playKick(now + lookAhead); playSynthNote(now + lookAhead + 0.02, 220, 0.22); playSynthNote(now + lookAhead + beatInterval*0.5, 330, 0.22); playSynthNote(now + lookAhead + beatInterval*0.75, 440, 0.22); triggerBeatPulse(0.08); }
function startMusic(){ ensureAudio(); setupMusicNodes(); if(music.running) return; music.running = true; music.intervalId = setInterval(scheduleMusic, Math.max(150, (60/music.bpm)*1000)); const btn = document.getElementById('musicToggle'); if(btn){ btn.textContent='Music: On'; btn.setAttribute('aria-pressed','true'); btn.classList.add('active'); } }
function stopMusic(){ if(music.intervalId) clearInterval(music.intervalId); music.intervalId=null; music.running=false; if(music.masterGain){ try{ music.masterGain.disconnect(); }catch(e){} } music.masterGain=null; music.musicGain=null; const btn = document.getElementById('musicToggle'); if(btn){ btn.textContent='Music: Off'; btn.setAttribute('aria-pressed','false'); btn.classList.remove('active'); } }

// Storage: single top scorer object {name,score,date}
function getTop(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function saveTop(obj){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(obj)); }catch(e){}
}
function clearTop(){ localStorage.removeItem(LS_KEY); }

function updateBestDisplay(){
  const top = getTop();
  if(top){ bestScoreEl.textContent = top.score; bestNameEl.textContent = top.name; }
  else { bestScoreEl.textContent = 0; bestNameEl.textContent = '—'; }
}

function resetGame(){
  snake = [{x: Math.floor(GRID_SIZE/2), y: Math.floor(GRID_SIZE/2)}];
  dir = {x: 1, y: 0}; nextDir = {x: 1, y: 0};
  score = 0; speed = 1; eatPulse = 0;
  placeFood();
  scoreEl.textContent = score;
  speedDisplay.textContent = speed.toFixed(1);
}

function placeFood(){
  let attempts = 0;
  while(true){
    const pos = {x: randInt(0, GRID_SIZE-1), y: randInt(0, GRID_SIZE-1)};
    if(!snake.some(s => s.x === pos.x && s.y === pos.y)){
      food = pos; return;
    }
    if(++attempts > 200) { food = {x:0,y:0}; return; }
  }
}
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a }

function drawCell(x,y,fill,stroke,scale=1){
  const w = CELL_SIZE*scale; const h = CELL_SIZE*scale;
  const off = (CELL_SIZE - w)/2;
  ctx.fillStyle = fill;
  ctx.fillRect(x*CELL_SIZE + off, y*CELL_SIZE + off, w, h);
  if(stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, Math.floor(CELL_SIZE*0.06)); ctx.strokeRect(x*CELL_SIZE + off + 0.5, y*CELL_SIZE + off + 0.5, w-1, h-1); }
}

function draw(){
  // clear
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // subtle background
  ctx.fillStyle = '#041218';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth = 1;
  for(let i=0;i<=GRID_SIZE;i++){
    const p = i*CELL_SIZE;
    ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(canvas.width,p); ctx.stroke();
  }

  // food with pulse
  if(food){
    const scale = 1 + Math.max(0, eatPulse/6)*0.35;
    drawCell(food.x, food.y, '#ff6b6b', '#7f2b2b', scale);
  }

  // particles (under snake for glow)
  if(particles.length) drawParticles();

  // snake with gradient head
  for(let i=snake.length-1;i>=0;i--){
    const s = snake[i];
    const factor = 1 - (i / Math.max(1, snake.length));
    const fill = i===0 ? '#a8ff9a' : `rgba(${Math.floor(100+150*factor)},${Math.floor(200-60*factor)},${Math.floor(120+10*factor)},1)`;
    const stroke = i===0 ? '#3ea55c' : '#214a33';
    drawCell(s.x, s.y, fill, stroke);
  }
}

function step(){
  if(!isRunning || isPaused) return;
  dir = nextDir;
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};

  // wrap
  if(head.x < 0) head.x = GRID_SIZE-1;
  if(head.x >= GRID_SIZE) head.x = 0;
  if(head.y < 0) head.y = GRID_SIZE-1;
  if(head.y >= GRID_SIZE) head.y = 0;

  // collision
  if(snake.some(s => s.x === head.x && s.y === head.y)){
    playGameOver();
    gameOver(); return;
  }

  snake.unshift(head);

  if(food && head.x === food.x && head.y === food.y){
    score += 10; speed += SPEED_INCREASE_PER_FOOD/10; eatPulse = 6; playEat(); spawnParticles(food.x, food.y); placeFood();
    // speed change will affect next interval
    startTickLoop();
  } else { snake.pop(); }

  scoreEl.textContent = score;
  speedDisplay.textContent = speed.toFixed(1);
  if(eatPulse > 0) eatPulse = Math.max(0, eatPulse - 0.28);
}

function gameOver(){
  isRunning = false; clearInterval(tickTimer);
  const top = getTop();
  const qualifies = !top || score > top.score;
  if(qualifies){ showNameModal(); }
  else { alert('Game over! Score: ' + score); }
  updateBestDisplay();
}

function startGame(){
  ensureAudio(); resetGame(); isRunning = true; isPaused = false; startTickLoop();
}

function startTickLoop(){
  if(tickTimer) clearInterval(tickTimer);
  const interval = Math.max(28, TICK_BASE_MS - (speed-1)*12);
  tickTimer = setInterval(step, interval);
}

function togglePause(){ if(!isRunning) return; isPaused = !isPaused; pauseBtn.textContent = isPaused ? 'Resume' : 'Pause'; }

// input handling
function handleKey(e){
  const key = e.key;
  if(['ArrowUp','w','W'].includes(key)) trySetDir(0,-1);
  if(['ArrowDown','s','S'].includes(key)) trySetDir(0,1);
  if(['ArrowLeft','a','A'].includes(key)) trySetDir(-1,0);
  if(['ArrowRight','d','D'].includes(key)) trySetDir(1,0);
  if(key === 'p' || key === 'P') togglePause();
}
function trySetDir(x,y){ if(x === -dir.x && y === -dir.y) return; nextDir = {x,y}; }

// touch swipe support
let touchStart = null;
canvas.addEventListener('touchstart', (e)=>{ const t = e.touches[0]; touchStart = {x: t.clientX, y: t.clientY, t: Date.now()}; });
canvas.addEventListener('touchend', (e)=>{
  if(!touchStart) return; const t = e.changedTouches[0]; const dx = t.clientX - touchStart.x; const dy = t.clientY - touchStart.y; const dt = Date.now() - touchStart.t; touchStart = null;
  if(Math.hypot(dx,dy) < 20 || dt > 800) return; // ignore small or too slow
  if(Math.abs(dx) > Math.abs(dy)) trySetDir(dx>0?1:-1,0); else trySetDir(0, dy>0?1:-1);
});

// on-screen D-pad
function wireButton(btn, x,y){ if(!btn) return; btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); trySetDir(x,y); }); btn.addEventListener('mousedown', ()=> trySetDir(x,y)); }
wireButton(btnUp,0,-1); wireButton(btnDown,0,1); wireButton(btnLeft,-1,0); wireButton(btnRight,1,0);

// Scores UI
function showScores(){
  const top = getTop();
  if(!top){ scoresList.textContent = 'No top scorer yet.'; }
  else { scoresList.innerHTML = `<div class="top-only"><strong>${top.name}</strong> — ${top.score} <span class="date">${new Date(top.date).toLocaleDateString()}</span></div>`; }
  scoresPanel.classList.remove('hidden'); scoresPanel.setAttribute('aria-hidden','false');
}
function hideScores(){ scoresPanel.classList.add('hidden'); scoresPanel.setAttribute('aria-hidden','true'); }
function clearScores(){ if(confirm('Clear top scorer?')){ clearTop(); updateBestDisplay(); hideScores(); } }

function showNameModal(){ finalScoreEl.textContent = score; playerNameInput.value = ''; nameModal.classList.remove('hidden'); playerNameInput.focus(); }
function hideNameModal(){ nameModal.classList.add('hidden'); }
function saveNameAndScore(){ const name = playerNameInput.value.trim() || 'Anon'; saveTop({name, score, date: (new Date()).toISOString()}); hideNameModal(); updateBestDisplay(); showScores(); }

// initialization
updateBestDisplay(); resetGame();

// event wiring
window.addEventListener('keydown', handleKey);
newGameBtn.addEventListener('click', ()=>{ if(isRunning){ if(!confirm('Start a new game? Current progress will be lost.')) return; clearInterval(tickTimer); } startGame(); });
pauseBtn.addEventListener('click', ()=>{ togglePause(); });
showScoresBtn.addEventListener('click', showScores);
closeScoresBtn && closeScoresBtn.addEventListener('click', hideScores);
clearScoresBtn.addEventListener('click', clearScores);
saveNameBtn.addEventListener('click', saveNameAndScore);
skipSaveBtn.addEventListener('click', ()=>{ hideNameModal(); updateBestDisplay(); });
playerNameInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') saveNameAndScore(); });
nameModal.addEventListener('click', (e)=>{ if(e.target === nameModal) return; });

// music toggle wiring (button added to UI)
const musicBtn = document.getElementById('musicToggle');
if(musicBtn){ musicBtn.addEventListener('click', ()=>{ ensureAudio(); if(music.running) stopMusic(); else startMusic(); }); }

// Render loop using requestAnimationFrame
let lastFrameTime = performance.now();
function render(now){
  const dt = Math.min(0.05, (now - lastFrameTime)/1000);
  lastFrameTime = now;
  updateParticles(dt);
  updateBeatPulse(dt);
  draw();
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// responsive canvas sizing
function fitCanvas(){
  const maxSize = Math.min(window.innerWidth * 0.92, 680);
  const dpr = window.devicePixelRatio || 1;
  const displaySize = Math.floor(maxSize);
  canvas.style.width = displaySize + 'px'; canvas.style.height = displaySize + 'px';
  canvas.width = GRID_SIZE * Math.floor((displaySize * dpr) / GRID_SIZE);
  canvas.height = canvas.width; // square
  CELL_SIZE = Math.floor(canvas.width / GRID_SIZE);
  draw();
}
window.addEventListener('resize', fitCanvas); fitCanvas();

// make controls keyboard-focusable
[newGameBtn, pauseBtn, showScoresBtn, clearScoresBtn].forEach(b=>{ if(b) b.tabIndex=0; });

// allow first user interaction to initialize audio context (some browsers require gesture)
['touchstart','mousedown','keydown'].forEach(ev=> window.addEventListener(ev, ensureAudio, {once:true}));

// On mobile, start the game on first meaningful pointerdown and request fullscreen
(function setupAutoStart(){
  function tryEnterFullscreen(){
    const el = canvas.parentElement || document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if(req){ try{ req.call(el); }catch(e){} }
  }

  function onFirstPointer(e){
    // ignore if modal is showing
    if(nameModal && !nameModal.classList.contains('hidden')) return;
    // start audio, fit canvas, request fullscreen, then start game
    ensureAudio();
    fitCanvas();
    tryEnterFullscreen();
    // small delay to ensure fullscreen/audiocontext settle
    setTimeout(()=>{
      if(!isRunning) startGame();
    }, 10);
    // hide mobile hint if present
    const tapHint = document.getElementById('tapHint'); if(tapHint) tapHint.style.display = 'none';
  }

  // add as once so it only triggers on the first user gesture
  canvas.addEventListener('pointerdown', onFirstPointer, {once:true, passive:true});
})();

// expose small API
window.__retroSnake = { getTop, saveTop, clearTop };
