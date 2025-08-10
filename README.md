# TapLab

**TapLab** is a fast, browser-based reflex trainer for FPS enjoyers, try-hards, and “why did that not register?” philosophers. Four bite-sized drills, zero installs, lots of timing stats, and a healthy pinch of sarcasm.

> TL;DR: Open link, pick level, hit start, get humbled in milliseconds.

---

## Why this exists

Because sometimes you don’t need a full aim trainer with 400 toggles - you just need a few sharp drills that measure:  
- how fast you **react**,  
- how fast you **get there**,  
- whether you **clicked the wrong shiny thing**, and  
- how often your **eyes lied** to you.

Also because I wanted to press buttons and see numbers go brr.

---

## The Drills

### 1) Reaction Test
Click the rectangle the moment it turns **blue-green**.  
- Tracks: per-round times, average, false starts.  
- Optional *False Start Trick* (random orange bait).  
- Built-in **benchmarks** after your run:  
  - *On The Top* - ≤ 130 ms (exceptional; F1 / pro esports best runs)  
  - *Elite* - 131–150 ms  
  - *High Ranked* - 151–180 ms  
  - *Experienced* - 181–199 ms  
  - *Average* - 200–260 ms  
  - *Below Average* - > 260 ms

### 2) Pop-up Targets
Targets spawn one-by-one in a 16:9 arena. Hover over, then click it - as fast as possible.  
- Tracks: **Hover time** (to get on target), **Click delay** (hover to click), **Total time**, **Misses**, **False hits**.  
- Optional **False Target** in orange color with adjustable chance. Clicking it doesn’t count. It just judges you.

### 3) Peripheral Awareness
Keep your eyes on the **center dot**. A tiny real target spawns in random **quadrants** among big distractor dots. Click the quadrant (UL/UR/LL/LR) - **do not chase it with your eyes**.  
- Tracks: reaction time from spawn to click, mistakes per round, average on correct trials.  
- Bonus mode: **Same color** - distractors match the target color, the true tiny target **blinks 3×** to be just barely fair.

### 4) Quadrant Blink
Every *xx* ms, one quadrant lights up briefly. Click the highlighted quadrant **during** that window.  
- Tracks: per-interval RT (correct only), **missed** intervals, **wrong** clicks, averages.  
- Adjustable speed for pain selection (100–1500 ms).

---

> Press **M** any time to toggle the Settings panel. Or just click the button.

---

## Settings (per drill)

Open the **⚙ Settings** panel:

**Reaction Test**  
- Rounds (3–10)  
- *False Start Trick* on/off

**Pop-up Targets**  
- Number of targets (1–50)  
- Target size (5–25 px)  
- False target on/off + probability (0–1, step 0.05)

**Peripheral Awareness**  
- Rounds (3–50)  
- True target size (3/6/9 px)  
- Distractor count (6–30)  
- **Same color mode** (true target blinks)

**Quadrant Blink**  
- Intervals count (10–200)  
- Blink speed (100–1500 ms, step 25)

**Reset buttons**  
- **Reset This Level’s Scores** - clears that drill’s history/scores.  
- **Reset All Scores & Settings** - scorched earth (localStorage wipe).

---

## How it measures stuff (plain English)

- **Reaction Test**: time from *blue-green paint* to your click. False/too soon flags shown.  
- **Pop-up Targets**:  
  - *Hover* = spawn→first time mouse enters target  
  - *Click delay* = hover→click  
  - *Total* = spawn→click  
  - Misses/false hits per target saved  
  - False target lifetime adapts to your past averages (capped at 2s).  
- **Peripheral**: ms from spawn→your quadrant click. Mistake = wrong quadrant (no RT).  
- **Quadrant Blink**: if you click the right quadrant during its highlight window, that interval gets an RT; else it’s **missed**. Wrong quadrant = **wrong**.

All data is kept **locally** via `localStorage`. No servers, no analytics, no cloud, no judgement (lie).

---

> Tip: Use a desktop monitor and mouse.

---

## FAQ

**Q: My reaction time seems worse than my pride allows.**  
A: Pride is not a timing function. Also, monitors, mice, browsers, and human hands all add latency. Compare yourself **to yourself** over time.

**Q: Why orange for baits?**  
A: Because it looks friendly and then ruins your day.

**Q: Does this make me better in games?**  
A: It can improve consistency and awareness. You still need aim practice, VOD review, game sense, and to stop peeking mid-reload.

---


> Tip: Git gud
