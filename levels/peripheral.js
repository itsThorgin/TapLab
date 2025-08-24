window.peripheral = {
  // configurable defaults (overridden by saved settings)
  rounds: 10,
  trueTargetSize: 6,           // 3 | 6 | 9 px
  distractorCount: 12,
  distractorMin: 15,
  distractorMax: 25,

  // runtime state
  currentRound: 0,
  times: [],                   // ms (null if mistake)
  mistakes: [],                // boolean per round
  targetQuadrant: null,
  spawnTime: 0,
  endCallback: null,
  gameActive: false,
  timeoutIds: [],
  inCountdown: false,
  roundReady: false,     // stops clicks until target is active
  uniformColor: false,   // all dots same color + true target blinks 3x for peripheral round

  init(endCallback) {
    const saved = JSON.parse(localStorage.getItem('peripheral_settings') || '{}');
    this.rounds = Number.isFinite(saved.rounds) ? saved.rounds : this.rounds;
    this.trueTargetSize = [3,6,9].includes(saved.trueTargetSize) ? saved.trueTargetSize : this.trueTargetSize;
    this.distractorCount= Number.isFinite(saved.distractorCount) ? saved.distractorCount : this.distractorCount;

    this.endCallback = endCallback;
    this.currentRound = 0;
    this.times = [];
    this.mistakes = [];
    this.timeoutIds = [];
    this.gameActive = false;

    this.renderSettingsPanel();
    this.showInstruction();

    this.uniformColor = !!saved.uniformColor;
  },

  renderSettingsPanel() {
    const panel = document.getElementById('level-specific-settings');
    panel.innerHTML = `
      <label>Rounds:
        <input type="number" id="periph-rounds" min="3" max="10" value="${this.rounds}">
      </label><br><br>
      <label>True target size:
        <select id="periph-size">
          <option value="3" ${this.trueTargetSize===3?'selected':''}>3 px</option>
          <option value="6" ${this.trueTargetSize===6?'selected':''}>6 px</option>
          <option value="9" ${this.trueTargetSize===9?'selected':''}>9 px</option>
        </select>
      </label><br><br>
      <label>Distractors (15-25 px):
        <input type="number" id="periph-distractors" min="6" max="30" value="${this.distractorCount}">
      </label><br><br>
      <label>
        <input type="checkbox" id="periph-uniform" ${this.uniformColor ? 'checked' : ''}>
        Same color mode (true target blinks)
      </label><br><br>
      <button style="border:1px solid #0A0A23;" onclick="window.peripheral.saveSettings()">Save Settings</button>
      <button style="margin-left:6px;border:1px solid #0A0A23;" onclick="window.peripheral.showHistory()">View History</button>
    `;
  },

  saveSettings() {
    const rounds = parseInt(document.getElementById('periph-rounds').value);
    const trueTargetSize = parseInt(document.getElementById('periph-size').value);
    const distractorCount = parseInt(document.getElementById('periph-distractors').value);
    const uniformColor = document.getElementById('periph-uniform').checked;

    this.rounds = Math.min(10, Math.max(3, rounds || 10));
    this.trueTargetSize = [3,6,9].includes(trueTargetSize) ? trueTargetSize : 6;
    this.distractorCount = Math.min(30, Math.max(6, distractorCount || 12));
    this.uniformColor = uniformColor;

    localStorage.setItem('peripheral_settings', JSON.stringify({
      rounds: this.rounds,
      trueTargetSize: this.trueTargetSize,
      distractorCount: this.distractorCount,
      uniformColor: this.uniformColor
    }));
    this.showPopupMessage("Settings saved.");
    this.showInstruction();
  },

  showInstruction() {
    const container = document.getElementById('game-container');
    container.classList.remove('hidden');
    container.innerHTML = `
      <div style="text-align:center;max-width:600px;margin:auto;">
        <h2>Peripheral Awareness</h2>
        <p>
          Keep your eyes on the <strong>center point</strong>. A tiny target will appear in one quadrant.<br>
          <em>Do not chase it with your eyes</em><br>
          Click the <strong>quadrant</strong> (UL / UR / LL / LR) where it appeared.<br>
          Tracks reaction time from spawn to click and your mistakes.<br>
          ${this.rounds} rounds total.
        </p>
        <div style="display:flex; gap:10px; justify-content:center;">
          <button onclick="window.peripheral.startGame()">Start</button>
          <button onclick="window.peripheral.returnToMenu()">Back to Menu</button>
        </div>
      </div>
    `;
  },

  startGame() {
    this.currentRound = 0;
    this.times = [];
    this.mistakes = [];
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds = [];
    this.gameActive = true;
    
    // Build the arena UI
    const container = document.getElementById('game-container');
    container.innerHTML = `
      <button id="back-btn" style="position:absolute; top:10px; left:10px;">← Back</button>
      <div style="text-align:center; margin-top:40px;">
        <h3>Round ${this.currentRound + 1} of ${this.rounds}</h3>
        <div id="peripheral-area" style="
          position:relative; width:60vw; aspect-ratio:16/9;
          background:#6c757d; border-radius:8px; overflow:hidden; margin:auto;
        "></div>
        <div style="margin-top:10px; opacity:0.8; font-size:0.9em;">
          Click the quadrant where the tiny target appears. Keep your eyes on the center.
        </div>
      </div>
    `;
    document.getElementById('back-btn').onclick = () => this.returnToMenu();

    const area = document.getElementById('peripheral-area');

    // Crosshair quadrants
    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute; left:0; top:50%; width:100%; height:2px; background:rgba(255,255,255,0.35); transform:translateY(-1px);`;
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute; top:0; left:50%; height:100%; width:2px; background:rgba(255,255,255,0.35); transform:translateX(-1px);`;
    area.appendChild(hLine); area.appendChild(vLine);

    // Center fixation dot
    const centerDot = document.createElement('div');
    centerDot.style.cssText = `
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:8px; height:8px; border-radius:50%; background:#e0e1dd; box-shadow:0 0 4px rgba(0,0,0,0.4);
    `;
    area.appendChild(centerDot);

    // Quadrant overlays (to click targets)
    const quads = [
      { key: 'UL', left: 0,   top: 0 },
      { key: 'UR', left: 50,  top: 0 },
      { key: 'LL', left: 0,   top: 50 },
      { key: 'LR', left: 50,  top: 50 },
    ];
    quads.forEach(q => {
      const Q = document.createElement('div');
      Q.dataset.quadrant = q.key;
      Q.style.cssText = `
        position:absolute; left:${q.left}%; top:${q.top}%;
        width:50%; height:50%;
      `;
      const label = document.createElement('div');
      label.textContent = q.key;
      label.style.cssText = `
        position:absolute; ${q.top===0?'top:6px;':'bottom:6px;'}${q.left===0?'left:8px;':'right:8px;'}
        font-size:.8em; color:rgba(255,255,255,0.55); pointer-events:none;
      `;
      Q.appendChild(label);

      Q.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (!this.gameActive || this.inCountdown) return;
        const clicked = e.currentTarget.dataset.quadrant;
        this.handleQuadrantClick(clicked);
      });

      area.appendChild(Q);
    });

    // Distractors
    this.placeDistractors(area);

    // countdown, then first spawn
    this.inCountdown = true;
    window.show321(area, 500).then(() => {
      this.inCountdown = false;
      setTimeout(() => this.spawnTrueTarget(area), 400);
    });
  },

  startRound() {
    if (!this.gameActive) return;
    this.roundReady = false;

    const container = document.getElementById('game-container');
    container.innerHTML = `
      <button id="back-btn" style="position:absolute; top:10px; left:10px;">← Back</button>
      <div style="text-align:center; margin-top:40px;">
        <h3>Round ${this.currentRound + 1} of ${this.rounds}</h3>
        <div id="peripheral-area" style="
          position:relative; width:60vw; aspect-ratio:16/9;
          background:#6c757d; border-radius:8px; overflow:hidden; margin:auto;
        "></div>
        <div style="margin-top:10px; opacity:0.8; font-size:0.9em;">
          Click the quadrant where the tiny target appears. Keep your eyes on the center.
        </div>
      </div>
    `;
    document.getElementById('back-btn').onclick = () => this.returnToMenu();

    const area = document.getElementById('peripheral-area');

    // Crosshair quadrants
    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute; left:0; top:50%; width:100%; height:2px; background:rgba(255,255,255,0.35); transform:translateY(-1px);`;
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute; top:0;left:50%; height:100%; width:2px; background:rgba(255,255,255,0.35); transform:translateX(-1px);`;
    area.appendChild(hLine); area.appendChild(vLine);

    // Center fixation dot
    const centerDot = document.createElement('div');
    centerDot.style.cssText = `
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:8px; height:8px; border-radius:50%; background:#e0e1dd; box-shadow:0 0 4px rgba(0,0,0,0.4);
    `;
    area.appendChild(centerDot);

    // Quadrant overlays (toclick targets)
    const quads = [
      { key: 'UL', left: 0,   top: 0 },
      { key: 'UR', left: 50,  top: 0 },
      { key: 'LL', left: 0,   top: 50 },
      { key: 'LR', left: 50,  top: 50 },
    ];
    quads.forEach(q => {
      const Q = document.createElement('div');
      Q.dataset.quadrant = q.key;
      Q.style.cssText = `
        position:absolute; left:${q.left}%;top:${q.top}%;
        width:50%; height:50%;
      `;
      const label = document.createElement('div');
      label.textContent = q.key;
      label.style.cssText = `
        position:absolute; ${q.top===0?'top:6px;':'bottom:6px;'}${q.left===0?'left:8px;':'right:8px;'}
        font-size:.8em; color:rgba(255,255,255,0.55); pointer-events:none;
      `;
      Q.appendChild(label);

      Q.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (!this.gameActive || this.inCountdown) return;
        const clicked = e.currentTarget.dataset.quadrant;
        this.handleQuadrantClick(clicked);
      });

      area.appendChild(Q);
    });

    // Distractors
    this.placeDistractors(area);

    // little countdown before spawning
    setTimeout(() => this.spawnTrueTarget(area), 400);
  },

  spawnTrueTarget(area) {
    if (!this.gameActive) return;

    const w = area.clientWidth;
    const h = area.clientHeight;

    // Pick quadrant
    const quadrants = ['UL','UR','LL','LR'];
    this.targetQuadrant = quadrants[Math.floor(Math.random() * 4)];

    // Compute bounds for target within chosen quadrant (+ padding)
    const pad = Math.max(12, this.trueTargetSize + 8);
    const halfW = w / 2, halfH = h / 2;

    let minX, maxX, minY, maxY;
    switch (this.targetQuadrant) {
      case 'UL': minX = pad; maxX = halfW - pad; minY = pad; maxY = halfH - pad; break;
      case 'UR': minX = halfW + pad; maxX = w - pad; minY = pad; maxY = halfH - pad; break;
      case 'LL': minX = pad; maxX = halfW - pad; minY = halfH + pad;   maxY = h - pad; break;
      default: minX = halfW + pad; maxX = w - pad; minY = halfH + pad; maxY = h - pad; break;
    }

    // pick a spot that doesn't overlap any distractor
    let x, y, tries = 0;
    const tr = this.trueTargetSize / 2;
    const blockers = this._distractors || [];
    do {
      x = minX + Math.random() * Math.max(1, (maxX - minX));
      y = minY + Math.random() * Math.max(1, (maxY - minY));
      tries++;
      // must not overlap any distractor (with 4px buffer)
      var ok = true;
      for (const d of blockers) {
        const dx = x - d.x, dy = y - d.y;
        if (Math.hypot(dx, dy) < (tr + d.r + 4)) { ok = false; break; }
      }
    } while (!ok && tries < 80);

    // True target dot
    const trueColor = '#2ec4b6';
    const dot = document.createElement('div');
    dot.style.cssText = `
      position:absolute; left:${x - this.trueTargetSize/2}px; top:${y - this.trueTargetSize/2}px;
      width:${this.trueTargetSize}px; height:${this.trueTargetSize}px; border-radius:50%;
      background:${trueColor}; box-shadow:0 0 4px rgba(0,0,0,0.35);
      pointer-events:none; opacity:1;
    `;
    area.appendChild(dot);

    // IMPORTANT: clicks are not valid yet
    this.roundReady = false;

    if (this.uniformColor) {
      // start timing and accept clicks immediately
      requestAnimationFrame(() => {
        this.spawnTime = performance.now();
        this.roundReady = true;   // allows clicks during blinking
      });

      // Blink the target 3x, then make the round active
      const blinks = 3, interval = 140;
      let toggles = 0;
      const blinkTimer = setInterval(() => {
        dot.style.opacity = (dot.style.opacity === '0') ? '1' : '0';
        toggles++;
        if (toggles >= blinks * 2) {
          clearInterval(blinkTimer);
          dot.style.opacity = '1';
        }
      }, interval);
    } else {
      // Normal mode: ready immediately after paint
      requestAnimationFrame(() => {
        this.spawnTime = performance.now();
        this.roundReady = true;
      });
    }
  },

  handleQuadrantClick(clickedQuadrant) {
    if (!this.gameActive) return;
    if (!this.roundReady) return; // ignore early clicking

    this.roundReady = false; // blocks other clicks until next round

    const rt = Math.round(performance.now() - this.spawnTime);
    const correct = clickedQuadrant === this.targetQuadrant;

    if (correct) {
      this.times.push(rt);
      this.mistakes.push(false);
    } else {
      this.times.push(null);      // no reaction time for mistake
      this.mistakes.push(true);
      this.showTemporaryMessage('Wrong segment!', '#ff4d4d');
    }

    this.currentRound++;
    if (this.currentRound >= this.rounds) {
      this.finish();
    } else {
      // brief pause to reduce accidental double click
      this.timeoutIds.push(setTimeout(() => this.startRound(), 400));
    }
  },

  placeDistractors(area) {
    const w = area.clientWidth;
    const h = area.clientHeight;
    const dots = [];

    const maxAttempts = 400;
    const triesPerDot = 40;

    for (let i = 0; i < this.distractorCount; i++) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < triesPerDot) {
        attempts++;
        const size = this.distractorMin + Math.random() * (this.distractorMax - this.distractorMin);
        const r = size / 2;

        const pad = 6;
        const x = pad + r + Math.random() * (w - 2*(pad + r));
        const y = pad + r + Math.random() * (h - 2*(pad + r));

        // avoid center 30px radius
        const dxC = x - w/2, dyC = y - h/2;
        if ((dxC*dxC + dyC*dyC) < (30*30)) continue;

        // avoid crossing the 2px lines a bit
        if (Math.abs(x - w/2) < (r + 6) || Math.abs(y - h/2) < (r + 6)) continue;

        // no overlap with previous
        let ok = true;
        for (const d of dots) {
          const dx = x - d.x, dy = y - d.y;
          if (Math.hypot(dx, dy) < (r + d.r + 6)) { ok = false; break; }
        }
        if (!ok) continue;

        // place
        const dot = document.createElement('div');
        dot.style.cssText = `
          position:absolute; left:${x - r}px;top:${y - r}px;
          width:${size}px; height:${size}px;border-radius:50%;
          background:${this.uniformColor ? '#2ec4b6' : '#f4a261'}; opacity:.9; pointer-events:none;
        `;
        area.appendChild(dot);
        dots.push({ x, y, r });
        placed = true;
      }

      if (!placed && i < maxAttempts) continue; // just skip if overcrowded
    }
    this._distractors = dots;
  },

  finish() {
    this.gameActive = false;
    const validTimes = this.times.filter(t => Number.isFinite(t));
    const avg = validTimes.length ? Math.round(validTimes.reduce((a,b)=>a+b,0)/validTimes.length) : null;
    const mistakesTotal = this.mistakes.filter(Boolean).length;

    const results = {
      times: this.times,    // per round ms or null
      mistakes: this.mistakes,    // per round bool
      average: avg,   // null if no correct rounds
      mistakesTotal,
      rounds: this.rounds,
      _customOverlay: true
    };

    this.showResultsOverlay(results);
    this.endCallback(results);

    // history
    const history = JSON.parse(localStorage.getItem('peripheral_history') || '[]');
    history.push({
      date: new Date().toLocaleString(),
      rounds: this.rounds,
      trueTargetSize: this.trueTargetSize,
      distractorCount: this.distractorCount,
      average: avg,
      mistakesTotal,
      times: this.times
    });
    localStorage.setItem('peripheral_history', JSON.stringify(history));
  },

  showResultsOverlay(results) {
    const container = document.getElementById('game-container');

    // builds labels from mistakes and times
    const labels = results.times.map((t, i) => {
      if (results.mistakes[i]) return 'wrong';
      if (!Number.isFinite(t)) return 'missed';
      return 'correct';
    });
  
    const rows = results.times.map((t, i) => {
      const L = labels[i];
      const tdisp = Number.isFinite(t) ? `${t} ms` : '<strong>- - -</strong>';
      const color =
        L === 'correct' ? '#2ec4b6' :
        L === 'wrong'   ? '#ffb300' :
                          '#f44336';
      return `
        <tr>
          <td>${i + 1}</td>
          <td style="color:${color};">${tdisp}</td>
          <td>${L}</td>
        </tr>
      `;
    }).join('');
  
    container.innerHTML = `
      <div style="max-width:95%; margin:auto; color:#e0e1dd;">
        <h2 style="text-align:center;">Peripheral Awareness Results</h2>
        <div style="margin:8px 0; text-align:center;">
          <span>Avg Reaction Time (correct only): <strong>${results.average ?? '-'}</strong>${results.average ? ' ms' : ''}</span><br>
          <span>Mistakes: <strong>${results.mistakesTotal}</strong></span>
        </div>

        <div style="max-height:300px; overflow-y:auto;">
          <table class="results-table">
            <tr>
              <th>#</th><th>Reaction Time</th><th>Label</th>
            </tr>
            ${rows}
          </table>
        </div>

        <div style="text-align:center; margin-top:14px;">
          <button onclick="window.peripheral.startGame()">Restart</button>
          <button onclick="returnToMenu()">Back to Menu</button>
        </div>
      </div>
    `;
  },

  showHistory() {
    const history = JSON.parse(localStorage.getItem('peripheral_history') || '[]');
    const container = document.getElementById('game-container');
    container.classList.remove('hidden');

    if (!history.length) {
      container.innerHTML = `
        <div style="text-align:center; margin-top:20px;">
          <h3>No history found</h3>
          <button onclick="window.peripheral.returnToMenu()">Back</button>
        </div>
      `;
      return;
    }

    const rows = history.map((h,i) => `
      <tr>
        <td>${i+1}</td>
        <td>${h.date}</td>
        <td>${h.rounds}r / ${h.trueTargetSize}px / ${h.distractorCount} distractors</td>
        <td>${h.average ?? '-'}</td>
        <td>${h.mistakesTotal}</td>
        <td>${(h.times||[]).map(t => Number.isFinite(t)? t : '-').join(', ')}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="max-width:95%; margin:auto; color:#e0e1dd;">
        <h2 style="text-align:center;">Peripheral Awareness History</h2>
        <div style="max-height:70vh; overflow-y:auto;">
          <table class="results-table">
            <tr>
              <th>#</th><th>Date</th><th>Config</th><th>Average</th><th>Mistakes</th><th>Times</th>
            </tr>
            ${rows}
          </table>
        </div>
        <div style="text-align:center; margin-top:10px;">
          <button onclick="window.peripheral.returnToMenu()">Back</button>
        </div>
      </div>
    `;
  },

  showPopupMessage: function(text) {
        const panel = document.getElementById('settings-panel');
        const msg = document.createElement('div');
        msg.textContent = text;
        msg.style.cssText = `
            background:#2ec4b6; color:#002; padding:6px 10px;
            border-radius:6px; margin-top:8px; font-size:0.9em;
        `;
        panel.appendChild(msg);
        setTimeout(()=>msg.remove(), 1500);
    },
  
  showTemporaryMessage(text, color = "#ff4d4d") {
    const host = document.getElementById('game-container');
    if (!host) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const msg = document.createElement('div');
    msg.textContent = text;
    msg.style.cssText = `
      position:absolute ;top:50%; left:50%; transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.6); color:${color}; padding:6px 12px; border-radius:6px;
      font-weight:bold; z-index:1000; font-size:1.2em; pointer-events:none;
    `;
    host.appendChild(msg);
    setTimeout(() => { msg.style.transition='opacity .4s'; msg.style.opacity='0'; setTimeout(()=>msg.remove(), 400); }, 1000);
  },

  returnToMenu() {
    this.gameActive = false;
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds = [];
    const container = document.getElementById('game-container');
    container.innerHTML = '';
    container.classList.add('hidden');
    returnToMenu();
  }

};


