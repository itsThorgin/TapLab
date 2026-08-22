window.quadrantBlink = {
  // Settings, saved settings can replace these values.
  intervalsCount: 30,   // Set the number of highlights in one run.
  blinkIntervalMs: 400,   // Use 100 to 1500 milliseconds in 5 millisecond steps.
  isOfficial: false,
  OFFICIAL: { intervalsCount: 100, blinkIntervalMs: 250 },
  officialLabel: "Official: 100 intervals @ 250 ms",

  // Store the runtime state.
  currentIndex: 0,
  activeQuadrant: null,
  lastQuadrant: null,
  intervalId: null,
  intervalStart: 0,
  roundReady: false,

  times: [],    // Store the reaction time for each interval, or null.
  labels: [],   // Use "correct", "wrong", or "missed" for each interval.
  wrongClicks: 0,
  missedIntervals: 0,

  endCallback: null,
  gameActive: false,
  timeoutIds: [],

  init(endCallback) {
    const saved = window.readStoredJSON('quadrantBlink_settings', {});
    this.intervalsCount  = Number.isFinite(saved.intervalsCount) ? saved.intervalsCount : this.intervalsCount;
    this.blinkIntervalMs = Number.isFinite(saved.blinkIntervalMs) ? saved.blinkIntervalMs : this.blinkIntervalMs;

    this.endCallback = endCallback;
    this.isOfficial = false;
    this.resetState();

    this.renderSettingsPanel();
    this.showInstruction();
  },

  resetState() {
    // Stop the quadrant interval.
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Clear all queued timeouts.
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds = [];

    // Reset the runtime state.
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
    panel.innerHTML = window.renderLevelSettings({
      fields: [
        { type: 'number', id: 'qb-count', label: 'Intervals', note: 'Choose from 25 to 200', min: 25, max: 200, value: this.intervalsCount },
        { type: 'number', id: 'qb-speed', label: 'Blink speed', note: '100–1500 ms in 5 ms steps', min: 100, max: 1500, step: 5, value: this.blinkIntervalMs }
      ],
      saveAction: 'window.quadrantBlink.saveSettings()',
      historyAction: 'window.quadrantBlink.showHistory()'
    });
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
    container.innerHTML = window.renderInstructionScreen({
      drillName: 'Quadrant Blink',
      summary: 'React inside repeating attention windows while maintaining accuracy.',
      steps: [
        'Keep your eyes on the center dot.',
        `A quadrant lights up every ${this.blinkIntervalMs} ms.`,
        'Click the highlighted quadrant before that interval ends.'
      ],
      setup: [
        { label: 'Intervals', value: this.intervalsCount },
        { label: 'Blink speed', value: `${this.blinkIntervalMs} ms` }
      ],
      note: 'Misses and wrong clicks both count as errors. A rank requires the accuracy and consistency gate.',
      officialLabel: this.officialLabel,
      startAction: 'window.quadrantBlink.isOfficial=false;window.quadrantBlink.startGame()',
      officialAction: 'window.quadrantBlink.startOfficial()',
      backAction: 'window.quadrantBlink.returnToMenu()'
    });
  },

  // Official preset. Do not use saved settings.
  startOfficial() {
    this.isOfficial = true;
    this.intervalsCount = this.OFFICIAL.intervalsCount;
    this.blinkIntervalMs = this.OFFICIAL.blinkIntervalMs;
    this.startGame();
  },

  startGame() {
    window.lockSettingsForRun();
    this.resetState();
    this.gameActive = true;

    const container = document.getElementById('game-container');
    container.innerHTML = window.renderGameScreen({
      drillName: 'Quadrant Blink',
      mode: this.isOfficial ? 'Official' : 'Custom',
      progressLabel: 'Interval',
      progressCurrent: 1,
      progressTotal: this.intervalsCount,
      progressId: 'qb-idx',
      stageHTML: '<div id="qb-area" class="game-arena game-arena-wide"></div>',
      hint: 'Hold fixation at the center and click the highlighted quadrant before the interval changes.',
      backAction: 'window.quadrantBlink.returnToMenu()'
    });

    const area = document.getElementById('qb-area');
    this.setupArena(area);

    window.show321(area, 500).then(() => this.beginCadence(area));
  },

  setupArena(area) {
    // Draw the crosshair quadrants.
    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute; left:0; top:50%; width:100%; height:2px; background:rgba(255,255,255,0.35); transform:translateY(-1px);`;
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute; top:0; left:50%; height:100%; width:2px; background:rgba(255,255,255,0.35); transform:translateX(-1px);`;
    area.appendChild(hLine); area.appendChild(vLine);

    // Add the quadrant click surfaces.
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
      // Add the quadrant label.
      const label = document.createElement('div');
      label.textContent = q.key;
      label.style.cssText = `
        position:absolute; ${q.top===0?'top:6px;':'bottom:6px;'}${q.left===0?'left:8px;':'right:8px;'}
        font-size:.8em; color:rgba(255,255,255,0.55); pointer-events:none;
      `;
      Q.appendChild(label);

      window.onPrimaryPointerDown(Q, (e) => {
        if (!this.gameActive || !this.roundReady) return;
        const clicked = e.currentTarget.dataset.quadrant;
        this.handleClick(clicked);
      });

      area.appendChild(Q);
    });

    // Add a highlight overlay to each quadrant.
    ['UL','UR','LL','LR'].forEach(k => {
      const overlay = document.createElement('div');
      overlay.id = `qb-ov-${k}`;
      overlay.style.cssText = `
        position:absolute; pointer-events:none; opacity:0;
        background:#2ec4b6;
        transition: opacity ${Math.min(120, this.blinkIntervalMs*0.3)}ms ease;
      `;
      
      // Position the overlay.
      switch (k) {
        case 'UL': overlay.style.left='0%'; overlay.style.top='0%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
        case 'UR': overlay.style.left='50%'; overlay.style.top='0%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
        case 'LL': overlay.style.left='0%'; overlay.style.top='50%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
        case 'LR': overlay.style.left='50%'; overlay.style.top='50%'; overlay.style.width='50%'; overlay.style.height='50%'; break;
      }
      area.appendChild(overlay);
    });

    // Draw the center dot.
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
    this.tick(area); // Show the first highlight immediately.

    this.intervalId = setInterval(() => {
      this.advanceInterval(area);
    }, this.blinkIntervalMs);
  },

  tick(area) {
    // Select a quadrant that differs from the previous quadrant.
    const opts = ['UL','UR','LL','LR'].filter(q => q !== this.lastQuadrant);
    this.activeQuadrant = opts[Math.floor(Math.random() * opts.length)];
    this.lastQuadrant = this.activeQuadrant;

    // Clear the previous highlights.
    ['UL','UR','LL','LR'].forEach(k => {
      const el = document.getElementById(`qb-ov-${k}`);
      if (!el) return;

      // Restore the transition after a feedback flash changes it.
      if (el.dataset._prevTransition !== undefined) {
        el.style.transition = el.dataset._prevTransition;
        delete el.dataset._prevTransition;
      }

      // Set the normal overlay opacity.
      el.style.opacity = (k === this.activeQuadrant) ? '0.35' : '0';
    });

    // Wait for the browser to paint. Then start the timer and accept clicks.
    requestAnimationFrame(() => {
      this.intervalStart = performance.now();
      this.roundReady = true;
    });

    // Create an array entry for this interval.
    this.times[this.currentIndex] = null;
    this.labels[this.currentIndex] = 'missed'; // Replace this default value after a correct click.
    document.getElementById('qb-idx').textContent = (this.currentIndex + 1);
  },

  advanceInterval(area) {
    // Keep the interval marked as missed when no correct click occurs.
    if (!this.gameActive) return;
    if (this.roundReady && this.labels[this.currentIndex] === 'missed') {
      window.showGameFeedback({
        type: 'warning',
        message: 'Missed interval',
        duration: Math.min(300, this.blinkIntervalMs)
      });
    }

    this.currentIndex++;
    if (this.currentIndex >= this.intervalsCount) {
      // Remove the highlight and stop the interval timer.
      ['UL','UR','LL','LR'].forEach(k => {
        const el = document.getElementById(`qb-ov-${k}`);
        if (el) el.style.opacity = '0';
      });
      clearInterval(this.intervalId);
      this.intervalId = null;

      // Calculate the number of missed intervals.
      this.missedIntervals = this.labels.filter(x => x === 'missed').length;
      this.finish();
      return;
    }

    // Prepare the next interval.
    this.roundReady = false;
    this.tick(area);
  },

  handleClick(clicked) {
    if (!this.gameActive || !this.roundReady) return;

    // Count a click only when it occurs during the real interval window.
    // Use the same clock for the interval window and the reaction time.
    // This check prevents interval timer delays from extending the valid window.
    const rt = Math.round(performance.now() - this.intervalStart);
    const withinWindow = rt <= this.blinkIntervalMs;

    const correct = (clicked === this.activeQuadrant) && withinWindow;
    if (correct) {
      this.times[this.currentIndex] = rt;
      this.labels[this.currentIndex] = 'correct';

      this.flashOverlayUntilNextTick(this.activeQuadrant, 0.95);
      window.showGameFeedback({
        type: 'success',
        message: `Hit • ${rt} ms`,
        duration: Math.min(300, this.blinkIntervalMs),
        pulseTarget: '#qb-area'
      });
    } else if (clicked === this.activeQuadrant && !withinWindow) {
      // Record a miss when the correct quadrant is clicked too late.
      this.labels[this.currentIndex] = 'missed';
      window.showGameFeedback({
        type: 'warning',
        message: 'Too late',
        duration: Math.min(320, this.blinkIntervalMs),
        pulseTarget: '#qb-area'
      });
    } else {
      this.wrongClicks++;
      // Record a wrong click for this interval.
      this.labels[this.currentIndex] = 'wrong';
      window.showGameFeedback({
        type: 'error',
        message: 'Wrong quadrant',
        duration: Math.min(320, this.blinkIntervalMs),
        pulseTarget: '#qb-area'
      });
    }

    // Accept only the first click in each interval.
    this.roundReady = false;
  },

  // Evaluate progress toward the next speed.
  evaluateProgress(results) {
    const correctCount = results.labels.filter(l => l === 'correct').length;
    const accuracy = correctCount / results.intervalsCount;
    const neededCorrect = Math.ceil(results.intervalsCount * 0.75);

    // Set the next interval window 5 milliseconds faster.
    // Require 75 percent accuracy. Also require half of the correct clicks to fit the next time window - be faster.
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

    // Show a short feedback flash.
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
      times: this.times,    // Store milliseconds for each interval, or null.
      labels: this.labels,    // Use "correct", "wrong", or "missed" for each interval.
      average: avg,
      wrongClicks: this.wrongClicks,
      missedIntervals: this.missedIntervals,
      official: this.isOfficial,
      _customOverlay: true
    };

    const progress = this.evaluateProgress(results);
    
    this.showResultsOverlay(results, progress);
    this.endCallback(results);

    // Add the result to history.
    const historyEntry = {
      date: new Date().toLocaleString(),
      intervalsCount: this.intervalsCount,
      blinkIntervalMs: this.blinkIntervalMs,
      average: avg,
      wrongClicks: this.wrongClicks,
      missedIntervals: this.missedIntervals,
      times: this.times,
      progress: progress,
      official: this.isOfficial
    };
    window.appendHistory('quadrantBlink_history', historyEntry, {
      config: h => ({
        official: !!h.official,
        intervalsCount: h.intervalsCount,
        blinkIntervalMs: h.blinkIntervalMs
      }),
      label: h => `${h.official ? '★ Official' : 'Custom'} • ${h.intervalsCount} intervals @ ${h.blinkIntervalMs} ms`,
      metrics: {
        average: h => Number.isFinite(h.average) ? h.average : null,
        errors: h => (Number(h.missedIntervals) || 0) + (Number(h.wrongClicks) || 0),
        accuracy: h => h.progress && Number.isFinite(h.progress.accuracy) ? h.progress.accuracy : null,
        qualifies: h => h.progress && typeof h.progress.qualifies === 'boolean' ? (h.progress.qualifies ? 1 : 0) : null
      }
    });
  },

  // Base the rank on the average time for correct reactions.
  // The rank limits are estimates.
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

    const rows = results.times.map((t, i) => {
      const L = results.labels[i];
      const tdisp = Number.isFinite(t) ? `${t} ms` : '- - -';
      const color = (L === 'correct') ? '#2ec4b6' : (L === 'wrong' ? '#ffb300' : '#f44336');
      return `<tr><td>${i + 1}</td><td style="color:${color};">${tdisp}</td><td>${L}</td></tr>`;
    }).join('');

    container.innerHTML = window.renderResultScreen({
      drillName: 'Quadrant Blink',
      official: results.official,
      primary: {
        label: ranked ? 'Qualified average' : 'Qualification result',
        value: ranked && results.average !== null ? `${results.average} ms` : 'Unranked',
        hint: ranked
          ? `${progress.correctCount}/${results.intervalsCount} correct intervals`
          : `${progress.accuracy}% accuracy • ${progress.correctCount}/${results.intervalsCount} correct`,
        color: category.color
      },
      metrics: [
        { label: 'Correct-click average', value: results.average !== null ? `${results.average} ms` : '-' },
        { label: 'Accuracy', value: `${progress.accuracy}%`, tone: progress.accuracy >= 75 ? 'success' : 'warning' },
        { label: 'Errors', value: totalErrors, tone: totalErrors ? 'warning' : 'success' },
        { label: 'Interval speed', value: `${results.blinkIntervalMs} ms` }
      ],
      assessment: {
        eyebrow: 'Performance tier',
        title: category.label,
        description: category.range,
        color: category.color,
        benchmarks: benchmarks.map(benchmark => ({
          ...benchmark,
          active: ranked && benchmark.label === category.label
        })),
        footer: `Next level: ${progress.qualifies ? 'YES' : 'NO'} • need ${progress.neededCorrect}/${results.intervalsCount} correct and at least 50% consistency at ${progress.nextSpeed} ms`
      },
      breakdown: {
        title: 'Interval breakdown',
        headers: ['Interval', 'Reaction', 'Result'],
        rows,
        note: 'Only correct clicks contribute to the reaction-time average.'
      },
      restartAction: 'window.quadrantBlink.startGame()',
      backAction: 'window.quadrantBlink.returnToMenu()'
    });
  },

  // Show a message after the settings are saved.
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
    const history = window.readStoredJSON('quadrantBlink_history', []);
    const container = document.getElementById('game-container');
    container.classList.remove('hidden');

    if (!history.length) {
      container.innerHTML = window.renderEmptyHistory({
        drillName: 'Quadrant Blink',
        backAction: 'window.quadrantBlink.returnToMenu()'
      });
      return;
    }

    const archive = history.find(h => h && h._compacted === true);
    const recent = history.filter(h => h && typeof h === 'object' && h._compacted !== true);
    const historyOffset = archive ? Number(archive.sessionCount) || 0 : 0;
    const compactedRow = window.renderCompactedHistoryRow(archive, 8, group => {
      const reaction = window.getCompactedMetric(group, 'average');
      const errors = window.getCompactedMetric(group, 'errors');
      const accuracy = window.getCompactedMetric(group, 'accuracy');
      const qualifies = window.getCompactedMetric(group, 'qualifies');
      return `<div class="compacted-history-group">
        <strong>${window.escapeHTML(group.label)}</strong><br>
        ${group.sessionCount} runs • ${reaction ? Math.round(reaction.average) + ' ms average / ' + Math.round(reaction.min) + ' ms best' : 'no ranked timing data'} •
        ${accuracy ? accuracy.average.toFixed(1) + '% accuracy' : '-'} • ${errors ? errors.average.toFixed(1) : '0'} errors/run •
        ${qualifies ? Math.round(qualifies.average * 100) : 0}% ready-next rate
      </div>`;
    });

    const rows = recent.slice().reverse().map((h,i) => {
      const prog = h.progress || {};
      const errors = (h.missedIntervals || 0) + (h.wrongClicks || 0);
      const ranked = prog.qualifies;
      const avgDisp = (ranked && h.average != null) ? (h.average + ' ms') : 'Unranked';
      return `
        <tr>
          <td>${historyOffset + recent.length - i}</td>
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

    container.innerHTML = window.renderHistoryScreen({
      drillName: 'Quadrant Blink',
      headers: ['#', 'Date', 'Mode', 'Config', 'Average', 'Errors', 'Accuracy %', 'Ready Next?'],
      rows,
      compactedRow,
      recentCount: recent.length,
      archivedCount: historyOffset,
      backAction: 'window.quadrantBlink.returnToMenu()'
    });
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
