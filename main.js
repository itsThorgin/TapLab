let currentLevel = null;

window.readStoredJSON = function readStoredJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;

        const parsed = JSON.parse(raw);

        if (Array.isArray(fallback)) {
            return Array.isArray(parsed) ? parsed : fallback;
        }

        if (fallback && typeof fallback === 'object') {
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed
                : fallback;
        }

        return parsed ?? fallback;
    } catch (error) {
        console.warn(`Ignoring invalid stored data for "${key}".`, error);
        return fallback;
    }
};

const HISTORY_RECENT_LIMIT = 100;

window.appendHistory = function appendHistory(storageKey, entry, options) {
    const stored = window.readStoredJSON(storageKey, []);
    let archive = stored.find(item => item && item._compacted === true) || null;
    const recent = stored.filter(item => item && typeof item === 'object' && !Array.isArray(item) && item._compacted !== true);
    recent.push(entry);

    const foldIntoArchive = oldEntry => {
        if (!archive || archive.schemaVersion !== 1) {
            archive = {
                _compacted: true,
                schemaVersion: 1,
                sessionCount: 0,
                firstDate: null,
                lastDate: null,
                groups: {}
            };
        }

        if (!archive.groups || typeof archive.groups !== 'object' || Array.isArray(archive.groups)) {
            archive.groups = {};
        }

        const config = options.config(oldEntry);
        const groupKey = JSON.stringify(config);
        let group = archive.groups[groupKey];

        if (!group) {
            group = archive.groups[groupKey] = {
                config,
                label: options.label(oldEntry),
                official: !!oldEntry.official,
                sessionCount: 0,
                firstDate: oldEntry.date || null,
                lastDate: oldEntry.date || null,
                metrics: {}
            };
        }

        archive.sessionCount = (Number(archive.sessionCount) || 0) + 1;
        archive.firstDate = archive.firstDate || oldEntry.date || null;
        archive.lastDate = oldEntry.date || archive.lastDate;

        group.sessionCount = (Number(group.sessionCount) || 0) + 1;
        group.firstDate = group.firstDate || oldEntry.date || null;
        group.lastDate = oldEntry.date || group.lastDate;

        Object.entries(options.metrics).forEach(([metricName, readValue]) => {
            const value = readValue(oldEntry);
            if (!Number.isFinite(value)) return;

            const stat = group.metrics[metricName] || {
                sum: 0,
                count: 0,
                min: value,
                max: value
            };
            stat.sum += value;
            stat.count += 1;
            stat.min = Math.min(stat.min, value);
            stat.max = Math.max(stat.max, value);
            group.metrics[metricName] = stat;
        });
    };

    while (recent.length > HISTORY_RECENT_LIMIT) {
        foldIntoArchive(recent.shift());
    }

    const nextHistory = archive ? [archive, ...recent] : recent;
    localStorage.setItem(storageKey, JSON.stringify(nextHistory));
    return nextHistory;
};

window.getCompactedMetric = function getCompactedMetric(group, metricName) {
    const stat = group && group.metrics ? group.metrics[metricName] : null;
    if (!stat || !Number.isFinite(stat.sum) || !Number.isFinite(stat.count) || stat.count <= 0) return null;

    return {
        average: stat.sum / stat.count,
        min: stat.min,
        max: stat.max,
        count: stat.count
    };
};

window.escapeHTML = function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
};

function closeSettingsForHistory() {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.classList.add('hidden');
}

window.renderEmptyHistory = function renderEmptyHistory({ drillName, backAction }) {
    closeSettingsForHistory();

    return `
        <section class="history-screen history-screen-empty" aria-labelledby="history-title">
            <header class="history-header">
                <div>
                    <span class="history-eyebrow">Training history</span>
                    <h2 id="history-title">${window.escapeHTML(drillName)}</h2>
                    <p>Your completed runs for this drill will appear here.</p>
                </div>
            </header>
            <div class="history-empty-card">
                <span class="history-empty-icon" aria-hidden="true">↺</span>
                <h3>No saved runs yet</h3>
                <p>Complete a run, then return here to compare it with future attempts.</p>
            </div>
            <footer class="history-actions">
                <button class="history-back-button" onclick="${backAction}">Back</button>
            </footer>
        </section>
    `;
};

