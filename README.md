[![Make.fun competition](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Rank](https://make.fun/badge/best-stealth-game-20261121-1759/vickyair1/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Reward](https://make.fun/badge/best-stealth-game-20261121-1759/vickyair1/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

# NIGHTJAR — the Lamplighter Heists

A complete top-down stealth game for [make.fun's best stealth game bounty](https://make.fun/bounty/best-stealth-game-20261121-1759). You are Wren, a nightjar-thief in the canal city of Velmora. Steal each night's relic, then reach the exit unseen.

## The game

Six nights, six heists, one bird that is never seen:

| Night | Heist | Wardens | Extras |
|---|---|---|---|
| 1 | The Chandler's Yard | 3 | learn the dark |
| 2 | Ink Market at Midnight | 4 | tripwire |
| 3 | The Paper Mill | 5 | sweeping camera |
| 4 | The Clocktower Works | 6 | hound, 2 cameras |
| 5 | The Gilded Archive | 7 | hound, lasers |
| 6 | The Lamplighter's Vault | 8 | 2 hounds, 3 cameras |

- **Vision cones, raycast** — walls and tall crates carve every cone; hedges hide a crouched thief but never block a cone.
- **Light and shadow** — lamp pools make you seen farther and faster; shadow is your friend.
- **Detection with recovery** — patrol → suspicious (`?`) → alert (`!`, chase) → search your last seen spot → give up. A near miss raises the alarm; breaking line of sight lets you recover.
- **Noise** — sprinting is loud, sneaking is silent; thrown coins clink and pull wardens over; a whistle lures them; footsteps tell you where a guard is (synthesized Web Audio, no files).
- **Gadgets** — 3 coins to throw, 2 smoke puffs that blind cones, a whistle on a cooldown.
- **Tripwires, cameras, hounds** — cameras sweep and trip the alarm; hounds hear farther and run faster.
- **Ratings** — GHOST (never spotted), SHADOW, SEEN; stars, par times, best times and unlocks saved per night.

## Controls

- **WASD / arrows** move · **SHIFT** sneak (silent, hidden in low cover)
- **SPACE** sprint (loud) · **CLICK** throw a coin · **F** smoke puff · **E** whistle
- **R** retry the night · **ESC** pause · **M** menu

## Play it

Static files, no network request, no build step:

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots live in `screenshots/` (cover first). The entry program is `main.ts` (Node 22): it copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.

## Source layout

- `game/src/config.js` — geometry, tuning, palette
- `game/src/levels.js` — the six nights: floor plans, patrols, lamps, cameras
- `game/src/vision.js` — line of sight, raycast cones
- `game/src/guards.js` — warden / hound / camera brains
- `game/src/player.js` — movement, collision, gadgets
- `game/src/world.js` — the level state: light, noise, smoke, loot, alarm
- `game/src/render.js` — lamplit floors, cones, cover, the thief
- `game/src/hud.js` — detection panel, legend, title / complete / caught screens
- `game/src/audio.js` — every sound synthesized with Web Audio
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — the staged screenshot scenes
- `game/src/main.js` — screens, the loop, progress

## License

MIT — see [LICENSE](LICENSE).
