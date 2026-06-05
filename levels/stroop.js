window.stroop = {
    // settings (overridden by saved)
    trials: 20,             // number of trials (5..50)
    incongruentBias: 0.75,  // probability a trial is incongruent (word != ink)
    isOfficial: false,
    OFFICIAL: { trials: 25, incongruentBias: 0.75 },
    officialLabel: "Official: 25 trials, 75% incongruent",

    // palette: 6 colors. name = the word text; hex = the ink/swatch color.
    palette: [
        { name: 'RED',    hex: '#e63946' },
        { name: 'GREEN',  hex: '#2ec4b6' },
        { name: 'BLUE',   hex: '#4d9de0' },
        { name: 'YELLOW', hex: '#f4d35e' },
        { name: 'ORANGE', hex: '#f4a261' },
        { name: 'PURPLE', hex: '#9b5de5' },
    ],

    // runtime state
    currentTrial: 0,
    times: [],              // ms per trial (only correct trials get a time; wrong = null)
    correctFlags: [],       // bool per trial
    congruentFlags: [],     // bool per trial (was word==ink)
    inkIndex: null,         // index into palette for current ink color
    wordIndex: null,        // index into palette for current word
    trialStart: 0,
    acceptingInput: false,
    endCallback: null,
    gameActive: false,
    timeoutIds: [],

    init(endCallback) {
        const saved = JSON.parse(localStorage.getItem('stroop_settings') || '{}');
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
        panel.innerHTML = `
            <label>Trials:
                <input type="number" id="stroop-trials" min="5" max="50" value="${this.trials}">
            </label><br><br>
            <label>Incongruent chance:
                <input type="number" id="stroop-bias" min="0" max="1" step="0.05" value="${this.incongruentBias}">
            </label><br><br>
            <button style="border:1px solid #0A0A23;" onclick="window.stroop.saveSettings()">Save Settings</button>
            <button style="margin-left:6px;border:1px solid #0A0A23;" onclick="window.stroop.showHistory()">View History</button>
        `;
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
        container.innerHTML = `
            <div style="text-align:center;max-width:620px;margin:auto;">
                <h2>Stroop Test</h2>
                <p>
                    A color <strong>word</strong> appears, printed in some <strong>ink color</strong>.<br>
                    Click the swatch matching the <strong>ink color</strong> - <em>not</em> what the word says.<br>
                    E.g. the word <span style="color:#4d9de0;font-weight:bold;">GREEN</span> printed in blue &rarr; click the <strong>blue</strong> swatch.<br>
                    Measures reaction time and accuracy. ${this.trials} trials total.
                </p>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button onclick="window.stroop.isOfficial=false;window.stroop.startGame()">Start</button>
                    <button onclick="window.stroop.startOfficial()">Start Official</button>
                    <button onclick="window.stroop.returnToMenu()">Back to Menu</button>
                </div>
                <div style="margin-top:8px; font-size:0.82em; opacity:0.75;">${this.officialLabel}</div>
            </div>
        `;
    },

    // load the fixed official preset (bypasses saved settings) and start.
    startOfficial() {
        this.isOfficial = true;
        this.trials = this.OFFICIAL.trials;
        this.incongruentBias = this.OFFICIAL.incongruentBias;
        this.startGame();
    },

    startGame() {
        this.currentTrial = 0;
        this.times = [];
        this.correctFlags = [];
        this.congruentFlags = [];
        this.acceptingInput = false;
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        this.gameActive = true;

        const container = document.getElementById('game-container');
        container.innerHTML = `
            <button id="back-btn" style="position:absolute; top:10px; left:10px;">← Back</button>
            <div style="text-align:center; margin-top:30px;">
                <h3>Trial <span id="stroop-idx">1</span> / ${this.trials}</h3>
                <div id="stroop-word-area" style="
                    height:28vh; display:flex; align-items:center; justify-content:center;
                    user-select:none;
                ">
                    <span id="stroop-word" style="font-size:5em; font-weight:bold;"></span>
                </div>
                <div id="stroop-swatches" style="
                    display:flex; gap:14px; flex-wrap:wrap; justify-content:center; max-width:560px; margin:10px auto 0 auto;
                "></div>
            </div>
        `;
        document.getElementById('back-btn').onclick = () => this.returnToMenu();

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
        // display order is shuffled so position can't be memorized
        // but each button keeps its true palette index (for scoring)
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
            sw.onmousedown = (e) => {
                e.preventDefault();
                this.handleAnswer(paletteIndex);
            };
            wrap.appendChild(sw);
        });
    },

    nextTrial() {
        if (!this.gameActive) return;
        if (this.currentTrial >= this.trials) { this.finish(); return; }

        const n = this.palette.length;
        // pick the ink color
        this.inkIndex = Math.floor(Math.random() * n);

        // decide congruent or incongruent
        const incongruent = Math.random() < this.incongruentBias;
        if (incongruent) {
            // word is a different color name than the ink
            let w;
            do { w = Math.floor(Math.random() * n); } while (w === this.inkIndex);
            this.wordIndex = w;
        } else {
            this.wordIndex = this.inkIndex;
        }
        this.congruentFlags[this.currentTrial] = !incongruent;

        // render the word
        const wordEl = document.getElementById('stroop-word');
        const idxEl = document.getElementById('stroop-idx');
        if (idxEl) idxEl.textContent = this.currentTrial + 1;
        if (wordEl) {
            wordEl.textContent = this.palette[this.wordIndex].name;
            wordEl.style.color = this.palette[this.inkIndex].hex;
        }

        this.trialStart = performance.now();
        this.acceptingInput = true;
    },

    handleAnswer(swatchIndex) {
        if (!this.gameActive || !this.acceptingInput) return;
        this.acceptingInput = false;

        const rt = Math.round(performance.now() - this.trialStart);
        const correct = (swatchIndex === this.inkIndex);
        this.correctFlags[this.currentTrial] = correct;
        this.times[this.currentTrial] = correct ? rt : null;

        // visual feedback on the word area
        this.flashFeedback(correct);

        // shuffle swatch positions after a correct answer so position can't be memorized
        if (correct) this.renderSwatches();

        this.currentTrial++;
        const delay = correct ? 250 : 500; // linger a touch longer on a mistake
        const id = setTimeout(() => {
            if (this.currentTrial >= this.trials) this.finish();
            else this.nextTrial();
        }, delay);
        this.timeoutIds.push(id);
    },

    flashFeedback(correct) {
        const wordEl = document.getElementById('stroop-word');
        if (!wordEl) return;
        // brief tint behind the word: green for correct, red for wrong
        const area = document.getElementById('stroop-word-area');
        if (area) {
            area.style.transition = 'background 0.1s';
            area.style.background = correct ? 'rgba(46,196,182,0.18)' : 'rgba(230,57,70,0.22)';
            const id = setTimeout(() => { if (area) area.style.background = 'transparent'; }, 200);
            this.timeoutIds.push(id);
        }
    },

    finish() {
        this.gameActive = false;
        const correctTimes = this.times.filter(t => Number.isFinite(t));
        const avg = correctTimes.length ? Math.round(correctTimes.reduce((a, b) => a + b, 0) / correctTimes.length) : null;
        const correctCount = this.correctFlags.filter(Boolean).length;
        const accuracy = this.trials ? Math.round((correctCount / this.trials) * 100) : 0;

        // stroop interference: avg incongruent RT - avg congruent RT (correct trials only)
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
            official: this.isOfficial,
            _customOverlay: true
        };

        this.showResultsOverlay(results);
        this.endCallback(results);

        const history = JSON.parse(localStorage.getItem('stroop_history') || '[]');
        history.push({
            date: new Date().toLocaleString(),
            trials: this.trials,
            average: avg,
            accuracy,
            interference,
            official: this.isOfficial
        });
        localStorage.setItem('stroop_history', JSON.stringify(history));
    },

    // factual interpretation of the interference score
    // healthy adult interference is typically 50-200 ms (research documented)
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

        container.innerHTML = `
            <div style="text-align:center;color:#e0e1dd; max-width:560px; margin:auto;">
                <h2>Stroop Test${results.official ? ' <span style="color:#f4d35e;">★ Official</span>' : ''}</h2>

                <div style="margin:10px auto; padding:10px 14px; border-radius:10px;
                            background:rgba(255,255,255,0.05); max-width:440px;">
                    <div style="font-size:0.95em; opacity:0.85;">Stroop interference</div>
                    <div style="font-size:1.15em; font-weight:bold; color:${interf.color}; margin-top:2px;">
                        ${interf.text}
                    </div>
                    <div style="font-size:0.8em; opacity:0.7; margin-top:4px;">
                        (extra time incongruent trials cost vs congruent - the core Stroop measure)
                    </div>
                </div>

                <table style="margin:8px auto 0 auto;border-collapse:collapse;color:white;">
                    <tr><td style="text-align:left;">Trials</td>
                        <td style="text-align:right;padding-left:24px;">${results.trials}</td></tr>
                    <tr><td style="text-align:left;">Accuracy</td>
                        <td style="text-align:right;padding-left:24px;">${results.accuracy}%</td></tr>
                    <tr><td style="text-align:left;">Avg reaction</td>
                        <td style="text-align:right;padding-left:24px;">${results.average !== null ? results.average + ' ms' : '-'}</td></tr>
                    <tr><td style="text-align:left;">Avg congruent</td>
                        <td style="text-align:right;padding-left:24px;">${results.avgCongruent !== null ? results.avgCongruent + ' ms' : '-'}</td></tr>
                    <tr><td style="text-align:left;">Avg incongruent</td>
                        <td style="text-align:right;padding-left:24px;">${results.avgIncongruent !== null ? results.avgIncongruent + ' ms' : '-'}</td></tr>
                </table>

                <div style="margin-top:16px; display:flex; gap:10px; justify-content:center;">
                    <button onclick="window.stroop.restartGame()">Restart</button>
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
        const history = JSON.parse(localStorage.getItem('stroop_history') || '[]');
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');

        if (!history.length) {
            container.innerHTML = `
                <div style="text-align:center; margin-top:20px;">
                    <h3>No history found</h3>
                    <button onclick="window.stroop.showInstruction()">Back</button>
                </div>
            `;
            return;
        }

        const rows = history.slice().reverse().map(h => `
            <tr>
                <td>${h.date}</td>
                <td>${h.official ? '★ Official' : '-'}</td>
                <td>${h.trials}</td>
                <td>${h.average !== null ? h.average + ' ms' : '-'}</td>
                <td>${h.accuracy}%</td>
                <td>${h.interference !== null ? h.interference + ' ms' : '-'}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div style="text-align:center; max-width:780px; margin:auto;">
                <h2>Stroop - History</h2>
                <div style="max-height:60vh; overflow-y:auto;">
                    <table class="results-table">
                        <tr><th>Date</th><th>Mode</th><th>Trials</th><th>Avg RT</th><th>Accuracy</th><th>Interference</th></tr>
                        ${rows}
                    </table>
                </div>
                <div style="margin-top:14px;">
                    <button onclick="window.stroop.showInstruction()">Back</button>
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
        this.acceptingInput = false;
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];

        const container = document.getElementById('game-container');
        container.innerHTML = '';
        container.classList.add('hidden');

        returnToMenu();
    }
};
