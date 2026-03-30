# PCLabs — Project Context v0.2.0

## Overview

PCLabs is a Windows desktop application built with Electron and PowerShell that gives users a one-click diagnostic and optimization tool for their PC. It targets Windows gamers and general PC users who want to understand their system health and squeeze more performance out of their hardware without needing technical knowledge.

- **Current version:** v0.2.0
- **License:** MIT (open source)
- **Tech stack:** Electron (main + renderer), PowerShell (all system data collection), vanilla JS (no frameworks), plain CSS
- **Target audience:** Windows 10/11 gamers and general PC users
- **Distribution:** NSIS installer built with electron-builder, released on GitHub

---

## File Structure (App)

Local path: `C:\Users\brand\OneDrive\Desktop\pclabs`

| File | Purpose |
|---|---|
| `main.js` | Electron main process. Creates the BrowserWindow, registers all `ipcMain.handle` handlers, contains all PowerShell data collectors (`pse`, `pseFile`), score calculation logic, and Pro license validation (keys loaded from `keys.json` at startup). |
| `index.html` | App shell markup only. References `styles.css` (via `<link>`) and `renderer.js` (via `<script>`). Contains all screen `<div>` elements, sidebar nav, titlebar, and the Pro gate modal. No inline JS or CSS. |
| `styles.css` | All CSS for the app. Includes CSS variables, screen layouts, component styles (cards, badges, bars, tabs), game profile cards, junk cleaner UI, optimizer UI, and all responsive rules. |
| `renderer.js` | All frontend JS logic (~1850 lines). Handles screen navigation, scan rendering, Pro gate, junk cleaner, game optimizer, game profile cards, export reports. Communicates with main process via `window.pclabs.*` (the contextBridge API). |
| `preload.js` | Thin bridge. Uses `contextBridge.exposeInMainWorld('pclabs', {...})` to safely expose IPC calls to the renderer with `contextIsolation: true` and `nodeIntegration: false`. |
| `package.json` | Electron app manifest and electron-builder config. Version `0.2.0`, build target Windows x64 NSIS installer. `files` array: `["main.js", "preload.js", "index.html", "renderer.js", "styles.css", "keys.json"]` — all must be present or the installer will break. |
| `package-lock.json` | npm lockfile. |
| `dist/` | Build output folder. Contains `PCLabs Setup 0.2.0.exe` after running `npm run build`. Not committed to git. |
| `website/` | Stale website copy — not used for deployment. See Repos section. |
| `PCLABS_PROJECT_CONTEXT.md` | This file. |
| `PCLABS_MASTER_SAVE_STATE.txt` | Periodic full snapshot of all source files for recovery. |
| `beta-keys.md` | Archived key log — rotated keys (revoked) and active keys with distribution status. **Listed in `.gitignore` — never commit this file.** |
| `keys.json` | Active Pro license keys loaded at runtime. **Listed in `.gitignore` — never commit this file. App crashes on startup if missing.** |
| `README.md` | Basic project readme. |
| `arcai-prompts.md` | AI prompt drafts/notes. |
| `content-calendar.md` | Marketing content calendar. |
| `discord-setup.md` | Discord server setup notes. |
| `monetization-roadmap.md` | Monetization planning doc. |
| `social-setup.md` | Social media setup notes. |
| `stripe-setup.md` | Stripe integration planning. |
| `vercel.json` | Vercel config (for website, not app). |

---

## Repos

| | |
|---|---|
| **App repo (new, active)** | https://github.com/brandonvera3-stack/pclabs |
| **App repo (old, retiring)** | https://github.com/brandonvera3-stack/pclabs-Clean |
| **Website repo** | https://github.com/brandonvera3-stack/PC-Labs-Site |
| **Website live** | https://www.thepclabs.com |
| **Website hosting** | Vercel — auto-deploys on push to `PC-Labs-Site` main branch |
| **Website local** | `C:\Users\brand\OneDrive\Desktop\pc-labs-site` |

**IMPORTANT:** The app repo is being migrated to a clean fresh repo at `github.com/brandonvera3-stack/pclabs`. The old `pclabs-Clean` repo is being retired — do not push new work there. The new repo will have a clean git history with no exposed keys in the commit log.

