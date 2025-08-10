window.popupTargets = {
    targetCount: 10,
    targetSize: 25,
    falseTargetEnabled: false,
    falseTargetChance: 0.25,
    currentIndex: 0,
    times: [],
    hoverTimes: [],
    clickDelays: [],
    misses: [],
    falseHits: [],
    spawnTime: 0,
    hoverTime: null,
    endCallback: null,
    gameActive: false,

    init: function(endCallback) {
        const savedSettings = JSON.parse(localStorage.getItem('popupTargets_settings')) || {};
        this.targetCount = savedSettings.count || 10;
        this.targetSize = savedSettings.size || 25;
        this.falseTargetEnabled = savedSettings.falseTarget || false;
        this.falseTargetChance = savedSettings.falseChance || 0.25;

        this.endCallback = endCallback;
        this.currentIndex = 0;
        this.times = [];
        this.hoverTimes = [];
        this.clickDelays = [];
        this.misses = [];
        this.falseHits = [];
        this.gameActive = false;

        this.renderSettingsPanel();
        this.showInstruction();
    },

    renderSettingsPanel: function() {
        const panel = document.getElementById('level-specific-settings');
        panel.innerHTML = `
            <label>Number of targets: 
                <input type="number" id="popup-count" min="1" max="50" value="${this.targetCount}">
            </label><br><br>
            <label>Target size: 
                <select id="popup-size">
                    <option value="25" ${this.targetSize==25?'selected':''}>25 px</option>
                    <option value="20" ${this.targetSize==20?'selected':''}>20 px</option>
                    <option value="15" ${this.targetSize==15?'selected':''}>15 px</option>
                    <option value="10" ${this.targetSize==10?'selected':''}>10 px</option>
                    <option value="5"  ${this.targetSize==5?'selected':''}>5 px</option>
                </select>
            </label><br><br>
            <label>
                <input type="checkbox" id="popup-false-target" ${this.falseTargetEnabled ? 'checked' : ''}>
                Enable False Target Trick
            </label><br><br>
            <label>False target chance: 
                <input type="number" id="popup-false-chance" min="0" max="1" step="0.05" value="${this.falseTargetChance}">
            </label><br><br>
            <button style="border: 1px solid #0A0A23;" onclick="window.popupTargets.saveSettings()">Save Settings</button>
            <button style="margin-left:6px; border:1px solid #0A0A23;" onclick="window.popupTargets.showHistory()">View History</button>
        `;
    },

    showHistory: function() {
        const history = JSON.parse(localStorage.getItem('popupTargets_history') || '[]');
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');

        if (!history.length) {
            container.innerHTML = `
                <div style="text-align:center; margin-top:20px;">
                    <h3>No history found</h3>
                    <button onclick="window.popupTargets.returnToMenu()">Back</button>
                </div>
            `;
            return;
        }

        let rows = history.map((h, idx) => {
            const missList = h.misses.map((m, i) => m ? `T${i+1}: ${m}` : null).filter(Boolean).join(', ') || 'None';
            const falseList = h.falseHits.map((f, i) => f ? `T${i+1}: ${f}` : null).filter(Boolean).join(', ') || 'None';
            return `
                <tr>
                    <td>${idx+1}</td>
                    <td>${h.date}</td>
                    <td>${h.targetCount} × ${h.targetSize}px</td>
                    <td>${h.avgHover} ms</td>
                    <td>${h.avgClick} ms</td>
                    <td>${h.avgTotal} ms</td>
                    <td>${(h.totalSessionTime/1000).toFixed(2)} s</td>
                    <td>${missList}</td>
                    <td>${falseList}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div style="max-width:95%; margin:auto; color:#e0e1dd;">
                <h2 style="text-align:center;">Popup Targets History</h2>
                <div style="max-height:70vh; overflow-y:auto;">
                    <table class="results-table">
                        <tr>
                            <th>#</th><th>Date</th><th>Config</th>
                            <th>Avg Hover</th><th>Avg Click</th><th>Avg Total</th>
                            <th>Total Time</th><th>Misses</th><th>False Hits</th>
                        </tr>
                        ${rows}
                    </table>
                </div>
                <div style="text-align:center; margin-top:10px;">
                    <button onclick="window.popupTargets.returnToMenu()">Back</button>
                </div>
            </div>
        `;
    },

    saveSettings: function() {
        const count = parseInt(document.getElementById('popup-count').value);
        const size = parseInt(document.getElementById('popup-size').value);
        const falseTarget = document.getElementById('popup-false-target').checked;
        const falseChance = parseFloat(document.getElementById('popup-false-chance').value);
        localStorage.setItem('popupTargets_settings', JSON.stringify({ count, size, falseTarget, falseChance }));
        this.targetCount = count;
        this.targetSize = size;
        this.falseTargetEnabled = falseTarget;
        this.falseTargetChance = falseChance;
        this.showPopupMessage("Settings saved.");
    },

    showInstruction: function() {
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');
        container.innerHTML = `
            <div style="text-align:center; max-width:600px; margin:auto;">
                <h2>Pop-up Targets</h2>
                <p>
                    Move your mouse to each target and click it as fast as possible.<br>
                    Tracks time to hover over target, click delay, total hit time, misses, and false hits.<br>
                    ${this.targetCount} targets total.
                </p>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button onclick="window.popupTargets.startGame()">Start</button>
                    <button onclick="window.popupTargets.returnToMenu()">Back to Menu</button>
                </div>
            </div>
        `;
    },

    startGame: function() {
        this.currentIndex = 0;
        this.times = [];
        this.hoverTimes = [];
        this.clickDelays = [];
        this.misses = [];
        this.falseHits = [];
        this.gameActive = true;

        const container = document.getElementById('game-container');
        container.innerHTML = `
            <button id="back-btn" style="position:absolute; top:10px; left:10px;">← Back</button>
            <div id="popup-area" style="position:relative; width:60vw; aspect-ratio:16/9; background:#6c757d; border-radius:8px; overflow:hidden; margin:auto;"></div>
        `;
        document.getElementById('back-btn').onclick = () => this.returnToMenu();

        const area = document.getElementById('popup-area');

        // Count misses
        area.addEventListener('mousedown', (e) => {
            if (!this.gameActive) return;
            if (this.inCountdown) return;
            if (!e.target.id || (e.target.id !== 'popup-target' && e.target.id !== 'false-target')) {
                this.misses[this.currentIndex] = (this.misses[this.currentIndex] || 0) + 1;
                this.showTemporaryMessage("Miss!", "#ff4d4d");
            }
        });

        this.inCountdown = true;
        window.show321(area, 500).then(() => {
            this.inCountdown = false;
            this.spawnTarget();
        });
        
        const sequence = ["3", "2", "1", "Go!"];
        let step = 0;

        this.inCountdown = true;

        const showStep = () => {
            countdownOverlay.textContent = sequence[step];
            countdownOverlay.style.opacity = "1";
            countdownOverlay.style.transform = "translate(-50%,-50%) scale(1.2)";
        
            setTimeout(() => {
                countdownOverlay.style.opacity = "0";
                countdownOverlay.style.transform = "translate(-50%,-50%) scale(1)";
            }, 300); // fade out after 0.3s
        
            step++;
            if (step < sequence.length) {
                setTimeout(showStep, 500); // move to next number
            } else {
                setTimeout(() => {
                    countdownOverlay.remove();
                    this.inCountdown = false;
                    this.spawnTarget();
                }, 500);
            }
        };

        showStep();
    },
    
    spawnTarget: function(forceRealNext = false) {
        if (!this.gameActive) return;
        const area = document.getElementById('popup-area');
        if (!area) return;
        area.innerHTML = '';

        const spawnFalse = !forceRealNext && this.falseTargetEnabled && Math.random() < this.falseTargetChance;

        this.spawnTime = performance.now();
        this.hoverTime = null;

        if (spawnFalse) {
            const falseTarget = document.createElement('div');
            falseTarget.id = 'false-target';
            falseTarget.style.width = `${this.targetSize}px`;
            falseTarget.style.height = `${this.targetSize}px`;
            falseTarget.style.background = '#f4a261';
            falseTarget.style.borderRadius = '50%';
            falseTarget.style.position = 'absolute';
            falseTarget.style.cursor = 'pointer';
                    
            const maxX = area.clientWidth - this.targetSize;
            const maxY = area.clientHeight - this.targetSize;
            falseTarget.style.left = `${Math.random() * maxX}px`;
            falseTarget.style.top  = `${Math.random() * maxY}px`;
                    
            // miss if clicking elsewhere while it's visible
            const missHandler = (e) => {
              if (e.target.id !== 'false-target') {
                this.misses[this.currentIndex] = (this.misses[this.currentIndex] || 0) + 1;
                this.showTemporaryMessage("Miss!", "#ff4d4d");
              }
            };
            area.addEventListener('mousedown', missHandler);
        
            area.appendChild(falseTarget);
        
            let cleaned = false;
            const cleanup = () => {
              if (cleaned) return;
              cleaned = true;
              area.removeEventListener('mousedown', missHandler);
              if (!this.gameActive) return;
              // move to a REAL target, no increment for currentIndex
              this.spawnTarget(true);
            };
        
            // clicking the false target counts a false hit and despawns immediately
            falseTarget.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.falseHits[this.currentIndex] = (this.falseHits[this.currentIndex] || 0) + 1;
                this.showTemporaryMessage("False target!", "#ff4d4d");
                setTimeout(cleanup, 0); // allows paint before respawn
            });
        
            // auto despawn after history based lifetime (no miss on despawn)
            const lifetime = this.getFalseTargetDuration();
            const tid = setTimeout(cleanup, lifetime);
        
            return; // exit (no real target here)
        }

        // Otherwise spawn REAL target
        const realTarget = document.createElement('div');
        realTarget.id = 'popup-target';
        realTarget.style.width = `${this.targetSize}px`;
        realTarget.style.height = `${this.targetSize}px`;
        realTarget.style.background = '#2ec4b6';
        realTarget.style.borderRadius = '50%';
        realTarget.style.position = 'absolute';
        realTarget.style.cursor = 'pointer';

        const maxX = area.clientWidth - this.targetSize;
        const maxY = area.clientHeight - this.targetSize;
        realTarget.style.left = `${Math.random() * maxX}px`;
        realTarget.style.top = `${Math.random() * maxY}px`;

        realTarget.addEventListener('mouseenter', () => {
            if (this.hoverTime === null) {
                this.hoverTime = performance.now();
            }
        });

        realTarget.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // limits bubbling to false targets
            this.hitTarget();
        });

        area.appendChild(realTarget);
    },

    getFalseTargetDuration: function() {
        // default 1 sec
        let duration = 1000;

        const history = JSON.parse(localStorage.getItem('popupTargets_history') || '[]');
        if (history.length) {
            // using mean of past avgTotal values
            const mean = Math.round(
                history.reduce((acc, h) => acc + (Number(h.avgTotal) || 0), 0) / history.length
            );
            // capping false target max shown time at 2s
            duration = Math.min(2000, mean || 1000);
        }

        return duration;
    },

    hitTarget: function() {
        const now = performance.now();
        const totalTime = now - this.spawnTime;
        const hoverTime = this.hoverTime ? this.hoverTime - this.spawnTime : null;
        const clickDelay = (hoverTime !== null) ? (now - this.hoverTime) : null;

        this.times.push(Math.round(totalTime));
        this.hoverTimes.push(hoverTime !== null ? Math.round(hoverTime) : null);
        this.clickDelays.push(clickDelay !== null ? Math.round(clickDelay) : null);

        this.currentIndex++;
        if (this.currentIndex >= this.targetCount) {
            this.finish();
        } else {
            setTimeout(() => this.spawnTarget(), 0); // moving it to next tick
        }
    },

    finish: function() {
        this.gameActive = false;
        const avgHover = Math.round(this.hoverTimes.reduce((a,b)=>a+(b||0),0) / this.hoverTimes.length);
        const avgClick = Math.round(this.clickDelays.reduce((a,b)=>a+(b||0),0) / this.clickDelays.length);
        const avgTotal = Math.round(this.times.reduce((a,b)=>a+b,0) / this.times.length);
        const totalSessionTime = this.times.reduce((a,b)=>a+b,0);

        const results = {
            hoverTimes: this.hoverTimes,
            clickDelays: this.clickDelays,
            totalTimes: this.times,
            misses: this.misses,
            falseHits: this.falseHits,
            avgHover,
            avgClick,
            avgTotal,
            totalSessionTime,
            _customOverlay: true
        };
        this.showResultsOverlay(results);
        this.endCallback(results);

        const history = JSON.parse(localStorage.getItem('popupTargets_history') || '[]');
        history.push({
            date: new Date().toLocaleString(),
            targetCount: this.targetCount,
            targetSize: this.targetSize,
            avgHover,
            avgClick,
            avgTotal,
            totalSessionTime,
            misses: this.misses,
            falseHits: this.falseHits
        });
        localStorage.setItem('popupTargets_history', JSON.stringify(history));
    },

    showResultsOverlay: function(results) {
        const container = document.getElementById('game-container');

        let rows = '';
        for (let i = 0; i < results.totalTimes.length; i++) {
            rows += `<tr>
                        <td>${i+1}</td>
                        <td>${results.hoverTimes[i] ?? '-'} ms</td>
                        <td>${results.clickDelays[i] ?? '-'} ms</td>
                        <td>${results.totalTimes[i]} ms</td>
                        <td>${results.misses[i] || 0}</td>
                        <td>${results.falseHits[i] || 0}</td>
                     </tr>`;
        }

        container.innerHTML = `
            <div style="text-align:center; margin-top:20px; max-width:720px; margin:auto; color:#e0e1dd;">
                <h2>Pop-up Targets</h2>
                <p>Average hover: ${results.avgHover} ms</p>
                <p>Average click delay: ${results.avgClick} ms</p>
                <p>Average total: ${results.avgTotal} ms</p>
                <p>Total session time: ${(results.totalSessionTime/1000).toFixed(2)} s</p>

                <table class="results-table" style="margin:0 auto;max-width:600px;">
                    <tr><th>#</th><th>Hover(ms)</th><th>Click delay(ms)</th><th>Total(ms)</th><th>Misses</th><th>False Hits</th></tr>
                    ${rows}
                </table>

                <div style="margin-top:14px; display:flex; gap:10px; justify-content:center;">
                    <button onclick="window.popupTargets.startGame()">Restart</button>
                    <button onclick="returnToMenu()">Back to Menu</button>
                </div>
            </div>
        `;
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
        const host = document.getElementById('game-container');
        if (!host) return;
        
         // center overlay correctly
        const computedPos = getComputedStyle(host).position;
        if (computedPos === 'static' || !computedPos) {
            host.style.position = 'relative';
        }

        const msg = document.createElement('div');
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
        host.appendChild(msg);

        setTimeout(() => {
            msg.style.transition = "opacity 0.4s";
            msg.style.opacity = "0";
            setTimeout(() => msg.remove(), 400);
        }, 1000);
    },

    returnToMenu: function() {
        this.gameActive = false;

        const area = document.getElementById('popup-area');
        if (area && area.parentNode) {
            const fresh = area.cloneNode(true);    // drop all listeners
            area.parentNode.replaceChild(fresh, area);
        }

        const container = document.getElementById('game-container');
        container.innerHTML = '';
        container.classList.add('hidden');
        returnToMenu();
    }
};