window.renderHistoryScreen = function renderHistoryScreen({
    drillName,
    headers,
    rows,
    compactedRow = '',
    recentCount = 0,
    archivedCount = 0,
    backAction
}) {
    closeSettingsForHistory();

    const safeRecentCount = Math.max(0, Number(recentCount) || 0);
    const safeArchivedCount = Math.max(0, Number(archivedCount) || 0);
    const recentWord = safeRecentCount === 1 ? 'run' : 'runs';
    const archivedWord = safeArchivedCount === 1 ? 'run' : 'runs';
    const archiveHint = safeArchivedCount
        ? 'Newest runs are shown first. Open the archive row for compacted averages.'
        : 'Newest runs are shown first. Results are stored only on this device.';

    return `
        <section class="history-screen" aria-labelledby="history-title">
            <header class="history-header">
                <div>
                    <span class="history-eyebrow">Training history</span>
                    <h2 id="history-title">${window.escapeHTML(drillName)}</h2>
                    <p>${archiveHint}</p>
                </div>
                <div class="history-counts" aria-label="Saved run counts">
                    <span class="history-count-chip">${safeRecentCount} recent ${recentWord}</span>
                    ${safeArchivedCount ? `<span class="history-count-chip history-count-chip-archive">${safeArchivedCount} archived ${archivedWord}</span>` : ''}
                </div>
            </header>
            <div class="history-table-shell" tabindex="0" aria-label="${window.escapeHTML(drillName)} saved results">
                <table class="results-table history-table">
                    <thead>
                        <tr>${headers.map(header => `<th scope="col">${window.escapeHTML(header)}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${rows}
                        ${compactedRow}
                    </tbody>
                </table>
            </div>
            <footer class="history-actions">
                <button class="history-back-button" onclick="${backAction}">Back</button>
            </footer>
        </section>
    `;
};

function safeResultColor(value, fallback = '#2ec4b6') {
    return /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? value : fallback;
}

window.renderResultScreen = function renderResultScreen({
    drillName,
    official = false,
    primary,
    metrics = [],
    assessment = null,
    breakdown = null,
    restartAction,
    backAction
}) {
    const primaryAccent = safeResultColor(primary && primary.color);
    const modeLabel = official ? '★ Official' : 'Custom run';
    const modeClass = official ? ' result-mode-official' : '';
    const assessmentColor = assessment ? safeResultColor(assessment.color, '#f4a261') : null;
    const metricHTML = metrics.map(metric => {
        const allowedTones = ['warning', 'danger', 'success'];
        const toneClass = allowedTones.includes(metric.tone) ? ` result-metric-${metric.tone}` : '';
        return `
            <div class="result-metric${toneClass}">
                <span>${window.escapeHTML(metric.label)}</span>
                <strong>${window.escapeHTML(metric.value)}</strong>
                ${metric.note ? `<small>${window.escapeHTML(metric.note)}</small>` : ''}
            </div>
        `;
    }).join('');

    const assessmentHTML = assessment ? `
        <aside class="result-assessment" style="--assessment-color:${assessmentColor};">
            <span class="result-assessment-eyebrow">${window.escapeHTML(assessment.eyebrow || 'Assessment')}</span>
            <strong class="result-assessment-title">${window.escapeHTML(assessment.title)}</strong>
            ${assessment.description ? `<p>${window.escapeHTML(assessment.description)}</p>` : ''}
            ${Array.isArray(assessment.benchmarks) && assessment.benchmarks.length ? `
                <div class="result-benchmark-list">
                    ${assessment.benchmarks.map(benchmark => `
                        <div class="result-benchmark${benchmark.active ? ' result-benchmark-active' : ''}"
                             style="--benchmark-color:${safeResultColor(benchmark.color, '#f4a261')};">
                            <strong>${window.escapeHTML(benchmark.label)}</strong>
                            <span>${window.escapeHTML(benchmark.range)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            ${assessment.footer ? `<div class="result-assessment-footer">${window.escapeHTML(assessment.footer)}</div>` : ''}
        </aside>
    ` : '';

    const breakdownHTML = breakdown ? `
        <section class="result-breakdown" aria-labelledby="result-breakdown-title">
            <div class="result-section-heading">
                <div>
                    <span class="result-section-eyebrow">Run detail</span>
                    <h3 id="result-breakdown-title">${window.escapeHTML(breakdown.title || 'Run breakdown')}</h3>
                </div>
                ${breakdown.note ? `<p>${window.escapeHTML(breakdown.note)}</p>` : ''}
            </div>
            <div class="result-table-shell" tabindex="0" aria-label="${window.escapeHTML(drillName)} run breakdown">
                <table class="results-table result-table">
                    <thead><tr>${breakdown.headers.map(header => `<th scope="col">${window.escapeHTML(header)}</th>`).join('')}</tr></thead>
                    <tbody>${breakdown.rows}</tbody>
                </table>
            </div>
        </section>
    ` : '';

    return `
        <section class="result-screen" aria-labelledby="result-title">
            <header class="result-header">
                <div>
                    <span class="result-eyebrow">Training result</span>
                    <h2 id="result-title">${window.escapeHTML(drillName)}</h2>
                </div>
                <span class="result-mode${modeClass}">${modeLabel}</span>
            </header>
            <div class="result-summary-grid${assessment ? ' result-summary-with-assessment' : ''}">
                <div class="result-performance">
                    <div class="result-primary" style="--primary-accent:${primaryAccent};">
                        <span>${window.escapeHTML(primary.label)}</span>
                        <strong>${window.escapeHTML(primary.value)}</strong>
                        ${primary.hint ? `<small>${window.escapeHTML(primary.hint)}</small>` : ''}
                    </div>
                    ${metricHTML ? `<div class="result-metrics-grid">${metricHTML}</div>` : ''}
                </div>
                ${assessmentHTML}
            </div>
            ${breakdownHTML}
            <footer class="result-actions">
                <button class="result-restart-button" onclick="${restartAction}">Restart</button>
                <button onclick="${backAction}">Back to Menu</button>
            </footer>
        </section>
    `;
};

window.renderLevelSettings = function renderLevelSettings({ fields, saveAction, historyAction }) {
    const fieldHTML = fields.map(field => {
        const id = window.escapeHTML(field.id);
        const label = window.escapeHTML(field.label);
        const note = field.note ? `<small>${window.escapeHTML(field.note)}</small>` : '';

        if (field.type === 'checkbox') {
            return `
                <label class="settings-toggle" for="${id}">
                    <span><strong>${label}</strong>${note}</span>
                    <input type="checkbox" id="${id}" ${field.checked ? 'checked' : ''}>
                </label>
            `;
        }

        let control = '';
        if (field.type === 'select') {
            control = `
                <select id="${id}">
                    ${field.options.map(option => `
                        <option value="${window.escapeHTML(option.value)}" ${option.selected ? 'selected' : ''}>${window.escapeHTML(option.label)}</option>
                    `).join('')}
                </select>
            `;
        } else {
            const min = field.min !== undefined ? ` min="${window.escapeHTML(field.min)}"` : '';
            const max = field.max !== undefined ? ` max="${window.escapeHTML(field.max)}"` : '';
            const step = field.step !== undefined ? ` step="${window.escapeHTML(field.step)}"` : '';
            control = `<input type="number" id="${id}" value="${window.escapeHTML(field.value)}"${min}${max}${step}>`;
        }

        return `
            <label class="settings-field" for="${id}">
                <span><strong>${label}</strong>${note}</span>
                ${control}
            </label>
        `;
    }).join('');

    return `
        <div class="level-settings-form">
            <div class="settings-fields">${fieldHTML}</div>
            <div class="level-settings-actions">
                <button class="settings-save-button" onclick="${saveAction}">Save Settings</button>
                ${historyAction ? `<button onclick="${historyAction}">View History</button>` : ''}
            </div>
        </div>
    `;
};

window.renderInstructionScreen = function renderInstructionScreen({
    drillName,
    summary,
    steps,
    setup,
    note = '',
    officialLabel,
    startAction,
    officialAction,
    backAction
}) {
    return `
        <section class="instruction-screen" aria-labelledby="instruction-title">
            <header class="instruction-header">
                <span class="instruction-eyebrow">Drill briefing</span>
                <h2 id="instruction-title" tabindex="-1">${window.escapeHTML(drillName)}</h2>
                <p>${window.escapeHTML(summary)}</p>
            </header>
            <div class="instruction-layout">
                <article class="instruction-card instruction-how">
                    <span class="instruction-card-eyebrow">How to play</span>
                    <ol>
                        ${steps.map((step, index) => `
                            <li><span>${index + 1}</span><p>${window.escapeHTML(step)}</p></li>
                        `).join('')}
                    </ol>
                    ${note ? `<div class="instruction-note">${window.escapeHTML(note)}</div>` : ''}
                </article>
                <aside class="instruction-card instruction-setup">
                    <span class="instruction-card-eyebrow">Custom setup</span>
                    <div class="instruction-setup-list">
                        ${setup.map(item => `
                            <div><span>${window.escapeHTML(item.label)}</span><strong>${window.escapeHTML(item.value)}</strong></div>
                        `).join('')}
                    </div>
                    <div class="instruction-official">
                        <span>★ Official preset</span>
                        <strong>${window.escapeHTML(officialLabel.replace(/^Official:\s*/i, ''))}</strong>
                    </div>
                </aside>
            </div>
            <footer class="instruction-actions">
                <button class="instruction-start-button" onclick="${startAction}">Start Custom</button>
                <button class="instruction-official-button" onclick="${officialAction}">Start Official</button>
                <button onclick="${backAction}">Back to Menu</button>
            </footer>
            <p class="instruction-shortcut">Press <kbd>M</kbd> or use the gear to adjust this drill.</p>
        </section>
    `;
};

window.renderGameScreen = function renderGameScreen({
    drillName,
    mode = 'Custom',
    progressLabel,
    progressCurrent,
    progressTotal,
    progressId = '',
    stageHTML,
    hint = '',
    backAction,
    screenClass = ''
}) {
    const safeProgressId = progressId ? ` id="${window.escapeHTML(progressId)}"` : '';
    const modeClass = mode === 'Official' ? ' game-mode-badge-official' : '';

    return `
        <section class="game-screen ${window.escapeHTML(screenClass)}" aria-label="${window.escapeHTML(drillName)} active drill">
            <header class="game-hud">
                <button id="back-btn" class="game-back-button" onclick="${backAction}" aria-label="Exit ${window.escapeHTML(drillName)}">
                    <span aria-hidden="true">←</span> Exit
                </button>
                <div class="game-hud-identity">
                    <span>Active drill</span>
                    <strong>${window.escapeHTML(drillName)}</strong>
                </div>
                <span class="game-mode-badge${modeClass}">${mode === 'Official' ? '★ ' : ''}${window.escapeHTML(mode)}</span>
                <div class="game-progress" aria-live="polite">
                    <span>${window.escapeHTML(progressLabel)}</span>
                    <strong><span${safeProgressId}>${window.escapeHTML(progressCurrent)}</span><i>/</i>${window.escapeHTML(progressTotal)}</strong>
                </div>
            </header>
            <div id="game-feedback-region" class="game-feedback-region" role="status" aria-live="polite" aria-atomic="true"></div>
            <div class="game-stage">${stageHTML}</div>
            ${hint ? `<p class="game-hint"><span aria-hidden="true">◎</span>${window.escapeHTML(hint)}</p>` : ''}
        </section>
    `;
};

window.isPrimaryPointerEvent = function isPrimaryPointerEvent(event) {
    return !!event && event.isPrimary !== false && event.button === 0;
};

window.onPrimaryPointerDown = function onPrimaryPointerDown(element, handler) {
    if (!element) return;
    element.addEventListener('pointerdown', event => {
        if (!window.isPrimaryPointerEvent(event)) return;
        if (event.cancelable) event.preventDefault();
        handler(event);
    });
};

window.clearGameFeedback = function clearGameFeedback() {
    const region = document.getElementById('game-feedback-region');
    if (region) {
        clearTimeout(region._feedbackHideTimer);
        clearTimeout(region._feedbackRemoveTimer);
        clearTimeout(region._feedbackPulseTimer);
        region.replaceChildren();
    }

    document.querySelectorAll('.game-feedback-pulse').forEach(target => {
        target.classList.remove(
            'game-feedback-pulse',
            'game-feedback-pulse-success',
            'game-feedback-pulse-error',
            'game-feedback-pulse-warning'
        );
    });
};

window.showGameFeedback = function showGameFeedback({
    type = 'success',
    message,
    duration = 420,
    pulseTarget = null
}) {
    const region = document.getElementById('game-feedback-region');
    if (!region || !message) return;

    const allowedTypes = ['success', 'error', 'warning'];
    const safeType = allowedTypes.includes(type) ? type : 'success';
    const icons = { success: '✓', error: '×', warning: '!' };

    clearTimeout(region._feedbackHideTimer);
    clearTimeout(region._feedbackRemoveTimer);
    clearTimeout(region._feedbackPulseTimer);
    region.replaceChildren();

    const feedback = document.createElement('span');
    feedback.className = `game-feedback game-feedback-${safeType}`;

    const icon = document.createElement('span');
    icon.className = 'game-feedback-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = icons[safeType];

    const label = document.createElement('span');
    label.textContent = message;
    feedback.append(icon, label);
    region.appendChild(feedback);

    const target = typeof pulseTarget === 'string'
        ? document.querySelector(pulseTarget)
        : pulseTarget;
    if (target) {
        target.classList.remove(
            'game-feedback-pulse',
            'game-feedback-pulse-success',
            'game-feedback-pulse-error',
            'game-feedback-pulse-warning'
        );
        void target.offsetWidth;
        target.classList.add('game-feedback-pulse', `game-feedback-pulse-${safeType}`);
        const pulseTimer = setTimeout(() => {
            if (target) target.classList.remove('game-feedback-pulse', `game-feedback-pulse-${safeType}`);
        }, Math.min(duration, 360));
        region._feedbackPulseTimer = pulseTimer;
    }

    region._feedbackHideTimer = setTimeout(() => {
        feedback.classList.add('game-feedback-leaving');
        region._feedbackRemoveTimer = setTimeout(() => {
            if (feedback.isConnected) feedback.remove();
        }, 120);
    }, duration);
};

window.renderCompactedHistoryRow = function renderCompactedHistoryRow(archive, columnCount, renderGroup) {
    if (!archive || archive._compacted !== true) return '';

    const groups = Object.values(archive.groups || {})
        .sort((a, b) => String(a.label).localeCompare(String(b.label)));
    const sessionCount = Number(archive.sessionCount) || 0;
    const runWord = sessionCount === 1 ? 'run' : 'runs';
    const configWord = groups.length === 1 ? 'configuration' : 'configurations';
    const dateRange = [archive.firstDate, archive.lastDate]
        .filter(Boolean)
        .map(window.escapeHTML)
        .join(' → ');

    return `
        <tr class="compacted-history-row">
            <td colspan="${columnCount}">
                <details class="compacted-history">
                    <summary>
                        <strong>📦 ${sessionCount} earlier ${runWord}, compacted and averaged</strong>
                        <span>${dateRange}${dateRange ? ' • ' : ''}${groups.length} ${configWord}</span>
                    </summary>
                    <div class="compacted-history-groups">
                        ${groups.map(renderGroup).join('')}
                    </div>
                </details>
            </td>
        </tr>
    `;
};

const TAPLAB_LEVELS = Object.freeze({
    reaction: 'Reaction Test',
    popupTargets: 'Pop-up Targets',
    peripheral: 'Peripheral Awareness',
    quadrantBlink: 'Quadrant Blink',
    schulte: 'Schulte Table',
    quadrantTargets: 'Quadrant + Target',
    stroop: 'Stroop Test'
});

function clearTapLabStorage() {
    const suffixes = ['settings', 'history', 'scores'];
    Object.keys(TAPLAB_LEVELS).forEach(level => {
        suffixes.forEach(suffix => localStorage.removeItem(`${level}_${suffix}`));
    });
}

let settingsFeedbackTimeout = null;

function showSettingsFeedback(message) {
    const feedback = document.getElementById('settings-feedback');
    feedback.textContent = message;
    feedback.classList.remove('hidden');

    clearTimeout(settingsFeedbackTimeout);
    settingsFeedbackTimeout = setTimeout(() => {
        feedback.classList.add('hidden');
    }, 2500);
}

function requestConfirmation({ title, message, confirmLabel = 'Confirm' }) {
    const overlay = document.getElementById('confirm-overlay');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelButton = document.getElementById('confirm-cancel');
    const acceptButton = document.getElementById('confirm-accept');
    const previousFocus = document.activeElement;

    titleEl.textContent = title;
    messageEl.textContent = message;
    acceptButton.textContent = confirmLabel;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');

    return new Promise(resolve => {
        let settled = false;

        const finish = confirmed => {
            if (settled) return;
            settled = true;
            overlay.classList.add('hidden');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.onclick = null;
            cancelButton.onclick = null;
            acceptButton.onclick = null;
            document.removeEventListener('keydown', handleKeydown);
            if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
            resolve(confirmed);
        };

        const handleKeydown = event => {
            if (event.key === 'Escape') finish(false);
            if (event.key === 'Tab') {
                const focusOrder = [cancelButton, acceptButton];
                const currentIndex = focusOrder.indexOf(document.activeElement);
                const direction = event.shiftKey ? -1 : 1;
                const nextIndex = currentIndex === -1
                    ? 0
                    : (currentIndex + direction + focusOrder.length) % focusOrder.length;
                event.preventDefault();
                focusOrder[nextIndex].focus();
            }
        };

        cancelButton.onclick = () => finish(false);
        acceptButton.onclick = () => finish(true);
        overlay.onclick = event => {
            if (event.target === overlay) finish(false);
        };
        document.addEventListener('keydown', handleKeydown);
        cancelButton.focus();
    });
}

document.getElementById('settings-btn').addEventListener('click', toggleSettings);
document.getElementById('close-settings').addEventListener('click', toggleSettings);

document.getElementById('reset-global').addEventListener('click', async () => {
    const confirmed = await requestConfirmation({
        title: 'Reset all TapLab data?',
        message: 'This permanently removes all TapLab scores, histories, and settings from this browser. Other projects on this origin will not be touched.',
        confirmLabel: 'Reset TapLab'
    });

    if (!confirmed) return;
    clearTapLabStorage();
    showSettingsFeedback('All TapLab scores, histories, and settings were reset.');
});

document.getElementById('reset-level').addEventListener('click', async () => {
    if (!currentLevel) {
        showSettingsFeedback('Open a level before resetting its scores.');
        return;
    }

    const level = currentLevel;
    const levelLabel = TAPLAB_LEVELS[level] || level;
    const confirmed = await requestConfirmation({
        title: `Reset ${levelLabel} scores?`,
        message: 'This removes the latest result and complete history for this level. Its settings will be kept.',
        confirmLabel: 'Reset Scores'
    });

    if (!confirmed) return;
    localStorage.removeItem(`${level}_scores`);
    localStorage.removeItem(`${level}_history`);
    showSettingsFeedback(`${levelLabel} scores were reset.`);
});

document.addEventListener('keydown', (e) => {
    const confirmationOpen = !document.getElementById('confirm-overlay').classList.contains('hidden');
    if (confirmationOpen) return;
    if (e.key === 'Escape' && !document.getElementById('settings-panel').classList.contains('hidden')) {
        toggleSettings();
        return;
    }

    // Do not use the M shortcut when the user types in a field.
    const el = document.activeElement;
    if (el && (
        (el.tagName === 'INPUT' && ['text','password','email','search','url','tel','number'].includes(el.type)) ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable
    )) {
        return;
    }
    if (e.key.toLowerCase() === 'm') toggleSettings();
});

showGlobalSettingsPanel();

// Show the shared countdown overlay.
window.show321 = function show321(host, stepMs = 500) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
            pointer-events:none;z-index:9999;
        `;
        const bubble = document.createElement('div');
        bubble.style.cssText = `
            font-size:3em;font-weight:bold;color:#fff;background:rgba(0,0,0,0.55);
            padding:20px 40px;border-radius:10px;opacity:0;transition:opacity .25s, transform .25s;
            transform:scale(1);
        `;
        overlay.appendChild(bubble);

        const prevPos = getComputedStyle(host).position;
        if (prevPos === 'static' || !prevPos) host.style.position = 'relative';
        host.appendChild(overlay);

        const seq = ['3','2','1','Go!'];
        let i = 0;

        const step = () => {
            bubble.textContent = seq[i];
            bubble.style.opacity = '1';
            bubble.style.transform = 'scale(1.15)';
            setTimeout(() => {
                bubble.style.opacity = '0';
                bubble.style.transform = 'scale(1.0)';
            }, Math.min(300, stepMs - 50));

            i++;
            if (i < seq.length) setTimeout(step, stepMs);
            else setTimeout(() => { overlay.remove(); resolve(); }, stepMs);
        };
        step();
    });
};

