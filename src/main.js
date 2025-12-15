const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const goldEl = document.getElementById("gold");
const livesEl = document.getElementById("lives");
const waveEl = document.getElementById("wave");
const startBtn = document.getElementById("start");
const musicBtn = document.getElementById("toggle-music");
const sfxBtn = document.getElementById("toggle-sfx");

const TOWER_COLORS = {
  archer: "#73c7ff",
  barracks: "#7dd97f",
  mage: "#c490ff",
  bomb: "#ff9f68",
};

const ENEMY_COLORS = {
  goblin: "#8bd38b",
  orc: "#7d9c5a",
  boss: "#c45d5d",
};

const AUDIO = {
  context: null,
  bgm: null,
  musicOn: false,
  sfxOn: false,
};

const gameState = {
  gold: 250,
  lives: 20,
  waveIndex: 0,
  running: false,
  lastSpawn: 0,
  enemies: [],
  towers: [],
  slots: [],
  projectiles: [],
  selectedType: null,
  lastFrame: 0,
};

const pathPoints = [
  { x: 40, y: 520 },
  { x: 200, y: 520 },
  { x: 350, y: 420 },
  { x: 520, y: 420 },
  { x: 760, y: 300 },
  { x: 920, y: 300 },
];

const waves = [
  { type: "goblin", count: 10, delay: 1200 },
  { type: "goblin", count: 6, delay: 900 },
  { type: "orc", count: 8, delay: 1400 },
  { type: "orc", count: 6, delay: 1200 },
  { type: "boss", count: 1, delay: 0 },
];

const towerStats = {
  archer: { cost: 100, range: 140, damage: 8, rate: 550, upgrade: 80 },
  barracks: { cost: 120, range: 90, damage: 4, rate: 280, slow: 0.8, upgrade: 90 },
  mage: { cost: 140, range: 170, damage: 12, rate: 700, pierce: 0.2, upgrade: 100 },
  bomb: { cost: 150, range: 130, damage: 20, rate: 1200, splash: 80, upgrade: 120 },
};

const enemyStats = {
  goblin: { hp: 35, speed: 80, reward: 15 },
  orc: { hp: 80, speed: 55, reward: 25 },
  boss: { hp: 400, speed: 45, reward: 120 },
};

function resetGame() {
  gameState.gold = 250;
  gameState.lives = 20;
  gameState.waveIndex = 0;
  gameState.running = true;
  gameState.enemies = [];
  gameState.towers = [];
  gameState.projectiles = [];
  gameState.selectedType = null;
  gameState.lastSpawn = performance.now();
  gameState.lastFrame = performance.now();
  waves.forEach((wave) => {
    wave.spawned = 0;
    wave.nextSpawn = 0;
  });
  buildSlots();
  updateHUD();
  startWave();
}

function buildSlots() {
  const slotPositions = [
    { x: 200, y: 340 },
    { x: 320, y: 260 },
    { x: 480, y: 310 },
    { x: 620, y: 220 },
    { x: 780, y: 420 },
    { x: 520, y: 520 },
  ];
  gameState.slots = slotPositions.map((pos, i) => ({ id: i, ...pos, tower: null }));
}

function startWave() {
  if (gameState.waveIndex >= waves.length) return;
  const wave = waves[gameState.waveIndex];
  wave.spawned = 0;
  wave.nextSpawn = performance.now();
}

function spawnEnemy(type) {
  const stat = enemyStats[type];
  gameState.enemies.push({
    type,
    hp: stat.hp,
    maxHp: stat.hp,
    speed: stat.speed,
    reward: stat.reward,
    pathIndex: 0,
    progress: 0,
    slowUntil: 0,
    x: pathPoints[0].x,
    y: pathPoints[0].y,
  });
  playSfx("spawn");
}

function placeTower(slot, type) {
  const stats = towerStats[type];
  if (gameState.gold < stats.cost) return;
  gameState.gold -= stats.cost;
  slot.tower = {
    type,
    level: 1,
    cooldown: 0,
    x: slot.x,
    y: slot.y,
  };
  gameState.towers.push(slot.tower);
  updateHUD();
}

function upgradeTower(slot) {
  const tower = slot.tower;
  if (!tower) return;
  const base = towerStats[tower.type];
  const cost = base.upgrade * tower.level;
  if (gameState.gold < cost) return;
  gameState.gold -= cost;
  tower.level += 1;
  updateHUD();
}

function selectTowerType(type) {
  gameState.selectedType = type;
  document.querySelectorAll(".tower-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
}

function updateHUD() {
  goldEl.textContent = gameState.gold;
  livesEl.textContent = gameState.lives;
  waveEl.textContent = `${gameState.waveIndex + 1}/${waves.length}`;
}

function drawPath() {
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 18;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i++) {
    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
  }
  ctx.stroke();
}

