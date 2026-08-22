window.peripheral = {
  // Define defaults. Saved settings can replace these values.
  rounds: 10,
  trueTargetSize: 6,           // Use 3, 6, or 9 pixels.
  distractorCount: 12,
  distractorMin: 3,            // Set the minimum distractor size in pixels.
  distractorMax: 30,

  // Store the runtime state.
  currentRound: 0,
  times: [],                   // Store milliseconds. Use null after a mistake.
  mistakes: [],                // Store the mistake state for each round.
  targetQuadrant: null,
  spawnTime: 0,
  endCallback: null,
  gameActive: false,
  timeoutIds: [],
  inCountdown: false,
  roundReady: false,     // Block clicks until the target is active.
  uniformColor: false,   // Use one dot color. Blink the true target three times.
  isOfficial: false,
  OFFICIAL: { rounds: 25, trueTargetSize: 3, distractorCount: 50, uniformColor: true },
  officialLabel: "Official: 25 rounds, 3px target, 50 distractors, uniform color",

  init(endCallback) {
    const saved = window.readStoredJSON('peripheral_settings', {});
    this.rounds = Number.isFinite(saved.rounds) ? saved.rounds : this.rounds;
    this.trueTargetSize = [3,6,9].includes(saved.trueTargetSize) ? saved.trueTargetSize : this.trueTargetSize;
    this.distractorCount= Number.isFinite(saved.distractorCount) ? saved.distractorCount : this.distractorCount;
    this.uniformColor = !!saved.uniformColor;

    this.endCallback = endCallback;
    this.currentRound = 0;
    this.times = [];
    this.mistakes = [];
    this.timeoutIds = [];
    this.gameActive = false;
    this.isOfficial = false;

    this.renderSettingsPanel();
    this.showInstruction();
  },

  renderSettingsPanel() {
    const panel = document.getElementById('level-specific-settings');
    panel.innerHTML = window.renderLevelSettings({
      fields: [
        { type: 'number', id: 'periph-rounds', label: 'Rounds', note: 'Choose from 5 to 50', min: 5, max: 50, value: this.rounds },
        {
          type: 'select', id: 'periph-size', label: 'True target size', note: 'Tiny targets demand more peripheral precision',
          options: [3, 6, 9].map(size => ({ value: size, label: `${size} px`, selected: this.trueTargetSize === size }))
        },
        { type: 'number', id: 'periph-distractors', label: 'Distractors', note: 'Choose from 10 to 50', min: 10, max: 50, value: this.distractorCount },
        { type: 'checkbox', id: 'periph-uniform', label: 'Same color mode', note: 'The true target blinks three times', checked: this.uniformColor }
      ],
      saveAction: 'window.peripheral.saveSettings()',
      historyAction: 'window.peripheral.showHistory()'
    });
  },

  saveSettings() {
    const rounds = parseInt(document.getElementById('periph-rounds').value);
    const trueTargetSize = parseInt(document.getElementById('periph-size').value);
    const distractorCount = parseInt(document.getElementById('periph-distractors').value);
    const uniformColor = document.getElementById('periph-uniform').checked;

    this.rounds = Math.min(50, Math.max(5, rounds || 5));
    this.trueTargetSize = [3,6,9].includes(trueTargetSize) ? trueTargetSize : 6;
    this.distractorCount = Math.min(50, Math.max(10, distractorCount || 10));
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
    container.innerHTML = window.renderInstructionScreen({
      drillName: 'Peripheral Awareness',
      summary: 'Locate a tiny target without moving your gaze away from the center.',
      steps: [
        'Keep your eyes fixed on the center point.',
        'Detect the tiny target using peripheral vision; do not chase it with your eyes.',
        'Click the quadrant where it appeared: UL, UR, LL, or LR.'
      ],
      setup: [
        { label: 'Rounds', value: this.rounds },
        { label: 'Target size', value: `${this.trueTargetSize} px` },
        { label: 'Distractors', value: this.distractorCount },
        { label: 'Color mode', value: this.uniformColor ? 'Same color' : 'Color contrast' }
      ],
      note: 'Reaction time is recorded from target appearance to quadrant click. Wrong quadrants count as mistakes.',
      officialLabel: this.officialLabel,
      startAction: 'window.peripheral.isOfficial=false;window.peripheral.startGame()',
      officialAction: 'window.peripheral.startOfficial()',
      backAction: 'window.peripheral.returnToMenu()'
    });
  },

  // Apply the fixed official preset. Do not use saved settings.
  startOfficial() {
    this.isOfficial = true;
    this.rounds = this.OFFICIAL.rounds;
    this.trueTargetSize = this.OFFICIAL.trueTargetSize;
    this.distractorCount = this.OFFICIAL.distractorCount;
    this.uniformColor = this.OFFICIAL.uniformColor;
    this.startGame();
  },

  startGame() {
    window.lockSettingsForRun();
    this.currentRound = 0;
    this.times = [];
    this.mistakes = [];
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds = [];
    this.gameActive = true;
    
    // Build the arena interface.
    const container = document.getElementById('game-container');
    container.innerHTML = window.renderGameScreen({
      drillName: 'Peripheral Awareness',
      mode: this.isOfficial ? 'Official' : 'Custom',
      progressLabel: 'Round',
      progressCurrent: this.currentRound + 1,
      progressTotal: this.rounds,
      stageHTML: '<div id="peripheral-area" class="game-arena game-arena-wide"></div>',
      hint: 'Keep your gaze on the center, then click the quadrant containing the tiny target.',
      backAction: 'window.peripheral.returnToMenu()'
    });

    const area = document.getElementById('peripheral-area');

    // Draw the crosshair quadrants.
    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute; left:0; top:50%; width:100%; height:2px; background:rgba(255,255,255,0.35); transform:translateY(-1px);`;
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute; top:0; left:50%; height:100%; width:2px; background:rgba(255,255,255,0.35); transform:translateX(-1px);`;
    area.appendChild(hLine); area.appendChild(vLine);

    // Draw the center fixation dot.
    const centerDot = document.createElement('div');
    centerDot.style.cssText = `
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:8px; height:8px; border-radius:50%; background:#e0e1dd; box-shadow:0 0 4px rgba(0,0,0,0.4);
    `;
    area.appendChild(centerDot);

    // Add a click surface to each quadrant.
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

      window.onPrimaryPointerDown(Q, (e) => {
        e.stopPropagation();
        if (!this.gameActive || this.inCountdown) return;
        const clicked = e.currentTarget.dataset.quadrant;
        this.handleQuadrantClick(clicked);
      });

      area.appendChild(Q);
    });

    // Draw the distractors.
    this.placeDistractors(area);

    // Show the countdown. Then show the first target.
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
    container.innerHTML = window.renderGameScreen({
      drillName: 'Peripheral Awareness',
      mode: this.isOfficial ? 'Official' : 'Custom',
      progressLabel: 'Round',
      progressCurrent: this.currentRound + 1,
      progressTotal: this.rounds,
      stageHTML: '<div id="peripheral-area" class="game-arena game-arena-wide"></div>',
      hint: 'Keep your gaze on the center, then click the quadrant containing the tiny target.',
      backAction: 'window.peripheral.returnToMenu()'
    });

    const area = document.getElementById('peripheral-area');

    // Draw the crosshair quadrants.
    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute; left:0; top:50%; width:100%; height:2px; background:rgba(255,255,255,0.35); transform:translateY(-1px);`;
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute; top:0;left:50%; height:100%; width:2px; background:rgba(255,255,255,0.35); transform:translateX(-1px);`;
    area.appendChild(hLine); area.appendChild(vLine);

    // Draw the center fixation dot.
    const centerDot = document.createElement('div');
    centerDot.style.cssText = `
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:8px; height:8px; border-radius:50%; background:#e0e1dd; box-shadow:0 0 4px rgba(0,0,0,0.4);
    `;
    area.appendChild(centerDot);

    // Add a click surface to each quadrant.
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

      window.onPrimaryPointerDown(Q, (e) => {
        e.stopPropagation();
        if (!this.gameActive || this.inCountdown) return;
        const clicked = e.currentTarget.dataset.quadrant;
        this.handleQuadrantClick(clicked);
      });

      area.appendChild(Q);
    });

    // Draw the distractors.
    this.placeDistractors(area);

    // Show a short countdown before the target appears.
    setTimeout(() => this.spawnTrueTarget(area), 400);
  },

  spawnTrueTarget(area) {
    if (!this.gameActive) return;

    const w = area.clientWidth;
    const h = area.clientHeight;

    // Select a quadrant.
    const quadrants = ['UL','UR','LL','LR'];
    this.targetQuadrant = quadrants[Math.floor(Math.random() * 4)];

    // Calculate the target limits inside the selected quadrant. Include padding.
    const pad = Math.max(12, this.trueTargetSize + 8);
    const halfW = w / 2, halfH = h / 2;

    let minX, maxX, minY, maxY;
    switch (this.targetQuadrant) {
      case 'UL': minX = pad; maxX = halfW - pad; minY = pad; maxY = halfH - pad; break;
      case 'UR': minX = halfW + pad; maxX = w - pad; minY = pad; maxY = halfH - pad; break;
      case 'LL': minX = pad; maxX = halfW - pad; minY = halfH + pad;   maxY = h - pad; break;
      default: minX = halfW + pad; maxX = w - pad; minY = halfH + pad; maxY = h - pad; break;
    }

    // Select a position that does not overlap a distractor.
    let x, y, tries = 0;
    const tr = this.trueTargetSize / 2;
    const blockers = this._distractors || [];
    do {
      x = minX + Math.random() * Math.max(1, (maxX - minX));
      y = minY + Math.random() * Math.max(1, (maxY - minY));
      tries++;
      // Keep 4 pixels between the target and each distractor.
      var ok = true;
      for (const d of blockers) {
        const dx = x - d.x, dy = y - d.y;
        if (Math.hypot(dx, dy) < (tr + d.r + 4)) { ok = false; break; }
      }
    } while (!ok && tries < 80);

    // Draw the true target dot.
    const trueColor = '#2ec4b6';
    const dot = document.createElement('div');
    dot.style.cssText = `
      position:absolute; left:${x - this.trueTargetSize/2}px; top:${y - this.trueTargetSize/2}px;
      width:${this.trueTargetSize}px; height:${this.trueTargetSize}px; border-radius:50%;
      background:${trueColor}; box-shadow:0 0 4px rgba(0,0,0,0.35);
      pointer-events:none; opacity:1;
    `;
    area.appendChild(dot);

    // Keep clicks disabled until the target is active.
    this.roundReady = false;

    if (this.uniformColor) {
      // Start the timer and accept clicks immediately.
      requestAnimationFrame(() => {
        this.spawnTime = performance.now();
        this.roundReady = true;   // Accept clicks while the target blinks.
      });

      // Blink the target three times. Then make the round active.
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
      // In normal mode, accept clicks after the browser paints the target.
      requestAnimationFrame(() => {
        this.spawnTime = performance.now();
        this.roundReady = true;
      });
    }
  },

  handleQuadrantClick(clickedQuadrant) {
    if (!this.gameActive) return;
    if (!this.roundReady) return; // Ignore early clicks.

    this.roundReady = false; // Block other clicks until the next round.

    const rt = Math.round(performance.now() - this.spawnTime);
    const correct = clickedQuadrant === this.targetQuadrant;

    if (correct) {
      this.times.push(rt);
      this.mistakes.push(false);
      window.showGameFeedback({
        type: 'success',
        message: `Correct • ${rt} ms`,
        duration: 340,
        pulseTarget: '#peripheral-area'
      });
    } else {
      this.times.push(null);      // Do not record a reaction time after a mistake.
      this.mistakes.push(true);
      this.showTemporaryMessage('Wrong quadrant', 'error');
    }

    this.currentRound++;
    if (this.currentRound >= this.rounds) {
      this.finish();
    } else {
      // Use a short pause to reduce accidental double clicks.
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

        // Keep the distractor outside a 30-pixel radius around the center.
        const dxC = x - w/2, dyC = y - h/2;
        if ((dxC*dxC + dyC*dyC) < (30*30)) continue;

        // Keep the distractor away from the crosshair lines.
        if (Math.abs(x - w/2) < (r + 6) || Math.abs(y - h/2) < (r + 6)) continue;

        // Prevent overlap with earlier distractors.
        let ok = true;
        for (const d of dots) {
          const dx = x - d.x, dy = y - d.y;
          if (Math.hypot(dx, dy) < (r + d.r + 6)) { ok = false; break; }
        }
        if (!ok) continue;

        // Place the distractor.
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

      if (!placed && i < maxAttempts) continue; // Skip this distractor if the arena is too crowded.
    }
    this._distractors = dots;
  },

  finish() {
    this.gameActive = false;
    const validTimes = this.times.filter(t => Number.isFinite(t));
    const avg = validTimes.length ? Math.round(validTimes.reduce((a,b)=>a+b,0)/validTimes.length) : null;
    const mistakesTotal = this.mistakes.filter(Boolean).length;

    const results = {
      times: this.times,    // Store milliseconds for each round, or null.
      mistakes: this.mistakes,    // Store the mistake state for each round.
      average: avg,   // Use null when no round is correct.
      mistakesTotal,
      rounds: this.rounds,
      official: this.isOfficial,
      _customOverlay: true
    };

    this.showResultsOverlay(results);
    this.endCallback(results);

    // Add the result to history.
    const historyEntry = {
      date: new Date().toLocaleString(),
      rounds: this.rounds,
      trueTargetSize: this.trueTargetSize,
      distractorCount: this.distractorCount,
      uniformColor: this.uniformColor,
      average: avg,
      mistakesTotal,
      times: this.times,
      official: this.isOfficial
    };
    window.appendHistory('peripheral_history', historyEntry, {
      config: h => ({
        official: !!h.official,
        rounds: h.rounds,
        trueTargetSize: h.trueTargetSize,
        distractorCount: h.distractorCount,
        uniformColor: h.official ? true : (typeof h.uniformColor === 'boolean' ? h.uniformColor : null)
      }),
      label: h => {
        const uniform = h.official ? true : h.uniformColor;
        const mode = typeof uniform === 'boolean' ? (uniform ? 'same color' : 'color contrast') : 'legacy color mode';
        return `${h.official ? '★ Official' : 'Custom'} • ${h.rounds}r • ${h.trueTargetSize}px • ${h.distractorCount} distractors • ${mode}`;
      },
      metrics: {
        average: h => Number.isFinite(h.average) ? h.average : null,
        mistakesTotal: h => Number.isFinite(h.mistakesTotal) ? h.mistakesTotal : null
      }
    });
  },

  showResultsOverlay(results) {
    const container = document.getElementById('game-container');
    const correctCount = results.times.filter(Number.isFinite).length;
    const labels = results.times.map((t, i) => {
      if (results.mistakes[i]) return 'wrong';
      if (!Number.isFinite(t)) return 'missed';
      return 'correct';
    });
    const rows = results.times.map((t, i) => {
      const L = labels[i];
      const tdisp = Number.isFinite(t) ? `${t} ms` : '- - -';
      const color = L === 'correct' ? '#2ec4b6' : L === 'wrong' ? '#ffb300' : '#f44336';
      return `<tr><td>${i + 1}</td><td style="color:${color};">${tdisp}</td><td>${L}</td></tr>`;
    }).join('');

    container.innerHTML = window.renderResultScreen({
      drillName: 'Peripheral Awareness',
      official: results.official,
      primary: {
        label: 'Average correct reaction',
        value: results.average !== null ? `${results.average} ms` : '-',
        hint: 'Average includes correct rounds only',
        color: '#2ec4b6'
      },
      metrics: [
        { label: 'Correct rounds', value: `${correctCount} / ${results.rounds}`, tone: correctCount === results.rounds ? 'success' : undefined },
        { label: 'Mistakes', value: results.mistakesTotal, tone: results.mistakesTotal ? 'warning' : 'success' },
        { label: 'Rounds', value: results.rounds }
      ],
      breakdown: {
        title: 'Round breakdown',
        headers: ['Round', 'Reaction', 'Result'],
        rows,
        note: 'Wrong and missed rounds are excluded from the average.'
      },
      restartAction: 'window.peripheral.startGame()',
      backAction: 'returnToMenu()'
    });
  },

  showHistory() {
    const history = window.readStoredJSON('peripheral_history', []);
    const container = document.getElementById('game-container');
    container.classList.remove('hidden');

    if (!history.length) {
      container.innerHTML = window.renderEmptyHistory({
        drillName: 'Peripheral Awareness',
        backAction: 'window.peripheral.returnToMenu()'
      });
      return;
    }

    const archive = history.find(h => h && h._compacted === true);
    const recent = history.filter(h => h && typeof h === 'object' && h._compacted !== true);
    const historyOffset = archive ? Number(archive.sessionCount) || 0 : 0;
    const compactedRow = window.renderCompactedHistoryRow(archive, 7, group => {
      const reaction = window.getCompactedMetric(group, 'average');
      const mistakes = window.getCompactedMetric(group, 'mistakesTotal');
      return `<div class="compacted-history-group">
        <strong>${window.escapeHTML(group.label)}</strong><br>
        ${group.sessionCount} runs • ${reaction ? Math.round(reaction.average) + ' ms average' : 'no correct timing data'} •
        ${mistakes ? mistakes.average.toFixed(1) : '0'} mistakes/run
      </div>`;
    });

    const rows = recent.slice().reverse().map((h,i) => `
      <tr>
        <td>${historyOffset + recent.length - i}</td>
        <td>${h.date}</td>
        <td>${h.official ? '★ Official' : '-'}</td>
        <td>${h.rounds}r / ${h.trueTargetSize}px / ${h.distractorCount} distractors</td>
        <td>${h.average ?? '-'}</td>
        <td>${h.mistakesTotal}</td>
        <td>${(h.times||[]).map(t => Number.isFinite(t)? t : '-').join(', ')}</td>
      </tr>
    `).join('');

    container.innerHTML = window.renderHistoryScreen({
      drillName: 'Peripheral Awareness',
      headers: ['#', 'Date', 'Mode', 'Config', 'Average', 'Mistakes', 'Times'],
      rows,
      compactedRow,
      recentCount: recent.length,
      archivedCount: historyOffset,
      backAction: 'window.peripheral.returnToMenu()'
    });
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
  
  showTemporaryMessage(text, type = "error") {
    window.showGameFeedback({
      type,
      message: text,
      duration: 380,
      pulseTarget: '#peripheral-area'
    });
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