**IMPORTANT:** The website is served from the `PC-Labs-Site` repo only. There is also a `website/` subfolder inside the old `pclabs-Clean` repo — this is a stale copy and is NOT what Vercel deploys. Always edit and push from `C:\Users\brand\OneDrive\Desktop\pc-labs-site`.

---

## Architecture

### IPC Pattern

```
main.js (ipcMain.handle)
  ↕  IPC channel
preload.js (contextBridge.exposeInMainWorld)
  ↕  window.pclabs.*
renderer.js (await window.pclabs.methodName())
```

Full API exposed via `window.pclabs`:

| Method | IPC Channel | Purpose |
|---|---|---|
| `runScan()` | `run-scan` | Full diagnostic scan |
| `saveReport(html)` | `save-report` | Save HTML export to disk |
| `runJunkScan()` | `run-junk-scan` | Scan for junk file categories |
| `runJunkClean(ids)` | `run-junk-clean` | Clean selected junk categories |
| `runGameDetect()` | `run-game-detect` | Detect installed games |
| `runGameOptimize(opts)` | `run-game-optimize` | Apply optimizer settings |
| `validateKey(key)` | `validate-key` | Check Pro license key |
| `minimize()` | `win-min` (send) | Minimize window |
| `maximize()` | `win-max` (send) | Toggle maximize |
| `close()` | `win-close` (send) | Close window |
| `openFeedback()` | `open-feedback` (send) | Open feedback URL in browser |
| `openExternal(url)` | `open-external` (send) | Open any URL in browser |

### PowerShell Execution

Two helpers in `main.js`:

**`pse(script, timeout = 12000)`**
- Runs a PowerShell one-liner or short inline script via `-Command`
- Use for quick CIM queries, registry reads, short operations
- Returns stdout as string, resolves null on error

**`pseFile(name, script, timeout = 18000)`**
- Writes script to a temp `.ps1` file, runs with `-ExecutionPolicy Bypass -File`
- Use for scripts with complex quoting, multi-line logic, or anything over ~3 lines
- Returns stdout as string, resolves null on error
- Required when the script contains double quotes that would break `-Command` escaping

**CRITICAL resolve pattern:**

```js
// CORRECT — use this:
resolve((stdout || '').trim() || null)

// WRONG — do NOT use this:
resolve(err ? null : stdout)
```

PowerShell exits non-zero (triggering `err`) even when it produces valid JSON output — for example when scanning directories that require elevation. The `err ? null` pattern silently discards valid data. Always use `(stdout || '').trim() || null`.

**Every PowerShell script must start with:**
```powershell
$ErrorActionPreference = 'SilentlyContinue'
```

---

## Pro Gate System

