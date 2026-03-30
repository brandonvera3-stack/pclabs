# PCLabs

Free Windows PC diagnostics and gaming optimization app.

PCLabs scans your system and gives you plain-English results — no technical knowledge required. It runs entirely on your machine. Nothing is sent anywhere, and nothing is modified.

---

## What it checks

| Category | What's scanned |
|---|---|
| System Profile | CPU, GPU, RAM, OS version, uptime |
| Storage Health | Disk type, S.M.A.R.T. status, space usage |
| Stability & Crashes | BSODs, kernel power events, WHEA errors, Windows Reliability Index |
| Performance | Startup app impact, background resource usage, disk queue |
| Windows Health & Security | Windows Defender status, pending updates, SFC/DISM flags |
| Network & Gaming | Adapter info, connectivity, gaming readiness rating |

**Read-only.** PCLabs never writes to your registry, modifies system files, or changes any settings unless you explicitly apply an optimization.

---

## Pro features

- **Junk Cleaner** — scan and remove temp files, update caches, crash dumps, browser caches
- **Game Optimizer** — apply performance tweaks (HAGS, power plan, Nagle, Game Bar, fullscreen optimizations)
- **Game Profiles** — per-game settings recommendations for 22 popular titles
- **Export Report** — save a full diagnostic report as HTML

---

## Download

Download the latest installer from the [releases page](https://github.com/brandonvera3-stack/pclabs/releases).

Requires Windows 10 or 11 (x64).

---

## Build from source

```bash
# Clone the repo
git clone https://github.com/brandonvera3-stack/pclabs.git
cd pclabs

# Install dependencies
npm install

# Run in development
npm start

# Build the Windows installer
npm run build
# Output: dist/PCLabs Setup 0.2.0.exe
```

> **Note:** `keys.json` is required to run the app and is not included in the repo (it is gitignored). Without it, Pro license validation will not function and the app may crash on startup.

---

## License

MIT — see [LICENSE](LICENSE) for details.
