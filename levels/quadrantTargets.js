window.quadrantTargets = {
    // settings (overridden by saved)
    cycles: 10,                 // number of real quadrant+target cycles (5..50)
    targetSize: 25,             // px diameter of the spawned target
    fakeEnabled: false,         // enable fake light ups
    fakeChance: 0.3,            // chance a light up event is fake
    fakeRepeatChance: 0.5,      // after a fake, chance another light up follows quickly
    fakeDurationMs: 500,        // how long a fake stays lit
    isOfficial: false,
    OFFICIAL: { cycles: 25, targetSize: 10, fakeEnabled: true, fakeChance: 0.3 },
    officialLabel: "Official: 25 cycles, 10px target, fakes on (0.3)",

    // runtime state
    currentCycle: 0,
    quadRTs: [],                // ms: light up -> quadrant click (per cycle)
    hoverTimes: [],             // ms: target spawn -> first hover (per cycle)
    clickDelays: [],            // ms: hover -> target click (per cycle)
    errors: 0,                  // wrong/fake quadrant clicks
    activeQuadrant: null,       // currently lit real quadrant key, or null
    isFakeActive: false,        // a fake light up is currently showing
    phase: 'idle',              // 'idle' | 'quadrant' | 'target'
    quadLitTime: 0,
    targetSpawnTime: 0,
    targetHoverTime: null,
    endCallback: null,
    gameActive: false,
    timeoutIds: [],

    init(endCallback) {
        const saved = JSON.parse(localStorage.getItem('quadrantTargets_settings') || '{}');
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
        const sizeOpts = [25, 20, 15, 10, 30].sort((a,b)=>b-a)
            .map(s => `<option value="${s}" ${this.targetSize === s ? 'selected' : ''}>${s} px</option>`).join('');
        panel.innerHTML = `
            <label>Cycles:
                <input type="number" id="qt-cycles" min="5" max="50" value="${this.cycles}">
            </label><br><br>
            <label>Target size:
                <select id="qt-size">${sizeOpts}</select>
            </label><br><br>
            <label>
                <input type="checkbox" id="qt-fake" ${this.fakeEnabled ? 'checked' : ''}>
                Enable fake light-ups
            </label><br><br>
            <label>Fake chance:
                <input type="number" id="qt-fake-chance" min="0" max="1" step="0.05" value="${this.fakeChance}">
            </label><br><br>
            <button style="border:1px solid #0A0A23;" onclick="window.quadrantTargets.saveSettings()">Save Settings</button>
            <button style="margin-left:6px;border:1px solid #0A0A23;" onclick="window.quadrantTargets.showHistory()">View History</button>
        `;
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
        container.innerHTML = `
            <div style="text-align:center;max-width:620px;margin:auto;">
                <h2>Quadrant + Target</h2>
                <p>
                    A quadrant <strong>lights up</strong> - click it.<br>
                    Then a <strong>target</strong> appears inside that quadrant - click it too.<br>
                    Then the next quadrant lights up, and so on.<br>
                    ${this.fakeEnabled ? 'Some light-ups are <strong style="color:#f4a261;">orange (fake)</strong>: they vanish on their own - don\'t click them! Only click <strong style="color:#2ec4b6;">teal</strong> ones.<br>' : ''}
                    Measures quadrant reaction, target hover, and click time. ${this.cycles} cycles total.
                </p>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button onclick="window.quadrantTargets.isOfficial=false;window.quadrantTargets.startGame()">Start</button>
                    <button onclick="window.quadrantTargets.startOfficial()">Start Official</button>
                    <button onclick="window.quadrantTargets.returnToMenu()">Back to Menu</button>
                </div>
                <div style="margin-top:8px; font-size:0.82em; opacity:0.75;">${this.officialLabel}</div>
            </div>
        `;
    },

    // load the fixed official preset (bypasses saved settings) and start.
    startOfficial() {
        this.isOfficial = true;
        this.cycles = this.OFFICIAL.cycles;
        this.targetSize = this.OFFICIAL.targetSize;
        this.fakeEnabled = this.OFFICIAL.fakeEnabled;
        this.fakeChance = this.OFFICIAL.fakeChance;
        this.startGame();
    },

    startGame() {
        this.currentCycle = 0;
        this.quadRTs = [];
        this.hoverTimes = [];
        this.clickDelays = [];
        this.errors = 0;
        this.activeQuadrant = null;
        this.isFakeActive = false;
        this.phase = 'idle';
        this.targetHoverTime = null;
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        this.gameActive = true;

        const container = document.getElementById('game-container');
        container.innerHTML = `
            <button id="back-btn" style="position:absolute; top:10px; left:10px;">← Back</button>
            <div style="text-align:center; margin-top:40px;">
                <h3>Cycle <span id="qt-idx">1</span> / ${this.cycles}</h3>
                <div id="qt-area" style="
                    position:relative; width:60vw; aspect-ratio:16/9;
                    background:#6c757d; border-radius:8px; overflow:hidden; margin:auto;
                "></div>
                <div style="margin-top:10px; opacity:0.8; font-size:0.9em;">
                    Click the lit quadrant, then click the target that appears inside it.
                </div>
            </div>
        `;
        document.getElementById('back-btn').onclick = () => this.returnToMenu();

        const area = document.getElementById('qt-area');
        this.setupArena(area);

        window.show321(area, 500).then(() => {
            if (!this.gameActive) return;
            this.nextLightUp();
        });
    },

    setupArena(area) {
        // crosshair
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

        // highlight overlays (behind the clickable surfaces)
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

        // clickable quadrants
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
            Q.addEventListener('mousedown', (e) => {
                if (!this.gameActive) return;
                this.handleQuadrantClick(e.currentTarget.dataset.quadrant);
            });
            area.appendChild(Q);
        });

        // center dot
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

    // decide the next event: either a fake light up or a real one.
    nextLightUp() {
        if (!this.gameActive) return;
        if (this.currentCycle >= this.cycles) { this.finish(); return; }

        const doFake = this.fakeEnabled && Math.random() < this.fakeChance;
        if (doFake) {
            this.startFake();
        } else {
            this.startRealQuadrant();
        }
    },

    startFake() {
        this.isFakeActive = true;
        this.phase = 'idle'; // not a measured phase
        const key = this.randomQuadrant();
        this.fakeQuadrant = key;
        this.setOverlay(key, true, '#f4a261'); // fake = orange (go/don't go)

        // fake vanishes on its own after fakeDurationMs (no penalty for ignoring)
        const id = setTimeout(() => {
            if (!this.gameActive) return;
            this.setOverlay(key, false);
            this.isFakeActive = false;
            this.fakeQuadrant = null;
            // after a fake, maybe another light up soon, else a real one
            const delay = 200 + Math.random() * 500;
            const id2 = setTimeout(() => {
                if (!this.gameActive) return;
                // chance to chain another fake, otherwise go for real
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
        this.phase = 'quadrant';
        this.isFakeActive = false;
        this.activeQuadrant = this.randomQuadrant();
        this.setOverlay(this.activeQuadrant, true, '#2ec4b6'); // real = teal
        this.quadLitTime = performance.now();
    },

    handleQuadrantClick(clicked) {
        // clicking during a fake light up = error
        if (this.isFakeActive) {
            if (clicked === this.fakeQuadrant) {
                this.errors++;
                this.flashError(clicked);
            }
            return;
        }

        // only meaningful during the quadrant phase
        if (this.phase !== 'quadrant' || !this.activeQuadrant) return;

        if (clicked === this.activeQuadrant) {
            // correct quadrant: record RT, turn off highlight, spawn target inside it
            const rt = Math.round(performance.now() - this.quadLitTime);
            this.quadRTs.push(rt);
            this.setOverlay(this.activeQuadrant, false);
            this.spawnTargetInQuadrant(this.activeQuadrant);
        } else {
            // wrong quadrant: error, keep waiting on the correct one
            this.errors++;
            this.flashError(clicked);
        }
    },

    spawnTargetInQuadrant(key) {
        this.phase = 'target';
        this.targetHoverTime = null;
        const area = document.getElementById('qt-area');
        if (!area) return;

        const W = area.clientWidth, H = area.clientHeight;
        const halfW = W / 2, halfH = H / 2;
        const size = this.targetSize;
        // quadrant origin
        const ox = (key === 'UR' || key === 'LR') ? halfW : 0;
        const oy = (key === 'LL' || key === 'LR') ? halfH : 0;
        // keep target fully inside the quadrant
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
        target.addEventListener('mouseenter', () => {
            if (this.targetHoverTime === null) this.targetHoverTime = performance.now();
        });
        target.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.handleTargetClick();
        });
        area.appendChild(target);
        this.targetSpawnTime = performance.now();
    },

    handleTargetClick() {
        if (this.phase !== 'target') return;
        const now = performance.now();
        const hover = this.targetHoverTime ? Math.round(this.targetHoverTime - this.targetSpawnTime) : null;
        const clickDelay = (this.targetHoverTime !== null) ? Math.round(now - this.targetHoverTime) : null;
        this.hoverTimes.push(hover);
        this.clickDelays.push(clickDelay);

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
            // brief pause then next light-up
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
            // restore: if this is a still active real quadrant keep it teal,
            // a still active fake keep it orange, otherwise hide it
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

        const results = {
            cycles: this.cycles,
            avgQuadRT: avgQuad,
            avgHover: avgHover,
            avgClick: avgClick,
            errors: this.errors,
            quadRTs: this.quadRTs,
            official: this.isOfficial,
            _customOverlay: true
        };

        this.showResultsOverlay(results);
        this.endCallback(results);

        const history = JSON.parse(localStorage.getItem('quadrantTargets_history') || '[]');
        history.push({
            date: new Date().toLocaleString(),
            cycles: this.cycles,
            avgQuadRT: avgQuad,
            avgHover: avgHover,
            avgClick: avgClick,
            errors: this.errors,
            official: this.isOfficial
        });
        localStorage.setItem('quadrantTargets_history', JSON.stringify(history));
    },

    showResultsOverlay(results) {
        const container = document.getElementById('game-container');

        container.innerHTML = `
            <div style="text-align:center;color:#e0e1dd; max-width:560px; margin:auto;">
                <h2>Quadrant + Target${results.official ? ' <span style="color:#f4d35e;">★ Official</span>' : ''}</h2>
                <table style="margin:10px auto;border-collapse:collapse;color:white;">
                    <tr><td style="text-align:left;">Cycles</td>
                        <td style="text-align:right;padding-left:24px;">${results.cycles}</td></tr>
                    <tr><td style="text-align:left;">Avg quadrant reaction</td>
                        <td style="text-align:right;padding-left:24px;">${results.avgQuadRT !== null ? results.avgQuadRT + ' ms' : '-'}</td></tr>
                    <tr><td style="text-align:left;">Avg target hover</td>
                        <td style="text-align:right;padding-left:24px;">${results.avgHover !== null ? results.avgHover + ' ms' : '-'}</td></tr>
                    <tr><td style="text-align:left;">Avg target click delay</td>
                        <td style="text-align:right;padding-left:24px;">${results.avgClick !== null ? results.avgClick + ' ms' : '-'}</td></tr>
                    <tr><td style="text-align:left;">Errors</td>
                        <td style="text-align:right;padding-left:24px;">${results.errors}</td></tr>
                </table>
                <div style="margin-top:16px; display:flex; gap:10px; justify-content:center;">
                    <button onclick="window.quadrantTargets.restartGame()">Restart</button>
                    <button onclick="returnToMenu()">Back to Menu</button>
                </div>
            </div>
        `;
    },

    restartGame() {
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        this.gameActive = false;
        this.startGame();
    },

    showHistory() {
        const history = JSON.parse(localStorage.getItem('quadrantTargets_history') || '[]');
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');

        if (!history.length) {
            container.innerHTML = `
                <div style="text-align:center; margin-top:20px;">
                    <h3>No history found</h3>
                    <button onclick="window.quadrantTargets.showInstruction()">Back</button>
                </div>
            `;
            return;
        }

        const rows = history.slice().reverse().map(h => `
            <tr>
                <td>${h.date}</td>
                <td>${h.official ? '★ Official' : '-'}</td>
                <td>${h.cycles}</td>
                <td>${h.avgQuadRT !== null ? h.avgQuadRT + ' ms' : '-'}</td>
                <td>${h.avgHover !== null ? h.avgHover + ' ms' : '-'}</td>
                <td>${h.avgClick !== null ? h.avgClick + ' ms' : '-'}</td>
                <td>${h.errors}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div style="text-align:center; max-width:820px; margin:auto;">
                <h2>Quadrant + Target - History</h2>
                <div style="max-height:60vh; overflow-y:auto;">
                    <table class="results-table">
                        <tr><th>Date</th><th>Mode</th><th>Cycles</th><th>Quad RT</th><th>Hover</th><th>Click</th><th>Errors</th></tr>
                        ${rows}
                    </table>
                </div>
                <div style="margin-top:14px;">
                    <button onclick="window.quadrantTargets.showInstruction()">Back</button>
                </div>
            </div>
        `;
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
