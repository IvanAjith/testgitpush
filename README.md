# Void Brawl

A cartoon 3D space brawler that runs in the browser. Fight 3–7 computer opponents on floating arenas and knock everyone off the edge. Last fighter standing wins.

## Controls

| Input | Action |
|---|---|
| Arrow keys (or WASD) | Move |
| Left click | Attack (a random move each time) |
| Right click (or Space) | Jump (press again in the air for a double jump) |
| Q / E | Turn the camera |
| Esc / M / F | Pause / mute / fast-forward while spectating |

Land **6 hits** and your next attack is a **SUPER** that launches the opponent out of the arena.

## Play locally

The game uses ES modules, so open it through a local web server (double-clicking `index.html` won't work):

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Host on GitHub Pages

1. Merge this branch into the repository's default branch.
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Choose the default branch and the `/ (root)` folder, then **Save**.
4. After a minute the game is live at `https://<your-github-username>.github.io/<repo-name>/`.

No build step is needed. Three.js is bundled in `lib/`, so it works offline.

## Play on an Android phone

On a phone the game shows a **thumb-stick on the left** and **JUMP / HIT buttons on the right** (drag the right side of the screen to turn the camera).

- **APK:** every push builds an installable APK on GitHub (see `.github/workflows/android.yml`). Download `VoidBrawl.apk` from the repo's **Releases** page (tag `android-latest`) on your phone, open it and allow "install unknown apps".
- **No-APK option:** once the game is hosted on GitHub Pages, open the link in Chrome on your phone and choose **Add to Home screen**.

## Files

- `index.html`, `style.css`: menu and HUD.
- `game.js`: arenas, combat, AI, camera, audio.
- `characters.js`: the fighter roster and the model builder. **Add a new fighter by adding an entry to `ROSTER`.**
- `lib/three.module.js`: Three.js r160 (MIT licence).
