window.quadrantBlink = {
  // settings (overridden by saved)
  intervalsCount: 30,   // number of highlights per session
  blinkIntervalMs: 400,   // 100-1500 step 25

  // runtime state
  currentIndex: 0,
  activeQuadrant: null,
  lastQuadrant: null,
  intervalId: null,
  intervalStart: 0,
  roundReady: false,

  times: [],    // per interval RT | ms or null
  labels: [],   // 'correct' | 'wrong' | 'missed'
  wrongClicks: 0,
  missedIntervals: 0,

  endCallback: null,
  gameActive: false,
  timeoutIds: [],

  init(endCallback) {
    const saved = JSON.parse(localStorage.getItem('quadrantBlink_settings') || '{}');
    this.intervalsCount  = Number.isFinite(saved.intervalsCount) ? saved.intervalsCount : this.intervalsCount;
    this.blinkIntervalMs = Number.isFinite(saved.blinkIntervalMs) ? saved.blinkIntervalMs : this.blinkIntervalMs;

    this.endCallback = endCallback;
    this.resetState();

    this.renderSettingsPanel();
    this.showInstruction();
  },

  resetState() {
    this.currentIndex = 0;
    this.activeQuadrant = null;
    this.lastQuadrant = null;
    this.intervalId = null;
    this.intervalStart = 0;
    this.roundReady = false;

    this.times = [];
    this.labels = [];
    this.wrongClicks = 0;
    this.missedIntervals = 0;

    this.gameActive = false;
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds = [];
  },

  renderSettingsPanel() {
    const panel = document.getElementById('level-specific-settings');
    panel.innerHTML = `
      <label>Intervals (count):
        <input type="number" id="qb-count" min="10" max="200" value="${this.intervalsCount}">
      </label><br><br>
      <label>Blink speed (ms, 100-1500, step 25):
        <input type="number" id="qb-speed" min="100" max="1500" step="25" value="${this.blinkIntervalMs}">
      </label><br><br>
      <button style="border:1px solid #0A0A23;" onclick="window.quadrantBlink.saveSettings()">Save Settings</button>
      <button style="margin-left:6px; border:1px solid #0A0A23;" onclick="window.quadrantBlink.showHistory()">View History</button>
    `;
  },

  saveSettings() {
    const count = parseInt(document.getElementById('qb-count').value);
    const speed = parseInt(document.getElementById('qb-speed').value);

    this.intervalsCount  = Math.min(200, Math.max(10, count || 30));
    this.blinkIntervalMs = Math.min(1500, Math.max(100, speed || 400));

    localStorage.setItem('quadrantBlink_settings', JSON.stringify({
      intervalsCount: this.intervalsCount,
      blinkIntervalMs: this.blinkIntervalMs
    }));
    this.showPopupMessage("Settings saved.");
    this.showInstruction();
  },

  showInstruction() {
    const container = document.getElementById('game-container');
    container.classList.remove('hidden');
    container.innerHTML = `
      <div style="text-align:center; max-width:600px; margin:auto;">
        <h2>Quadrant Blink</h2>
        <p>
          Keep your eyes on the <strong>center dot</strong>.<br>
          One quadrant will <strong>light up</strong> every <strong>${this.blinkIntervalMs} ms</strong>.<br>
          Click the highlighted quadrant <em>during that interval</em>.<br>
          Tracks reaction time from highlight to correct click, misses, and wrong clicks.
        </p>
        <div style="display:flex; gap:10px; justify-content:center;">
          <button onclick="window.quadrantBlink.startGame()">Start</button>
          <button onclick="window.quadrantBlink.returnToMenu()">Back to Menu</button>
        </div>
      </div>
    `;
  },

  startGame() {
    this.resetState();
    this.gameActive = true;

    const container = document.getElementById('game-container');
    container.innerHTML = `
      <button id="back-btn" style="position:absolute; top:10px; left:10px;">← Back</button>
      <div style="text-align:center; margin-top:40px;">
        <h3>Interval <span id="qb-idx">1</span> / ${this.intervalsCount}</h3>
        <div id="qb-area" style="
          position:relative; width:60vw; aspect-ratio:16/9;
          background:#6c757d; border-radius:8px; overflow:hidden; margin:auto;
        "></div>
        <div style="margin-top:10px; opacity:0.8; font-size:0.9em;">
          Click the quadrant that is highlighted. Keep fixation at the center.
        </div>
      </div>
    `;
    document.getElementById('back-btn').onclick = () => this.returnToMenu();

    const area = document.getElementById('qb-area');
    this.setupArena(area);

    // countdown then begin
    window.show321(area, 500).then(() => this.beginCadence(area));
  },

  setupArena(area) {
    // Crosshair quadrants
    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute; left:0; top:50%; width:100%; height:2px; background:rgba(255,255,255,0.35); transform:translateY(-1px);`;
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute; top:0; left:50%; height:100%; width:2px; background:rgba(255,255,255,0.35); transform:translateX(-1px);`;
    area.appendChild(hLine); area.appendChild(vLine);

    // Center dot
    const centerDot = document.createElement('div');
    centerDot.style.cssText = `
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:8px; height:8px; border-radius:50%; background:#e0e1dd; box-shadow:0 0 4px rgba(0,0,0,0.4);
    `;
    area.appendChild(centerDot);

    // Quadrant click surface
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
      // quadrant label
      const label = document.createElement('div');
      label.textContent = q.key;
      label.style.cssText = `
        position:absolute; ${q.top===0?'top:6px;':'bottom:6px;'}${q.left===0?'left:8px;':'right:8px;'}
        font-size:.8em; color:rgba(255,255,255,0.55); pointer-events:none;
      `;
      Q.appendChild(label);

      Q.addEventListener('mousedown', (e) => {
        if (!this.gameActive || !this.roundReady) return;
        const clicked = e.currentTarget.dataset.quadrant;
        this.handleClick(clicked);
      });

      area.appendChild(Q);
    });

    // Highlight overlays for each quadrant
    ['UL','UR','LL','LR'].forEach(k => {
      const overlay = document.createElement('div');
      overlay.id = `qb-ov-${k}`;
      overlay.style.cssText = `
        position:absolute; pointer-events:none; opacity:0;
        background:#2ec4b6;
        transition: opacity ${Math.min(120, this.blinkIntervalMs*0.3)}ms ease;
      `;
      const halfW = area.clientWidth / 2;
      const halfH = area.clientHeight / 2;
      // position
      switch (k) {
        case 'UL': overlay.style.left='0%'; overlay.style.top='0%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
        case 'UR': overlay.style.left='50%'; overlay.style.top='0%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
        case 'LL': overlay.style.left='0%'; overlay.style.top='50%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
        case 'LR': overlay.style.left='50%'; overlay.style.top='50%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
      }
      area.appendChild(overlay);
    });
  },

  beginCadence(area) {
    if (!this.gameActive) return;
    this.roundReady = false;
    this.tick(area); // show first highlight immediately

    this.intervalId = setInterval(() => {
      this.advanceInterval(area);
    }, this.blinkIntervalMs);
  },

  tick(area) {
    // choose a new quadrant different from last
    const opts = ['UL','UR','LL','LR'].filter(q => q !== this.lastQuadrant);
    this.activeQuadrant = opts[Math.floor(Math.random() * opts.length)];
    this.lastQuadrant = this.activeQuadrant;

    // clear previous highlights
    ['UL','UR','LL','LR'].forEach(k => {
      const el = document.getElementById(`qb-ov-${k}`);
      if (el) el.style.opacity = (k === this.activeQuadrant) ? '0.35' : '0';
    });

    // start timing and accept clicks and sync the timing with paint
    requestAnimationFrame(() => {
      this.intervalStart = performance.now();
      this.roundReady = true;
    });
    
    // ensure a slot exists for this interval in arrays
    this.times[this.currentIndex] = null;
    this.labels[this.currentIndex] = 'missed'; // default - overwritten on correct click
    document.getElementById('qb-idx').textContent = (this.currentIndex + 1);
  },

  advanceInterval(area) {
    // closing the current interval, if no correct click happened, it stays as 'miss'
    if (!this.gameActive) return;

    this.currentIndex++;
    if (this.currentIndex >= this.intervalsCount) {
      // remove highlight and stop cadence
      ['UL','UR','LL','LR'].forEach(k => {
        const el = document.getElementById(`qb-ov-${k}`);
        if (el) el.style.opacity = '0';
      });
      clearInterval(this.intervalId);
      this.intervalId = null;

      // compute missed count
      this.missedIntervals = this.labels.filter(x => x === 'missed').length;
      this.finish();
      return;
    }

    // next interval
    this.roundReady = false;
    this.tick(area);
  },

  handleClick(clicked) {
    if (!this.gameActive || !this.roundReady) return;

    const correct = (clicked === this.activeQuadrant);
    if (correct) {
      const rt = Math.round(performance.now() - this.intervalStart);
      this.times[this.currentIndex] = rt;
      this.labels[this.currentIndex] = 'correct';
    } else {
      this.wrongClicks++;
      // stays 'missed' for this interval (no correct click)
      this.labels[this.currentIndex] = 'wrong';
    }

    // Accept only the first click per interval
    this.roundReady = false;
  },

  // evaluation for next speed progression
  evaluateProgress(results) {
    const correctCount = results.labels.filter(l => l === 'correct').length;
    const accuracy = correctCount / results.intervalsCount;
    const neededCorrect = Math.floor(results.intervalsCount * 0.75);

    const nextSpeed = Math.max(100, results.blinkIntervalMs - 25);

    let consistency = 0;

    if (correctCount >= neededCorrect) {
      const fastEnoughCount = results.times.filter(
        (t, i) => results.labels[i] === 'correct' && t !== null && t <= nextSpeed
      ).length;
      const consistency = correctCount ? (fastEnoughCount / correctCount) : 0;
    }
      
    const qualifies = (
      correctCount >= neededCorrect &&
      avgFastEnough &&
      consistency >= 0.5
    );

    return {
      accuracy: Math.round(accuracy * 100),
      neededCorrect,
      correctCount,
      nextSpeed,
      consistency: Math.round(consistency * 100),
      qualifies
    };
  },
  
  finish() {
    this.gameActive = false;

    const correctTimes = this.times.filter(t => Number.isFinite(t));
    const avg = correctTimes.length ? Math.round(correctTimes.reduce((a,b)=>a+b,0)/correctTimes.length) : null;

    const results = {
      intervalsCount: this.intervalsCount,
      blinkIntervalMs: this.blinkIntervalMs,
      times: this.times,    // per interval ms or null
      labels: this.labels,    // 'correct' | 'wrong' | 'missed'
      average: avg,
      wrongClicks: this.wrongClicks,
      missedIntervals: this.missedIntervals,
      _customOverlay: true
    };

    const progress = this.evaluateProgress(results);
    
    this.showResultsOverlay(results, progress);
    this.endCallback(results);

    // history
    const history = JSON.parse(localStorage.getItem('quadrantBlink_history') || '[]');
    history.push({
      date: new Date().toLocaleString(),
      intervalsCount: this.intervalsCount,
      blinkIntervalMs: this.blinkIntervalMs,
      average: avg,
      wrongClicks: this.wrongClicks,
      missedIntervals: this.missedIntervals,
      times: this.times,
      progress: progress
    });
    localStorage.setItem('quadrantBlink_history', JSON.stringify(history));
  },

  showResultsOverlay(results, progress) {
    const container = document.getElementById('game-container');

    const rows = results.times.map((t,i) => {
      const L = results.labels[i];
      const tdisp = Number.isFinite(t) ? `${t} ms` : '<strong>- - -</strong>';
      const color = (L==='correct') ? '#2ec4b6' : (L==='wrong' ? '#ffb300' : '#f44336');
      return `
        <tr>
          <td>${i+1}</td>
          <td style="color:${color};">${tdisp}</td>
          <td>${L}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="max-width:95%; margin:auto; color:#e0e1dd;">
        <h2 style="text-align:center;">Quadrant Blink Results</h2>
        <div style="margin:8px 0; text-align:center;">
          <span>Avg Reaction Time (correct only): <strong>${results.average ?? '-'}</strong>${results.average ? ' ms' : ''}</span><br>
          <span>Missed intervals: <strong>${results.missedIntervals}</strong></span> ·
          <span>Wrong clicks: <strong>${results.wrongClicks}</strong></span><br>
          <span>Speed: <strong>${results.blinkIntervalMs} ms</strong> · Intervals: <strong>${results.intervalsCount}</strong></span>
        </div>

        <div style="margin:8px 0; text-align:center; padding-top:6px; font-size:0.9em;">
          <div>Accuracy: <strong>${progress.accuracy}% </strong> ${progress.correctCount >= progress.neededCorrect ? '✓' : '✗'}
            (${progress.correctCount} / ${results.intervalsCount}, need ${progress.neededCorrect} for <strong>75%</strong>)</div>
          <div>Consistency: <strong>${progress.consistency}%</strong> ${progress.consistency >= 50 ? '✓' : '✗'}
            (need ≥ 50% correct at next speed)</div>
          <div>Next level readiness: 
            <strong style="color:${progress.qualifies ? '#2ec4b6' : '#f44336'};">
              ${progress.qualifies ? 'YES' : 'NO'}
            </strong>
          </div>
        </div>

        <div style="font-size:0.9em; color:#ccc; text-align:left; max-width:600px; margin:auto;">
          <strong>Legend:</strong><br><br>
          • <span style="color:#2ec4b6;">Correct</span> - Clicked the lit quadrant during its highlight.<br>
          • <span style="color:#ffb300;">Wrong</span> - Clicked a different quadrant while one was lit.<br>
          • <span style="color:#f44336;">Missed</span> - No clicks before the highlight ended.<br><br>
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
          <button onclick="window.quadrantBlink.startGame()">Restart</button>
          <button onclick="returnToMenu()">Back to Menu</button>
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
  
  showHistory() {
    const history = JSON.parse(localStorage.getItem('quadrantBlink_history') || '[]');
    const container = document.getElementById('game-container');
    container.classList.remove('hidden');

    if (!history.length) {
      container.innerHTML = `
        <div style="text-align:center; margin-top:20px;">
          <h3>No history found</h3>
          <button onclick="window.quadrantBlink.returnToMenu()">Back</button>
        </div>
      `;
      return;
    }

    const rows = history.map((h,i) => {
      const prog = h.progress || {};
      return `
        <tr>
          <td>${i+1}</td>
          <td>${h.date}</td>
          <td>${h.intervalsCount} @ ${h.blinkIntervalMs}ms</td>
          <td>${h.average ?? '-'}</td>
          <td>${h.missedIntervals}</td>
          <td>${h.wrongClicks}</td>
          <td>${prog.accuracy !== undefined ? prog.accuracy + '%' : '-'}</td>
          <td>${prog.qualifies !== undefined ? (prog.qualifies ? 'YES' : 'NO') : '-'}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="max-width:95%; margin:auto; color:#e0e1dd;">
        <h2 style="text-align:center;">Quadrant Blink History</h2>
        <div style="max-height:70vh; overflow-y:auto;">
          <table class="results-table">
            <tr>
              <th>#</th><th>Date</th><th>Config</th><th>Average</th><th>Missed</th><th>Wrong</th><th>Accuracy %</th><th>Ready Next?</th>
            </tr>
            ${rows}
          </table>
        </div>
        <div style="text-align:center; margin-top:10px;">
          <button onclick="window.quadrantBlink.returnToMenu()">Back</button>
        </div>
      </div>
    `;
  },

  returnToMenu() {
    this.gameActive = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds = [];

    const container = document.getElementById('game-container');
    container.innerHTML = '';
    container.classList.add('hidden');
    returnToMenu();
  }

};



