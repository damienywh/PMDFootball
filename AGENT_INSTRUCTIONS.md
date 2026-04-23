# Agent Instructions — PMDF Football Predictor Deployment

You (the agent) are helping Damien deploy **PMDF Football Predictor** to GitHub Pages at `https://damienywh.github.io/PMDFootball/`.

**Secrets policy: do NOT add any secrets, passwords, or API keys to this file, the README, or any committed docs.** Credentials live only in `js/app.js` (which is client-side code anyway — Firebase Web API keys are designed to be exposed there). The admin password is a client-side gate; treat it as something the user sets privately in `js/app.js` and never print it in documentation, commit messages, or chat output.

---

## Context you need

- **Repo:** `github.com/damienywh/PMDFootball` (already exists, Pages enabled on `main` branch, root path)
- **Live URL:** `https://damienywh.github.io/PMDFootball/`
- **Source files:** contents of `PMDFootball.zip` — these must land at the **repo root**, not inside a subfolder.
- **Firebase already configured:** `firebaseUrl` + `firebaseApiKey` are already in `js/app.js`. Do not regenerate or re-edit those values.
- **Commit author:** Use Damien's usual git config (`damienywh` / his registered email).

---

## Steps

### 1. Clone the repo (or update the local checkout)

```bash
cd ~/projects   # or wherever Damien keeps repos
rm -rf PMDFootball-deploy
git clone git@github.com:damienywh/PMDFootball.git PMDFootball-deploy
cd PMDFootball-deploy
```

If SSH isn't set up, use HTTPS with a PAT:
```bash
git clone https://github.com/damienywh/PMDFootball.git PMDFootball-deploy
```

### 2. Wipe existing contents (preserving `.git`)

The repo has broken/stale files. Remove everything except `.git`:

```bash
find . -mindepth 1 -not -path './.git' -not -path './.git/*' -delete
```

Verify — should show only `.git`:
```bash
ls -la
```

### 3. Unzip the new build into the repo root

Assume the zip is at `~/Downloads/PMDFootball.zip` (or wherever Damien saved it):

```bash
unzip -o ~/Downloads/PMDFootball.zip -d .
```

The new zip has files at the **root** (no wrapping `PMDFootball/` folder). After unzipping, the repo root should contain: `index.html`, `css/`, `data/`, `js/`, `README.md`, `.nojekyll`, `.gitignore`, `AGENT_INSTRUCTIONS.md`.

Verify:
```bash
ls -la
# Expected output includes: .nojekyll  .gitignore  index.html  css  data  js  README.md
```

`.nojekyll` is the critical file — without it, GitHub Pages runs Jekyll which can strip files. Confirm it's there:
```bash
test -f .nojekyll && echo "OK" || echo "MISSING"
```

### 4. Sanity-check the code

Before pushing, confirm the Firebase config is populated (NOT the empty placeholder):

```bash
grep -E "firebaseUrl|firebaseApiKey" js/app.js
```

Should show:
```
firebaseUrl: 'https://pmdfootball-default-rtdb.europe-west1.firebasedatabase.app',
firebaseApiKey: 'AIzaSy...' + 30+ chars,
```

If `firebaseApiKey` is empty or just a placeholder (`'CHANGE_ME'`, `''`), stop and report — do NOT guess values.

Check JS syntax:
```bash
for f in js/*.js data/*.js; do node --check "$f" || echo "SYNTAX ERROR: $f"; done
```

### 5. Commit and push to main

```bash
git add -A
git status    # review what's being committed

git commit -m "Deploy PMDF Football Predictor — full rebuild with Firebase auth, pixel avatars, certainty engine"
git push origin main
```

### 6. Verify the deployment

After the push, wait ~60 seconds for GitHub Pages to rebuild. Then:

```bash
# Check the site loads and serves the new version
curl -sL https://damienywh.github.io/PMDFootball/ | grep -E "PMDF Football|PMD Predictor|Final Five"
```

**Expected:** matches `PMDF Football` or `PMD Predictor` (the new branding).
**Problem signal:** if it matches `Final Five`, the old cached build is still live — wait another minute, hard-refresh, and re-check.

If still broken after 3 minutes, check the Actions tab:
```
https://github.com/damienywh/PMDFootball/actions
```

The most recent `pages-build-deployment` workflow will show the error. Common failures:

- **"Jekyll build failed"** — `.nojekyll` is missing. Re-verify step 3.
- **"No such file or directory"** — structure is nested. Re-verify step 2 wiped everything.
- **"Permission denied"** — git credentials issue; needs user intervention.

### 7. Report back

Reply to Damien with:
- ✅ / ❌ for each of the 6 steps above
- The commit SHA (`git rev-parse HEAD`)
- The grep output from step 6
- Any errors encountered, verbatim

Do not attempt to modify Firebase rules, the data files, or the Config block. If those seem wrong, stop and ask.

---

## Quick single-line version (for the confident agent)

```bash
cd ~/projects && \
  rm -rf PMDFootball-deploy && \
  git clone git@github.com:damienywh/PMDFootball.git PMDFootball-deploy && \
  cd PMDFootball-deploy && \
  find . -mindepth 1 -not -path './.git' -not -path './.git/*' -delete && \
  unzip -o ~/Downloads/PMDFootball.zip -d . && \
  test -f .nojekyll && test -f index.html && \
  grep -qE "firebaseApiKey: 'AIzaSy[A-Za-z0-9_-]{30,}'" js/app.js && \
  git add -A && \
  git commit -m "Deploy PMDF Football Predictor — clean rebuild" && \
  git push origin main && \
  echo "DEPLOYED — check https://damienywh.github.io/PMDFootball/ in 60s"
```

---

## If the zip isn't where expected

Damien may have downloaded it to:
- `~/Downloads/PMDFootball.zip` (default)
- `~/Desktop/PMDFootball.zip`
- iCloud / Google Drive sync folder

Search:
```bash
find ~ -name "PMDFootball.zip" 2>/dev/null | head -5
```

Use the first match.
