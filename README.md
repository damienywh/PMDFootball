# PMDF Football Predictor

A multiplayer prediction game for the final stretch of the Premier League season (and any other league/tournament you want to plug in).

**Live:** https://damienywh.github.io/PMDFootball/

---

## What it does

- Everyone joins with their name, sees the live Premier League table (pulled from ESPN), and predicts the final top 5 + bottom 3.
- Teams that are mathematically locked into top 5 or bottom 3 (given remaining fixtures) are auto-prefilled and locked — players can only reorder within that group.
- Each club's slot shows a pixel-art Habbo-style avatar of that team's leading scorer wearing the club colours. No copyrighted crests.
- Bonus "tiebreaker" picks: Title Winner, 6th Place (Europa), Most Goals Scored, Golden Boot. Three of the four auto-score from the live table; Golden Boot is entered by the admin at season end.
- Live leaderboard shows projected standings based on the current table, and a final leaderboard after the admin finalizes.
- Share button generates a plain-text summary with a link to the site, for pasting into WhatsApp/Slack/iMessage.
- Built so you can swap in a completely different competition (like the 2026 World Cup) by editing one file and changing one line.

---

## Deploy (first time)

1. Put the files in a new GitHub repo (`github.com/damienywh/PMDFootball`).
2. Repo **Settings** → **Pages** → source = `main` branch, `/` root.
3. Wait ~1 min. Visit `https://damienywh.github.io/PMDFootball/`.

It'll work out of the box in **local-only mode** (each player sees their own picks but not others'). To enable full multiplayer, set up Firebase — 5 mins:

### Firebase setup (enables real multiplayer with locked-down rules)

1. Go to [firebase.google.com/console](https://console.firebase.google.com/) → **Add project**. Skip Analytics if you want.
2. Left sidebar → **Build** → **Realtime Database** → **Create database**. Location: **europe-west1**. Start in test mode.
3. Left sidebar → **Build** → **Authentication** → **Get started** → **Sign-in method** tab → enable **Anonymous**. This is critical — it's what makes your rules secure without requiring users to sign up.
4. Left sidebar (gear icon) → **Project settings** → **General** tab. Scroll to **Your apps**, register a **Web app** (nickname doesn't matter). Copy the **Web API Key** shown — it looks like `AIzaSy...`.
5. Open `js/app.js`. Near the top, fill both values:
   ```js
   window.PMD.Config = {
     firebaseUrl: 'https://pmdfootball-default-rtdb.europe-west1.firebasedatabase.app',
     firebaseApiKey: 'AIzaSy...YOUR_KEY_HERE',
     adminPassword: 'CHANGE_ME',   // keep this private — change to anything you like
     siteUrl: 'https://damienywh.github.io/PMDFootball/',
   };
   ```
6. Back in Firebase → **Realtime Database** → **Rules** tab. Replace everything with:
   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null"
     }
   }
   ```
   Click **Publish**.
7. Commit + push. Done. Every visitor now gets an anonymous Firebase identity automatically (invisible to them), and the database is locked to authenticated requests only.

### What these rules protect against

- **Random scrapers / drive-by writers** — blocked. They don't go through your site, so they don't get a token.
- **The 30-day test-mode expiry warning** — gone. These rules are production-ready.
- **One player deleting another's picks** — not blocked. Anonymous auth gives everyone the same level of access. For a trust-based group game this is fine; if you need per-player write protection, we can add stricter rules later (each player can only write to `players/{their-own-uid}`). Ask if you want that.

### If you see "permission denied" errors

Most likely your API key isn't set in `js/app.js`, or Anonymous sign-in isn't enabled in Firebase Console → Authentication. Check both.

---

## How it works (for players)

1. Open the link, enter your name — that's your identity on this device.
2. Pick a team from the pool (bottom of the predictions panel), then tap a slot to place it.
3. Mathematically certain picks (Wolves + Burnley right now) are auto-filled and locked 🔒. You can reorder them within the bottom 3 but can't remove them.
4. Fill in tiebreakers for bonus points. Each is worth 4–6 pts.
5. Hit **Save Picks**. Once the admin locks the game, predictions reveal.
6. Tap **Share** to send your picks as a text (uses native share sheet on mobile, clipboard on desktop).

**Scoring:** 5 pts exact position · 2 pts correct group, wrong position · 4–6 pts per correct tiebreaker. Max base score = 40 (8 exact) + up to 19 tiebreaker = 59.

---

## Admin

Visit `/#/admin` and enter the password. Set or change the password in `js/app.js` (field: `adminPassword`). Don't commit a real password to a public repo — edit it locally or via GitHub's file editor.

