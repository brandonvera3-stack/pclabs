# PCLabs — Desktop App Setup Guide

Everything you need to go from zero to a running Windows app.

---

## What you're building

A real Windows desktop app that scans your PC and shows:
- CPU, GPU, RAM, OS, and disk info (real data from your machine)
- A PC Health Score based on simple logic
- Gaming Readiness rating
- Top issues and recommended actions

**Stack:** Electron + HTML/CSS/JavaScript
- Electron is the same technology used by VS Code, Slack, Discord, and Figma
- You write the UI in HTML/CSS and the Windows parts in JavaScript
- No Python, no C#, no complex setup

---

## STEP 1 — Install Node.js

1. Go to: **https://nodejs.org**
2. Download the **LTS** version (the green button)
3. Run the installer — click Next through everything, keep all defaults
4. When it finishes, open **Command Prompt** (search "cmd" in Start)
5. Type: `node --version`
   You should see something like: `v20.11.0`
   If you do, Node is installed. ✓

---

## STEP 2 — Put the files in a folder

1. Create a new folder somewhere easy, e.g.:
   `C:\Users\YourName\Desktop\pclabs`
2. Copy all 4 files into that folder:
   - `package.json`
   - `main.js`
   - `preload.js`
   - `index.html`

Your folder should look like this:
```
pclabs/
  package.json
  main.js
  preload.js
  index.html
```

---

## STEP 3 — Install dependencies

1. Open **Command Prompt**
2. Navigate to your folder:
   ```
   cd C:\Users\YourName\Desktop\pclabs
   ```
   (replace YourName with your actual Windows username)
3. Run:
   ```
   npm install
   ```
4. Wait. This downloads Electron (~120 MB). It will take 1–3 minutes.
   You'll see a progress bar. When it says "added X packages" — done. ✓

---

## STEP 4 — Run the app

Still in Command Prompt, in your pclabs folder, run:
```
npm start
```

The PCLabs window will open. Click **Run Full Scan** — it will read your real PC hardware using Windows built-in tools (wmic, PowerShell).

To stop the app, close the window or press Ctrl+C in Command Prompt.

---

## STEP 5 — Build a .exe installer

When you're ready to share PCLabs as a proper Windows installer:

1. In Command Prompt, in your pclabs folder, run:
   ```
   npm run build
   ```
2. Wait ~2–5 minutes. electron-builder packages everything.
3. When done, look inside the new `dist/` folder.
   You'll find a file like: `PCLabs Setup 0.1.0.exe`
4. Double-click it to install PCLabs on your PC like any normal app.
   It creates a Start Menu shortcut and optionally a desktop icon.

To share the app with others: send them the `PCLabs Setup 0.1.0.exe` file.
They don't need Node.js — the installer is self-contained.

---

## How the real data collection works

PCLabs uses two built-in Windows tools — no extra software needed:

| Data          | How it's collected                              |
|---------------|-------------------------------------------------|
| CPU name      | `wmic cpu get name`                             |
| GPU name      | `wmic path win32_videocontroller get name`      |
| OS version    | `wmic os get caption,version`                   |
| Disk usage    | `wmic logicaldisk where "DeviceID='C:'" get...` |
| RAM           | Node.js `os.totalmem()` / `os.freemem()`        |
| Startup apps  | PowerShell `Get-CimInstance Win32_StartupCommand` |

Everything is **read-only**. PCLabs never writes to your registry, never installs anything, and never modifies any system files.

---

## Replacing mock data with real collectors

The scoring logic in `main.js` in the `analyzeSystem()` function is where issues and actions are generated.

To add more real checks later:
1. Add a new `wmic()` or `ps()` call in the `run-scan` handler
2. Use the result in `analyzeSystem()` to add new issues/actions
3. The UI updates automatically — no HTML changes needed for adding new data points

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm` is not recognized | Node.js isn't installed — go back to Step 1 |
| App opens but shows sample data | This is normal on first run if wmic is slow; try scanning again |
| Build fails with icon error | Remove the `"icon"` line from package.json build section, or add a real .ico file |
| Window is blank | Check Command Prompt for error messages |

---

## File structure

```
pclabs/
  package.json   ← App name, version, scripts, build config
  main.js        ← Electron main process: window creation + data collectors
  preload.js     ← Secure bridge between Electron and the UI
  index.html     ← Entire UI: HTML + CSS + JavaScript in one file
  node_modules/  ← Created by npm install (don't edit)
  dist/          ← Created by npm run build (your .exe lives here)
```

---

## Questions or feedback

Email: hello@thepclabs.com
Website: thepclabs.com
