# TapLab

TapLab is a fast, browser based reflex trainer for FPS enjoyers, tryhards, and "why did that not register?" philosophers. Seven little drills, zero installs, lots of timing stats, and a healthy pinch of sarcasm.

**TL;DR:** Open link, pick level, hit start, and prove yourself I guess?

## Why this exists

Because sometimes you don't need a full aim trainer with xx toggles - you just need a few sharp drills that measure:

* how fast you react,
* how fast you get there,
* how often your eyes lied to you,
* and whether you can read the word "RED" without your brain betraying you.

Also because I wanted to press buttons and see numbers go brr.

## The Drills

### 1) Reaction Test
Click the rectangle the moment it turns blue green .. teal? idk

* Tracks: per round times, average, false starts.
* Optional False Start Trick (random orange bait - don't click it).
* Built-in benchmarks after your run:
   * On The Top - ≤ 130 ms (exceptional; F1 / pro esports best runs)
   * Elite - 131-150 ms
   * High Ranked - 151-180 ms
   * Experienced - 181-199 ms
   * Average - 200-260 ms
   * Below Average - > 260 ms

### 2) Pop-up Targets
Targets spawn one by one. Hover over, then click - as fast as possible.

* Tracks: Hover time (to get on target), Click delay (hover to click), Total time, Misses, False hits.
* Optional False Target in orange with adjustable chance. Clicking it doesn't count, but everyone will judge you.
* Stats only, no rank - mouse travel depends too much on your setup to slap a universal grade on it (see *About the ranks* below).

### 3) Peripheral Awareness
Keep your eyes on the center dot. A tiny real target spawns in a random quadrant among big distractor dots. Click the quadrant (UL/UR/LL/LR) - do not chase it with your eyes.

* Tracks: reaction time from spawn to click, mistakes per round, average on correct trials.
* Bonus mode: Same color - distractors match the target color and the true tiny target blinks 3x. Significantly less fun, which is the point.
* Stats only, no rank.

### 4) Quadrant Blink
Every xx ms, one quadrant lights up briefly. Click the highlighted quadrant during that window.

* Tracks: per interval RT (correct only), errors (missed + wrong), accuracy, averages.
* Adjustable speed for pain selection (100-1500 ms, in 5 ms steps).
* Ranked - and the rank only counts if you actually qualify. Nailing one lucky click while missing everything else gets you "Unranked" but nice try.
   * Best tier is ≤ 200 ms, seemed reasonable and all the other tier numbers are from very specific place - my imagination.
* "Next level: YES/NO" tells you when you're ready to drop the speed: 75% accuracy **and** at least half your correct clicks already fast enough for the next 5 ms step.

### 5) Schulte Table
The classic attention/peripheral vision grid. Numbers, scattered around. Click them in order, starting at 1.

* Pick your grid from 3x3 to 9x9.
* Optional Shuffle mode: every correct pick reshuffles the *remaining* numbers. Picked numbers stay put, highlighted. Muscle memory need not to apply.
* Optional center fixation dot (a hollow ring, so it doesn't sit on top of the number) for proper "find it with your peripheral vision" training.
* Tracks: total time, per cell time, errors, slowest finds.
* Ranked on time per cell, anchored to documented 5x5 norms: ≤ 0.60 s/cell is exceptional (~15s on a 5x5), ~1.4-1.8 s/cell is typical.

### 6) Quadrant + Target
Two stage drill. A quadrant lights up - click it - then a target spawns *inside* that quadrant - click that too - then the next quadrant. Repeat for your chosen number of cycles.

* Tracks: quadrant reaction time, target hover time, click delay, errors.
* Optional fake light ups: orange = fake (it vanishes on its own, don't touch it), teal = real (go). Clicking a fake is an error. Fakes never pollute your real timing - they just test your patience.
* Stats only, no rank (it's a hybrid task with no honest benchmark to compare against).

### 7) Stroop Test
A color *word* appears, printed in some *ink color*. Click the swatch matching the **ink** - not what the word says. Your brain will try to read the word. That's the whole joke.

* Six colors, six swatches, and the swatches reshuffle after every correct answer so you can't autopilot by position.
* Tracks: accuracy, average reaction, congruent vs incongruent times.
* The headline number is **Stroop interference** (how much slower incongruent trials are) - interpreted against the documented healthy adult range (typically 50-200 ms).

Press **M** any time to toggle the Settings panel. Or just click the button like a civilized person.

## Official Mode

Every drill has a **Start Official** button next to the normal Start.

It loads a fixed preset - same grid, same speed, same trial count for everyone - so scores are actually comparable instead of "well I set it to 5 rounds and 30px targets so." Official runs get a gold ★ Official badge on the results screen and an "Official" tag in history.

It's local only, so "comparing between people" means screenshots and bragging rights, not a live leaderboard. The official presets:

| Drill | Official preset |
|---|---|
| Reaction Test | 25 rounds, false start on |
| Pop-up Targets | 25 targets, 10px, false targets on (0.3) |
| Peripheral Awareness | 25 rounds, 3px target, 50 distractors, same color mode |
| Quadrant Blink | 100 intervals @ 250 ms |
| Schulte Table | 5x5, shuffle on, fixation dot on |
| Quadrant + Target | 25 cycles, 10px target, fakes on (0.3) |
| Stroop Test | 25 trials, 75% incongruent |

## Settings (per drill)

Open the ⚙ Settings panel:

**Reaction Test**
* Rounds (5-50)
* False Start Trick on/off

**Pop-up Targets**
* Number of targets (5-50)
* Target size (10/15/20/25/30 px)
* False target on/off + probability (0-1, step 0.05)

**Peripheral Awareness**
* Rounds (5-50)
* True target size (3/6/9 px)
* Distractor count (10-50)
* Same color mode (true target blinks)

**Quadrant Blink**
* Intervals count (25-200)
* Blink speed (100-1500 ms, step 5)

**Schulte Table**
* Grid size (3x3 to 9x9)
* Shuffle remaining after each pick on/off
* Center fixation dot on/off

**Quadrant + Target**
* Cycles (5-50)
* Target size (10/15/20/25/30 px)
* Fake light-ups on/off + chance (0-1)

**Stroop Test**
* Trials (5-50)
* Incongruent chance (0-1)

**Reset buttons**
* Reset This Level's Scores - clears that drill's history/scores.
* Reset All Scores & Settings - scorched earth (localStorage wipe).

All data is kept locally via `localStorage`. Clear your browser data and it's gone - there's no cloud, no account, no one watching your 340 ms average but you.

## About the ranks

Not every drill has a rank, on purpose. Because.

* **Ranked:** Reaction Test, Schulte Table - tasks with documented human benchmarks. Quadrant Blink - has unofficial ranks.
* **Stats only:** Pop-up Targets, Peripheral Awareness, Quadrant + Target - hybrid tasks where the time depends so much on screen size, mouse, and DPI that a universal grade would just be made up confidence.
* **Stroop:** stats only, but with a research grounded read of your interference score.

> Tip: Use a desktop monitor and a mouse. I am ignoring all of you that want to use phone. Do not the cat.

## FAQ

**Q: My reaction time seems worse than my pride allows.**  
A: Pride is not a timing function. Monitors, mice, browsers, and human hands all add latency. Compare yourself to yourself over time.

**Q: Why orange for baits?**  
A: Because it looks friendly and then ruins your day, idk.

**Q: I clicked the lit quadrant but it said I missed / clicked wrong?**  
A: You were probably a hair too slow - the highlight expired and your in flight click landed on the next one. That's the drill working, not the drill lying. Scoring is strict to the speed you picked, but the highlight can visually linger a frame more, tho I don't think I ever saw this happen.

**Q: Does this make me better in games?**  
A: It can improve speed, consistency and awareness. You still need aim practice, VOD review, game sense, and to stop peeking mid reload.

> Tip: Git gud
