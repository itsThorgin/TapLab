window.stroop = {
    // Define settings. Saved settings can replace these values.
    trials: 20,             // Set the number of trials from 5 to 50.
    incongruentBias: 0.75,  // Set the probability that the word and ink color differ.
    isOfficial: false,
    OFFICIAL: { trials: 25, incongruentBias: 0.75 },
    officialLabel: "Official: 25 trials, 75% incongruent",

    // Palette of colors. Use name for word text and hex for ink and swatch colors.
    palette: [
        { name: 'RED',    hex: '#e63946' },
        { name: 'GREEN',  hex: '#2ec4b6' },
        { name: 'BLUE',   hex: '#4d9de0' },
        { name: 'YELLOW', hex: '#f4d35e' },
        { name: 'ORANGE', hex: '#f4a261' },
        { name: 'PURPLE', hex: '#9b5de5' },
    ],

    // Store the runtime state.
    currentTrial: 0,
    times: [],              // Store milliseconds for correct trials. Use null for wrong trials.
    correctFlags: [],       // Store the correct state for each trial.
    congruentFlags: [],     // Store whether the word matches the ink for each trial.
    inkIndex: null,         // Store the palette index of the current ink color.
    wordIndex: null,        // Store the palette index of the current word.
    trialStart: 0,
    acceptingInput: false,
    endCallback: null,
    gameActive: false,
    timeoutIds: [],

    init(endCallback) {
        const saved = window.readStoredJSON('stroop_settings', {});
        this.trials = (saved.trials >= 5 && saved.trials <= 50) ? saved.trials : 20;
        this.incongruentBias = Number.isFinite(saved.incongruentBias) ? saved.incongruentBias : 0.75;

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
                    id: 'stroop-trials',
                    label: 'Trials',
                    note: 'Color-word decisions in one run',
                    min: 5,
                    max: 50,
                    value: this.trials
                },
                {
                    type: 'number',
                    id: 'stroop-bias',
                    label: 'Incongruent chance',
                    note: 'Probability from 0 to 1 that word and ink conflict',
                    min: 0,
                    max: 1,
                    step: 0.05,
                    value: this.incongruentBias
                }
            ],
            saveAction: 'window.stroop.saveSettings()',
            historyAction: 'window.stroop.showHistory()'
        });
    },

    saveSettings() {
        const trials = parseInt(document.getElementById('stroop-trials').value);
        const bias = parseFloat(document.getElementById('stroop-bias').value);
        this.trials = Math.min(50, Math.max(5, trials || 20));
        this.incongruentBias = Math.min(1, Math.max(0, Number.isFinite(bias) ? bias : 0.75));
        localStorage.setItem('stroop_settings', JSON.stringify({
            trials: this.trials,
            incongruentBias: this.incongruentBias
        }));
        this.showPopupMessage("Settings saved.");
        this.showInstruction();
    },

    showInstruction() {
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');
        container.innerHTML = window.renderInstructionScreen({
            drillName: 'Stroop Test',
            summary: 'Measure selective attention and how quickly you resolve conflicting visual information.',
            steps: [
                'A color word appears in a colored ink.',
                'Click the swatch that matches the ink color, not the word.',
                'The swatches reshuffle, so identify the color before locating your response.'
            ],
            setup: [
                { label: 'Trials', value: this.trials },
                { label: 'Incongruent', value: `${Math.round(this.incongruentBias * 100)}% chance` },
                { label: 'Measures', value: 'Speed + accuracy' }
            ],
            note: 'Incongruent trials create interference by making the word meaning disagree with its ink color.',
            officialLabel: this.officialLabel,
            startAction: 'window.stroop.isOfficial=false;window.stroop.startGame()',
            officialAction: 'window.stroop.startOfficial()',
            backAction: 'window.stroop.returnToMenu()'
        });
    },

    // Apply the fixed official preset. Do not use saved settings.
    startOfficial() {
        this.isOfficial = true;
        this.trials = this.OFFICIAL.trials;
        this.incongruentBias = this.OFFICIAL.incongruentBias;
        this.startGame();
    },

    startGame() {
        window.lockSettingsForRun();
        this.currentTrial = 0;
        this.times = [];
        this.correctFlags = [];
        this.congruentFlags = [];
        this.acceptingInput = false;
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        this.gameActive = true;

        const container = document.getElementById('game-container');
        container.innerHTML = window.renderGameScreen({
            drillName: 'Stroop Test',
            mode: this.isOfficial ? 'Official' : 'Custom',
            progressLabel: 'Trial',
            progressCurrent: 1,
            progressTotal: this.trials,
            progressId: 'stroop-idx',
            stageHTML: `
                <div class="stroop-game-stage">
                    <div id="stroop-word-area" class="stroop-word-area">
                        <span id="stroop-word"></span>
                    </div>
                    <div id="stroop-swatches" class="stroop-swatches"></div>
                </div>
            `,
            hint: 'Respond to the ink color, not the word meaning.',
            backAction: 'window.stroop.returnToMenu()'
        });

        this.renderSwatches();

        const area = document.getElementById('stroop-word-area');
        window.show321(area, 500).then(() => {
            if (!this.gameActive) return;
            this.nextTrial();
        });
    },

    renderSwatches() {
        const wrap = document.getElementById('stroop-swatches');
        if (!wrap) return;
        wrap.innerHTML = '';
        // Change the display order so the player cannot memorize positions.
        // Keep the original palette index on each button for scoring.
        const order = this.palette.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        order.forEach(paletteIndex => {
            const c = this.palette[paletteIndex];
            const sw = document.createElement('button');
            sw.className = 'stroop-swatch';
            sw.style.cssText = `
                width:72px; height:72px; border-radius:12px; margin:0;
                background:${c.hex}; border:2px solid rgba(255,255,255,0.15);
                cursor:pointer; transition:transform 0.08s;
            `;
            sw.setAttribute('aria-label', `${c.name} color swatch`);
            sw.tabIndex = -1;
            window.onPrimaryPointerDown(sw, () => {
                this.handleAnswer(paletteIndex);
            });
            wrap.appendChild(sw);
        });
    },

    nextTrial() {
        if (!this.gameActive) return;
        if (this.currentTrial >= this.trials) { this.finish(); return; }
        window.clearGameFeedback();
        this.acceptingInput = false;
        const trialIndex = this.currentTrial;

        const n = this.palette.length;
        // Select the ink color.
        this.inkIndex = Math.floor(Math.random() * n);

        // Select whether the word and ink color match.
        const incongruent = Math.random() < this.incongruentBias;
        if (incongruent) {
            // Select a color word that differs from the ink color.
            let w;
            do { w = Math.floor(Math.random() * n); } while (w === this.inkIndex);
            this.wordIndex = w;
        } else {
            this.wordIndex = this.inkIndex;
        }
        this.congruentFlags[this.currentTrial] = !incongruent;

        // Display the word.
        const wordEl = document.getElementById('stroop-word');
        const idxEl = document.getElementById('stroop-idx');
        if (idxEl) idxEl.textContent = this.currentTrial + 1;
        if (wordEl) {
            wordEl.textContent = this.palette[this.wordIndex].name;
            wordEl.style.color = this.palette[this.inkIndex].hex;
        }

        requestAnimationFrame(() => {
            if (!this.gameActive || this.currentTrial !== trialIndex || !wordEl || !wordEl.isConnected) return;
            this.trialStart = performance.now();
            this.acceptingInput = true;
        });
    },

    handleAnswer(swatchIndex) {
        if (!this.gameActive || !this.acceptingInput) return;
        this.acceptingInput = false;

        const rt = Math.round(performance.now() - this.trialStart);
        const correct = (swatchIndex === this.inkIndex);
        this.correctFlags[this.currentTrial] = correct;
        this.times[this.currentTrial] = correct ? rt : null;

        // Show visual feedback in the word area.
        this.flashFeedback(correct);

        // Move the swatches after a correct answer so the player cannot memorize positions.
        if (correct) this.renderSwatches();

        this.currentTrial++;
        const delay = correct ? 250 : 500; // Show feedback longer after a mistake.
        const id = setTimeout(() => {
            if (this.currentTrial >= this.trials) this.finish();
            else this.nextTrial();
        }, delay);
        this.timeoutIds.push(id);
    },

    flashFeedback(correct) {
        const area = document.getElementById('stroop-word-area');
        if (!area) return;
        window.showGameFeedback({
            type: correct ? 'success' : 'error',
            message: correct ? 'Correct' : 'Incorrect',
            duration: correct ? 220 : 420,
            pulseTarget: area
        });
    },

    finish() {
        this.gameActive = false;
        const correctTimes = this.times.filter(t => Number.isFinite(t));
        const avg = correctTimes.length ? Math.round(correctTimes.reduce((a, b) => a + b, 0) / correctTimes.length) : null;
        const correctCount = this.correctFlags.filter(Boolean).length;
        const accuracy = this.trials ? Math.round((correctCount / this.trials) * 100) : 0;

        // Calculate Stroop interference from correct trials.
        // Subtract the average matching trial time from the average different trial time.
        const congTimes = [], incongTimes = [];
        this.times.forEach((t, i) => {
            if (!Number.isFinite(t)) return;
            if (this.congruentFlags[i]) congTimes.push(t); else incongTimes.push(t);
        });
        const avgCong = congTimes.length ? Math.round(congTimes.reduce((a, b) => a + b, 0) / congTimes.length) : null;
        const avgIncong = incongTimes.length ? Math.round(incongTimes.reduce((a, b) => a + b, 0) / incongTimes.length) : null;
        const interference = (avgCong !== null && avgIncong !== null) ? (avgIncong - avgCong) : null;

        const results = {
            trials: this.trials,
            average: avg,
            accuracy,
            avgCongruent: avgCong,
            avgIncongruent: avgIncong,
            interference,
            times: this.times,
            correctFlags: this.correctFlags,
            congruentFlags: this.congruentFlags,
            official: this.isOfficial,
            _customOverlay: true
        };

        this.showResultsOverlay(results);
        this.endCallback(results);

        const historyEntry = {
            date: new Date().toLocaleString(),
            trials: this.trials,
            incongruentBias: this.incongruentBias,
            average: avg,
            accuracy,
            interference,
            official: this.isOfficial
        };
        window.appendHistory('stroop_history', historyEntry, {
            config: h => ({
                official: !!h.official,
                trials: h.trials,
                incongruentBias: h.official ? 0.75 : (Number.isFinite(h.incongruentBias) ? h.incongruentBias : null)
            }),
            label: h => {
                const bias = h.official ? 0.75 : h.incongruentBias;
                const biasLabel = Number.isFinite(bias) ? `${Math.round(bias * 100)}% incongruent` : 'legacy incongruent setting';
                return `${h.official ? '★ Official' : 'Custom'} • ${h.trials} trials • ${biasLabel}`;
            },
            metrics: {
                average: h => Number.isFinite(h.average) ? h.average : null,
                accuracy: h => Number.isFinite(h.accuracy) ? h.accuracy : null,
                interference: h => Number.isFinite(h.interference) ? h.interference : null
            }
        });
    },

    // Interpret the interference score with reference ranges.
    // Use 50 to 200 milliseconds as the typical range for healthy adults.
    interferenceBand(ms) {
        if (ms === null || ms === undefined) return { text: "-", color: "#e0e1dd" };
        if (ms < 0)    return { text: `${ms} ms - unusual (faster on incongruent; likely noise or low trial count)`, color: "#ffd166" };
        if (ms < 50)   return { text: `${ms} ms - minimal interference (below the typical 50-200 ms)`, color: "#8bc34a" };
        if (ms <= 200) return { text: `${ms} ms - typical range (50-200 ms for healthy adults)`, color: "#2ec4b6" };
        return { text: `${ms} ms - elevated (above the typical 50-200 ms)`, color: "#ff9800" };
    },

    showResultsOverlay(results) {
        const container = document.getElementById('game-container');
        const interf = this.interferenceBand(results.interference);
        const formatMs = value => Number.isFinite(value) ? `${value} ms` : '-';
        let interpretationTitle = 'Insufficient data';
        if (results.interference !== null) {
            if (results.interference < 0) interpretationTitle = 'Unusual result';
            else if (results.interference < 50) interpretationTitle = 'Minimal interference';
            else if (results.interference <= 200) interpretationTitle = 'Typical range';
            else interpretationTitle = 'Elevated interference';
        }
        const rows = results.times.map((time, index) => {
            const correct = !!results.correctFlags[index];
            return `<tr>
                <td>${index + 1}</td>
                <td>${results.congruentFlags[index] ? 'Congruent' : 'Incongruent'}</td>
                <td>${formatMs(time)}</td>
                <td><span class="result-status ${correct ? 'result-status-success' : 'result-status-danger'}">${correct ? 'Correct' : 'Wrong'}</span></td>
            </tr>`;
        }).join('');

        container.innerHTML = window.renderResultScreen({
            drillName: 'Stroop Test',
            official: results.official,
            primary: {
                label: 'Stroop interference',
                value: formatMs(results.interference),
                hint: 'Incongruent average minus congruent average',
                color: interf.color
            },
            metrics: [
                { label: 'Accuracy', value: `${results.accuracy}%`, tone: results.accuracy >= 90 ? 'success' : 'warning' },
                { label: 'Avg reaction', value: formatMs(results.average) },
                { label: 'Avg congruent', value: formatMs(results.avgCongruent) },
                { label: 'Avg incongruent', value: formatMs(results.avgIncongruent) },
                { label: 'Trials', value: results.trials }
            ],
            assessment: {
                eyebrow: 'Reference interpretation',
                title: interpretationTitle,
                description: interf.text,
                color: interf.color,
                footer: 'This is a reference interpretation, not a competitive rank.'
            },
            breakdown: {
                title: 'Trial breakdown',
                headers: ['Trial', 'Type', 'Reaction', 'Result'],
                rows,
                note: 'Reaction time is retained for correct answers only.'
            },
            restartAction: 'window.stroop.restartGame()',
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
        const history = window.readStoredJSON('stroop_history', []);
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');

        if (!history.length) {
            container.innerHTML = window.renderEmptyHistory({
                drillName: 'Stroop Test',
                backAction: 'window.stroop.showInstruction()'
            });
            return;
        }

        const archive = history.find(h => h && h._compacted === true);
        const recent = history.filter(h => h && typeof h === 'object' && h._compacted !== true);
        const archivedCount = archive ? Number(archive.sessionCount) || 0 : 0;
        const compactedRow = window.renderCompactedHistoryRow(archive, 6, group => {
            const reaction = window.getCompactedMetric(group, 'average');
            const accuracy = window.getCompactedMetric(group, 'accuracy');
            const interference = window.getCompactedMetric(group, 'interference');
            return `<div class="compacted-history-group">
                <strong>${window.escapeHTML(group.label)}</strong><br>
                ${group.sessionCount} runs • ${reaction ? Math.round(reaction.average) + ' ms average / ' + Math.round(reaction.min) + ' ms best' : '-'} •
                ${accuracy ? accuracy.average.toFixed(1) + '% accuracy' : '-'} •
                ${interference ? Math.round(interference.average) + ' ms interference' : '-'}
            </div>`;
        });

        const rows = recent.slice().reverse().map(h => `
            <tr>
                <td>${h.date}</td>
                <td>${h.official ? '★ Official' : '-'}</td>
                <td>${h.trials}</td>
                <td>${h.average !== null ? h.average + ' ms' : '-'}</td>
                <td>${h.accuracy}%</td>
                <td>${h.interference !== null ? h.interference + ' ms' : '-'}</td>
            </tr>
        `).join('');

        container.innerHTML = window.renderHistoryScreen({
            drillName: 'Stroop Test',
            headers: ['Date', 'Mode', 'Trials', 'Avg RT', 'Accuracy', 'Interference'],
            rows,
            compactedRow,
            recentCount: recent.length,
            archivedCount,
            backAction: 'window.stroop.showInstruction()'
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
        this.acceptingInput = false;
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];

        const container = document.getElementById('game-container');
        container.innerHTML = '';
        container.classList.add('hidden');

        returnToMenu();
    }
};
