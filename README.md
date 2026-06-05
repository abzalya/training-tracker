# Training Tracker

A local-first PWA for tracking gym + run sessions against your 12-week plan.
No backend, no accounts, no AI — your data lives in the browser (IndexedDB) and
works fully offline mid-workout. Pre-seeded with your PPL split and run sessions.

## What it does
- **Today** — knows the weekday, shows the planned session pre-filled. Punch in
  weight × reps per set; last session shows as a faded target to beat. Notes per
  exercise and per session. Runs auto-compute pace + HR zone.
- **History** — every session, color-coded (green gym / blue run).
- **Progress** — estimated 1RM trend per lift (Epley), weekly volume per muscle
  group, easy-run avg-HR trend (your Week-6 base-building check), pace trend.
- **Export** — one tap copies a clean markdown summary to paste into Claude for
  analysis, plus JSON backup / restore.

## Run locally (on your Mac)
```bash
cd training-tracker
python3 -m http.server 8732
# open http://localhost:8732
```
Service workers + IndexedDB need an http(s) origin, so open it via localhost,
not by double-clicking the file.

## Put it on your iPhone (so it feels native)
A PWA can only install as a real app over **HTTPS**. Easiest path:
1. Push this folder to a GitHub repo.
2. Enable GitHub Pages (or drag the folder onto netlify.com / vercel.com).
3. Open the https URL in **Safari** on your phone → Share → **Add to Home Screen**.

Launched from the home-screen icon it runs full-screen with no Safari chrome —
indistinguishable from a native app, and works with the phone in airplane mode.

## Heads-up
- iOS can evict PWA storage if the app is unused for a long time and the device
  is low on space. The **Download backup** button is your safety net — export
  occasionally. (Cloud sync is a future phase if you want multi-device.)

## Files
- `data.js` — your plan (exercises, runs, HR zones). Edit freely.
- `db.js` — IndexedDB storage.
- `app.js` — views + logic. `charts.js` — dependency-free SVG charts.
- `sw.js` / `manifest.webmanifest` — offline app-shell + install metadata.
