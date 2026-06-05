window.quadrantBlink = {
  // settings (overridden by saved)
  intervalsCount: 30,   // number of highlights per session
  blinkIntervalMs: 400,   // 100-1500 step 5
  isOfficial: false,
  OFFICIAL: { intervalsCount: 100, blinkIntervalMs: 250 },
  officialLabel: "Official: 100 intervals @ 250 ms",

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
    this.isOfficial = false;
    this.resetState();

    this.renderSettingsPanel();
    this.showInstruction();
  },

  resetState() {
    // stop quadrant interval
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // clear any queued timeouts
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds = [];

    // runtime state resets
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
  },

  renderSettingsPanel() {
    const panel = document.getElementById('level-specific-settings');
    panel.innerHTML = `
      <label>Intervals (count):
        <input type="number" id="qb-count" min="25" max="200" value="${this.intervalsCount}">
      </label><br><br>
      <label>Blink speed (ms, 100-1500, step 5):
        <input type="number" id="qb-speed" min="100" max="1500" step="5" value="${this.blinkIntervalMs}">
      </label><br><br>
      <button style="border:1px solid #0A0A23;" onclick="window.quadrantBlink.saveSettings()">Save Settings</button>
      <button style="margin-left:6px; border:1px solid #0A0A23;" onclick="window.quadrantBlink.showHistory()">View History</button>
    `;
  },

  saveSettings() {
    const count = parseInt(document.getElementById('qb-count').value);
    const speed = parseInt(document.getElementById('qb-speed').value);

    this.intervalsCount  = Math.min(200, Math.max(25, count || 30));
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
          <button onclick="window.quadrantBlink.isOfficial=false;window.quadrantBlink.startGame()">Start</button>
          <button onclick="window.quadrantBlink.startOfficial()">Start Official</button>
          <button onclick="window.quadrantBlink.returnToMenu()">Back to Menu</button>
        </div>
        <div style="margin-top:8px; font-size:0.82em; opacity:0.75;">${this.officialLabel}</div>
      </div>
    `;
  },

  // load the fixed official preset (bypasses saved settings) and start.
  startOfficial() {
    this.isOfficial = true;
    this.intervalsCount = this.OFFICIAL.intervalsCount;
    this.blinkIntervalMs = this.OFFICIAL.blinkIntervalMs;
    this.startGame();
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
    // crosshair quadrants
    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute; left:0; top:50%; width:100%; height:2px; background:rgba(255,255,255,0.35); transform:translateY(-1px);`;
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute; top:0; left:50%; height:100%; width:2px; background:rgba(255,255,255,0.35); transform:translateX(-1px);`;
    area.appendChild(hLine); area.appendChild(vLine);

    // quadrant click surface
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

    // highlight overlays for each quadrant
    ['UL','UR','LL','LR'].forEach(k => {
      const overlay = document.createElement('div');
      overlay.id = `qb-ov-${k}`;
      overlay.style.cssText = `
        position:absolute; pointer-events:none; opacity:0;
        background:#2ec4b6;
        transition: opacity ${Math.min(120, this.blinkIntervalMs*0.3)}ms ease;
      `;
      
      // position
      switch (k) {
        case 'UL': overlay.style.left='0%'; overlay.style.top='0%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
        case 'UR': overlay.style.left='50%'; overlay.style.top='0%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
        case 'LL': overlay.style.left='0%'; overlay.style.top='50%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
        case 'LR': overlay.style.left='50%'; overlay.style.top='50%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
      }
      area.appendChild(overlay);
    });

    // center dot
    const centerDot = document.createElement('div');
    centerDot.style.cssText = `
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:8px; height:8px; border-radius:50%; background:#e0e1dd; box-shadow:0 0 4px rgba(0,0,0,0.4);
    `;
    area.appendChild(centerDot);
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
      if (!el) return;

      // restore prior transition if it changed during flash
      if (el.dataset._prevTransition !== undefined) {
        el.style.transition = el.dataset._prevTransition;
        delete el.dataset._prevTransition;
      }

      // baseline opacities
      el.style.opacity = (k === this.activeQuadrant) ? '0.35' : '0';
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
    // closing the current interval, if no correct click happened, it stays as miss
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

    // time based gate: the click only counts if it lands within the real
    // interval window, measured on the SAME clock as the reaction time
    // this makes the displayed blink speed the true window, regardless of
    // setInterval jitter (which could otherwise keep a quadrant lit a few
    // ms too long and let an over time click slip through as correct)
    const rt = Math.round(performance.now() - this.intervalStart);
    const withinWindow = rt <= this.blinkIntervalMs;

    const correct = (clicked === this.activeQuadrant) && withinWindow;
    if (correct) {
      this.times[this.currentIndex] = rt;
      this.labels[this.currentIndex] = 'correct';

      this.flashOverlayUntilNextTick(this.activeQuadrant, 0.95);
    } else if (clicked === this.activeQuadrant && !withinWindow) {
      // right quadrant but too late - counts as a miss of this interval
      this.labels[this.currentIndex] = 'missed';
    } else {
      this.wrongClicks++;
      // wrong click on this interval
      this.labels[this.currentIndex] = 'wrong';
    }

    // accept only the first click per interval
    this.roundReady = false;
  },

  // evaluation for next speed progression
  evaluateProgress(results) {
    const correctCount = results.labels.filter(l => l === 'correct').length;
    const accuracy = correctCount / results.intervalsCount;
    const neededCorrect = Math.floor(results.intervalsCount * 0.75);

    // readiness target = the NEXT step's window (5 ms faster)
    // you qualify when at least half of your correct clicks already land within that next step
    // and 75% accuracy
    const nextSpeed = Math.max(100, results.blinkIntervalMs - 5);

    let consistency = 0;

    if (correctCount >= neededCorrect) {
      const fastEnoughCount = results.times.filter(
        (t, i) => results.labels[i] === 'correct' && t !== null && t <= nextSpeed
      ).length;

      consistency = correctCount ? (fastEnoughCount / correctCount) : 0;
    }
    
    const qualifies = (
      correctCount >= neededCorrect &&
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

  flashOverlayUntilNextTick(k, peak = 0.8) {
    const ov = document.getElementById(`qb-ov-${k}`);
    if (!ov) return;

    // quick light up
    const prevTransition = ov.style.transition;
    ov.style.transition = 'opacity 60ms ease';
    ov.style.opacity = String(peak);

    ov.dataset._prevTransition = prevTransition || '';
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
      official: this.isOfficial,
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
      progress: progress,
      official: this.isOfficial
    });
    localStorage.setItem('quadrantBlink_history', JSON.stringify(history));
  },

  // tiers on avg reaction time (correct only)
  // ranks are based on nothing, felt about right
  getCategoryForMs(ms) {
    if (ms === null || ms === undefined) return { label: "No Data", color: "#888", range: "no correct intervals" };
    if (ms <= 200)  return { label: "Phenomenal", color: "#00e5ff", range: "≤ 200 ms - exceptional" };
    if (ms <= 250)  return { label: "Elite",      color: "#4caf50", range: "201-250 ms - very fast" };
    if (ms <= 310)  return { label: "Strong",     color: "#8bc34a", range: "251-310 ms - strong" };
    if (ms <= 380)  return { label: "Good",       color: "#ffeb3b", range: "311-380 ms - above average" };
    if (ms <= 460)  return { label: "Average",    color: "#ff9800", range: "381-460 ms - typical" };
    return { label: "Developing", color: "#f44336", range: "> 460 ms - keep practicing" };
  },

  showResultsOverlay(results, progress) {
    const container = document.getElementById('game-container');
    // only award a real rank if the player actually qualified (met the accuracy + consistency bar)
    const ranked = progress.qualifies;
    const category = ranked
      ? this.getCategoryForMs(results.average)
      : { label: "Unranked", color: "#888", range: "reach the next-level bar to earn a rank" };

    const totalErrors = (results.missedIntervals || 0) + (results.wrongClicks || 0);

    const benchmarks = [
      { label: "Phenomenal", range: "≤ 200 ms", color: "#00e5ff" },
      { label: "Elite",      range: "201-250 ms", color: "#4caf50" },
      { label: "Strong",     range: "251-310 ms", color: "#8bc34a" },
      { label: "Good",       range: "311-380 ms", color: "#ffeb3b" },
      { label: "Average",    range: "381-460 ms", color: "#ff9800" },
      { label: "Developing", range: "> 460 ms", color: "#f44336" }
    ];

    const benchmarkHTML = `
      <div class="badge-stack">
        ${benchmarks.map(b => `
          <div class="tier-badge" style="background:${b.color}">
            <strong>${b.label}</strong>
            <small>${b.range}</small>
          </div>
        `).join("")}
      </div>
    `;

    const rows = results.times.map((t, i) => {
      const L = results.labels[i];
      const tdisp = Number.isFinite(t) ? `${t} ms` : '- - -';
      const color = (L === 'correct') ? '#2ec4b6' : (L === 'wrong' ? '#ffb300' : '#f44336');
      return `<tr><td>${i + 1}</td><td style="color:${color};">${tdisp}</td><td>${L}</td></tr>`;
    }).join('');

    container.innerHTML = `
      <div style="text-align:center;color:#e0e1dd;">
        <h2>Quadrant Blink${results.official ? ' <span style="color:#f4d35e;">★ Official</span>' : ''}</h2>
        <div class="results-layout">
          <div class="column-left">
            ${benchmarkHTML}
          </div>
          <div class="column-separator"></div>
          <div class="column-right">
            <div class="current-result-badge" style="background:${category.color}">
              <strong>${category.label}</strong>
              <small>${category.range}</small>
            </div>
            <table style="margin:0 auto 6px auto;border-collapse:collapse;color:white;">
              <tr><td style="text-align:left;">Avg reaction (correct)</td>
                  <td style="text-align:right;padding-left:20px;">${results.average !== null ? results.average + ' ms' : '-'}</td></tr>
              <tr><td style="text-align:left;">Errors (missed + wrong)</td>
                  <td style="text-align:right;padding-left:20px;">${totalErrors}</td></tr>
              <tr><td style="text-align:left;">Accuracy</td>
                  <td style="text-align:right;padding-left:20px;">${progress.accuracy}%</td></tr>
              <tr><td style="text-align:left;">Speed / intervals</td>
                  <td style="text-align:right;padding-left:20px;">${results.blinkIntervalMs} ms / ${results.intervalsCount}</td></tr>
            </table>
            <div style="font-size:0.85em; opacity:0.9; margin-bottom:6px;">
              Next level: <strong style="color:${progress.qualifies ? '#2ec4b6' : '#f44336'};">${progress.qualifies ? 'YES' : 'NO'}</strong>
              <span style="opacity:0.8;">(need ${progress.neededCorrect}/${results.intervalsCount} correct + consistency)</span>
            </div>
            <div style="max-height:200px; overflow-y:auto; width:100%;">
              <table class="results-table" style="margin:0 auto;">
                <tr><th>#</th><th>Reaction</th><th>Label</th></tr>
                ${rows}
              </table>
            </div>
          </div>
        </div>
        <div style="margin-top:16px; display:flex; gap:10px; justify-content:center;">
          <button onclick="window.quadrantBlink.startGame()">Restart</button>
          <button onclick="window.quadrantBlink.returnToMenu()">Back to Menu</button>
        </div>
      </div>
    `;
  },

  // settings saved msg
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
      const errors = (h.missedIntervals || 0) + (h.wrongClicks || 0);
      const ranked = prog.qualifies;
      const avgDisp = (ranked && h.average != null) ? (h.average + ' ms') : 'Unranked';
      return `
        <tr>
          <td>${i+1}</td>
          <td>${h.date}</td>
          <td>${h.official ? '★ Official' : '-'}</td>
          <td>${h.intervalsCount} @ ${h.blinkIntervalMs}ms</td>
          <td>${avgDisp}</td>
          <td>${errors}</td>
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
              <th>#</th><th>Date</th><th>Mode</th><th>Config</th><th>Average</th><th>Errors</th><th>Accuracy %</th><th>Ready Next?</th>
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
    
    if (typeof window.returnToMenu === 'function') {
      window.returnToMenu();
    }
  }
};