- **Key storage:** Keys are loaded at runtime from `keys.json` via `fs.readFileSync` in `main.js`. `keys.json` is gitignored and stored locally only — it is never committed.
- **Key format:** `PCLABS-XXXX-XXXX-XXXX` (no "BETA" in key names)
- **Local key reference:** `C:\Users\brand\OneDrive\Desktop\pclabs-keys\` — contains `active-keys.md` (40 current keys) and `revoked-keys.md` (40 rotated keys). Never committed.
- **Validation:** `ipcMain.handle('validate-key', (_, key) => KEYS_SET.has(String(key).trim().toUpperCase()))`
- **Persistence:** Valid key stored in `localStorage` under key `'pclabs_pro_key'`
- **Runtime flag:** `_isPro` boolean in `renderer.js`
- **Activation:** `applyProState(isPro)` — updates `_isPro`, toggles all Pro UI elements, refreshes screens
- **Init:** `initProState()` — called on startup, reads `localStorage`, calls `validateKey`, calls `applyProState`
- **Pro gate modal:** shown via `progate-modal` element when a free user tries to access a Pro feature
- **Key input:** `index.html` contains `<input placeholder="PCLABS-XXXX-XXXX-XXXX">` (label: "Pro key:")
- **Key rotation:** All 40 original hardcoded keys were rotated on 2026-03-29 after exposure in git history. New keys are in `keys.json` only.

**Init order in renderer.js (critical):**
```js
// Restore _lastOptResult BEFORE initProState()
if (_savedOpt) { try { _lastOptResult = JSON.parse(_savedOpt); } catch(_) {} }
initProState();  // may call renderOptimizerScreen() which reads _lastOptResult
```

---

## Free Features

- **Full diagnostic scan** — CPU name/speed, GPU, RAM (total/used), storage (C: used/free), disk health, uptime
- **Health score** — starts at 85, deducted by issue severity (critical −20, high −11, medium −5, low −1), clamped to 30–100 (or 100 if no issues)
- **Gaming readiness rating** — `Excellent`, `Good`, `Fair`, `Needs Work` — displayed on Overview and Gaming tabs
- **Crash and reliability history** — BSOD, kernel power events, WHEA errors from Windows Event Log
- **Windows Reliability Index** — most recent score from WMI
- **Startup app analysis** — lists startup entries with impact ratings (high/medium/low)
- **Background process monitoring** — flags known resource-heavy processes (e.g. Razer Synapse, background updaters)
- **Recommendations panel** — plain-English action items per issue found
- **Windows health checks** — Windows Defender status, pending updates, SFC/DISM flags
- **Network status** — adapter info, connectivity checks

---

## Pro Features

### Junk Cleaner

- **IPC:** `run-junk-scan`, `run-junk-clean`
- **Screen:** `s-junk`, rendered by `renderJunkScreen()`, driven by `runJunkScan()` and `runJunkClean()`
- **State:** `_junkData` holds the last scan result

**9 scan categories:**

| ID | Description |
|---|---|
| `usertemp` | User temp folder (`%TEMP%`) |
| `wintemp` | Windows temp folder (`C:\Windows\Temp`) |
| `wupdate` | Windows Update cache (`SoftwareDistribution\Download`) |
| `crashdumps` | Minidump and memory dump files |
| `thumbcache` | Windows thumbnail cache |
| `recyclebin` | Recycle Bin contents |
| `chromecache` | Google Chrome cache |
| `edgecache` | Microsoft Edge cache |
| `firefoxcache` | Firefox cache |

- Scan returns size per category; user selects which to clean via checkboxes
- Clean reports total MB freed
- `run-junk-clean` receives `selectedIds` array passed as `-IdsJson` param to PowerShell
- **CRITICAL:** Pass IDs via `-IdsJson` flag, not via inline `pse()` escaping — quote escaping breaks the match

### Game Optimizer

- **IPC:** `run-game-detect`, `run-game-optimize`
- **Screen:** `s-optimizer`, rendered by `renderOptimizerScreen()`
- **State:** `_gameData` (last detect result), `_lastOptResult` (last optimize result, persisted to `localStorage` key `'pclabs_opt_result'`)

**6 optimizations:**

| ID | Name | What it does |
|---|---|---|
| `gamebar` | Disable Xbox Game Bar | Disables overlay and background Game Bar services |
| `hags` | Enable Hardware-Accelerated GPU Scheduling | Registry key to enable HAGS |
| `powerplan` | Set Power Plan to High Performance | Activates High Performance power scheme |
| `fullscreen` | Disable Fullscreen Optimizations | Registry key to disable DWM fullscreen optimizations |
| `visualfx` | Reduce Visual Effects | Sets SystemParameters for best performance |
| `nagle` | Disable Nagle Algorithm | Registry tweak to reduce TCP buffering latency |

- Applied optimization IDs are saved to `_lastOptResult.applied[]`
- On re-render, applied optimizations are filtered out of the checklist so they don't show as options again
- All optimizations are reversible Windows settings (no game files are modified)

**Game Detection — launchers scanned:**
Steam, Epic Games, Xbox/Game Pass, Battle.net, EA App, Ubisoft Connect, GOG Galaxy, Riot Games, Rockstar Games Launcher, Minecraft/Java

- Scans all available drive letters, not just C:
- Steam uses ACF file parsing with tab-aware regex: `"name"\s*[\t ]+\s*"([^"]+)"`

**Game Profiles:**
`GAME_PROFILES` constant in `renderer.js` contains 22 game entries. Keys are lowercased game names. Each entry:
```js
{ label: 'Display Name', tips: [{ setting, value, why }] }
```
Rendered by `renderGameProfiles(games, container)` as expandable accordion cards. Cards show game name, launcher, tip count badge, and chevron. Clicking toggles `.open` class to show/hide the tips panel.

### Export Reports

- **IPC:** `save-report`
- Generates a self-contained HTML file with all scan results
- Pro-gated — free users see the progate modal
- Report footer: `PCLabs · thepclabs.com · Report generated [date]`
- `_lastScanData` is set by `populateResults()` so the export button always has current data

