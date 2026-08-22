# TapLab

TapLab is a browser based reflex trainer with seven short drills for reaction speed, pointer control, visual attention, and response inhibition.

There are no accounts, installers, daily quests, premium currencies, or motivational owls. Open it, click things, and receive numbers that may or may not respect your self image.

Use the gear button or press **M** to open the settings.

## The seven drills

| Drill | What you do | What TapLab records | Score type |
|---|---|---|---|
| **Reaction Test** | Click when the area turns teal and ignore optional orange bait signals. | Every reaction, average reaction, and false starts. | Ranked |
| **Pop-up Targets** | Move onto each teal target and click it. Ignore optional orange targets. | Hover time, click delay, total time, misses, and false hits. | Stats only |
| **Peripheral Awareness** | Keep your gaze near the center and click the quadrant that contains the small target. | Correct reaction times, average reaction, and mistakes. | Stats only |
| **Quadrant Blink** | Click each highlighted quadrant before its interval ends. | Reaction times, average reaction, misses, wrong clicks, accuracy, and progression. | Estimated rank |
| **Schulte Table** | Find and click every number in ascending order. | Total time, time per cell, errors, and slowest finds. | Ranked |
| **Quadrant + Target** | Click the teal quadrant, then acquire and click the target inside it. | Average total, quadrant reaction, target hover, click delay, and errors. | Stats only |
| **Stroop Test** | Click the swatch that matches the ink color, not the written word. | Accuracy, reaction times, and Stroop interference. | Reference range |

Revolutionary concept, I know.

## Custom and Official runs

**Custom** uses your saved settings. Change the drill length, target size, difficulty, or optional bait modes as needed.

**Official** uses one fixed preset. This makes screenshots and comparisons more useful because everyone completed the same setup. TapLab does not have an online leaderboard, so bragging rights remain a manual process.

| Drill | Official preset |
|---|---|
| Reaction Test | 25 rounds, false starts enabled |
| Pop-up Targets | 25 targets, 10 px, false targets enabled at 0.3 probability |
| Peripheral Awareness | 25 rounds, 3 px target, 50 distractors, same-color mode |
| Quadrant Blink | 100 intervals at 250 ms |
| Schulte Table | 5 x 5, shuffle enabled, fixation point enabled |
| Quadrant + Target | 25 cycles, 10 px target, fake signals enabled at 0.3 probability |
| Stroop Test | 25 trials, 75 percent incongruent |

Official results receive a gold **Official** badge.

## Settings

| Drill | Available settings |
|---|---|
| Reaction Test | 5 to 50 rounds; false-start trick |
| Pop-up Targets | 5 to 50 targets; 5, 10, 15, 20, or 25 px targets; false targets; 0 to 1 false-target probability |
| Peripheral Awareness | 5 to 50 rounds; 3, 6, or 9 px true target; 10 to 50 distractors; same-color mode |
| Quadrant Blink | 25 to 200 intervals; 100 to 1500 ms interval in 5 ms steps |
| Schulte Table | 3 x 3 to 9 x 9 grid; shuffle mode; center fixation point |
| Quadrant + Target | 5 to 50 cycles; 10, 15, 20, 25, or 30 px target; fake signals; 0 to 1 fake probability |
| Stroop Test | 5 to 50 trials; 0 to 1 incongruent probability |

Settings are saved separately for each drill and cannot be changed during an active run.

## Timing and input

TapLab starts each measured timer after the browser paints the visual signal.

Your display, browser, operating system, and input device all add latency. Compare results on the same setup when you want a useful personal trend.

## Results and ranks

Every result screen shows a main metric, supporting statistics, and the individual measured times.

- **Reaction Test** uses reaction time benchmark tiers.
- **Schulte Table** ranks time per cell so different grid sizes remain comparable.
- **Quadrant Blink** uses estimated tiers and requires both accuracy and consistency before it awards a rank.
- **Stroop Test** compares interference with a typical adult reference range.
- **Pop-up Targets**, **Peripheral Awareness**, and **Quadrant + Target** remain stats only.

Quadrant Blink progression requires at least 75 percent accuracy and at least 50 percent correct reactions inside the next interval speed. One heroic click cannot carry 99 missed intervals. Tragic, but fair.

## History and local data

TapLab stores settings, the latest score, and run history in the browser with `localStorage`. Nothing is uploaded and there is no account or cloud synchronization.

Each drill keeps its newest 100 runs as complete history entries. When the limit is exceeded, older runs are folded into one expandable archive entry with weighted averages. The archive keeps different configurations and Official runs in separate groups.

The reset controls are available in Settings:

- **Reset This Level's Scores** removes the latest score and complete history for the current drill but keeps its settings.
- **Reset All Scores & Settings** removes all TapLab data.

Clearing browser site data also removes TapLab history. There is no recovery system hiding behind a dramatic confirmation button.

## Project structure

The project uses plain HTML, CSS, and JavaScript. It is intentionally small enough to understand without summoning a package manager.

## FAQ

**Why is my score worse than expected?**

Idk, maybe you overestimated yourself.. Hardware and browser latency also matter, so compare repeated runs instead of worshipping one number.

**Will this make me better at FPS games?**

It can help train reaction, attention, and consistency. It cannot help you with positioning, game sense, recoil control, or the wisdom to stop re-peeking the same angle.

**Can someone cheat?**

Yes. Results are local browser data, not verified competition records. Official mode standardizes the drill, not the honesty of the person holding the screenshot.

> Tip: Git gud