function isCurrentRunActive() {
    const level = currentLevel ? window[currentLevel] : null;
    return !!(level && level.gameActive);
}

function setSettingsLocked(locked) {
    const button = document.getElementById('settings-btn');
    button.disabled = locked;
    button.title = locked ? 'Settings unavailable during an active run' : 'Settings';

    if (locked) {
        document.getElementById('settings-panel').classList.add('hidden');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', 'Settings unavailable during an active run');
    } else {
        button.setAttribute('aria-label', 'Settings');
    }
}

window.lockSettingsForRun = function lockSettingsForRun() {
    setSettingsLocked(true);
};

function toggleSettings() {
    if (isCurrentRunActive()) return;
    const panel = document.getElementById('settings-panel');
    const button = document.getElementById('settings-btn');
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    button.setAttribute('aria-expanded', String(opening));

    if (opening) {
        requestAnimationFrame(() => document.getElementById('close-settings').focus());
    } else if (panel.contains(document.activeElement)) {
        button.focus();
    }
}

function showGlobalSettingsPanel() {
    const panel = document.getElementById('level-specific-settings');
    panel.innerHTML = `
        <div class="settings-empty-state">
            <span>↗</span>
            <strong>Choose a drill first</strong>
            <p>Each drill has its own setup controls. Open one from the menu, then return here.</p>
        </div>
    `;
    // Hide the level reset button on the main menu.
    const rl = document.getElementById('reset-level');
    if (rl) rl.style.display = 'none';
}