---

## Key State Variables (renderer.js)

| Variable | Type | Purpose |
|---|---|---|
| `_isPro` | boolean | Whether Pro is active |
| `_lastScanData` | object\|null | Last full scan result from `run-scan` |
| `_junkData` | object\|null | Last junk scan result |
| `_gameData` | object\|null | Last game detection result |
| `_lastOptResult` | object\|null | Last optimizer result; persisted to `localStorage` |
| `_activeToolScreen` | string\|null | ID of active tool screen (`'s-junk'`, `'s-optimizer'`, or null) |

---

## Screen & Navigation Architecture

- **Main screens:** navigated via `show(id)` — hides all `.screen` divs, shows target
- **Tool screens:** `s-junk`, `s-optimizer` — entered via `showToolScreen(id)`, which sets `_activeToolScreen`
- **`_activeToolScreen` guard:** `show()` returns early if `_activeToolScreen` is set and the target isn't the active tool screen — prevents async scan callbacks from navigating away
- **Clearing the guard:** Only the nav click handler sets `_activeToolScreen = null`, allowing navigation back to normal screens
- **`populateResults(data)`:** Called after scan completes. Guards on `_activeToolScreen` — if a tool screen is active, it updates data but does not switch screens

---

## Known Patterns & Gotchas

1. **Never put JS in index.html** — renderer.js was extracted out; keep it separate.
2. **Never put CSS in index.html** — styles.css was extracted out; keep it separate.
3. **`package.json` build `files` array** — must list `main.js`, `preload.js`, `index.html`, `renderer.js`, `styles.css`, `keys.json` explicitly. Missing entries = broken installer.
4. **`keys.json` must exist locally** — `main.js` reads `keys.json` at startup via `fs.readFileSync`. If the file is missing, the app will crash on startup. Always ensure `keys.json` is present at the project root before running or building.
5. **Steam ACF regex** — must be tab-aware (`\s*[\t ]+\s*`) not just space-aware. Steam sometimes uses tabs between key and value.
6. **`_lastOptResult` restore order** — must happen before `initProState()` in renderer.js startup sequence.
7. **`pseFile` vs `pse`** — use `pseFile` for any script with double quotes, multi-line logic, or file system iteration. Use `pse` for simple one-liner CIM/WMI queries.
8. **Score clamping** — score is clamped to 30–100. If no issues are found, the `noIssues` flag allows it to reach 100 (bypasses the normal 96 cap).
9. **Readiness ratings** — `Excellent` and `Good` map to green, `Fair` to amber, `Needs Work` to red.
10. **GitHub releases** — `gh` CLI token may lack `read:org` scope. Fallback: use PowerShell `Invoke-RestMethod` against the GitHub REST API directly.
11. **Website deployments** — only push to `C:\Users\brand\OneDrive\Desktop\pc-labs-site`. The `website/` folder inside the old pclabs-Clean repo is stale and not served.

---

## Website Pages

Located at `C:\Users\brand\OneDrive\Desktop\pc-labs-site`:

| File | URL | Purpose |
|---|---|---|
| `index.html` | `/` | Home page — hero, features, how it works, CTA |
| `pricing.html` | `/pricing` | Free vs Pro comparison table and FAQ |
| `download.html` | `/download` | Download button, SmartScreen notice, system requirements |
| `faq.html` | `/faq` | Full FAQ including v0.2.0 feature questions |
| `feedback.html` | `/feedback` | Bug report / feedback form (Formspree) |
| `app-preview.html` | `/app-preview` | Static mock of the app UI |

**Routing:** `vercel.json` sets `cleanUrls: true` so `/pricing` serves `pricing.html` without the extension.

**Logo:** `/images/pclabs-logo.png` — file at `pc-labs-site/images/pclabs-logo.png`. Referenced in favicon, OG image meta, and `<img>` tags across all pages.

