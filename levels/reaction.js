window.reaction = {
    rounds: 5,
    isOfficial: false,
    OFFICIAL: { rounds: 25, falseStart: true },
    officialLabel: "Official: 25 rounds, false start on",
    currentRound: 0,
    times: [],
    timeoutIds: [],
    clickable: false,
    endCallback: null,
    falseStartEnabled: false,
    startTime: 0,
    gameActive: false,

    init: function(endCallback) {
        const savedSettings = window.readStoredJSON('reaction_settings', {});
        const sr = parseInt(savedSettings.rounds);
        this.rounds = (Number.isFinite(sr) && sr >= 5 && sr <= 50) ? sr : 5;
        this.falseStartEnabled = savedSettings.falseStart || false;

        this.endCallback = endCallback;
        this.currentRound = 0;
        this.times = [];
        this.falseStarts = [];
        this.timeoutIds = [];
        this.gameActive = false;
        this.isOfficial = false;

        this.renderSettingsPanel();
        this.showInstruction();
    },

    renderSettingsPanel: function() {
        const panel = document.getElementById('level-specific-settings');
        panel.innerHTML = window.renderLevelSettings({
            fields: [
                { type: 'number', id: 'reaction-rounds', label: 'Rounds', note: 'Choose from 5 to 50', min: 5, max: 50, value: this.rounds },
                { type: 'checkbox', id: 'reaction-false-start', label: 'False Start Trick', note: 'Orange bait signals may appear', checked: this.falseStartEnabled }
            ],
            saveAction: 'window.reaction.saveSettings()',
            historyAction: 'window.reaction.showHistory()'
        });
    },

    startWithCountdown: function() {
        const host = document.getElementById('game-container');
        window.show321(host, 500).then(() => this.startRound());
    },

    saveSettings: function() {
        let rounds = parseInt(document.getElementById('reaction-rounds').value);
        rounds = (Number.isFinite(rounds)) ? Math.min(50, Math.max(5, rounds)) : 5;
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
        container.innerHTML = window.renderInstructionScreen({
            drillName: 'Reaction Test',
            summary: 'Measure the delay between a visual go signal and your click.',
            steps: [
                'Wait while the rectangle stays gray.',
                'Click immediately when it turns teal.',
                this.falseStartEnabled ? 'Ignore orange bait signals and keep waiting for teal.' : 'Complete every round as quickly and cleanly as possible.'
            ],
            setup: [
                { label: 'Rounds', value: this.rounds },
                { label: 'False start', value: this.falseStartEnabled ? 'On' : 'Off' }
            ],
            note: 'Timing begins when the teal signal is painted on screen.',
            officialLabel: this.officialLabel,
            startAction: 'window.reaction.isOfficial=false;window.reaction.startFirstRound()',
            officialAction: 'window.reaction.startOfficial()',
            backAction: 'window.reaction.returnToMenu()'
        });
    },

    // Apply the fixed official preset. Do not use saved settings.
    startOfficial: function() {
        this.isOfficial = true;
        this.rounds = this.OFFICIAL.rounds;
        this.falseStartEnabled = this.OFFICIAL.falseStart;
        this.currentRound = 0;
        this.times = [];
        this.falseStarts = [];
        this.startFirstRound();
    },

    startRound: function() {
        this.clearTemporaryMessage(); // Remove a pending message from the previous attempt.
        this.gameActive = true;
        const container = document.getElementById('game-container');
        container.innerHTML = window.renderGameScreen({
            drillName: 'Reaction Test',
            mode: this.isOfficial ? 'Official' : 'Custom',
            progressLabel: 'Round',
            progressCurrent: this.currentRound + 1,
            progressTotal: this.rounds,
            stageHTML: '<div id="reaction-box" class="game-arena game-arena-wide reaction-game-area"></div>',
            hint: 'Wait for green. Orange is a false signal.',
            backAction: 'window.reaction.returnToMenu()'
        });

        const box = document.getElementById('reaction-box');
        this.clickable = false;
        window.onPrimaryPointerDown(box, () => this.handleClick());

        // Schedule the go signal. Show the countdown only before the first round.
        this.scheduleGoSignal(box);
    },

    // Start the first round and show the countdown in the arena.
    startFirstRound: function() {
        window.lockSettingsForRun();
        this.gameActive = true;

        // Render the same arena interface that startRound uses.
        const container = document.getElementById('game-container');
        container.innerHTML = window.renderGameScreen({
            drillName: 'Reaction Test',
            mode: this.isOfficial ? 'Official' : 'Custom',
            progressLabel: 'Round',
            progressCurrent: this.currentRound + 1,
            progressTotal: this.rounds,
            stageHTML: '<div id="reaction-box" class="game-arena game-arena-wide reaction-game-area"></div>',
            hint: 'Wait for green. Orange is a false signal.',
            backAction: 'window.reaction.returnToMenu()'
        });

        const box = document.getElementById('reaction-box');
        this.clickable = false;
        window.onPrimaryPointerDown(box, () => this.handleClick());

        // Show the countdown in the arena. Then schedule the first go signal.
        window.show321(box, 500).then(() => {
            if (!this.gameActive || !box.isConnected) return;
            this.scheduleGoSignal(box);
        });
    },

    // Schedule a false start sequence or the real go signal.
    scheduleGoSignal: function(box) {
        let delay = 2000 + Math.random() * 3000; // Use a delay from 2 to 5 seconds.
        if (this.falseStartEnabled && Math.random() < 0.3) {
            const id1 = setTimeout(() => {
                box.style.background = '#f4a261';
                const id2 = setTimeout(() => {
                    box.style.background = '';
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
        this.clearTemporaryMessage(); // Prevent an old message from covering the go color.
        box.style.transition = "none";
        box.style.background = '#2ec4b6';
        // Start the timer after the browser shows the new color.
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
                    this.showTemporaryMessage("False signal", "error");
                    // Record a false start for the current round.
                    this.falseStarts[this.currentRound] = true;
                    // Wait for the blue signal and the next click.
                } else {
                    this.showTemporaryMessage("Too early", "error");
                    this.falseStarts[this.currentRound] = true;
                
                    // The "Too soon" message restarts the round.
                    this.cancelAllTimers();
                    const restartId = setTimeout(() => this.startRound(), 1000);
                    this.timeoutIds.push(restartId);
                }
            }
            return;
        }

        // Process a correct click.
        this.falseStarts[this.currentRound] = this.falseStarts[this.currentRound] || false;
        this.clickable = false;
        const reactionTime = Math.round(performance.now() - this.startTime);
        this.times.push(reactionTime);
        window.showGameFeedback({
            type: 'success',
            message: `${reactionTime} ms`,
            duration: 320,
            pulseTarget: box
        });
        this.currentRound++;

        box.style.transition = "background 0.4s";
        box.style.background = "";

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
        const history = window.readStoredJSON('reaction_history', []);
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');

        if (!history.length) {
            container.innerHTML = window.renderEmptyHistory({
                drillName: 'Reaction Test',
                backAction: 'window.reaction.returnToMenu()'
            });
            return;
        }

        const archive = history.find(h => h && h._compacted === true);
        const recent = history.filter(h => h && typeof h === 'object' && h._compacted !== true);
        const historyOffset = archive ? Number(archive.sessionCount) || 0 : 0;
        const compactedRow = window.renderCompactedHistoryRow(archive, 7, group => {
            const reaction = window.getCompactedMetric(group, 'average');
            const averageText = reaction ? `${Math.round(reaction.average)} ms average • ${Math.round(reaction.min)} ms best` : 'No timing data';
            return `<div class="compacted-history-group">
                <strong>${window.escapeHTML(group.label)}</strong><br>
                ${group.sessionCount} runs • ${averageText}
            </div>`;
        });

        const rows = recent.slice().reverse().map((h, i) => `
            <tr>
                <td>${historyOffset + recent.length - i}</td>
                <td>${h.date}</td>
                <td>${h.official ? '★ Official' : '-'}</td>
                <td>${h.rounds}${h.falseStartEnabled ? " (false start on)" : ""}</td>
                <td>${h.average} ms</td>
                <td>${h.bracket}</td>
                <td>${h.times.join(', ')}</td>
            </tr>
        `).join('');

        container.innerHTML = window.renderHistoryScreen({
            drillName: 'Reaction Test',
            headers: ['#', 'Date', 'Mode', 'Config', 'Average', 'Bracket', 'Times'],
            rows,
            compactedRow,
            recentCount: recent.length,
            archivedCount: historyOffset,
            backAction: 'window.reaction.returnToMenu()'
        });
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
            official: this.isOfficial,
            _customOverlay: true
        };

        this.showResultsOverlay(results);
        this.endCallback(results);

        // Add the result to history.
        const historyEntry = {
            date: new Date().toLocaleString(),
            rounds: this.rounds,
            falseStartEnabled: this.falseStartEnabled,
            average,
            bracket: category.label,
            official: this.isOfficial,
            times: this.times
        };
        window.appendHistory('reaction_history', historyEntry, {
            config: h => ({
                official: !!h.official,
                rounds: h.rounds,
                falseStartEnabled: !!h.falseStartEnabled
            }),
            label: h => `${h.official ? '★ Official' : 'Custom'} • ${h.rounds} rounds • false-start ${h.falseStartEnabled ? 'on' : 'off'}`,
            metrics: {
                average: h => Number.isFinite(h.average) ? h.average : null
            }
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
    
    showTemporaryMessage: function(text, type = "error") {
        window.showGameFeedback({
            type,
            message: text,
            duration: 420,
            pulseTarget: '#reaction-box'
        });
    },

    // Remove the temporary message when a new signal or round starts.
    clearTemporaryMessage: function() {
        window.clearGameFeedback();
    },

    showResultsOverlay: function(results) {
        const container = document.getElementById('game-container');
        const category = this.getCategoryForMs(results.average);
        const benchmarks = [
            { label: "On The Top", range: "≤ 130 ms", color: "#00e5ff" },
            { label: "Elite", range: "131-150 ms", color: "#4caf50" },
            { label: "High Ranked", range: "151-180 ms", color: "#8bc34a" },
            { label: "Experienced", range: "181-199 ms", color: "#ffeb3b" },
            { label: "Average", range: "200-260 ms", color: "#ff9800" },
            { label: "Below Average", range: "> 260 ms", color: "#f44336" }
        ];
        const falseStartCount = (results.falseStarts || []).filter(Boolean).length;
        const best = results.times.filter(Number.isFinite).length
            ? Math.min(...results.times.filter(Number.isFinite))
            : null;
        const timesHTML = results.times.map((t, i) => {
            const failed = results.falseStarts && results.falseStarts[i];
            return `<tr>
                <td>${i + 1}</td>
                <td>${Number.isFinite(t) ? `${t} ms` : '-'}</td>
                <td><span class="result-status ${failed ? 'result-status-warning' : 'result-status-success'}">${failed ? 'False start' : 'Clean'}</span></td>
            </tr>`;
        }).join("");

        container.innerHTML = window.renderResultScreen({
            drillName: 'Reaction Test',
            official: results.official,
            primary: {
                label: 'Average reaction time',
                value: `${results.average} ms`,
                hint: `Average across ${results.times.length} completed rounds`,
                color: category.color
            },
            metrics: [
                { label: 'Best round', value: best !== null ? `${best} ms` : '-' },
                { label: 'Rounds', value: results.times.length },
                { label: 'False starts', value: falseStartCount, tone: falseStartCount ? 'warning' : 'success' }
            ],
            assessment: {
                eyebrow: 'Performance tier',
                title: category.label,
                description: category.range,
                color: category.color,
                benchmarks: benchmarks.map(benchmark => ({
                    ...benchmark,
                    active: benchmark.label === category.label
                }))
            },
            breakdown: {
                title: 'Round breakdown',
                headers: ['Round', 'Reaction', 'Attempt'],
                rows: timesHTML,
                note: 'A false start marker means the round included bait click.'
            },
            restartAction: 'window.reaction.restartGame()',
            backAction: 'returnToMenu()'
        });
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
            range: "≤ 130 ms - exceptional; ~top 0.5% (Formula 1 drivers, top esports pros. Usually NOT average times but best runs in controlled environment)"
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
    // Stop the game logic.
    this.gameActive = false;
    this.cancelAllTimers();

    // Clear the runtime state.
    this.currentRound = 0;
    this.times = [];
    
    // Clear the DOM and hide the game container.
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