function drawSlots() {
  gameState.slots.forEach((slot) => {
    ctx.fillStyle = slot.tower ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.arc(slot.x, slot.y, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (slot.tower) {
      const color = TOWER_COLORS[slot.tower.type] || "#fff";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a0f1c";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Lv${slot.tower.level}`, slot.x, slot.y + 4);
    }
  });
}

function drawEnemies(dt) {
  gameState.enemies.forEach((enemy) => {
    const color = ENEMY_COLORS[enemy.type] || "#ddd";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, 16, 0, Math.PI * 2);
    ctx.fill();

    // HP bar
    const hpWidth = 32;
    const ratio = enemy.hp / enemy.maxHp;
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(enemy.x - hpWidth / 2, enemy.y - 24, hpWidth, 6);
    ctx.fillStyle = "#7dd97f";
    ctx.fillRect(enemy.x - hpWidth / 2, enemy.y - 24, hpWidth * ratio, 6);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.strokeRect(enemy.x - hpWidth / 2, enemy.y - 24, hpWidth, 6);

    ctx.fillStyle = "#e9f4ff";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(enemy.type === "boss" ? "오크왕" : enemy.type === "orc" ? "오크" : "고블린", enemy.x, enemy.y + 26);
  });
}

function drawProjectiles() {
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  gameState.projectiles.forEach((p) => {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.target.x, p.target.y);
    ctx.stroke();
  });
}

function moveEnemies(dt) {
  const now = performance.now();
  gameState.enemies.forEach((enemy) => {
    const speedFactor = now < enemy.slowUntil ? 0.5 : 1;
    const speed = enemy.speed * (dt / 1000) * speedFactor;
    let remaining = speed;
    while (remaining > 0) {
      const nextPoint = pathPoints[enemy.pathIndex + 1];
      if (!nextPoint) break;
      const dx = nextPoint.x - enemy.x;
      const dy = nextPoint.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= remaining) {
        enemy.x = nextPoint.x;
        enemy.y = nextPoint.y;
        enemy.pathIndex++;
        remaining -= dist;
      } else {
        enemy.x += (dx / dist) * remaining;
        enemy.y += (dy / dist) * remaining;
        remaining = 0;
      }
    }
  });
}

function cleanEntities() {
  const survivors = [];
  gameState.enemies.forEach((enemy) => {
    if (enemy.hp <= 0) {
      gameState.gold += enemy.reward;
      playSfx("reward");
      return;
    }
    if (enemy.pathIndex >= pathPoints.length - 1) return;
    survivors.push(enemy);
  });
  gameState.enemies = survivors;
  gameState.projectiles = gameState.projectiles.filter((p) => performance.now() - p.created < 200);
  updateHUD();
}

function handleLeaks() {
  gameState.enemies.forEach((enemy) => {
    if (enemy.pathIndex >= pathPoints.length - 1) {
      gameState.lives -= 1;
      enemy.hp = 0;
      enemy.reward = 0;
      if (gameState.lives <= 0) {
        gameOver();
      }
    }
  });
}

function fireTowers() {
  const now = performance.now();
  gameState.towers.forEach((tower) => {
    const base = towerStats[tower.type];
    const ready = now > tower.cooldown;
    if (!ready) return;

    const target = findTarget(tower);
    if (!target) return;

    tower.cooldown = now + base.rate * (1 - (tower.level - 1) * 0.1);
    const damage = base.damage * (1 + (tower.level - 1) * 0.25);

    applyDamage(tower, target, damage);
    gameState.projectiles.push({
      x: tower.x,
      y: tower.y,
      target: { x: target.x, y: target.y },
      created: now,
    });

    playSfx("attack");
  });
}

function applyDamage(tower, target, damage) {
  const base = towerStats[tower.type];
  if (tower.type === "bomb" && base.splash) {
    gameState.enemies.forEach((enemy) => {
      const dist = Math.hypot(enemy.x - target.x, enemy.y - target.y);
      if (dist <= base.splash) {
        enemy.hp -= damage;
      }
    });
  } else if (tower.type === "mage" && base.pierce) {
    const sorted = [...gameState.enemies].sort((a, b) => b.pathIndex - a.pathIndex);
    sorted.slice(0, 2).forEach((enemy, idx) => {
      enemy.hp -= idx === 0 ? damage : damage * base.pierce;
    });
  } else {
    target.hp -= damage;
    if (tower.type === "barracks") {
      target.slowUntil = performance.now() + 600;
    }
  }
}