**Current homepage content (as of 2026-03-29):**
- Hero eyebrow badge: "FREE · OPEN SOURCE · WINDOWS"
- Hero headline: "You shouldn't need a tech degree or a free afternoon to get the most out of your PC."
- Features section heading: "Here's what we actually look at"
- Checks grid section heading: "The twelve checks"
- Origin story section: added after trust bar, before features — brief founder backstory
- Transparency section: "No black boxes. No guesswork." — explains the 4 data sources (WMI/CIM, S.M.A.R.T., Windows Event Log, Registry reads), positioned before CTA
- Footer tagline: "Built for the working gamer."
- Price: $2.99 everywhere
- No time references ("30 seconds", "under a minute") anywhere on the page
- Meta description uses "open source." not "no install required."

---

## Build & Deploy

### Build the installer

```bash
cd C:\Users\brand\OneDrive\Desktop\pclabs
npm run build
# Output: dist/PCLabs Setup 0.2.0.exe
```

### Create a GitHub release (if gh CLI auth fails)

Use PowerShell `Invoke-RestMethod` directly:

```powershell
$token = "YOUR_GITHUB_TOKEN"
$headers = @{ Authorization = "token $token"; "User-Agent" = "pclabs" }

# 1. Create release
$body = @{ tag_name="v0.2.0"; name="PCLabs v0.2.0"; body="Release notes here"; draft=$false; prerelease=$false } | ConvertTo-Json
$rel = Invoke-RestMethod -Uri "https://api.github.com/repos/brandonvera3-stack/pclabs/releases" -Method Post -Headers $headers -Body $body -ContentType "application/json"

# 2. Upload asset
$uploadUrl = $rel.upload_url -replace '\{.*\}',''
$bytes = [System.IO.File]::ReadAllBytes("C:\path\to\PCLabs Setup 0.2.0.exe")
Invoke-RestMethod -Uri "${uploadUrl}?name=PCLabs-Setup-0.2.0.exe" -Method Post -Headers $headers -Body $bytes -ContentType "application/octet-stream"
```

### Deploy website

```bash
cd C:\Users\brand\OneDrive\Desktop\pc-labs-site
git add .
git commit -m "your message"
git push origin main
# Vercel auto-deploys from PC-Labs-Site repo
```

---

## Open Source

PCLabs is MIT licensed. The source code is public. Key-related files are explicitly excluded from the repo:

- `keys.json` — gitignored, never committed, must exist locally
- `beta-keys.md` — gitignored, never committed
- `pclabs-keys/` — gitignored, lives on Desktop outside the repo

The app repo is being migrated to a clean fresh history at `github.com/brandonvera3-stack/pclabs`. The old `pclabs-Clean` repo contained all 40 Pro/Beta keys in plaintext across two commits (`18c7df2`, `9e162a6`) — those keys were rotated on 2026-03-29 and are no longer valid.

---

## Current Release State (v0.2.0)

- All `Beta` / `beta` language removed from app UI and all website pages
- App titlebar: `PCLabs` (no badge)
- App sidebar: `v0.2.0`
- Pro key format: `PCLABS-XXXX-XXXX-XXXX` (no "BETA" prefix)
- Pro key label: `Pro key:` / placeholder: `PCLABS-XXXX-XXXX-XXXX`
- Export footer: `PCLabs · thepclabs.com`
- Pro price: $2.99
- Website: no "beta", "early access", "coming soon", or "v0.1.0" anywhere
- Download URL: `https://github.com/brandonvera3-stack/pclabs-Clean/releases/download/v0.2.0/PCLabs-Setup-0.2.0.exe` (will update when new repo is live)
- SmartScreen notice on download page
- Logo image committed to `pc-labs-site/images/pclabs-logo.png`
- All 40 Pro keys rotated 2026-03-29 — new keys in `keys.json` only
- App emoji removed from all UI — sidebar icons replaced with inline SVGs
- Repo being migrated to clean history at `github.com/brandonvera3-stack/pclabs`

---

## Next Feature Ideas

- **Benchmark mode** — CPU/RAM/disk benchmark with score comparison to similar hardware
- **Health score trend chart** — line graph showing score across multiple scans
- **PDF export** — premium formatted PDF report (Pro feature)
- **Driver status check** — flag outdated GPU, network, audio drivers
- **Thermal monitoring** — real-time CPU/GPU temps with alert thresholds
- **Scheduled scans** — run on startup, show badge in taskbar if issues found
- **Game config optimizer (Option A)** — write directly to game config files for top 10 popular games (Valorant, CS2, Fortnite, etc.) to apply optimal graphics/perf settings
- **Multi-PC support** — manage and compare multiple machines