Controls:
- **Lock Game / Reopen** — switch between open (picks being made) and locked (visible to all, awaiting results).
- **Enter Final Results** — manually fill the final top 5 / bottom 3. Or use **Pre-fill from Live Table** to copy the current standings.
- **Final Tiebreakers** — set the title winner, 6th place, top goals team, and Golden Boot. Auto-tracked ones (title/6th/goals) can be filled with one button. Golden Boot is manual.
- **Refresh Table** — force a pull from ESPN (normally refreshes every 5 min automatically).
- **Reset Everything** — nuclear option. Wipes all picks and returns to open phase.

---

## Swapping competitions (e.g., to 2026 World Cup)

This was designed for re-use. To pivot:

1. Open `data/worldcup-2026.js` — it's a scaffolded template.
2. Fill in the 48 qualified nations under `teams: [...]`. Each team needs:
   - `abbr`, `name`, `full`
   - `color` / `fg` / `accent` (kit colours)
   - `badge` (one of: `roundel`, `stripes-v`, `stripes-h`, `shield`, `cross`, `hoops`)
   - `espnMatch` (list of names the ESPN API might use)
   - `topScorer` with `name` and `style` block (hair/skin/facial/hairstyle)
   - `baseline` stats
3. Adjust `topN`, `botN`, `scoring`, `tiebreakers` for the format.
4. In `index.html`, change this one line:
   ```html
   <script src="data/epl-2025-26.js"></script>
   ```
   to:
   ```html
   <script src="data/worldcup-2026.js"></script>
   ```
5. Commit + push. Site now runs the World Cup game. Firebase data is namespaced per competition so EPL picks don't collide with World Cup picks.

---

## Updating top scorers

The `topScorer` fields in `data/epl-2025-26.js` are best-guess for April 2026. When a signing changes a club's top scorer, just edit the name and style attributes:

```js
topScorer: {
  name: 'Newsignings',
  style: {
    hair: '#1A0F0A',        // dark brown
    skin: '#C89773',        // medium
    facial: 'beard',        // none | beard | moustache | stubble
    hairstyle: 'short'      // bald | buzz | short | medium | long | mohawk
  }
}
```

No code changes needed. Avatar regenerates from those attributes.

---

## File layout

```
PMDFootball/
├── index.html              # Single entry point
├── css/
│   └── styles.css          # All styling
├── data/
│   ├── epl-2025-26.js      # ACTIVE competition config (teams, scorers, rules)
│   └── worldcup-2026.js    # Template for World Cup pivot
├── js/
│   ├── avatars.js          # Pixel-art avatar generator
│   ├── storage.js          # Firebase + localStorage adapter
│   ├── api.js              # ESPN live-data fetcher
│   └── app.js              # Main app (routing, rendering, scoring, share)
├── README.md               # This file
├── .nojekyll               # GitHub Pages: serve all files raw
└── .gitignore
```

---

## Data sources

- **Live table** — ESPN's unofficial API (`site.web.api.espn.com/apis/v2/sports/soccer/eng.1/standings`). CORS-enabled, no API key required. Returns rank, points, W/D/L, goals for/against, goal difference.
- **FPL API** — *not* used. Fantasy Premier League's API is CORS-blocked from browsers. If you want Golden Boot auto-tracking later, you'd need a serverless proxy (Cloudflare Worker, ~10 lines). For now the admin just picks from a short list.

---

## Tech

- Static HTML/CSS/vanilla JS — no build step, no bundler, no framework.
- Runs on any static host (GitHub Pages, Cloudflare Pages, Netlify, S3 + CloudFront, even `file://`).
- Firebase Realtime Database via REST API — no SDK.
- ESPN standings fetched on load, cached 5 min in Firebase so one fetch serves all players.

---

## Troubleshooting

**"I don't see other players' picks"** — You're in local-only mode. Set `firebaseUrl` in `js/app.js`.

**"The live table shows old data"** — Click the phase indicator in admin to force a refresh, or wait 5 min for the cache to expire.

**"My admin password doesn't work"** — Check the `adminPassword` value in `js/app.js`. You set it yourself; there is no default.

**"I deployed but the styles aren't loading"** — Make sure `.nojekyll` is in the repo root. Without it, GitHub Pages runs Jekyll which can ignore files starting with underscores.

**"Avatars look off"** — Edit the `topScorer.style` attributes in `data/epl-2025-26.js`. The generator is fully parametric.