function showLevelSettingsUI() {
    // Show the level reset button during a drill.
    const rl = document.getElementById('reset-level');
    if (rl) rl.style.display = 'inline-block';
}

function startLevel(levelName) {
    currentLevel = levelName;
    setSettingsLocked(false);
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');

    showLevelSettingsUI();

    if (window[levelName] && typeof window[levelName].init === 'function') {
        window[levelName].init(endLevel);
        requestAnimationFrame(() => {
            const title = document.getElementById('instruction-title');
            if (title) title.focus();
        });
    } else {
        document.getElementById('game-container').innerHTML = `<p>${levelName} not implemented yet.</p>`;
    }
}

function endLevel(results) {
    setSettingsLocked(false);
    saveScores(currentLevel, results);

    // Do not show raw JSON when the drill provides a score view.
    if (!results._customOverlay) {
        document.getElementById('game-container').classList.add('hidden');
        showResults(results);
    }
}

function returnToMenu() {
    currentLevel = null;
    setSettingsLocked(false);
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('game-container').innerHTML = '';
    document.getElementById('game-container').classList.add('hidden');

    showGlobalSettingsPanel();
    requestAnimationFrame(() => {
        const firstDrill = document.querySelector('.menu-card');
        if (firstDrill) firstDrill.focus();
    });
}

function showResults(results) {
    document.getElementById('results-content').innerHTML = `<pre>${JSON.stringify(results, null, 2)}</pre>`;
    document.getElementById('results').classList.remove('hidden');
}

function saveScores(level, results) {
    localStorage.setItem(`${level}_scores`, JSON.stringify(results));
}
