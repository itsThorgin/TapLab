window.reaction = {
    rounds: 10,
    currentRound: 0,
    times: [],
    timeoutIds: [],
    clickable: false,
    endCallback: null,
    falseStartEnabled: false,
    startTime: 0,
    gameActive: false,

    init: function(endCallback) {
        const savedSettings = JSON.parse(localStorage.getItem('reaction_settings')) || {};
        this.rounds = savedSettings.rounds || 5;
        this.falseStartEnabled = savedSettings.falseStart || false;

        this.endCallback = endCallback;
        this.currentRound = 0;
        this.times = [];
        this.falseStarts = [];
        this.timeoutIds = [];
        this.gameActive = false;

        this.renderSettingsPanel();
        this.showInstruction();
    },

    renderSettingsPanel: function() {
        const panel = document.getElementById('level-specific-settings');
        panel.innerHTML = `
            <label>Rounds: 
                <input type="number" id="reaction-rounds" min="5" max="50" value="${this.rounds}">
            </label><br><br>
            <label>
                <input type="checkbox" id="reaction-false-start" ${this.falseStartEnabled ? 'checked' : ''}>
                Enable False Start Trick
            </label><br><br>
            <button style="border: 1px solid #0A0A23;" onclick="window.reaction.saveSettings()">Save Settings</button>
            <button style="margin-left:6px; border:1px solid #0A0A23;" onclick="window.reaction.showHistory()">View History</button>
        `;
    },

    startWithCountdown: function() {
        const host = document.getElementById('game-container');
        window.show321(host, 500).then(() => this.startRound());
    },

    saveSettings: function() {
        const rounds = parseInt(document.getElementById('reaction-rounds').value);
        const falseStart = document.getElementById('reaction-false-start').checked;
        localStorage.setItem('reaction_settings', JSON.stringify({ rounds, falseStart }));
        this.showPopupMessage("Settings saved.");
        this.rounds = rounds;
        this.falseStartEnabled = falseStart;
        this.showInstruction();
    },

    showInstruction: function() {
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');
        container.innerHTML = `
            <div style="text-align:center; max-width:600px; margin:auto;">
                <h2>Reaction Test</h2>
                <p>
                    Click the rectangle as soon as it turns <strong style="color:#2ec4b6;">blue-green</strong>.<br>
                    If it turns <strong style="color:orange;">orange</strong>, don't click - that's a trick color!<br>
                    ${this.rounds} rounds total.
                </p>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button onclick="window.reaction.startFirstRound()">Start</button>
                    <button onclick="window.reaction.returnToMenu()">Back to Menu</button>
                </div>
            </div>
        `;
    },

    startRound: function() {
        this.gameActive = true;
        const container = document.getElementById('game-container');
        container.innerHTML = `
            <button id="back-btn" style="position:absolute; top:10px; left:10px;">← Back</button>
            <div style="text-align:center; margin-top:40px;">
                <h3>Round ${this.currentRound + 1} of ${this.rounds}</h3>
                <div id="reaction-box"
                     style="width:60vw; aspect-ratio:16/9; background:#6c757d; border-radius:8px; cursor:pointer;"></div>
            </div>
        `;
        document.getElementById('back-btn').onclick = () => this.returnToMenu();

        const box = document.getElementById('reaction-box');
        this.clickable = false;
        box.onmousedown = () => this.handleClick();

        // schedule go signal (countdown only on first round)
        this.scheduleGoSignal(box);
    },

    // start just the first round with countdown overlay shown on the arena rectangle
    startFirstRound: function() {
        this.gameActive = true;

        // render the arena UI (same as startRound)
        const container = document.getElementById('game-container');
        container.innerHTML = `
            <button id="back-btn" style="position:absolute; top:10px; left:10px;">← Back</button>
            <div style="text-align:center; margin-top:40px;">
                <h3>Round ${this.currentRound + 1} of ${this.rounds}</h3>
                <div id="reaction-box"
                    style="width:60vw; aspect-ratio:16/9; background:#6c757d; border-radius:8px; cursor:pointer;"></div>
            </div>
        `;
        document.getElementById('back-btn').onclick = () => this.returnToMenu();

        const box = document.getElementById('reaction-box');
        this.clickable = false;
        box.onmousedown = () => this.handleClick();

        // show countdown in the arena rectangle, then schedule first go signal
        window.show321(container, 500).then(() => {
            this.scheduleGoSignal(box);
        });
    },

    // schedule a falsestart sequence or the real go signal
    scheduleGoSignal: function(box) {
        let delay = 2000 + Math.random() * 3000; // 2-5 sec
        if (this.falseStartEnabled && Math.random() < 0.3) {
            const id1 = setTimeout(() => {
                box.style.background = '#f4a261';
                const id2 = setTimeout(() => {
                    box.style.background = '#6c757d';
                    delay = 1000 + Math.random() * 2000;
                    const id3 = setTimeout(() => this.goSignal(box), delay);
                    this.timeoutIds.push(id3);
                }, 700);
                this.timeoutIds.push(id2);
            }, delay);
            this.timeoutIds.push(id1);
        } else {
            const id = setTimeout(() => this.goSignal(box), delay);
            this.timeoutIds.push(id);
        }
    },

    goSignal: function(box) {
        box.style.transition = "none";
        box.style.background = '#2ec4b6';
        // start timer only after frame renders with new color
        requestAnimationFrame(() => {
            this.startTime = performance.now();
            this.clickable = true;
        });
    },

    handleClick: function() {
        const box = document.getElementById('reaction-box');
        const currentColor = window.getComputedStyle(box).backgroundColor;

        if (!this.clickable || !this.gameActive) {
            if (this.gameActive) {
                if (this.falseStartEnabled && currentColor.includes("rgb(244, 162, 97)")) {
                    this.showTemporaryMessage("Wrong color!", "#ff4d4d");
                    // mark false start for current round
                    this.falseStarts[this.currentRound] = true;
                    // keep waiting for blue and next click
                } else {
                    this.showTemporaryMessage("Too soon!", "#ff9800");
                    this.falseStarts[this.currentRound] = true;
                
                    // "too soon" restarts round
                    this.cancelAllTimers();
                    const restartId = setTimeout(() => this.startRound(), 1000);
                    this.timeoutIds.push(restartId);
                }
            }
            return;
        }

        // Correct click
        this.falseStarts[this.currentRound] = this.falseStarts[this.currentRound] || false;
        this.clickable = false;
        const reactionTime = Math.round(performance.now() - this.startTime);
        this.times.push(reactionTime);
        this.currentRound++;

        box.style.transition = "background 0.4s";
        box.style.background = "#6c757d";

        if (this.currentRound >= this.rounds) {
            this.gameActive = false;
            const finishId = setTimeout(() => this.finish(), 400);
            this.timeoutIds.push(finishId);
        } else {
            const nextId = setTimeout(() => this.startRound(), 400);
            this.timeoutIds.push(nextId);
        }
    },

    showHistory: function() {
        const history = JSON.parse(localStorage.getItem('reaction_history') || '[]');
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');

        if (!history.length) {
            container.innerHTML = `
                <div style="text-align:center; margin-top:20px;">
                    <h3>No history found</h3>
                    <button onclick="window.reaction.returnToMenu()">Back</button>
                </div>`;
            return;
        }

        const rows = history.map((h, i) => `
            <tr>
                <td>${i+1}</td>
                <td>${h.date}</td>
                <td>${h.rounds}${h.falseStartEnabled ? " (false-start on)" : ""}</td>
                <td>${h.average} ms</td>
                <td>${h.bracket}</td>
                <td>${h.times.join(', ')}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div style="max-width:95%; margin:auto; color:#e0e1dd;">
                <h2 style="text-align:center;">Reaction Test History</h2>
                <div style="max-height:70vh; overflow-y:auto;">
                    <table class="results-table">
                        <tr>
                            <th>#</th><th>Date</th><th>Config</th><th>Average</th><th>Bracket</th><th>Times</th>
                        </tr>
                        ${rows}
                    </table>
                </div>
                <div style="text-align:center; margin-top:10px;">
                    <button onclick="window.reaction.returnToMenu()">Back</button>
                </div>
            </div>
        `;
    },

    finish: function() {
        this.gameActive = false;
        const average = Math.round(this.times.reduce((a, b) => a + b, 0) / this.times.length);
        const category = this.getCategoryForMs(average);

        const results = {
            times: this.times,
            falseStarts: this.falseStarts,
            average,
            bracket: category.label,
            _customOverlay: true
        };

        this.showResultsOverlay(results);
        this.endCallback(results);

        // history
        const history = JSON.parse(localStorage.getItem('reaction_history') || '[]');
        history.push({
            date: new Date().toLocaleString(),
            rounds: this.rounds,
            falseStartEnabled: this.falseStartEnabled,
            average,
            bracket: category.label,
            times: this.times
        });
        localStorage.setItem('reaction_history', JSON.stringify(history));
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
    
    showTemporaryMessage: function(text, color = "#ff4d4d") {
        const box = document.getElementById('reaction-box');
        if (!box) return;  // safe check

        let msg = document.createElement("div");
        msg.textContent = text;
        msg.style.cssText = `
            position:absolute;
            top:50%;left:50%;
            transform:translate(-50%,-50%);
            background:rgba(0,0,0,0.6);
            color:${color};
            padding:6px 12px;
            border-radius:6px;
            font-weight:bold;
            z-index:1000;
            font-size:1.2em;
            pointer-events:none;
            backdrop-filter:saturate(120%) blur(0.5px);
        `;
        
        box.style.position = 'relative';
        box.appendChild(msg);
        setTimeout(() => {
            msg.style.transition = "opacity 0.4s";
            msg.style.opacity = "0";
            setTimeout(() => msg.remove(), 400);
        }, 1200);
    },

    showResultsOverlay: function(results) {
        const container = document.getElementById('game-container');
        const category = this.getCategoryForMs(results.average);

        // Benchmark ranges definition
        const benchmarks = [
            { label: "On The Top", range: "≤ 130 ms", color: "#00e5ff" },
            { label: "Elite", range: "131-150 ms", color: "#4caf50" },
            { label: "High Ranked", range: "151-180 ms", color: "#8bc34a" },
            { label: "Experienced", range: "181-199 ms", color: "#ffeb3b" },
            { label: "Average", range: "200-260 ms", color: "#ff9800" },
            { label: "Below Average", range: "> 260 ms", color: "#f44336" }
        ];

        // Create benchmark HTML
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

        // Table with results
        const timesHTML = results.times.map((t, i) => {
            const failed = results.falseStarts && results.falseStarts[i];
            const timeDisplay = t !== null ? `${t} ms` : '';
            const marker = failed ? '<span style="color:orange; font-size:1.2em; vertical-align:middle; margin-left:6px;">●</span>' : '';
            return `<tr>
                        <td>Round ${i + 1}</td>
                        <td style="padding-left:20px;">
                            ${timeDisplay}${marker}
                        </td>
                    </tr>`;
        }).join("");

        // Render
        container.innerHTML = `
            <div style="text-align:center;color:#e0e1dd;">
                <h2>Reaction Test</h2>

                <div class="results-layout">
                    <!-- LEFT column -->
                    <div class="column-left">
                        ${benchmarkHTML}
                    </div>

                    <!-- vertical separator -->
                    <div class="column-separator"></div>

                    <!-- RIGHT column -->
                    <div class="column-right">
                        <div class="current-result-badge" style="background:${category.color}">
                            <strong>${category.label}</strong>
                            <small>${category.range}</small>
                        </div>

                        <table style="margin:0 auto;border-collapse:collapse;color:white;">
                            ${timesHTML}
                            <tr style="border-top:1px solid rgba(255,255,255,0.2);">
                                <th style="padding-top:8px;text-align:left;">Average</th>
                                <th style="padding-top:8px; text-align:right; padding-left:20px;">${results.average} ms</th>
                            </tr>
                        </table>
                    </div>
                </div>

                <!-- Buttons under both columns -->
                <div style="margin-top:16px; display:flex; gap:10px; justify-content:center;">
                    <button onclick="window.reaction.restartGame()">Restart</button>
                    <button onclick="returnToMenu()">Back to Menu</button>
                </div>
            </div>
        `;
    },

    restartGame: function() {
        this.cancelAllTimers();
        this.currentRound = 0;
        this.times = [];
        this.falseStarts = [];
        this.gameActive = false;
        this.startFirstRound();
    },

    getCategoryForMs: function(ms) {
        if (ms <= 130) {
          return {
            label: "On The Top",
            color: "#00e5ff",
            range: "≤ 130 ms - exceptional; ~top 0.5% (Formula 1 drivers, top esports pros. Usually not average times but best runs in controlled environment)"
          };
        }
        if (ms <= 150) {
          return {
            label: "Elite",
            color: "#4caf50",
            range: "131-150 ms - ~top 2% of players"
          };
        }
        if (ms <= 180) {
          return {
            label: "High Ranked",
            color: "#8bc34a",
            range: "151-180 ms - very strong"
          };
        }
        if (ms <= 199) {
          return {
            label: "Experienced",
            color: "#ffeb3b",
            range: "181-199 ms - above average"
          };
        }
        if (ms <= 260) {
          return {
            label: "Average",
            color: "#ff9800",
            range: "200-260 ms - typical human range"
          };
        }
        return {
          label: "Below Average",
          color: "#f44336",
          range: "> 260 ms - slower than average"
        };
    },

    returnToMenu: function() {
    // stops game logic
    this.gameActive = false;
    this.cancelAllTimers();

    // clear state
    this.currentRound = 0;
    this.times = [];
    
    // clear dom and hide container
    const container = document.getElementById('game-container');
    container.innerHTML = '';
    container.classList.add('hidden');
    
    returnToMenu();
    },

    cancelAllTimers: function() {
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
    }

};

