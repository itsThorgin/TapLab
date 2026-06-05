window.schulte = {
    // settings (overridden by saved)
    gridSize: 5,            // N for an N x N grid (3..9)
    shuffleMode: false,     // reshuffle remaining numbers after each correct pick
    fixationDot: false,     // show a center fixation dot
    isOfficial: false,
    OFFICIAL: { gridSize: 5, shuffleMode: true, fixationDot: true },
    officialLabel: "Official: 5x5, shuffle on, fixation dot on",

    // runtime state
    cells: [],              // array of {value, picked} indexed by position 0..N*N-1
    nextNumber: 1,          // the number the player must click next
    total: 0,               // N*N
    startTime: 0,
    splitTimes: [],         // ms taken for each number (index 0 => number 1)
    lastPickTime: 0,
    errors: 0,
    endCallback: null,
    gameActive: false,
    timeoutIds: [],

    init(endCallback) {
        const saved = JSON.parse(localStorage.getItem('schulte_settings') || '{}');
        this.gridSize = (saved.gridSize >= 3 && saved.gridSize <= 9) ? saved.gridSize : 5;
        this.shuffleMode = !!saved.shuffleMode;
        this.fixationDot = !!saved.fixationDot;

        this.endCallback = endCallback;
        this.gameActive = false;
        this.timeoutIds = [];
        this.isOfficial = false;

        this.renderSettingsPanel();
        this.showInstruction();
    },

    renderSettingsPanel() {
        const panel = document.getElementById('level-specific-settings');
        let opts = '';
        for (let n = 3; n <= 9; n++) {
            opts += `<option value="${n}" ${this.gridSize === n ? 'selected' : ''}>${n} x ${n}</option>`;
        }
        panel.innerHTML = `
            <label>Grid size:
                <select id="schulte-grid">${opts}</select>
            </label><br><br>
            <label>
                <input type="checkbox" id="schulte-shuffle" ${this.shuffleMode ? 'checked' : ''}>
                Shuffle remaining after each pick
            </label><br><br>
            <label>
                <input type="checkbox" id="schulte-fixation" ${this.fixationDot ? 'checked' : ''}>
                Show center fixation dot
            </label><br><br>
            <button style="border:1px solid #0A0A23;" onclick="window.schulte.saveSettings()">Save Settings</button>
            <button style="margin-left:6px;border:1px solid #0A0A23;" onclick="window.schulte.showHistory()">View History</button>
        `;
    },

    saveSettings() {
        const gridSize = parseInt(document.getElementById('schulte-grid').value);
        const shuffleMode = document.getElementById('schulte-shuffle').checked;
        const fixationDot = document.getElementById('schulte-fixation').checked;

        this.gridSize = (gridSize >= 3 && gridSize <= 9) ? gridSize : 5;
        this.shuffleMode = shuffleMode;
        this.fixationDot = fixationDot;

        localStorage.setItem('schulte_settings', JSON.stringify({
            gridSize: this.gridSize,
            shuffleMode: this.shuffleMode,
            fixationDot: this.fixationDot
        }));
        this.showPopupMessage("Settings saved.");
        this.showInstruction();
    },

    showInstruction() {
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');
        container.innerHTML = `
            <div style="text-align:center;max-width:600px;margin:auto;">
                <h2>Schulte Table</h2>
                <p>
                    Find and click the numbers in order, starting at <strong>1</strong>.<br>
                    ${this.fixationDot ? 'Keep your eyes on the <strong>center dot</strong> and find numbers with your peripheral vision.<br>' : ''}
                    ${this.shuffleMode ? 'Shuffle mode is <strong>on</strong>: remaining numbers reshuffle after each correct pick.<br>' : ''}
                    Wrong clicks flash red and count as errors. Your time is measured from the first number.<br>
                    Grid: ${this.gridSize} x ${this.gridSize} (${this.gridSize * this.gridSize} numbers).
                </p>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button onclick="window.schulte.isOfficial=false;window.schulte.startGame()">Start</button>
                    <button onclick="window.schulte.startOfficial()">Start Official</button>
                    <button onclick="window.schulte.returnToMenu()">Back to Menu</button>
                </div>
                <div style="margin-top:8px; font-size:0.82em; opacity:0.75;">${this.officialLabel}</div>
            </div>
        `;
    },

    // load the fixed official preset (bypasses saved settings) and start
    startOfficial() {
        this.isOfficial = true;
        this.gridSize = this.OFFICIAL.gridSize;
        this.shuffleMode = this.OFFICIAL.shuffleMode;
        this.fixationDot = this.OFFICIAL.fixationDot;
        this.startGame();
    },

    // fisher-yates shuffle of an array (in place)
    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    // returns a new array that is a DERANGEMENT of values
    // a random reordering where no element ends up at the index it started at
    derange(values) {
        const n = values.length;
        if (n < 2) return values.slice();

        // try random shuffles until we get one with no fixed point
        // the expected number of attempts is small (under 3 i think, but capped just to be safe)
        for (let attempt = 0; attempt < 50; attempt++) {
            const shuffled = this.shuffleArray(values.slice());
            let ok = true;
            for (let i = 0; i < n; i++) {
                if (shuffled[i] === values[i]) { ok = false; break; }
            }
            if (ok) return shuffled;
        }

        // fallback (unlikely to be needed)
        // a single rotation guarantees no element stays in place for n >= 2
        const rotated = values.slice();
        const last = rotated.pop();
        rotated.unshift(last);
        return rotated;
    },

    startGame() {
        this.total = this.gridSize * this.gridSize;
        this.nextNumber = 1;
        this.splitTimes = [];
        this.errors = 0;
        this.gameActive = true;
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];

        // build cells: numbers 1->total placed in random positions
        const values = this.shuffleArray(Array.from({ length: this.total }, (_, i) => i + 1));
        this.cells = values.map(v => ({ value: v, picked: false }));

        this.renderArena();

        // countdown, then start the timer
        const container = document.getElementById('game-container');
        window.show321(container, 500).then(() => {
            if (!this.gameActive) return;
            this.startTime = performance.now();
            this.lastPickTime = this.startTime;
        });
    },

    renderArena() {
        const container = document.getElementById('game-container');
        const N = this.gridSize;
        // board sized to fit the viewport while staying square
        container.innerHTML = `
            <button id="back-btn" style="position:absolute; top:10px; left:10px;">← Back</button>
            <div style="text-align:center;">
                <h3 id="schulte-status">Find: 1</h3>
                <div id="schulte-board" style="
                    position:relative;
                    display:grid;
                    grid-template-columns:repeat(${N}, 1fr);
                    grid-template-rows:repeat(${N}, 1fr);
                    gap:4px;
                    width:min(80vh, 80vw);
                    height:min(80vh, 80vw);
                    margin:10px auto 0 auto;
                "></div>
            </div>
        `;
        document.getElementById('back-btn').onclick = () => this.returnToMenu();

        const board = document.getElementById('schulte-board');
        this.renderCells(board);

        if (this.fixationDot) {
            const dot = document.createElement('div');
            // ring size scales with the cell so it stays proportional to thenumbers (which are larger on smaller grids)
            // Cell ≈ board / N
            // board is min(80vh,80vw)
            // Ring ≈ 55% of a cell
            const ringSize = `calc(min(80vh, 80vw) / ${this.gridSize} * 0.55)`;
            // hollow ring as fixation point, so the number underneath stays readable
            dot.style.cssText = `
                position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
                width:${ringSize}; height:${ringSize};
                border-radius:50%;
                background:transparent; border:3px solid #f4a261;
                box-shadow:0 0 8px rgba(0,0,0,0.6), inset 0 0 5px rgba(0,0,0,0.4);
                pointer-events:none; z-index:5;
            `;
            board.appendChild(dot);
        }
    },

    // (re)draw all cell buttons based on current this.cells
    renderCells(board) {
        // remove existing cell buttons (keep the fixation dot,circle if present)
        board.querySelectorAll('.schulte-cell').forEach(el => el.remove());

        // font size scales with grid: smaller grids get bigger numbers
        const fontSize = Math.max(0.9, 2.6 - this.gridSize * 0.18);

        this.cells.forEach((cell, index) => {
            const btn = document.createElement('button');
            btn.className = cell.picked ? 'schulte-cell picked' : 'schulte-cell';
            btn.textContent = cell.value;
            btn.style.cssText = `
                width:100%; height:100%; margin:0; padding:0;
                font-size:${fontSize}em; font-weight:bold;
                border-radius:6px; cursor:pointer;
                background:${cell.picked ? '#2ec4b6' : '#1b263b'};
                color:${cell.picked ? '#002' : '#e0e1dd'};
                opacity:${cell.picked ? 0.85 : 1};
                transition:background 0.15s, color 0.15s;
            `;
            btn.onmousedown = (e) => {
                e.preventDefault();
                this.handleCellClick(index);
            };
            board.appendChild(btn);
        });
    },

    handleCellClick(index) {
        if (!this.gameActive) return;
        // timer not started yet (during countdown) -> ignore
        if (!this.startTime) return;

        const cell = this.cells[index];
        if (cell.picked) return; // already picked, ignore

        if (cell.value === this.nextNumber) {
            // correct pick
            const now = performance.now();
            this.splitTimes.push(Math.round(now - this.lastPickTime));
            this.lastPickTime = now;

            cell.picked = true;
            this.nextNumber++;

            const board = document.getElementById('schulte-board');

            if (this.nextNumber > this.total) {
                // done - re render to show the final cell highlighted, then finish
                this.renderCells(board);
                this.gameActive = false;
                const id = setTimeout(() => this.finish(), 250);
                this.timeoutIds.push(id);
                return;
            }

            // update status
            const status = document.getElementById('schulte-status');
            if (status) status.textContent = `Find: ${this.nextNumber}`;

            // shuffle mode: rearrange the remaining (unpicked) numbers among the unpicked cells 
            // picked cells stay in place and are highlighted
            // remaining numbers land on a different cell than they were on
            if (this.shuffleMode) {
                const unpickedIndices = [];
                const unpickedValues = [];
                this.cells.forEach((c, i) => {
                    if (!c.picked) {
                        unpickedIndices.push(i);
                        unpickedValues.push(c.value);
                    }
                });

                const deranged = this.derange(unpickedValues);
                unpickedIndices.forEach((cellIdx, k) => {
                    this.cells[cellIdx].value = deranged[k];
                });
            }
            this.renderCells(board);
        } else {
            // wrong pick - flash red, count error, no time penalty
            this.errors++;
            const board = document.getElementById('schulte-board');
            const btns = board.querySelectorAll('.schulte-cell');
            const btn = btns[index];
            if (btn) {
                // uses a class (with !important) so the flash beats the :hover rule
                btn.classList.add('error');
                const id = setTimeout(() => {
                    if (btn) btn.classList.remove('error');
                }, 250);
                this.timeoutIds.push(id);
            }
        }
    },

    finish() {
        this.gameActive = false;
        const totalTime = Math.round(performance.now() - this.startTime);
        const perCell = totalTime / this.total;
        const category = this.getCategoryForPerCell(perCell);

        const results = {
            gridSize: this.gridSize,
            shuffleMode: this.shuffleMode,
            totalTimeMs: totalTime,
            perCellMs: Math.round(perCell),
            errors: this.errors,
            bracket: category.label,
            splitTimes: this.splitTimes,
            official: this.isOfficial,
            _customOverlay: true
        };

        this.showResultsOverlay(results);
        this.endCallback(results);

        // history
        const history = JSON.parse(localStorage.getItem('schulte_history') || '[]');
        history.push({
            date: new Date().toLocaleString(),
            gridSize: this.gridSize,
            shuffleMode: this.shuffleMode,
            totalTimeMs: totalTime,
            perCellMs: Math.round(perCell),
            errors: this.errors,
            bracket: category.label,
            official: this.isOfficial
        });
        localStorage.setItem('schulte_history', JSON.stringify(history));
    },

    // tiers on time-per-cell so they're fair across grid sizes
    // grounded in documented 5x5 click norms: exceptional <15s, good ~20-30s, typical ~30-45s
    // per cell (÷25): <0.6s exceptional, ~0.8 good, ~1.1-1.4 typical
    getCategoryForPerCell(ms) {
        if (ms <= 600)  return { label: "Phenomenal", color: "#00e5ff", range: "≤ 0.60 s/cell - exceptional (≈15s on 5x5)" };
        if (ms <= 800)  return { label: "Elite",      color: "#4caf50", range: "0.60–0.80 s/cell - very fast (≈20s on 5x5)" };
        if (ms <= 1100) return { label: "Strong",     color: "#8bc34a", range: "0.80–1.10 s/cell - strong (≈27s on 5x5)" };
        if (ms <= 1400) return { label: "Good",       color: "#ffeb3b", range: "1.10–1.40 s/cell - above average (≈35s on 5x5)" };
        if (ms <= 1800) return { label: "Average",    color: "#ff9800", range: "1.40–1.80 s/cell - typical (≈45s on 5x5)" };
        return { label: "Developing", color: "#f44336", range: "> 1.80 s/cell - keep practicing" };
    },

    formatTime(ms) {
        const s = ms / 1000;
        return s.toFixed(2) + ' s';
    },

    showResultsOverlay(results) {
        const container = document.getElementById('game-container');
        const category = this.getCategoryForPerCell(results.perCellMs);

        const benchmarks = [
            { label: "Phenomenal", range: "≤ 0.60 s/cell", color: "#00e5ff" },
            { label: "Elite",      range: "0.60–0.80 s/cell", color: "#4caf50" },
            { label: "Strong",     range: "0.80–1.10 s/cell", color: "#8bc34a" },
            { label: "Good",       range: "1.10–1.40 s/cell", color: "#ffeb3b" },
            { label: "Average",    range: "1.40–1.80 s/cell", color: "#ff9800" },
            { label: "Developing", range: "> 1.80 s/cell", color: "#f44336" }
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

        // slowest few numbers (helpful feedback)
        let slowestHTML = '';
        if (results.splitTimes && results.splitTimes.length) {
            const indexed = results.splitTimes.map((t, i) => ({ num: i + 1, t }));
            indexed.sort((a, b) => b.t - a.t);
            const top = indexed.slice(0, Math.min(3, indexed.length));
            slowestHTML = `
                <div style="margin-top:10px; font-size:0.9em; opacity:0.9;">
                    Slowest finds: ${top.map(x => `#${x.num} (${(x.t/1000).toFixed(2)}s)`).join(', ')}
                </div>
            `;
        }

        container.innerHTML = `
            <div style="text-align:center;color:#e0e1dd;">
                <h2>Schulte Table${results.official ? ' <span style="color:#f4d35e;">★ Official</span>' : ''}</h2>
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
                        <table style="margin:0 auto;border-collapse:collapse;color:white;">
                            <tr><td style="text-align:left;">Grid</td>
                                <td style="text-align:right;padding-left:20px;">${results.gridSize} x ${results.gridSize}</td></tr>
                            <tr><td style="text-align:left;">Shuffle</td>
                                <td style="text-align:right;padding-left:20px;">${results.shuffleMode ? 'On' : 'Off'}</td></tr>
                            <tr><td style="text-align:left;">Total time</td>
                                <td style="text-align:right;padding-left:20px;">${this.formatTime(results.totalTimeMs)}</td></tr>
                            <tr><td style="text-align:left;">Per cell</td>
                                <td style="text-align:right;padding-left:20px;">${(results.perCellMs/1000).toFixed(2)} s</td></tr>
                            <tr><td style="text-align:left;">Errors</td>
                                <td style="text-align:right;padding-left:20px;">${results.errors}</td></tr>
                        </table>
                        ${slowestHTML}
                    </div>
                </div>
                <div style="margin-top:16px; display:flex; gap:10px; justify-content:center;">
                    <button onclick="window.schulte.restartGame()">Restart</button>
                    <button onclick="returnToMenu()">Back to Menu</button>
                </div>
            </div>
        `;
    },

    restartGame() {
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        this.startTime = 0;
        this.gameActive = false;
        this.startGame();
    },

    showHistory() {
        const history = JSON.parse(localStorage.getItem('schulte_history') || '[]');
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');

        if (!history.length) {
            container.innerHTML = `
                <div style="text-align:center; margin-top:20px;">
                    <h3>No history found</h3>
                    <button onclick="window.schulte.showInstruction()">Back</button>
                </div>
            `;
            return;
        }

        const rows = history.slice().reverse().map(h => `
            <tr>
                <td>${h.date}</td>
                <td>${h.official ? '★ Official' : '-'}</td>
                <td>${h.gridSize} x ${h.gridSize}</td>
                <td>${h.shuffleMode ? 'On' : 'Off'}</td>
                <td>${(h.totalTimeMs/1000).toFixed(2)} s</td>
                <td>${(h.perCellMs/1000).toFixed(2)} s</td>
                <td>${h.errors}</td>
                <td>${h.bracket}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div style="text-align:center; max-width:760px; margin:auto;">
                <h2>Schulte - History</h2>
                <div style="max-height:60vh; overflow-y:auto;">
                    <table class="results-table">
                        <tr><th>Date</th><th>Mode</th><th>Grid</th><th>Shuffle</th><th>Time</th><th>Per cell</th><th>Errors</th><th>Tier</th></tr>
                        ${rows}
                    </table>
                </div>
                <div style="margin-top:14px;">
                    <button onclick="window.schulte.showInstruction()">Back</button>
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
        this.startTime = 0;

        const container = document.getElementById('game-container');
        container.innerHTML = '';
        container.classList.add('hidden');

        returnToMenu();
    }
};