function findTarget(tower) {
  const base = towerStats[tower.type];
  const enemies = gameState.enemies
    .map((enemy) => ({ enemy, dist: Math.hypot(enemy.x - tower.x, enemy.y - tower.y) }))
    .filter((d) => d.dist <= base.range)
    .sort((a, b) => b.enemy.pathIndex - a.enemy.pathIndex);
  return enemies[0]?.enemy;
}

function updateWaves() {
  if (!gameState.running) return;
  const wave = waves[gameState.waveIndex];
  if (!wave) return;

  if (wave.spawned < wave.count && performance.now() >= wave.nextSpawn) {
    spawnEnemy(wave.type);
    wave.spawned += 1;
    wave.nextSpawn = performance.now() + wave.delay;
  }

  if (wave.spawned >= wave.count && gameState.enemies.length === 0) {
    gameState.waveIndex += 1;
    updateHUD();
    if (gameState.waveIndex < waves.length) {
      startWave();
      gameState.gold += 80;
      updateHUD();
      playSfx("reward");
    } else {
      victory();
    }
  }
}

function gameOver() {
  gameState.running = false;
  alert("왕국이 함락되었습니다! 다시 도전하세요.");
}

function victory() {
  gameState.running = false;
  alert("모든 웨이브를 막아냈습니다! 승리!");
}

function gameLoop(timestamp) {
  const dt = timestamp - gameState.lastFrame;
  gameState.lastFrame = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPath();
  drawSlots();
  drawProjectiles();
  drawEnemies(dt);

  if (gameState.running) {
    moveEnemies(dt);
    handleLeaks();
    fireTowers();
    cleanEntities();
    updateWaves();
  }

  requestAnimationFrame(gameLoop);
}

function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);

  const slot = gameState.slots.find((s) => Math.hypot(s.x - x, s.y - y) <= 28);
  if (!slot) return;

  if (slot.tower) {
    upgradeTower(slot);
  } else if (gameState.selectedType) {
    placeTower(slot, gameState.selectedType);
  }
}

function initControls() {
  document.querySelectorAll(".tower-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectTowerType(btn.dataset.type));
  });

  startBtn.addEventListener("click", () => {
    resetGame();
    ensureAudio();
  });

  musicBtn.addEventListener("click", toggleMusic);
  sfxBtn.addEventListener("click", toggleSfx);
  canvas.addEventListener("click", handleCanvasClick);
}

function ensureAudio() {
  if (!AUDIO.context) {
    AUDIO.context = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (AUDIO.musicOn && !AUDIO.bgm) {
    startMusic();
  }
}

function startMusic() {
  if (!AUDIO.context) return;
  const ctxAudio = AUDIO.context;
  const gain = ctxAudio.createGain();
  gain.gain.value = 0.05;
  gain.connect(ctxAudio.destination);

  const notes = [220, 262, 330, 262, 196, 220, 262, 196];
  let step = 0;
  function schedule() {
    if (!AUDIO.musicOn) return;
    const osc = ctxAudio.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(notes[step % notes.length], ctxAudio.currentTime);
    osc.connect(gain);
    osc.start();
    osc.stop(ctxAudio.currentTime + 0.35);
    step += 1;
    AUDIO.bgm = setTimeout(schedule, 400);
  }
  schedule();
}

function toggleMusic() {
  AUDIO.musicOn = !AUDIO.musicOn;
  musicBtn.textContent = AUDIO.musicOn ? "🎵 BGM 끄기" : "🎵 BGM 켜기";
  if (AUDIO.musicOn) {
    ensureAudio();
    startMusic();
  } else if (AUDIO.bgm) {
    clearTimeout(AUDIO.bgm);
    AUDIO.bgm = null;
  }
}

function toggleSfx() {
  AUDIO.sfxOn = !AUDIO.sfxOn;
  sfxBtn.textContent = AUDIO.sfxOn ? "🔊 효과음 끄기" : "🔊 효과음 켜기";
  ensureAudio();
}

function playSfx(type) {
  if (!AUDIO.sfxOn || !AUDIO.context) return;
  const ctxAudio = AUDIO.context;
  const osc = ctxAudio.createOscillator();
  const gain = ctxAudio.createGain();
  osc.type = type === "attack" ? "sawtooth" : "square";
  osc.frequency.value = type === "reward" ? 660 : type === "spawn" ? 220 : 440;
  gain.gain.setValueAtTime(0.12, ctxAudio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctxAudio.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(ctxAudio.destination);
  osc.start();
  osc.stop(ctxAudio.currentTime + 0.25);
}

function init() {
  buildSlots();
  initControls();
  updateHUD();
  requestAnimationFrame(gameLoop);
}

init();
