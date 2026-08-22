window.schulte = {
    // Define settings. Saved settings can replace these values.
    gridSize: 5,            // Set the number of rows and columns from 3 to 9.
    shuffleMode: false,     // Move the remaining numbers after each correct selection.
    fixationDot: false,     // Show a fixation point at the center.
    isOfficial: false,
    OFFICIAL: { gridSize: 5, shuffleMode: true, fixationDot: true },
    officialLabel: "Official: 5x5, shuffle on, fixation dot on",

    // Store the runtime state.
    cells: [],              // Store {value, picked} for each grid position.
    nextNumber: 1,          // Store the next number that the player must select.
    total: 0,               // Store the total number of cells.
    startTime: 0,
    splitTimes: [],         // Store the time for each number in milliseconds.
    lastPickTime: 0,
    errors: 0,
    endCallback: null,
    gameActive: false,
    timeoutIds: [],

    init(endCallback) {
        const saved = window.readStoredJSON('schulte_settings', {});
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
        panel.innerHTML = window.renderLevelSettings({
            fields: [
                {
                    type: 'select',
                    id: 'schulte-grid',
                    label: 'Grid size',
                    note: 'Choose from 3 × 3 through 9 × 9',
                    options: Array.from({ length: 7 }, (_, index) => index + 3).map(size => ({
                        value: size,
                        label: `${size} × ${size}`,
                        selected: this.gridSize === size
                    }))
                },
                {
                    type: 'checkbox',
                    id: 'schulte-shuffle',
                    label: 'Shuffle remaining numbers',
                    note: 'Reshuffle after every correct pick',
                    checked: this.shuffleMode
                },
                {
                    type: 'checkbox',
                    id: 'schulte-fixation',
                    label: 'Center fixation dot',
                    note: 'Supports peripheral search practice',
                    checked: this.fixationDot
                }
            ],
            saveAction: 'window.schulte.saveSettings()',
            historyAction: 'window.schulte.showHistory()'
        });
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
        container.innerHTML = window.renderInstructionScreen({
            drillName: 'Schulte Table',
            summary: 'Train visual search speed, scanning discipline, and peripheral awareness.',
            steps: [
                'Find and click every number in ascending order, beginning with 1.',
                this.fixationDot
                    ? 'Keep your gaze near the center dot and locate numbers with your peripheral vision.'
                    : 'Scan the full grid while keeping your search path controlled.',
                this.shuffleMode
                    ? 'After each correct pick, the remaining numbers reshuffle into new positions.'
                    : 'The grid stays fixed; wrong clicks flash red and count as errors.'
            ],
            setup: [
                { label: 'Grid', value: `${this.gridSize} × ${this.gridSize}` },
                { label: 'Numbers', value: this.gridSize * this.gridSize },
                { label: 'Shuffle', value: this.shuffleMode ? 'On' : 'Off' },
                { label: 'Fixation', value: this.fixationDot ? 'On' : 'Off' }
            ],
            note: 'Your timer begins when you click 1. Wrong clicks add errors but do not stop the run.',
            officialLabel: this.officialLabel,
            startAction: 'window.schulte.isOfficial=false;window.schulte.startGame()',
            officialAction: 'window.schulte.startOfficial()',
            backAction: 'window.schulte.returnToMenu()'
        });
    },

    // Apply the fixed official preset. Do not use saved settings.
    startOfficial() {
        this.isOfficial = true;
        this.gridSize = this.OFFICIAL.gridSize;
        this.shuffleMode = this.OFFICIAL.shuffleMode;
        this.fixationDot = this.OFFICIAL.fixationDot;
        this.startGame();
    },

    // Shuffle the array in place with the Fisher-Yates algorithm.
    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    // Return a new array with values in different positions.
    // Do not keep a value at its original index.
    derange(values) {
        const n = values.length;
        if (n < 2) return values.slice();

        // Try random shuffles until no value remains at its original index.
        // Stop after 50 attempts.
        for (let attempt = 0; attempt < 50; attempt++) {
            const shuffled = this.shuffleArray(values.slice());
            let ok = true;
            for (let i = 0; i < n; i++) {
                if (shuffled[i] === values[i]) { ok = false; break; }
            }
            if (ok) return shuffled;
        }

        // Use one rotation if the random attempts do not succeed.
        // For two or more values, this rotation moves every value.
        const rotated = values.slice();
        const last = rotated.pop();
        rotated.unshift(last);
        return rotated;
    },

    startGame() {
        window.lockSettingsForRun();
        this.total = this.gridSize * this.gridSize;
        this.nextNumber = 1;
        this.splitTimes = [];
        this.errors = 0;
        this.gameActive = true;
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];

        // Put the numbers from 1 through total in random cells.
        const values = this.shuffleArray(Array.from({ length: this.total }, (_, i) => i + 1));
        this.cells = values.map(v => ({ value: v, picked: false }));

        this.renderArena();

        // Show the countdown. Then start the timer.
        const board = document.getElementById('schulte-board');
        window.show321(board, 500).then(() => {
            if (!this.gameActive) return;
            this.startTime = performance.now();
            this.lastPickTime = this.startTime;
        });
    },

    renderArena() {
        const container = document.getElementById('game-container');
        const N = this.gridSize;
        // Fit a square board inside the viewport.
        container.innerHTML = window.renderGameScreen({
            drillName: 'Schulte Table',
            mode: this.isOfficial ? 'Official' : 'Custom',
            progressLabel: 'Find',
            progressCurrent: 1,
            progressTotal: this.total,
            progressId: 'schulte-status',
            stageHTML: `<div id="schulte-board" class="game-arena game-arena-square schulte-game-board" style="grid-template-columns:repeat(${N}, 1fr);grid-template-rows:repeat(${N}, 1fr);"></div>`,
            hint: this.fixationDot
                ? 'Keep your gaze near the orange ring and select the numbers in order.'
                : 'Select every number in ascending order as quickly and accurately as possible.',
            backAction: 'window.schulte.returnToMenu()',
            screenClass: 'game-screen-square'
        });

        const board = document.getElementById('schulte-board');
        this.renderCells(board);

        if (this.fixationDot) {
            const dot = document.createElement('div');
            // Keep the ring size proportional to the displayed cell size.
            const ringSize = `${board.clientWidth / this.gridSize * 0.55}px`;
            // Use a hollow fixation ring so the number under it stays visible.
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

    // Draw all cell buttons from the current cells array.
    renderCells(board) {
        // Remove existing cell buttons. Keep the fixation ring if it is present.
        board.querySelectorAll('.schulte-cell').forEach(el => el.remove());

        // Use larger numbers in smaller grids.
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
            btn.tabIndex = -1;
            window.onPrimaryPointerDown(btn, (e) => {
                this.handleCellClick(index);
            });
            board.appendChild(btn);
        });
    },

    handleCellClick(index) {
        if (!this.gameActive) return;
        // Ignore clicks before the timer starts.
        if (!this.startTime) return;

        const cell = this.cells[index];
        if (cell.picked) return; // Ignore a cell that was already selected.

        if (cell.value === this.nextNumber) {
            // Process a correct selection.
            const now = performance.now();
            this.splitTimes.push(Math.round(now - this.lastPickTime));
            this.lastPickTime = now;

            cell.picked = true;
            this.nextNumber++;

            const board = document.getElementById('schulte-board');

            if (this.nextNumber > this.total) {
                // Draw the final selected cell. Then finish the run.
                this.renderCells(board);
                this.gameActive = false;
                const id = setTimeout(() => this.finish(), 250);
                this.timeoutIds.push(id);
                return;
            }

            // Show the next required number.
            const status = document.getElementById('schulte-status');
            if (status) status.textContent = this.nextNumber;

            // In shuffle mode, move the remaining numbers between unselected cells.
            // Keep selected cells in position and keep their highlight.
            // Move each remaining number to a different cell.
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
            // For a wrong selection, show red feedback and count an error.
            // No time penalty.
            this.errors++;
            const board = document.getElementById('schulte-board');
            window.showGameFeedback({
                type: 'error',
                message: `Find ${this.nextNumber}`,
                duration: 380,
                pulseTarget: board
            });
            const btns = board.querySelectorAll('.schulte-cell');
            const btn = btns[index];
            if (btn) {
                // The error class uses !important so its color overrides :hover.
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

        // Add the result to history.
        const historyEntry = {
            date: new Date().toLocaleString(),
            gridSize: this.gridSize,
            shuffleMode: this.shuffleMode,
            fixationDot: this.fixationDot,
            totalTimeMs: totalTime,
            perCellMs: Math.round(perCell),
            errors: this.errors,
            bracket: category.label,
            official: this.isOfficial
        };
        window.appendHistory('schulte_history', historyEntry, {
            config: h => ({
                official: !!h.official,
                gridSize: h.gridSize,
                shuffleMode: !!h.shuffleMode,
                fixationDot: h.official ? true : (typeof h.fixationDot === 'boolean' ? h.fixationDot : null)
            }),
            label: h => {
                const fixation = h.official ? true : h.fixationDot;
                const fixationLabel = typeof fixation === 'boolean' ? `fixation ${fixation ? 'on' : 'off'}` : 'legacy fixation setting';
                return `${h.official ? '★ Official' : 'Custom'} • ${h.gridSize} × ${h.gridSize} • shuffle ${h.shuffleMode ? 'on' : 'off'} • ${fixationLabel}`;
            },
            metrics: {
                totalTimeMs: h => Number.isFinite(h.totalTimeMs) ? h.totalTimeMs : null,
                perCellMs: h => Number.isFinite(h.perCellMs) ? h.perCellMs : null,
                errors: h => Number.isFinite(h.errors) ? h.errors : null
            }
        });
    },

    // Base ranks on time per cell so different grid sizes are comparable.
    // Use reference ranges for 5-by-5 grids: under 15 seconds is exceptional, 20 to 30 is good, and 30 to 45 is typical.
    // For 25 cells, these ranges are under 0.6, approximately 0.8, and approximately 1.1 to 1.4 seconds per cell.
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
        const indexed = (results.splitTimes || []).map((time, index) => ({ number: index + 1, time }));
        const slowest = indexed.slice().sort((a, b) => b.time - a.time).slice(0, Math.min(3, indexed.length));
        const slowestText = slowest.length
            ? `Slowest finds: ${slowest.map(item => `#${item.number} (${(item.time / 1000).toFixed(2)} s)`).join(', ')}`
            : '';
        const rows = indexed.map(item => `
            <tr><td>${item.number}</td><td>${(item.time / 1000).toFixed(2)} s</td></tr>
        `).join('');

        container.innerHTML = window.renderResultScreen({
            drillName: 'Schulte Table',
            official: results.official,
            primary: {
                label: 'Total completion time',
                value: this.formatTime(results.totalTimeMs),
                hint: `${results.gridSize} × ${results.gridSize} grid`,
                color: category.color
            },
            metrics: [
                { label: 'Time per cell', value: `${(results.perCellMs / 1000).toFixed(2)} s` },
                { label: 'Errors', value: results.errors, tone: results.errors ? 'warning' : 'success' },
                { label: 'Grid', value: `${results.gridSize} × ${results.gridSize}` },
                { label: 'Shuffle', value: results.shuffleMode ? 'On' : 'Off' }
            ],
            assessment: {
                eyebrow: 'Performance tier',
                title: category.label,
                description: category.range,
                color: category.color,
                benchmarks: benchmarks.map(benchmark => ({
                    ...benchmark,
                    active: benchmark.label === category.label
                })),
                footer: slowestText
            },
            breakdown: {
                title: 'Find-time breakdown',
                headers: ['Number', 'Find time'],
                rows,
                note: 'Each split measures the time since the previous correct number.'
            },
            restartAction: 'window.schulte.restartGame()',
            backAction: 'returnToMenu()'
        });
    },

    restartGame() {
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        this.startTime = 0;
        this.gameActive = false;
        this.startGame();
    },

    showHistory() {
        const history = window.readStoredJSON('schulte_history', []);
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');

        if (!history.length) {
            container.innerHTML = window.renderEmptyHistory({
                drillName: 'Schulte Table',
                backAction: 'window.schulte.showInstruction()'
            });
            return;
        }

        const archive = history.find(h => h && h._compacted === true);
        const recent = history.filter(h => h && typeof h === 'object' && h._compacted !== true);
        const archivedCount = archive ? Number(archive.sessionCount) || 0 : 0;
        const compactedRow = window.renderCompactedHistoryRow(archive, 8, group => {
            const total = window.getCompactedMetric(group, 'totalTimeMs');
            const perCell = window.getCompactedMetric(group, 'perCellMs');
            const errors = window.getCompactedMetric(group, 'errors');
            return `<div class="compacted-history-group">
                <strong>${window.escapeHTML(group.label)}</strong><br>
                ${group.sessionCount} runs • ${total ? (total.average / 1000).toFixed(2) + ' s average' : '-'} •
                ${perCell ? (perCell.average / 1000).toFixed(2) + ' s/cell average / ' + (perCell.min / 1000).toFixed(2) + ' s best' : '-'} •
                ${errors ? errors.average.toFixed(1) : '0'} errors/run
            </div>`;
        });

        const rows = recent.slice().reverse().map(h => `
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

        container.innerHTML = window.renderHistoryScreen({
            drillName: 'Schulte Table',
            headers: ['Date', 'Mode', 'Grid', 'Shuffle', 'Time', 'Per cell', 'Errors', 'Tier'],
            rows,
            compactedRow,
            recentCount: recent.length,
            archivedCount,
            backAction: 'window.schulte.showInstruction()'
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
        this.startTime = 0;

        const container = document.getElementById('game-container');
        container.innerHTML = '';
        container.classList.add('hidden');

        returnToMenu();
    }
};
