let currentLevel = null;

document.getElementById('settings-btn').addEventListener('click', toggleSettings);
document.getElementById('close-settings').addEventListener('click', toggleSettings);

document.getElementById('reset-global').addEventListener('click', () => {
    if (confirm("Are you sure you want to erase ALL scores?")) {
        localStorage.clear();
        alert("All scores have been reset.");
    }
});

document.getElementById('reset-level').addEventListener('click', () => {
    if (!currentLevel) return alert("No level active.");
    if (confirm(`Reset scores for ${currentLevel}?`)) {
        localStorage.removeItem(`${currentLevel}_scores`);
        localStorage.removeItem(`${currentLevel}_history`);
        alert(`Scores for ${currentLevel} have been reset.`);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') toggleSettings();
});

showGlobalSettingsPanel();

// Shared countdown overlay, resolves when finished
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

function toggleSettings() {
    document.getElementById('settings-panel').classList.toggle('hidden');
}

function showGlobalSettingsPanel() {
    const panel = document.getElementById('level-specific-settings');
    panel.innerHTML = '<em style="opacity:.8">Open a level to see its settings.</em>';
    // hides level reset button on the main menu
    const rl = document.getElementById('reset-level');
    if (rl) rl.style.display = 'none';
}

function showLevelSettingsUI() {
    // shows level reset button inside level
    const rl = document.getElementById('reset-level');
    if (rl) rl.style.display = 'inline-block';
}

function startLevel(levelName) {
    currentLevel = levelName;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');

    showLevelSettingsUI();

    if (window[levelName] && typeof window[levelName].init === 'function') {
        window[levelName].init(endLevel);
    } else {
        document.getElementById('game-container').innerHTML = `<p>${levelName} not implemented yet.</p>`;
    }
}

function endLevel(results) {
    saveScores(currentLevel, results);

    // don't draw just JSON, if level has it's own score
    if (!results._customOverlay) {
        document.getElementById('game-container').classList.add('hidden');
        showResults(results);
    }
}

function returnToMenu() {
    currentLevel = null;
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('game-container').innerHTML = '';
    document.getElementById('game-container').classList.add('hidden');

    showGlobalSettingsPanel();
}

function showResults(results) {
    document.getElementById('results-content').innerHTML = `<pre>${JSON.stringify(results, null, 2)}</pre>`;
    document.getElementById('results').classList.remove('hidden');
}

function saveScores(level, results) {
    localStorage.setItem(`${level}_scores`, JSON.stringify(results));
}