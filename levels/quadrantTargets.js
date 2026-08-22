window.quadrantTargets = {
    // Settings, saved settings can replace these values.
    cycles: 10,                 // Set 5 to 50 real quadrant-and-target cycles.
    targetSize: 25,             // Set the target diameter in pixels.
    fakeEnabled: false,         // Enable fake light signals.
    fakeChance: 0.3,            // Set the probability that a light signal is fake.
    fakeRepeatChance: 0.5,      // Set the probability that another signal follows a fake signal.
    fakeDurationMs: 500,        // Set how long a fake signal stays visible.
    isOfficial: false,
    OFFICIAL: { cycles: 25, targetSize: 10, fakeEnabled: true, fakeChance: 0.3 },
    officialLabel: "Official: 25 cycles, 10px target, fakes on (0.3)",

    // Store the runtime state.
    currentCycle: 0,
    quadRTs: [],                // Store the time from the light signal to the quadrant click.
    hoverTimes: [],             // Store the time from target display to the first pointer entry.
    clickDelays: [],            // Store the time from the first pointer entry to the target click.
    totalTimes: [],             // Store the time from the light signal to the target click.
    errors: 0,                  // Count clicks on wrong or fake quadrants.
    activeQuadrant: null,       // Store the active real quadrant key, or null.
    isFakeActive: false,        // Indicate that a fake light signal is visible.
    phase: 'idle',              // Use "idle", "quadrant", or "target".
    quadLitTime: 0,
    targetSpawnTime: 0,
    targetHoverTime: null,
    endCallback: null,
    gameActive: false,
    timeoutIds: [],

    init(endCallback) {
        const saved = window.readStoredJSON('quadrantTargets_settings', {});
        this.cycles = (saved.cycles >= 5 && saved.cycles <= 50) ? saved.cycles : 10;
        this.targetSize = [10, 15, 20, 25, 30].includes(saved.targetSize) ? saved.targetSize : 25;
        this.fakeEnabled = !!saved.fakeEnabled;
        this.fakeChance = Number.isFinite(saved.fakeChance) ? saved.fakeChance : 0.3;

        this.endCallback = endCallback;
        this.gameActive = false;
        this.timeoutIds = [];
        this.isOfficial = false;

        this.renderSettingsPanel();
        this.showInstruction();
    },

    renderSettingsPanel() {
        const panel = document.getElementById('level-specific-settings');
        panel.innerHTML = window.renderLevelSettings({
            fields: [
                {
                    type: 'number',
                    id: 'qt-cycles',
                    label: 'Cycles',
                    note: 'Complete quadrant-to-target sequences',
                    min: 5,
                    max: 50,
                    value: this.cycles
                },
                {
                    type: 'select',
                    id: 'qt-size',
                    label: 'Target size',
                    note: 'Smaller targets demand more precision',
                    options: [30, 25, 20, 15, 10].map(size => ({
                        value: size,
                        label: `${size} px`,
                        selected: this.targetSize === size
                    }))
                },
                {
                    type: 'checkbox',
                    id: 'qt-fake',
                    label: 'Fake light-ups',
                    note: 'Orange signals disappear and must be ignored',
                    checked: this.fakeEnabled
                },
                {
                    type: 'number',
                    id: 'qt-fake-chance',
                    label: 'Fake chance',
                    note: 'Probability from 0 to 1 when fakes are enabled',
                    min: 0,
                    max: 1,
                    step: 0.05,
                    value: this.fakeChance
                }
            ],
            saveAction: 'window.quadrantTargets.saveSettings()',
            historyAction: 'window.quadrantTargets.showHistory()'
        });
    },

    saveSettings() {
        const cycles = parseInt(document.getElementById('qt-cycles').value);
        const targetSize = parseInt(document.getElementById('qt-size').value);
        const fakeEnabled = document.getElementById('qt-fake').checked;
        const fakeChance = parseFloat(document.getElementById('qt-fake-chance').value);

        this.cycles = Math.min(50, Math.max(5, cycles || 10));
        this.targetSize = [10, 15, 20, 25, 30].includes(targetSize) ? targetSize : 25;
        this.fakeEnabled = fakeEnabled;
        this.fakeChance = Math.min(1, Math.max(0, Number.isFinite(fakeChance) ? fakeChance : 0.3));

        localStorage.setItem('quadrantTargets_settings', JSON.stringify({
            cycles: this.cycles,
            targetSize: this.targetSize,
            fakeEnabled: this.fakeEnabled,
            fakeChance: this.fakeChance
        }));
        this.showPopupMessage("Settings saved.");
        this.showInstruction();
    },

    showInstruction() {
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');
        container.innerHTML = window.renderInstructionScreen({
            drillName: 'Quadrant + Target',
            summary: 'Combine broad visual reaction with precise pointer acquisition in one measured cycle.',
            steps: [
                'Click the quadrant when it lights up teal.',
                'Acquire and click the small target that appears inside that quadrant.',
                this.fakeEnabled
                    ? 'Ignore orange fake light-ups; they disappear on their own. Respond only to teal.'
                    : 'Repeat the quadrant-to-target sequence until every cycle is complete.'
            ],
            setup: [
                { label: 'Cycles', value: this.cycles },
                { label: 'Target', value: `${this.targetSize} px` },
                { label: 'Fakes', value: this.fakeEnabled ? `${Math.round(this.fakeChance * 100)}% chance` : 'Off' }
            ],
            note: 'TapLab records the full cycle plus quadrant reaction, target hover, and final click time separately.',
            officialLabel: this.officialLabel,
            startAction: 'window.quadrantTargets.isOfficial=false;window.quadrantTargets.startGame()',
            officialAction: 'window.quadrantTargets.startOfficial()',
            backAction: 'window.quadrantTargets.returnToMenu()'
        });
    },

    // Apply the fixed official preset. Do not use saved settings.
    startOfficial() {
        this.isOfficial = true;
        this.cycles = this.OFFICIAL.cycles;
        this.targetSize = this.OFFICIAL.targetSize;
        this.fakeEnabled = this.OFFICIAL.fakeEnabled;
        this.fakeChance = this.OFFICIAL.fakeChance;
        this.startGame();
    },

    startGame() {
        window.lockSettingsForRun();
        this.currentCycle = 0;
        this.quadRTs = [];
        this.hoverTimes = [];
        this.clickDelays = [];
        this.totalTimes = [];
        this.errors = 0;
        this.activeQuadrant = null;
        this.isFakeActive = false;
        this.phase = 'idle';
        this.targetHoverTime = null;
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        this.gameActive = true;

        const container = document.getElementById('game-container');
        container.innerHTML = window.renderGameScreen({
            drillName: 'Quadrant + Target',
            mode: this.isOfficial ? 'Official' : 'Custom',
            progressLabel: 'Cycle',
            progressCurrent: 1,
            progressTotal: this.cycles,
            progressId: 'qt-idx',
            stageHTML: '<div id="qt-area" class="game-arena game-arena-wide"></div>',
            hint: this.fakeEnabled
                ? 'Click teal quadrants, ignore orange fakes, then acquire the target.'
                : 'Click the lit quadrant, then acquire and click the target inside it.',
            backAction: 'window.quadrantTargets.returnToMenu()'
        });

        const area = document.getElementById('qt-area');
        this.setupArena(area);

        window.show321(area, 500).then(() => {
            if (!this.gameActive) return;
            this.nextLightUp();
        });
    },

    setupArena(area) {
        // Draw the crosshair.
        const hLine = document.createElement('div');
        hLine.style.cssText = `position:absolute; left:0; top:50%; width:100%; height:2px; background:rgba(255,255,255,0.35); transform:translateY(-1px); pointer-events:none;`;
        const vLine = document.createElement('div');
        vLine.style.cssText = `position:absolute; top:0; left:50%; height:100%; width:2px; background:rgba(255,255,255,0.35); transform:translateX(-1px); pointer-events:none;`;
        area.appendChild(hLine); area.appendChild(vLine);

        const quads = [
            { key: 'UL', left: 0,  top: 0 },
            { key: 'UR', left: 50, top: 0 },
            { key: 'LL', left: 0,  top: 50 },
            { key: 'LR', left: 50, top: 50 },
        ];

        // Add highlight overlays behind the click surfaces.
        quads.forEach(q => {
            const overlay = document.createElement('div');
            overlay.id = `qt-ov-${q.key}`;
            overlay.style.cssText = `
                position:absolute; left:${q.left}%; top:${q.top}%;
                width:50%; height:50%; background:#2ec4b6; opacity:0;
                pointer-events:none; transition:opacity 90ms ease;
            `;
            area.appendChild(overlay);
        });

        // Add the quadrant click surfaces.
        quads.forEach(q => {
            const Q = document.createElement('div');
            Q.dataset.quadrant = q.key;
            Q.style.cssText = `position:absolute; left:${q.left}%; top:${q.top}%; width:50%; height:50%;`;
            const label = document.createElement('div');
            label.textContent = q.key;
            label.style.cssText = `
                position:absolute; ${q.top===0?'top:6px;':'bottom:6px;'}${q.left===0?'left:8px;':'right:8px;'}
                font-size:.8em; color:rgba(255,255,255,0.45); pointer-events:none;
            `;
            Q.appendChild(label);
            window.onPrimaryPointerDown(Q, (e) => {
                if (!this.gameActive) return;
                this.handleQuadrantClick(e.currentTarget.dataset.quadrant);
            });
            area.appendChild(Q);
        });

        // Draw the center dot.
        const centerDot = document.createElement('div');
        centerDot.style.cssText = `
            position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
            width:8px; height:8px; border-radius:50%; background:#e0e1dd;
            box-shadow:0 0 4px rgba(0,0,0,0.4); pointer-events:none; z-index:6;
        `;
        area.appendChild(centerDot);
    },

    randomQuadrant() {
        return ['UL', 'UR', 'LL', 'LR'][Math.floor(Math.random() * 4)];
    },

    setOverlay(key, on, color) {
        const ov = document.getElementById(`qt-ov-${key}`);
        if (!ov) return;
        if (on && color) ov.style.background = color;
        ov.style.opacity = on ? '0.85' : '0';
    },

    // Select a fake or real light signal for the next event.
    nextLightUp() {
        if (!this.gameActive) return;
        if (this.currentCycle >= this.cycles) { this.finish(); return; }
        window.clearGameFeedback();

        const doFake = this.fakeEnabled && Math.random() < this.fakeChance;
        if (doFake) {
            this.startFake();
        } else {
            this.startRealQuadrant();
        }
    },

    startFake() {
        this.isFakeActive = true;
        this.phase = 'idle'; // Do not measure the idle phase.
        const key = this.randomQuadrant();
        this.fakeQuadrant = key;
        this.setOverlay(key, true, '#f4a261'); // Use orange for a fake signal.

        // Remove the fake signal after fakeDurationMs. Do not penalize the player for no click.
        const id = setTimeout(() => {
            if (!this.gameActive) return;
            this.setOverlay(key, false);
            this.isFakeActive = false;
            this.fakeQuadrant = null;
            // After a fake signal, show another signal soon or show a real signal.
            const delay = 200 + Math.random() * 500;
            const id2 = setTimeout(() => {
                if (!this.gameActive) return;
                // Use fakeRepeatChance to select another fake signal or a real signal.
                if (this.fakeEnabled && Math.random() < this.fakeRepeatChance && Math.random() < this.fakeChance) {
                    this.startFake();
                } else {
                    this.startRealQuadrant();
                }
            }, delay);
            this.timeoutIds.push(id2);
        }, this.fakeDurationMs);
        this.timeoutIds.push(id);
    },

    startRealQuadrant() {
        this.phase = 'idle';
        this.isFakeActive = false;
        this.activeQuadrant = this.randomQuadrant();
        const key = this.activeQuadrant;
        this.setOverlay(key, true, '#2ec4b6'); // Use teal for a real signal.
        const overlay = document.getElementById(`qt-ov-${key}`);

        requestAnimationFrame(() => {
            if (!this.gameActive || !overlay || !overlay.isConnected || this.activeQuadrant !== key) return;
            this.quadLitTime = performance.now();
            this.phase = 'quadrant';
        });
    },

    handleQuadrantClick(clicked) {
        // Record an error when the player clicks during a fake signal.
        if (this.isFakeActive) {
            if (clicked === this.fakeQuadrant) {
                this.errors++;
                window.showGameFeedback({
                    type: 'error',
                    message: 'False signal',
                    duration: 420,
                    pulseTarget: '#qt-area'
                });
                this.flashError(clicked);
            }
            return;
        }

        // Process the click only during the quadrant phase.
        if (this.phase !== 'quadrant' || !this.activeQuadrant) return;

        if (clicked === this.activeQuadrant) {
            // Record the reaction time for the correct quadrant.
            // Remove its highlight and show a target inside it.
            const rt = Math.round(performance.now() - this.quadLitTime);
            this.quadRTs.push(rt);
            this.setOverlay(this.activeQuadrant, false);
            this.spawnTargetInQuadrant(this.activeQuadrant);
        } else {
            // Record an error for a wrong quadrant. Continue to wait for the correct quadrant.
            this.errors++;
            window.showGameFeedback({
                type: 'error',
                message: 'Wrong quadrant',
                duration: 420,
                pulseTarget: '#qt-area'
            });
            this.flashError(clicked);
        }
    },

    spawnTargetInQuadrant(key) {
        this.phase = 'idle';
        this.targetHoverTime = null;
        const area = document.getElementById('qt-area');
        if (!area) return;

        const W = area.clientWidth, H = area.clientHeight;
        const halfW = W / 2, halfH = H / 2;
        const size = this.targetSize;
        // Calculate the quadrant origin.
        const ox = (key === 'UR' || key === 'LR') ? halfW : 0;
        const oy = (key === 'LL' || key === 'LR') ? halfH : 0;
        // Keep the complete target inside the quadrant.
        const x = ox + Math.random() * Math.max(1, halfW - size);
        const y = oy + Math.random() * Math.max(1, halfH - size);

        const target = document.createElement('div');
        target.id = 'qt-target';
        target.style.cssText = `
            position:absolute; left:${x}px; top:${y}px;
            width:${size}px; height:${size}px; border-radius:50%;
            background:#2ec4b6; cursor:pointer; z-index:7;
            box-shadow:0 0 6px rgba(46,196,182,0.6);
        `;
        target.addEventListener('pointerenter', (event) => {
            if (event.pointerType === 'touch') return;
            if (this.phase === 'target' && this.targetHoverTime === null) {
                this.targetHoverTime = performance.now();
            }
        });
        window.onPrimaryPointerDown(target, (e) => {
            e.stopPropagation();
            this.handleTargetClick();
        });
        area.appendChild(target);
        requestAnimationFrame(() => {
            if (!this.gameActive || !target.isConnected || this.activeQuadrant !== key) return;
            this.targetSpawnTime = performance.now();
            this.phase = 'target';
        });
    },

    handleTargetClick() {
        if (this.phase !== 'target') return;
        const now = performance.now();
        const hover = this.targetHoverTime ? Math.round(this.targetHoverTime - this.targetSpawnTime) : null;
        const clickDelay = (this.targetHoverTime !== null) ? Math.round(now - this.targetHoverTime) : null;
        const total = Math.round(now - this.quadLitTime);
        this.hoverTimes.push(hover);
        this.clickDelays.push(clickDelay);
        this.totalTimes.push(total);
        window.showGameFeedback({
            type: 'success',
            message: `Cycle • ${total} ms`,
            duration: 360,
            pulseTarget: '#qt-area'
        });

        const target = document.getElementById('qt-target');
        if (target) target.remove();

        this.currentCycle++;
        const idx = document.getElementById('qt-idx');
        if (idx) idx.textContent = Math.min(this.currentCycle + 1, this.cycles);

        this.phase = 'idle';
        this.activeQuadrant = null;

        if (this.currentCycle >= this.cycles) {
            const id = setTimeout(() => this.finish(), 150);
            this.timeoutIds.push(id);
        } else {
            // Use a short pause before the next light signal.
            const id = setTimeout(() => this.nextLightUp(), 250 + Math.random() * 350);
            this.timeoutIds.push(id);
        }
    },

    flashError(key) {
        const ov = document.getElementById(`qt-ov-${key}`);
        if (!ov) return;
        const prevBg = ov.style.background;
        const prevOp = ov.style.opacity;
        ov.style.background = '#e63946';
        ov.style.opacity = '0.7';
        const id = setTimeout(() => {
            // Restore the overlay state after the feedback flash.
            // Use teal for an active real signal and orange for an active fake signal. Hide other overlays.
            if (this.phase === 'quadrant' && this.activeQuadrant === key) {
                ov.style.background = '#2ec4b6';
                ov.style.opacity = '0.85';
            } else if (this.isFakeActive && this.fakeQuadrant === key) {
                ov.style.background = '#f4a261';
                ov.style.opacity = '0.85';
            } else {
                ov.style.background = prevBg || '#2ec4b6';
                ov.style.opacity = '0';
            }
        }, 250);
        this.timeoutIds.push(id);
    },

    finish() {
        this.gameActive = false;
        const avg = (arr) => {
            const valid = arr.filter(v => Number.isFinite(v));
            return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
        };
        const avgQuad = avg(this.quadRTs);
        const avgHover = avg(this.hoverTimes);
        const avgClick = avg(this.clickDelays);
        const avgTotal = avg(this.totalTimes);

        const results = {
            cycles: this.cycles,
            avgTotal,
            avgQuadRT: avgQuad,
            avgHover: avgHover,
            avgClick: avgClick,
            errors: this.errors,
            quadRTs: this.quadRTs,
            hoverTimes: this.hoverTimes,
            clickDelays: this.clickDelays,
            totalTimes: this.totalTimes,
            official: this.isOfficial,
            _customOverlay: true
        };

        this.showResultsOverlay(results);
        this.endCallback(results);

        const historyEntry = {
            date: new Date().toLocaleString(),
            cycles: this.cycles,
            targetSize: this.targetSize,
            fakeEnabled: this.fakeEnabled,
            fakeChance: this.fakeChance,
            avgTotal,
            avgQuadRT: avgQuad,
            avgHover: avgHover,
            avgClick: avgClick,
            errors: this.errors,
            official: this.isOfficial
        };
        window.appendHistory('quadrantTargets_history', historyEntry, {
            config: h => ({
                official: !!h.official,
                cycles: h.cycles,
                targetSize: h.official ? 10 : (Number.isFinite(h.targetSize) ? h.targetSize : null),
                fakeEnabled: h.official ? true : (typeof h.fakeEnabled === 'boolean' ? h.fakeEnabled : null),
                fakeChance: h.official ? 0.3 : (Number.isFinite(h.fakeChance) ? h.fakeChance : null)
            }),
            label: h => {
                const targetSize = h.official ? 10 : h.targetSize;
                const fakeEnabled = h.official ? true : h.fakeEnabled;
                const fakeChance = h.official ? 0.3 : h.fakeChance;
                const sizeLabel = Number.isFinite(targetSize) ? `${targetSize}px` : 'legacy target size';
                const fakeLabel = typeof fakeEnabled === 'boolean'
                    ? `fakes ${fakeEnabled ? `on (${Number.isFinite(fakeChance) ? fakeChance : '?'})` : 'off'}`
                    : 'legacy fake setting';
                return `${h.official ? '★ Official' : 'Custom'} • ${h.cycles} cycles • ${sizeLabel} • ${fakeLabel}`;
            },
            metrics: {
                avgTotal: h => Number.isFinite(h.avgTotal) ? h.avgTotal : null,
                avgQuadRT: h => Number.isFinite(h.avgQuadRT) ? h.avgQuadRT : null,
                avgHover: h => Number.isFinite(h.avgHover) ? h.avgHover : null,
                avgClick: h => Number.isFinite(h.avgClick) ? h.avgClick : null,
                errors: h => Number.isFinite(h.errors) ? h.errors : null
            }
        });
    },

    showResultsOverlay(results) {
        const container = document.getElementById('game-container');
        const formatMs = value => Number.isFinite(value) ? `${value} ms` : '-';
        const rows = results.totalTimes.map((total, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${formatMs(total)}</td>
                <td>${formatMs(results.quadRTs[index])}</td>
                <td>${formatMs(results.hoverTimes[index])}</td>
                <td>${formatMs(results.clickDelays[index])}</td>
            </tr>
        `).join('');

        container.innerHTML = window.renderResultScreen({
            drillName: 'Quadrant + Target',
            official: results.official,
            primary: {
                label: 'Average full-cycle time',
                value: formatMs(results.avgTotal),
                hint: 'Real quadrant appearance to target click',
                color: '#2ec4b6'
            },
            metrics: [
                { label: 'Avg quadrant reaction', value: formatMs(results.avgQuadRT) },
                { label: 'Avg target hover', value: formatMs(results.avgHover) },
                { label: 'Avg click delay', value: formatMs(results.avgClick) },
                { label: 'Errors', value: results.errors, tone: results.errors ? 'warning' : 'success' },
                { label: 'Cycles', value: results.cycles }
            ],
            breakdown: {
                title: 'Cycle breakdown',
                headers: ['Cycle', 'Total', 'Quadrant RT', 'Target hover', 'Click delay'],
                rows,
                note: 'Total is measured end to end and can include the short transition between stages.'
            },
            restartAction: 'window.quadrantTargets.restartGame()',
            backAction: 'returnToMenu()'
        });
    },

    restartGame() {
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        this.gameActive = false;
        this.startGame();
    },

    showHistory() {
        const history = window.readStoredJSON('quadrantTargets_history', []);
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');

        if (!history.length) {
            container.innerHTML = window.renderEmptyHistory({
                drillName: 'Quadrant + Target',
                backAction: 'window.quadrantTargets.showInstruction()'
            });
            return;
        }

        const archive = history.find(h => h && h._compacted === true);
        const recent = history.filter(h => h && typeof h === 'object' && h._compacted !== true);
        const archivedCount = archive ? Number(archive.sessionCount) || 0 : 0;
        const compactedRow = window.renderCompactedHistoryRow(archive, 8, group => {
            const total = window.getCompactedMetric(group, 'avgTotal');
            const quadrant = window.getCompactedMetric(group, 'avgQuadRT');
            const hover = window.getCompactedMetric(group, 'avgHover');
            const click = window.getCompactedMetric(group, 'avgClick');
            const errors = window.getCompactedMetric(group, 'errors');
            return `<div class="compacted-history-group">
                <strong>${window.escapeHTML(group.label)}</strong><br>
                ${group.sessionCount} runs • total ${total ? Math.round(total.average) + ' ms' : '-'} •
                quadrant ${quadrant ? Math.round(quadrant.average) + ' ms' : '-'} •
                hover ${hover ? Math.round(hover.average) + ' ms' : '-'} • click ${click ? Math.round(click.average) + ' ms' : '-'} •
                ${errors ? errors.average.toFixed(1) : '0'} errors/run
            </div>`;
        });

        const rows = recent.slice().reverse().map(h => `
            <tr>
                <td>${h.date}</td>
                <td>${h.official ? '★ Official' : '-'}</td>
                <td>${h.cycles}</td>
                <td>${Number.isFinite(h.avgTotal) ? h.avgTotal + ' ms' : '-'}</td>
                <td>${h.avgQuadRT !== null ? h.avgQuadRT + ' ms' : '-'}</td>
                <td>${h.avgHover !== null ? h.avgHover + ' ms' : '-'}</td>
                <td>${h.avgClick !== null ? h.avgClick + ' ms' : '-'}</td>
                <td>${h.errors}</td>
            </tr>
        `).join('');

        container.innerHTML = window.renderHistoryScreen({
            drillName: 'Quadrant + Target',
            headers: ['Date', 'Mode', 'Cycles', 'Avg Total', 'Quad RT', 'Hover', 'Click', 'Errors'],
            rows,
            compactedRow,
            recentCount: recent.length,
            archivedCount,
            backAction: 'window.quadrantTargets.showInstruction()'
        });
    },

    showPopupMessage(text) {
        const panel = document.getElementById('settings-panel');
        const msg = document.createElement('div');
        msg.textContent = text;
        msg.style.cssText = `
            background:#2ec4b6; color:#002; padding:6px 10px;
            border-radius:6px; margin-top:8px; font-size:0.9em;
        `;
        panel.appendChild(msg);
        setTimeout(() => msg.remove(), 1500);
    },

    returnToMenu() {
        this.gameActive = false;
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        this.phase = 'idle';

        const container = document.getElementById('game-container');
        container.innerHTML = '';
        container.classList.add('hidden');

        returnToMenu();
    }
};
