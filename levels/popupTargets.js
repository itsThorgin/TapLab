window.popupTargets = {
    targetCount: 10,
    targetSize: 25,
    falseTargetEnabled: false,
    falseTargetChance: 0.25,
    isOfficial: false,
    OFFICIAL: { count: 25, size: 10, falseTarget: true, falseChance: 0.3 },
    officialLabel: "Official: 25 targets, 10px, false targets on (0.3)",
    currentIndex: 0,
    times: [],
    hoverTimes: [],
    clickDelays: [],
    misses: [],
    falseHits: [],
    spawnTime: 0,
    hoverTime: null,
    targetReady: false,
    endCallback: null,
    gameActive: false,

    init: function(endCallback) {
        const savedSettings = window.readStoredJSON('popupTargets_settings', {});
        this.targetCount = savedSettings.count || 10;
        this.targetSize = savedSettings.size || 25;
        this.falseTargetEnabled = savedSettings.falseTarget || false;
        this.falseTargetChance = Number.isFinite(savedSettings.falseChance)
            ? Math.min(1, Math.max(0, savedSettings.falseChance))
            : 0.25;

        this.endCallback = endCallback;
        this.currentIndex = 0;
        this.times = [];
        this.hoverTimes = [];
        this.clickDelays = [];
        this.misses = [];
        this.falseHits = [];
        this.targetReady = false;
        this.gameActive = false;
        this.isOfficial = false;

        this.renderSettingsPanel();
        this.showInstruction();
    },

    renderSettingsPanel: function() {
        const panel = document.getElementById('level-specific-settings');
        panel.innerHTML = window.renderLevelSettings({
            fields: [
                { type: 'number', id: 'popup-count', label: 'Number of targets', note: 'Choose from 5 to 50', min: 5, max: 50, value: this.targetCount },
                {
                    type: 'select', id: 'popup-size', label: 'Target size', note: 'Smaller targets demand more precision',
                    options: [25, 20, 15, 10, 5].map(size => ({ value: size, label: `${size} px`, selected: this.targetSize === size }))
                },
                { type: 'checkbox', id: 'popup-false-target', label: 'False Target Trick', note: 'Orange targets should be ignored', checked: this.falseTargetEnabled },
                { type: 'number', id: 'popup-false-chance', label: 'False target chance', note: '0 to 1 probability', min: 0, max: 1, step: 0.05, value: this.falseTargetChance }
            ],
            saveAction: 'window.popupTargets.saveSettings()',
            historyAction: 'window.popupTargets.showHistory()'
        });
    },

    showHistory: function() {
        const history = window.readStoredJSON('popupTargets_history', []);
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');

        if (!history.length) {
            container.innerHTML = window.renderEmptyHistory({
                drillName: 'Pop-up Targets',
                backAction: 'window.popupTargets.returnToMenu()'
            });
            return;
        }

        const archive = history.find(h => h && h._compacted === true);
        const recent = history.filter(h => h && typeof h === 'object' && h._compacted !== true);
        const historyOffset = archive ? Number(archive.sessionCount) || 0 : 0;
        const compactedRow = window.renderCompactedHistoryRow(archive, 10, group => {
            const hover = window.getCompactedMetric(group, 'avgHover');
            const click = window.getCompactedMetric(group, 'avgClick');
            const total = window.getCompactedMetric(group, 'avgTotal');
            const misses = window.getCompactedMetric(group, 'missesTotal');
            const falseHits = window.getCompactedMetric(group, 'falseHitsTotal');
            return `<div class="compacted-history-group">
                <strong>${window.escapeHTML(group.label)}</strong><br>
                ${group.sessionCount} runs • hover ${hover ? Math.round(hover.average) + ' ms' : '-'} •
                click ${click ? Math.round(click.average) + ' ms' : '-'} • total ${total ? Math.round(total.average) + ' ms' : '-'} •
                ${misses ? misses.average.toFixed(1) : '0'} misses/run • ${falseHits ? falseHits.average.toFixed(1) : '0'} false hits/run
            </div>`;
        });

        let rows = recent.slice().reverse().map((h, idx) => {
            const missList = (h.misses || []).map((m, i) => m ? `T${i+1}: ${m}` : null).filter(Boolean).join(', ') || 'None';
            const falseList = (h.falseHits || []).map((f, i) => f ? `T${i+1}: ${f}` : null).filter(Boolean).join(', ') || 'None';
            return `
                <tr>
                    <td>${historyOffset + recent.length - idx}</td>
                    <td>${h.date}</td>
                    <td>${h.official ? '★ Official' : '-'}</td>
                    <td>${h.targetCount} × ${h.targetSize}px</td>
                    <td>${Number.isFinite(h.avgHover) ? h.avgHover + ' ms' : '-'}</td>
                    <td>${Number.isFinite(h.avgClick) ? h.avgClick + ' ms' : '-'}</td>
                    <td>${h.avgTotal} ms</td>
                    <td>${(h.totalSessionTime/1000).toFixed(2)} s</td>
                    <td>${missList}</td>
                    <td>${falseList}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = window.renderHistoryScreen({
            drillName: 'Pop-up Targets',
            headers: ['#', 'Date', 'Mode', 'Config', 'Avg Hover', 'Avg Click', 'Avg Total', 'Total Time', 'Misses', 'False Hits'],
            rows,
            compactedRow,
            recentCount: recent.length,
            archivedCount: historyOffset,
            backAction: 'window.popupTargets.returnToMenu()'
        });
    },

    saveSettings: function() {
        let count = parseInt(document.getElementById('popup-count').value);
        count = Number.isFinite(count) ? Math.min(50, Math.max(5, count)) : 10;
        const size = parseInt(document.getElementById('popup-size').value);
        const falseTarget = document.getElementById('popup-false-target').checked;
        let falseChance = parseFloat(document.getElementById('popup-false-chance').value);
        falseChance = Number.isFinite(falseChance) ? Math.min(1, Math.max(0, falseChance)) : 0.3;
        localStorage.setItem('popupTargets_settings', JSON.stringify({ count, size, falseTarget, falseChance }));
        this.targetCount = count;
        this.targetSize = size;
        this.falseTargetEnabled = falseTarget;
        this.falseTargetChance = falseChance;
        this.showPopupMessage("Settings saved.");
        this.showInstruction();
    },

    showInstruction: function() {
        const container = document.getElementById('game-container');
        container.classList.remove('hidden');
        container.innerHTML = window.renderInstructionScreen({
            drillName: 'Pop-up Targets',
            summary: 'Train fast pointer acquisition by moving to and clicking targets as they appear.',
            steps: [
                'Move the pointer onto each teal target as quickly as possible.',
                'Click once you are on the target.',
                this.falseTargetEnabled ? 'Ignore orange false targets; clicking one counts as a false hit.' : 'Continue until every target has been completed.'
            ],
            setup: [
                { label: 'Targets', value: this.targetCount },
                { label: 'Target size', value: `${this.targetSize} px` },
                { label: 'False targets', value: this.falseTargetEnabled ? `On • ${this.falseTargetChance}` : 'Off' }
            ],
            note: 'TapLab records hover time, click delay, end-to-end total, misses, and false hits.',
            officialLabel: this.officialLabel,
            startAction: 'window.popupTargets.isOfficial=false;window.popupTargets.startGame()',
            officialAction: 'window.popupTargets.startOfficial()',
            backAction: 'window.popupTargets.returnToMenu()'
        });
    },

    // Apply the fixed official preset. Do not use saved settings.
    startOfficial: function() {
        this.isOfficial = true;
        this.targetCount = this.OFFICIAL.count;
        this.targetSize = this.OFFICIAL.size;
        this.falseTargetEnabled = this.OFFICIAL.falseTarget;
        this.falseTargetChance = this.OFFICIAL.falseChance;
        this.startGame();
    },

    startGame: function() {
        window.lockSettingsForRun();
        this.currentIndex = 0;
        this.times = [];
        this.hoverTimes = [];
        this.clickDelays = [];
        this.misses = [];
        this.falseHits = [];
        this.targetReady = false;
        this.gameActive = true;

        const container = document.getElementById('game-container');
        container.innerHTML = window.renderGameScreen({
            drillName: 'Pop-up Targets',
            mode: this.isOfficial ? 'Official' : 'Custom',
            progressLabel: 'Target',
            progressCurrent: 1,
            progressTotal: this.targetCount,
            progressId: 'popup-idx',
            stageHTML: '<div id="popup-area" class="game-arena game-arena-wide"></div>',
            hint: this.falseTargetEnabled
                ? 'Click teal targets. Ignore orange false targets.'
                : 'Acquire each target, move onto it, and click.',
            backAction: 'window.popupTargets.returnToMenu()'
        });

        const area = document.getElementById('popup-area');

        // Count missed clicks.
        window.onPrimaryPointerDown(area, (e) => {
            if (!this.gameActive) return;
            if (this.inCountdown) return;
            if (!e.target.id || (e.target.id !== 'popup-target' && e.target.id !== 'false-target')) {
                this.misses[this.currentIndex] = (this.misses[this.currentIndex] || 0) + 1;
                this.showTemporaryMessage("Miss", "error");
            }
        });

        this.inCountdown = true;
        window.show321(area, 500).then(() => {
            if (!this.gameActive) return;
            this.inCountdown = false;
            this.spawnTarget();
        });
    },
    
    spawnTarget: function(forceRealNext = false) {
        if (!this.gameActive) return;
        const area = document.getElementById('popup-area');
        if (!area) return;
        area.innerHTML = '';
        this.targetReady = false;
        const progress = document.getElementById('popup-idx');
        if (progress) progress.textContent = Math.min(this.currentIndex + 1, this.targetCount);

        const spawnFalse = !forceRealNext && this.falseTargetEnabled && Math.random() < this.falseTargetChance;

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
                    
            area.appendChild(falseTarget);
        
            let cleaned = false;
            const cleanup = () => {
              if (cleaned) return;
              cleaned = true;
              if (!this.gameActive) return;
              // Continue with a real target. Do not increment currentIndex.
              this.spawnTarget(true);
            };
        
            // Record a false hit and remove the false target immediately.
            window.onPrimaryPointerDown(falseTarget, (e) => {
                e.stopPropagation();
                this.falseHits[this.currentIndex] = (this.falseHits[this.currentIndex] || 0) + 1;
                this.showTemporaryMessage("False target", "error");
                setTimeout(cleanup, 0); // Let the browser paint before the next target appears.
            });
        
            // Remove the target after its history based lifetime. Do not record a miss.
            const lifetime = this.getFalseTargetDuration();
            const tid = setTimeout(cleanup, lifetime);
        
            return; // Stop because this event has no real target.
        }

        // Spawn a real target.
        const realTarget = document.createElement('div');
        realTarget.id = 'popup-target';
        realTarget.style.width = `${this.targetSize}px`;
        realTarget.style.height = `${this.targetSize}px`;
        realTarget.style.background = '#2ec4b6';
        realTarget.style.borderRadius = '50%';
        realTarget.style.position = 'absolute';
        realTarget.style.cursor = 'pointer';
        this.hoverTime = null;

        const maxX = area.clientWidth - this.targetSize;
        const maxY = area.clientHeight - this.targetSize;
        realTarget.style.left = `${Math.random() * maxX}px`;
        realTarget.style.top = `${Math.random() * maxY}px`;

        realTarget.addEventListener('pointerenter', (event) => {
            if (event.pointerType === 'touch') return;
            if (this.targetReady && this.hoverTime === null) {
                this.hoverTime = performance.now();
            }
        });

        window.onPrimaryPointerDown(realTarget, (e) => {
            e.stopPropagation(); // Stop the false target click from reaching the arena.
            this.hitTarget();
        });

        area.appendChild(realTarget);
        requestAnimationFrame(() => {
            if (!this.gameActive || !realTarget.isConnected) return;
            this.spawnTime = performance.now();
            this.targetReady = true;
        });
    },

    getFalseTargetDuration: function() {
        // Use a default lifetime of 1 second.
        let duration = 1000;

        const history = window.readStoredJSON('popupTargets_history', []);
        const recentHistory = history.filter(h => h && h._compacted !== true && Number.isFinite(h.avgTotal));
        if (recentHistory.length) {
            // Use the mean of previous avgTotal values.
            const mean = Math.round(
                recentHistory.reduce((acc, h) => acc + h.avgTotal, 0) / recentHistory.length
            );
            // Limit the visible time of a false target to 2 seconds.
            duration = Math.min(2000, mean || 1000);
        }

        return duration;
    },

    hitTarget: function() {
        if (!this.gameActive || !this.targetReady) return;
        this.targetReady = false;

        const now = performance.now();
        const totalTime = now - this.spawnTime;
        const hoverTime = this.hoverTime ? this.hoverTime - this.spawnTime : null;
        const clickDelay = (hoverTime !== null) ? (now - this.hoverTime) : null;

        this.times.push(Math.round(totalTime));
        this.hoverTimes.push(hoverTime !== null ? Math.round(hoverTime) : null);
        this.clickDelays.push(clickDelay !== null ? Math.round(clickDelay) : null);
        window.showGameFeedback({
            type: 'success',
            message: `Hit • ${Math.round(totalTime)} ms`,
            duration: 340,
            pulseTarget: '#popup-area'
        });

        this.currentIndex++;
        if (this.currentIndex >= this.targetCount) {
            this.finish();
        } else {
            setTimeout(() => this.spawnTarget(), 0); // Spawn the next target in the next event loop cycle.
        }
    },

    finish: function() {
        this.gameActive = false;
        this.targetReady = false;
        const averageMeasured = (values) => {
            const measured = values.filter(Number.isFinite);
            return measured.length
                ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length)
                : null;
        };
        const avgHover = averageMeasured(this.hoverTimes);
        const avgClick = averageMeasured(this.clickDelays);
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
            official: this.isOfficial,
            _customOverlay: true
        };
        this.showResultsOverlay(results);
        this.endCallback(results);

        const historyEntry = {
            date: new Date().toLocaleString(),
            targetCount: this.targetCount,
            targetSize: this.targetSize,
            falseTargetEnabled: this.falseTargetEnabled,
            falseTargetChance: this.falseTargetChance,
            avgHover,
            avgClick,
            avgTotal,
            totalSessionTime,
            misses: this.misses,
            falseHits: this.falseHits,
            official: this.isOfficial
        };
        window.appendHistory('popupTargets_history', historyEntry, {
            config: h => ({
                official: !!h.official,
                targetCount: h.targetCount,
                targetSize: h.targetSize,
                falseTargetEnabled: h.official ? true : (typeof h.falseTargetEnabled === 'boolean' ? h.falseTargetEnabled : null),
                falseTargetChance: h.official ? 0.3 : (Number.isFinite(h.falseTargetChance) ? h.falseTargetChance : null)
            }),
            label: h => {
                const falseEnabled = h.official ? true : h.falseTargetEnabled;
                const falseChance = h.official ? 0.3 : h.falseTargetChance;
                const falseLabel = typeof falseEnabled === 'boolean'
                    ? `false-target ${falseEnabled ? `on (${Number.isFinite(falseChance) ? falseChance : '?'})` : 'off'}`
                    : 'legacy false-target setting';
                return `${h.official ? '★ Official' : 'Custom'} • ${h.targetCount} × ${h.targetSize}px • ${falseLabel}`;
            },
            metrics: {
                avgHover: h => Number.isFinite(h.avgHover) ? h.avgHover : null,
                avgClick: h => Number.isFinite(h.avgClick) ? h.avgClick : null,
                avgTotal: h => Number.isFinite(h.avgTotal) ? h.avgTotal : null,
                totalSessionTime: h => Number.isFinite(h.totalSessionTime) ? h.totalSessionTime : null,
                missesTotal: h => Array.isArray(h.misses) ? h.misses.reduce((sum, value) => sum + (Number(value) || 0), 0) : null,
                falseHitsTotal: h => Array.isArray(h.falseHits) ? h.falseHits.reduce((sum, value) => sum + (Number(value) || 0), 0) : null
            }
        });
    },

    showResultsOverlay: function(results) {
        const container = document.getElementById('game-container');
        const formatMs = (value) => Number.isFinite(value) ? `${value} ms` : '-';
        const totalMisses = (results.misses || []).reduce((sum, value) => sum + (Number(value) || 0), 0);
        const totalFalseHits = (results.falseHits || []).reduce((sum, value) => sum + (Number(value) || 0), 0);

        let rows = '';
        for (let i = 0; i < results.totalTimes.length; i++) {
            rows += `<tr>
                        <td>${i+1}</td>
                        <td>${formatMs(results.hoverTimes[i])}</td>
                        <td>${formatMs(results.clickDelays[i])}</td>
                        <td>${results.totalTimes[i]} ms</td>
                        <td>${results.misses[i] || 0}</td>
                        <td>${results.falseHits[i] || 0}</td>
                     </tr>`;
        }

        container.innerHTML = window.renderResultScreen({
            drillName: 'Pop-up Targets',
            official: results.official,
            primary: {
                label: 'Average total time',
                value: `${results.avgTotal} ms`,
                hint: 'Target appearance to click',
                color: '#2ec4b6'
            },
            metrics: [
                { label: 'Avg hover', value: formatMs(results.avgHover) },
                { label: 'Avg click delay', value: formatMs(results.avgClick) },
                { label: 'Total session', value: `${(results.totalSessionTime / 1000).toFixed(2)} s` },
                { label: 'Misses', value: totalMisses, tone: totalMisses ? 'warning' : 'success' },
                { label: 'False hits', value: totalFalseHits, tone: totalFalseHits ? 'danger' : 'success' }
            ],
            breakdown: {
                title: 'Target breakdown',
                headers: ['Target', 'Hover', 'Click', 'Total', 'Misses', 'False hits'],
                rows,
                note: 'Hover and click are component timings; total is measured directly from appearance to click.'
            },
            restartAction: 'window.popupTargets.startGame()',
            backAction: 'returnToMenu()'
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
            duration: 480,
            pulseTarget: '#popup-area'
        });
    },

    returnToMenu: function() {
        this.gameActive = false;
        this.targetReady = false;

        const area = document.getElementById('popup-area');
        if (area && area.parentNode) {
            const fresh = area.cloneNode(true);    // Remove all event listeners from the arena.
            area.parentNode.replaceChild(fresh, area);
        }

        const container = document.getElementById('game-container');
        container.innerHTML = '';
        container.classList.add('hidden');
        returnToMenu();
    }

};


