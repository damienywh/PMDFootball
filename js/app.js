/* ================================================================
   PMD SPORTS PREDICTOR — MAIN APP
   ================================================================
   All game logic lives here. Reads COMPETITION config from the
   active data file, renders three routes (game/leaderboard/admin),
   manages state via PMD.Storage.

   To customise behaviour, prefer editing the competition config
   rather than this file — that keeps upgrades clean.
   ================================================================ */

(function() {
  // ===============================================================
  // CONFIG (edit these to deploy)
  // ===============================================================
  // ===============================================================
  // VERSION — bump this every time the code changes.
  // Shown in the nav so users can tell which build they're looking at.
  // ===============================================================
  const VERSION = 'v0.5.2';

  window.PMD = window.PMD || {};
  window.PMD.Config = {
    // Firebase Realtime Database URL. Leave empty for local-only mode.
    firebaseUrl: 'https://pmdfootball-default-rtdb.europe-west1.firebasedatabase.app',

    // Firebase Web API Key — enables Anonymous Auth so rules can require auth.
    // Find this in: Firebase Console → Project Settings → General → Web API Key.
    // Leave empty to use unauthenticated requests (NOT recommended).
    firebaseApiKey: 'AIzaSyCft3DVEqUEfiFYgx1SLd2PxokzrRtWB8o',

    // Admin password (client-side gate — good enough for friendly groups)
    adminPassword: 'finance',

    // Site URL — used in share messages
    siteUrl: 'https://damienywh.github.io/PMDFootball/',
  };

  // Shortcuts
  const Store = window.PMD.Storage;
  const Api = window.PMD.Api;
  const Avatar = window.PMD.Avatar;
  const C = window.COMPETITION;
  const TEAM_BY_ABBR = Object.fromEntries(C.teams.map(t => [t.abbr, t]));

  // ===============================================================
  // STATE
  // ===============================================================
  let me = null;
  let myPicks = emptyPicks();
  let myTiebreakers = {};
  let saved = true;
  let gameState = {
    phase: 'open',
    finalTop: Array(C.topN).fill(null),
    finalBot: Array(C.botN).fill(null),
    finalTiebreakers: {},
  };
  let allPlayers = [];
  let selectedTeam = null;
  let selectedContext = 'pred';
  let currentRoute = '/';
  let tableSource = 'loading';
  let tableFetchedAt = null;
  let liveTableData = [];  // live-updated team stats
  let certainTop = [];     // abbrs guaranteed in top N
  let certainBot = [];     // abbrs guaranteed in bottom N

  function emptyPicks() {
    return {
      top: Array(C.topN).fill(null),
      bot: Array(C.botN).fill(null),
    };
  }

  // ===============================================================
  // INIT
  // ===============================================================
  // Global crash banner — if anything blows up, show the error on-screen
  // instead of just silently in the console. Makes debugging on mobile
  // possible since users can't easily open DevTools.
  window.addEventListener('error', (e) => { showCrashBanner(e.message || e.error?.message, e.error?.stack); });
  window.addEventListener('unhandledrejection', (e) => { showCrashBanner('Unhandled promise: ' + (e.reason?.message || String(e.reason)), e.reason?.stack); });

  function showCrashBanner(msg, stack) {
    try {
      let banner = document.getElementById('crashBanner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'crashBanner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#FF5555;color:#fff;padding:10px 14px;font:12px/1.4 monospace;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,0.5);max-height:40vh;overflow:auto;';
        document.body.appendChild(banner);
      }
      banner.innerHTML = `<strong>⚠️ Error:</strong> ${String(msg).replace(/</g, '&lt;')}<br>
        <span style="opacity:0.8;font-size:10px;">${(stack || '').toString().split('\n').slice(0, 4).join('<br>').replace(/</g, '&lt;')}</span>
        <button onclick="document.getElementById('crashBanner').remove()" style="float:right;background:#fff;color:#000;border:0;padding:2px 8px;border-radius:3px;margin-left:10px;cursor:pointer;">×</button>`;
    } catch (_) { /* even the banner failed; nothing we can do */ }
  }

  async function init() {
    try {
      // Populate baseline table — always works, no network needed
      liveTableData = C.teams.map(t => ({ ...t, ...t.baseline }));

      // Load me (purely local)
      try { me = Store.safeParse(await Store.get('me', false), null); } catch (e) { console.warn('Load me failed', e); me = null; }

      // Load shared game state (network call — OK to fail)
      try {
        const gsRaw = await Store.get('game:state', true);
        if (gsRaw) gameState = Object.assign(gameState, Store.safeParse(gsRaw, {}));
      } catch (e) { console.warn('Load game state failed', e); }

      // Set version pill in nav + on entry screen
      const vEl = document.getElementById('navVersion');
      if (vEl) vEl.textContent = VERSION;
      const vEl2 = document.getElementById('entryVersion');
      if (vEl2) vEl2.textContent = VERSION;

      if (me && me.id) {
        await enterGame();
      } else {
        showNameEntry();
      }
    } catch (e) {
      showCrashBanner('init() crashed: ' + (e.message || e), e.stack);
      // Last-resort: still show the name entry so the user can interact
      try { showNameEntry(); } catch (_) {}
    }
  }

  function showNameEntry() {
    document.getElementById('nameEntryScreen').style.display = 'block';
    document.getElementById('appShell').style.display = 'none';
    const input = document.getElementById('nameInput');
    if (input) {
      setTimeout(() => input.focus(), 100);
      input.onkeydown = (e) => { if (e.key === 'Enter') handleEnter(); };
    }
    document.getElementById('enterBtn').onclick = handleEnter;
    const browseBtn = document.getElementById('browseOnlyBtn');
    if (browseBtn) browseBtn.onclick = async (e) => {
      e.preventDefault();
      me = null;
      await enterGame();
    };
  }

  async function enterGame() {
    try {
      document.getElementById('nameEntryScreen').style.display = 'none';
      document.getElementById('appShell').style.display = 'block';

      try { wireInlineNameEntry(); } catch (e) { console.warn('wireInlineNameEntry failed', e); }
      try { wireActions(); } catch (e) { console.warn('wireActions failed', e); }
      try { wireRouting(); } catch (e) { console.warn('wireRouting failed', e); }

      if (me && me.id) {
        try {
          const mineRaw = await Store.get('players:' + me.id, true);
          const mine = Store.safeParse(mineRaw, null);
          if (mine) {
            myPicks.top = mine.top || emptyPicks().top;
            myPicks.bot = mine.bot || emptyPicks().bot;
            myTiebreakers = mine.tiebreakers || {};
          }
        } catch (e) { console.warn('Load my picks failed', e); }
      }

      try { renderPlayerState(); } catch (e) { console.warn('renderPlayerState failed', e); }
      try { handleRoute(); } catch (e) { console.warn('handleRoute failed', e); }

      // Render baseline table IMMEDIATELY so something visible even if ESPN fails
      try {
        renderLiveStatus();
        renderLiveTable();
        renderSlots();
        renderPool();
      } catch (e) { console.warn('Initial render failed', e); }

      // Network calls — each wrapped so one failure doesn't cascade
      refreshAll().catch(e => console.warn('refreshAll failed', e));
      refreshLiveTable().catch(e => console.warn('refreshLiveTable failed', e));

      setInterval(() => refreshAll().catch(e => console.warn('refreshAll tick', e)), 4000);
      setInterval(() => refreshLiveTable(false).catch(e => console.warn('refreshLiveTable tick', e)), 5 * 60 * 1000);
    } catch (e) {
      showCrashBanner('enterGame() crashed: ' + (e.message || e), e.stack);
    }
  }

  function renderPlayerState() {
    const inline = document.getElementById('inlineNameEntry');
    const switchWrap = document.getElementById('switchPlayerWrap');
    const pill = document.getElementById('navPlayerPill');
    const nameEl = document.getElementById('navPlayerName');
    const hasMe = !!(me && me.id);

    if (inline) inline.style.display = hasMe ? 'none' : 'block';
    if (switchWrap) switchWrap.style.display = hasMe ? 'block' : 'none';
    if (pill) pill.style.display = hasMe ? 'inline-flex' : 'none';
    if (nameEl && hasMe) nameEl.textContent = me.name;
  }

  function wireInlineNameEntry() {
    // "Join" button inside the Game page when a browser decides to register
    const input = document.getElementById('inlineNameInput');
    const btn = document.getElementById('inlineJoinBtn');
    if (!input || !btn) return;
    const join = async () => {
      const name = input.value.trim();
      if (!name) return;
      await joinAs(name);
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') join(); };
    btn.onclick = join;
  }

  async function joinAs(name) {
    const id = 'p_' + Math.random().toString(36).slice(2, 10);
    me = { id, name };
    await Store.set('me', me, false);
    // joinedAt + firstLockedAt let us flag late entries. Existing records without
    // joinedAt are treated as pre-lock originals — backward compatible.
    await Store.set('players:' + id, {
      id, name,
      top: myPicks.top, bot: myPicks.bot,
      tiebreakers: {},
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    }, true);
    renderPlayerState();
    await refreshAll();
    toast(`Welcome, ${name}!`);
  }

  async function handleEnter() {
    // The fullscreen gate's "Join Game" button
    const name = document.getElementById('nameInput').value.trim();
    if (!name) return;
    await joinAs(name);
    await enterGame();
  }

  // ===============================================================
  // LIVE TABLE
  // ===============================================================
  async function refreshLiveTable(force) {
    const result = await Api.fetchLive({ force });
    if (!result) {
      tableSource = 'offline';
    } else {
      tableSource = result.source;
      tableFetchedAt = result.fetchedAt;
      if (result.updates) applyTableUpdates(result.updates);
    }
    updateCertainties();
    renderLiveStatus();
    renderLiveTable();
    autoPrefillCertainties();
    renderSlots();
    renderPool();
  }

  function applyTableUpdates(updates) {
    const byAbbr = Object.fromEntries(liveTableData.map(t => [t.abbr, t]));
    updates.forEach(u => {
      const t = byAbbr[u.abbr];
      if (!t) return;
      if (u.rank != null) t.rank = u.rank;
      if (u.pts != null) t.pts = u.pts;
      if (u.gp != null) t.gp = u.gp;
      if (u.w != null) t.w = u.w;
      if (u.d != null) t.d = u.d;
      if (u.l != null) t.l = u.l;
      if (u.gf != null) t.gf = u.gf;
      if (u.ga != null) t.ga = u.ga;
      if (u.gd != null) t.gd = u.gd;
    });
    liveTableData.sort((a, b) => (a.rank || 99) - (b.rank || 99));
  }

  function renderLiveStatus() {
    const subtitle = document.getElementById('tableSubtitle');
    if (!subtitle) return;
    if (tableSource === 'live' || tableSource === 'cached') {
      subtitle.textContent = `ESPN · Updated ${timeAgo(tableFetchedAt)}`;
    } else if (tableSource === 'offline') {
      subtitle.textContent = `Baseline from ${C.baselineDate}`;
    } else {
      subtitle.textContent = 'Loading…';
    }
  }

  function renderLiveTable() {
    const root = document.getElementById('liveTable');
    if (!root) return;
    const sorted = liveTableData.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));

    const rows = sorted.map(t => {
      let cls = '';
      if (t.rank <= C.topN) cls = 'top-5';
      else if (t.rank >= 21 - C.botN) cls = 'bot-3';
      const gdClass = t.gd > 0 ? 'gd-pos' : (t.gd < 0 ? 'gd-neg' : '');
      const gdDisplay = t.gd > 0 ? `+${t.gd}` : (t.gd ?? '');
      return `
        <tr class="${cls}">
          <td class="rank">${t.rank}</td>
          <td class="team-col">
            <div class="team-cell">
              ${Avatar.render(t, 'xs')}
              <span>${escapeHtml(t.name)}</span>
            </div>
          </td>
          <td>${t.gp ?? ''}</td>
          <td>${t.w ?? ''}</td>
          <td>${t.d ?? ''}</td>
          <td>${t.l ?? ''}</td>
          <td>${t.gf ?? ''}</td>
          <td>${t.ga ?? ''}</td>
          <td class="${gdClass}">${gdDisplay}</td>
          <td class="pts-col">${t.pts ?? ''}</td>
        </tr>`;
    }).join('');

    root.innerHTML = `
      <table class="live-table">
        <thead>
          <tr>
            <th>#</th>
            <th class="team-col">Team</th>
            <th>GP</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ===============================================================
  // MATHEMATICAL CERTAINTIES
  // ===============================================================
  // A team T is guaranteed in bottom N if there are ≥ (20-N) other
  // teams whose current points exceed T's max-possible points. Those
  // teams can't finish below T; therefore T is in the bottom N.
  //
  // A team T is guaranteed in top N if there are ≤ (N-1) other
  // teams whose max-possible exceeds T's current points. Everyone
  // else can't reach T; therefore T must be in top N.
  // ===============================================================
  function updateCertainties() {
    const total = C.totalGames;
    const enriched = liveTableData.map(t => ({
      abbr: t.abbr,
      pts: t.pts ?? 0,
      gp: t.gp ?? 0,
      max: (t.pts ?? 0) + Math.max(0, total - (t.gp ?? 0)) * 3,
    }));

    const newCertainTop = [];
    const newCertainBot = [];

    enriched.forEach(t => {
      // Guaranteed bottom N?
      const aboveCount = enriched.filter(o => o.abbr !== t.abbr && o.pts > t.max).length;
      if (aboveCount >= (20 - C.botN)) newCertainBot.push(t.abbr);

      // Guaranteed top N?
      const couldOvertakeCount = enriched.filter(o => o.abbr !== t.abbr && o.max > t.pts).length;
      if (couldOvertakeCount <= (C.topN - 1)) newCertainTop.push(t.abbr);
    });

    certainTop = newCertainTop;
    certainBot = newCertainBot;
  }

  /**
   * NOTE: We deliberately do NOT auto-place certain teams into specific slots.
   * Rank ordering matters in this game — "MCI is in the top 5" does not mean
   * "MCI is #1". Users pick every exact position themselves. We only surface
   * the mathematical certainty as an info banner, so players know the group-
   * level locks (who's definitely top-5, who's definitely bottom-3) without
   * being told what specific rank to give them.
   *
   * If, late in the season, a team's exact rank becomes mathematically locked
   * (rare edge case), we could re-introduce position-specific auto-fill. For
   * now, zero intervention.
   */
  function autoPrefillCertainties() {
    // Intentionally empty — see note above. Users place teams themselves.
  }

  function renderCertaintyNotice() {
    const root = document.getElementById('certaintyNotice');
    if (!root) return;
    const items = [];
    if (certainTop.length) {
      const names = certainTop.map(a => TEAM_BY_ABBR[a]?.name).join(' + ');
      items.push(`<strong>GUARANTEED TOP ${C.topN}:</strong> ${names}`);
    }
    if (certainBot.length) {
      const names = certainBot.map(a => TEAM_BY_ABBR[a]?.name).join(' + ');
      items.push(`<strong>GUARANTEED BOTTOM ${C.botN}:</strong> ${names}`);
    }
    if (items.length === 0) {
      root.style.display = 'none';
      return;
    }
    root.style.display = 'block';
    root.innerHTML = `💡 Group-level locks (math can't lie): ${items.join(' · ')}. <em>You still pick each team's exact position.</em>`;
  }

  // ===============================================================
  // ROUTING
  // ===============================================================
  function wireRouting() {
    document.querySelectorAll('[data-route]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '#' + el.dataset.route;
      });
    });
    window.addEventListener('hashchange', handleRoute);
  }

  function handleRoute() {
    const hash = window.location.hash.replace(/^#/, '') || '/';
    currentRoute = hash;
    const isAdmin = hash === '/admin';
    const isLb = hash === '/leaderboard';
    const isBuilt = hash === '/built';
    const isGame = !isAdmin && !isLb && !isBuilt;

    document.getElementById('page-game').style.display = isGame ? 'block' : 'none';
    document.getElementById('page-leaderboard').style.display = isLb ? 'block' : 'none';
    document.getElementById('page-admin').style.display = isAdmin ? 'block' : 'none';
    const builtEl = document.getElementById('page-built');
    if (builtEl) builtEl.style.display = isBuilt ? 'block' : 'none';

    document.querySelectorAll('.nav-link[data-route]').forEach(el => {
      el.classList.toggle('active',
        (el.dataset.route === '/' && isGame) ||
        (el.dataset.route === '/leaderboard' && isLb) ||
        (el.dataset.route === '/admin' && isAdmin) ||
        (el.dataset.route === '/built' && isBuilt));
    });

    if (isAdmin) renderAdminPage();
    if (isLb) renderLeaderboardPage();
    window.scrollTo(0, 0);
  }

  // ===============================================================
  // RENDER — SLOTS + POOL
  // ===============================================================
  function renderSlots() {
    const topRoot = document.getElementById('topSlots');
    if (topRoot) {
      topRoot.innerHTML = myPicks.top
        .map((abbr, i) => slotHtml(abbr, i + 1, 'top', 'pred'))
        .join('');
    }
    const botRoot = document.getElementById('botSlots');
    if (botRoot && C.botN > 0) {
      botRoot.innerHTML = myPicks.bot
        .map((abbr, i) => slotHtml(abbr, 21 - C.botN + i, 'bot', 'pred'))
        .join('');
    }

    document.querySelectorAll('#topSlots .slot, #botSlots .slot').forEach(el => {
      el.onclick = () => slotClick(el);
    });

    const topFilled = myPicks.top.filter(Boolean).length;
    const botFilled = myPicks.bot.filter(Boolean).length;
    const tp = document.getElementById('topProgress');
    const bp = document.getElementById('botProgress');
    if (tp) tp.textContent = `${topFilled} / ${C.topN}`;
    if (bp) bp.textContent = `${botFilled} / ${C.botN}`;

    const totalRequired = C.topN + C.botN;
    const totalFilled = topFilled + botFilled;
    const sb = document.getElementById('saveBtn');
    if (sb) sb.disabled = (totalFilled !== totalRequired) || gameState.phase !== 'open';

    // Admin results slots
    const resTop = document.getElementById('resultsTopSlots');
    if (resTop) {
      resTop.innerHTML = gameState.finalTop
        .map((abbr, i) => slotHtml(abbr, i + 1, 'top', 'results'))
        .join('');
    }
    const resBot = document.getElementById('resultsBotSlots');
    if (resBot) {
      resBot.innerHTML = gameState.finalBot
        .map((abbr, i) => slotHtml(abbr, 21 - C.botN + i, 'bot', 'results'))
        .join('');
    }
    document.querySelectorAll('#resultsTopSlots .slot, #resultsBotSlots .slot').forEach(el => {
      el.onclick = () => slotClick(el);
    });

    renderCertaintyNotice();
    renderTiebreakers();
  }

  function slotHtml(abbr, pos, group, ctx) {
    const team = abbr ? TEAM_BY_ABBR[abbr] : null;
    const filled = !!team;
    const cls = ['slot', group, filled ? 'filled' : ''].filter(Boolean).join(' ');

    const body = team
      ? `${Avatar.render(team, 'lg')}<span class="slot-team-name">${escapeHtml(team.name)}</span>`
      : `<span class="slot-empty-hint">+</span><span class="slot-empty-label">EMPTY</span>`;

    return `
      <div class="${cls}" data-ctx="${ctx}" data-group="${group}" data-index="${pos}">
        <span class="slot-pos">#${pos}</span>
        ${body}
      </div>`;
  }

  function slotClick(el) {
    const ctx = el.dataset.ctx;
    const group = el.dataset.group;
    const pos = parseInt(el.dataset.index, 10);

    if (ctx === 'pred' && gameState.phase !== 'open') {
      toast('Game is locked — picks cannot change');
      return;
    }

    const arr = getSlotArray(ctx, group);
    const idx = (group === 'top' ? pos - 1 : pos - (21 - C.botN));

    // If a team is selected in same context, place it
    if (selectedTeam && selectedContext === ctx) {
      const otherArr = group === 'top' ? getSlotArray(ctx, 'bot') : getSlotArray(ctx, 'top');
      // Remove selectedTeam from its current position
      for (let j = 0; j < arr.length; j++) if (arr[j] === selectedTeam) arr[j] = null;
      for (let j = 0; j < otherArr.length; j++) if (otherArr[j] === selectedTeam) otherArr[j] = null;
      arr[idx] = selectedTeam;
      selectedTeam = null;
      afterMutate(ctx);
      return;
    }

    // No team selected — clicking clears the slot
    if (arr[idx]) {
      arr[idx] = null;
      afterMutate(ctx);
      return;
    }

    toast('Pick a team from the pool first');
  }

  function getSlotArray(ctx, group) {
    if (ctx === 'pred') return group === 'top' ? myPicks.top : myPicks.bot;
    return group === 'top' ? gameState.finalTop : gameState.finalBot;
  }

  function afterMutate(ctx) {
    renderSlots();
    renderPool();
    if (ctx === 'pred') { saved = false; updateSaveStatus(); }
    if (ctx === 'results') saveGameState();
  }

  function renderPool() {
    const usedInPred = new Set([...myPicks.top, ...myPicks.bot].filter(Boolean));
    const usedInResults = new Set([...gameState.finalTop, ...gameState.finalBot].filter(Boolean));

    const renderIn = (rootId, ctx) => {
      const root = document.getElementById(rootId);
      if (!root) return;
      const used = ctx === 'pred' ? usedInPred : usedInResults;
      root.innerHTML = C.teams.slice().sort((a, b) => a.name.localeCompare(b.name)).map(t => {
        const isUsed = used.has(t.abbr);
        const sel = selectedTeam === t.abbr && selectedContext === ctx;
        return `
          <div class="pool-item ${sel ? 'selected' : ''} ${isUsed ? 'used' : ''}"
               data-abbr="${t.abbr}" data-ctx="${ctx}">
            ${Avatar.render(t, 'sm')}
            <span class="pool-name">${escapeHtml(t.name)}</span>
          </div>`;
      }).join('');
      root.querySelectorAll('.pool-item').forEach(el => {
        el.onclick = () => {
          if (el.classList.contains('used')) return;
          const abbr = el.dataset.abbr;
          const c = el.dataset.ctx;
          if (selectedTeam === abbr && selectedContext === c) {
            selectedTeam = null;
          } else {
            selectedTeam = abbr;
            selectedContext = c;
          }
          renderPool();
          highlightActiveSlots();
        };
      });
    };
    renderIn('teamPool', 'pred');
    renderIn('adminTeamPool', 'results');
  }

  function highlightActiveSlots() {
    document.querySelectorAll('.slot').forEach(el => {
      el.classList.toggle('active',
        !!selectedTeam && el.dataset.ctx === selectedContext && !el.classList.contains('filled'));
    });
  }

  function updateSaveStatus() {
    const el = document.getElementById('saveStatus');
    if (!el) return;
    if (saved) { el.textContent = '● SAVED'; el.classList.add('saved'); }
    else { el.textContent = '○ UNSAVED CHANGES'; el.classList.remove('saved'); }
  }

  // ===============================================================
  // TIEBREAKERS
  // ===============================================================
  function renderTiebreakers() {
    const root = document.getElementById('tiebreakerList');
    if (!root) return;
    if (!C.tiebreakers || C.tiebreakers.length === 0) {
      root.innerHTML = '';
      return;
    }

    root.innerHTML = C.tiebreakers.map(tb => {
      const currentPick = myTiebreakers[tb.id] || null;

      let options;
      if (tb.candidatePlayers) {
        // Player-level options
        options = tb.candidatePlayers.map(p => {
          const team = TEAM_BY_ABBR[p.team];
          const sel = currentPick === p.id;
          const avatar = team
            ? Avatar.render(team, 'xs')
            : `<div class="badge-wrap xs tb-others-placeholder">?</div>`;
          return `<div class="tb-option ${sel ? 'selected' : ''}" data-tb="${tb.id}" data-pick="${p.id}">
            ${avatar}
            <span>${escapeHtml(p.name)}</span>
          </div>`;
        }).join('');
      } else {
        // Team-level options — shortlist or all 20 teams
        const pool = (tb.candidates && tb.candidates.length)
          ? tb.candidates.map(a => TEAM_BY_ABBR[a]).filter(Boolean)
          : C.teams.slice().sort((a, b) => a.name.localeCompare(b.name));
        options = pool.map(t => {
          const sel = currentPick === t.abbr;
          return `<div class="tb-option ${sel ? 'selected' : ''}" data-tb="${tb.id}" data-pick="${t.abbr}">
            ${Avatar.render(t, 'xs')}
            <span>${escapeHtml(t.name)}</span>
          </div>`;
        }).join('');
      }

      return `
        <div class="tiebreaker">
          <div class="tiebreaker-header">
            <span class="tiebreaker-label">${escapeHtml(tb.label)}</span>
            <span class="tiebreaker-points">+${tb.points} PTS</span>
          </div>
          <div class="tiebreaker-sub">${escapeHtml(tb.subLabel || '')}</div>
          <div class="tiebreaker-options">${options}</div>
        </div>`;
    }).join('');

    root.querySelectorAll('.tb-option').forEach(el => {
      el.onclick = () => {
        if (gameState.phase !== 'open') {
          toast('Game is locked — tiebreaker picks cannot change');
          return;
        }
        const tbId = el.dataset.tb;
        const pick = el.dataset.pick;
        if (myTiebreakers[tbId] === pick) {
          delete myTiebreakers[tbId];
        } else {
          myTiebreakers[tbId] = pick;
        }
        saved = false;
        updateSaveStatus();
        renderTiebreakers();
      };
    });
  }

  // ===============================================================
  // ROSTER / REFRESH
  // ===============================================================
  async function refreshAll() {
    const gsRaw = await Store.get('game:state', true);
    const incoming = Store.safeParse(gsRaw, null);
    if (incoming) gameState = Object.assign(gameState, incoming);

    const keys = await Store.list('players:', true);
    const recs = await Promise.all(keys.map(k => Store.get(k, true)));
    allPlayers = recs.map(r => Store.safeParse(r, null)).filter(Boolean);
    allPlayers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const mine = me && me.id ? allPlayers.find(p => p.id === me.id) : null;
    if (mine && saved) {
      myPicks.top = mine.top || myPicks.top;
      myPicks.bot = mine.bot || myPicks.bot;
      myTiebreakers = mine.tiebreakers || myTiebreakers;
    }

    renderPhase();
    renderSlots();
    renderPool();
    renderRoster('rosterGrid', 'rosterTitle', 'rosterCount');
    if (currentRoute === '/leaderboard') renderLeaderboardPage();
    if (currentRoute === '/admin' && isAdminAuthed()) renderAdminPlayers();
    updateSaveStatus();
  }

  function renderPhase() {
    const phase = gameState.phase;
    ['phaseIndicator', 'phaseIndicator2', 'phaseIndicator3'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('phase-open', 'phase-locked', 'phase-finished');
      if (phase === 'open') { el.textContent = '● OPEN — MAKE YOUR PICKS'; el.classList.add('phase-open'); }
      else if (phase === 'locked') { el.textContent = '● LOCKED — AWAITING RESULTS'; el.classList.add('phase-locked'); }
      else { el.textContent = '● FULL TIME'; el.classList.add('phase-finished'); }
    });
  }

  function renderRoster(gridId, titleId, countId) {
    const root = document.getElementById(gridId);
    if (!root) return;
    const showPicks = gameState.phase !== 'open';
    if (titleId) document.getElementById(titleId).textContent = showPicks ? 'All Predictions' : 'The Players';
    if (countId) document.getElementById(countId).textContent = `— ${allPlayers.length} in`;

    if (allPlayers.length === 0) {
      root.innerHTML = `<div class="empty-state">No players yet. Share the link to get started.</div>`;
      return;
    }

    root.innerHTML = allPlayers.map(p => {
      const isMe = !!(me && p.id === me.id);
      const topFilled = (p.top || []).filter(Boolean).length;
      const botFilled = (p.bot || []).filter(Boolean).length;
      const total = C.topN + C.botN;
      const complete = (topFilled + botFilled) === total;
      // Late entry: joined after the admin's first lock. Existing players who
      // have no joinedAt field (saved under earlier versions) are treated as
      // pre-lock, i.e. never late.
      const isLate = !!(gameState.firstLockedAt && p.joinedAt && p.joinedAt > gameState.firstLockedAt);

      let topRow, botRow;
      if (showPicks || isMe) {
        topRow = (p.top || []).map(a => {
          const t = TEAM_BY_ABBR[a];
          return t ? Avatar.render(t, 'sm') : '<span class="hidden-badge"></span>';
        }).join('');
        botRow = (p.bot || []).map(a => {
          const t = TEAM_BY_ABBR[a];
          return t ? Avatar.render(t, 'sm') : '<span class="hidden-badge"></span>';
        }).join('');
      } else {
        topRow = Array(C.topN).fill('<span class="hidden-badge"></span>').join('');
        botRow = Array(C.botN).fill('<span class="hidden-badge"></span>').join('');
      }

      return `
        <div class="roster-card ${isMe ? 'me' : ''} ${isLate ? 'late' : ''}">
          <div class="roster-head">
            <div class="roster-name">
              ${escapeHtml(p.name)}${isMe ? ' ★' : ''}
              ${isLate ? '<span class="late-badge" title="Joined after first lock">LATE</span>' : ''}
            </div>
            <div class="roster-status ${complete ? 'complete' : 'pending'}">
              ${complete ? '● IN' : `○ ${topFilled + botFilled}/${total}`}
            </div>
          </div>
          <div class="roster-picks-label">${C.topLabel}</div>
          <div class="roster-picks-row">${topRow}</div>
          ${C.botN > 0 ? `
            <div class="roster-picks-label">${C.botLabel}</div>
            <div class="roster-picks-row">${botRow}</div>
          ` : ''}
        </div>`;
    }).join('');
  }

  // ===============================================================
  // SCORING
  // ===============================================================
  function scoreAgainst(player, finalTop, finalBot, finalTiebreakers) {
    const topSet = new Set(finalTop.filter(Boolean));
    const botSet = new Set(finalBot.filter(Boolean));
    let total = 0, exact = 0, partial = 0, tbPoints = 0, tbHits = 0;

    (player.top || []).forEach((pick, i) => {
      if (!pick) return;
      if (finalTop[i] === pick) { total += C.scoring.exact; exact++; }
      else if (topSet.has(pick)) { total += C.scoring.correctGroup; partial++; }
    });
    (player.bot || []).forEach((pick, i) => {
      if (!pick) return;
      if (finalBot[i] === pick) { total += C.scoring.exact; exact++; }
      else if (botSet.has(pick)) { total += C.scoring.correctGroup; partial++; }
    });

    // Tiebreakers
    const playerTb = player.tiebreakers || {};
    (C.tiebreakers || []).forEach(tb => {
      const pick = playerTb[tb.id];
      const actual = (finalTiebreakers || {})[tb.id];
      if (pick && actual && pick === actual) {
        total += tb.points;
        tbPoints += tb.points;
        tbHits++;
      }
    });

    return { total, exact, partial, tbPoints, tbHits };
  }

  function computeProjectedResults() {
    const sorted = liveTableData.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
    const projTop = sorted.slice(0, C.topN).map(t => t.abbr);
    const projBot = sorted.slice(20 - C.botN, 20).map(t => t.abbr);

    const projTb = {};
    (C.tiebreakers || []).forEach(tb => {
      if (tb.source === 'rank1') projTb[tb.id] = sorted[0]?.abbr;
      else if (tb.source === 'rank6') projTb[tb.id] = sorted[5]?.abbr;
      else if (tb.source === 'topGF') {
        const sortedGF = liveTableData.slice().sort((a, b) => (b.gf || 0) - (a.gf || 0));
        projTb[tb.id] = sortedGF[0]?.abbr;
      }
      else if (tb.source === 'mode') {
        // Tally votes across all players — winner is the most-picked value
        const votes = {};
        allPlayers.forEach(p => {
          const pick = (p.tiebreakers || {})[tb.id];
          if (pick) votes[pick] = (votes[pick] || 0) + 1;
        });
        const sortedVotes = Object.entries(votes).sort((a, b) => b[1] - a[1]);
        if (sortedVotes.length > 0) projTb[tb.id] = sortedVotes[0][0];
      }
      // 'manual' sources don't project — host sets at end
    });

    return { projTop, projBot, projTb };
  }

  // Tally current votes for display in admin (mode-source tiebreakers)
  function tallyVotes(tbId) {
    const votes = {};
    allPlayers.forEach(p => {
      const pick = (p.tiebreakers || {})[tbId];
      if (pick) votes[pick] = (votes[pick] || 0) + 1;
    });
    return Object.entries(votes).sort((a, b) => b[1] - a[1]);
  }

  function renderLeaderboardPage() {
    const finishedEl = document.getElementById('leaderboardSection');
    const liveEl = document.getElementById('liveLeaderboardSection');
    const lbSub = document.getElementById('lbSubtitle');

    renderRoster('lbRosterGrid', 'lbRosterTitle', 'lbRosterCount');

    if (gameState.phase === 'finished') {
      finishedEl.style.display = 'block';
      liveEl.style.display = 'none';
      lbSub.textContent = 'Final scores — game over';

      const scored = allPlayers
        .map(p => ({ p, s: scoreAgainst(p, gameState.finalTop, gameState.finalBot, gameState.finalTiebreakers) }))
        .sort((a, b) => b.s.total - a.s.total);

      document.getElementById('lbCount').textContent = `— ${scored.length} scored`;
      const root = document.getElementById('leaderboard');
      root.innerHTML = scored.map((x, i) => {
        const rank = i + 1;
        const podium = rank <= 3 ? `podium-${rank}` : '';
        return `
          <div class="lb-row ${podium}">
            <div class="lb-rank">${rank}</div>
            <div>
              <div class="lb-name">${escapeHtml(x.p.name)}${me && x.p.id === me.id ? ' ★' : ''}</div>
              <div class="lb-breakdown">${x.s.exact} EXACT · ${x.s.partial} PARTIAL · ${x.s.tbHits} TIEBREAKER</div>
            </div>
            <div class="lb-score">${x.s.total}</div>
          </div>`;
      }).join('');
    } else {
      finishedEl.style.display = 'none';
      lbSub.textContent = gameState.phase === 'locked'
        ? 'Picks locked — awaiting final table'
        : 'Picks still open';

      const total = C.topN + C.botN;
      const complete = allPlayers.filter(p => (p.top || []).filter(Boolean).length === C.topN
        && (p.bot || []).filter(Boolean).length === C.botN);
      if (complete.length === 0) {
        liveEl.style.display = 'none';
        return;
      }
      liveEl.style.display = 'block';

      const { projTop, projBot, projTb } = computeProjectedResults();

      const scored = complete
        .map(p => ({ p, s: scoreAgainst(p, projTop, projBot, projTb) }))
        .sort((a, b) => b.s.total - a.s.total);

      const root = document.getElementById('projectedLeaderboard');
      root.innerHTML = scored.map((x, i) => {
        const rank = i + 1;
        const podium = rank <= 3 ? `podium-${rank}` : '';
        return `
          <div class="lb-row ${podium}">
            <div class="lb-rank">${rank}</div>
            <div>
              <div class="lb-name">${escapeHtml(x.p.name)}${me && x.p.id === me.id ? ' ★' : ''}</div>
              <div class="lb-breakdown">${x.s.exact} EXACT · ${x.s.partial} PARTIAL · ${x.s.tbHits} TIEBREAKER</div>
            </div>
            <div class="lb-score">${x.s.total}</div>
          </div>`;
      }).join('');
    }
  }

  // ===============================================================
  // ADMIN
  // ===============================================================
  function isAdminAuthed() {
    return sessionStorage.getItem('pmd_admin') === 'yes';
  }

  function renderAdminPage() {
    if (isAdminAuthed()) {
      document.getElementById('adminLogin').style.display = 'none';
      document.getElementById('adminControls').style.display = 'block';
      renderSlots();
      renderPool();
      renderAdminTiebreakers();
      renderAdminPlayers();
    } else {
      document.getElementById('adminLogin').style.display = 'block';
      document.getElementById('adminControls').style.display = 'none';
      setTimeout(() => document.getElementById('adminPwInput').focus(), 50);
    }
  }

  function tryAdminLogin() {
    const pw = document.getElementById('adminPwInput').value;
    const err = document.getElementById('adminError');
    if (pw === window.PMD.Config.adminPassword) {
      sessionStorage.setItem('pmd_admin', 'yes');
      err.textContent = '';
      renderAdminPage();
    } else {
      err.textContent = 'WRONG PASSWORD';
      document.getElementById('adminPwInput').value = '';
      setTimeout(() => { err.textContent = ''; }, 2000);
    }
  }

  function renderAdminTiebreakers() {
    const root = document.getElementById('adminTbList');
    if (!root) return;
    if (!C.tiebreakers || C.tiebreakers.length === 0) {
      root.innerHTML = '';
      return;
    }

    root.innerHTML = C.tiebreakers.map(tb => {
      const current = (gameState.finalTiebreakers || {})[tb.id] || null;
      let options;
      if (tb.candidatePlayers) {
        options = tb.candidatePlayers.map(p => {
          const team = TEAM_BY_ABBR[p.team];
          const sel = current === p.id;
          const avatar = team
            ? Avatar.render(team, 'xs')
            : `<div class="badge-wrap xs tb-others-placeholder">?</div>`;
          return `<div class="tb-option ${sel ? 'selected' : ''}" data-tb="${tb.id}" data-pick="${p.id}">
            ${avatar}
            <span>${escapeHtml(p.name)}</span>
          </div>`;
        }).join('');
      } else {
        const pool = (tb.candidates && tb.candidates.length)
          ? tb.candidates.map(a => TEAM_BY_ABBR[a]).filter(Boolean)
          : C.teams.slice().sort((a, b) => a.name.localeCompare(b.name));
        options = pool.map(t => {
          const sel = current === t.abbr;
          return `<div class="tb-option ${sel ? 'selected' : ''}" data-tb="${tb.id}" data-pick="${t.abbr}">
            ${Avatar.render(t, 'xs')}
            <span>${escapeHtml(t.name)}</span>
          </div>`;
        }).join('');
      }

      // Source label
      let sourceLabel;
      if (tb.source === 'manual') sourceLabel = '<strong style="color:var(--accent)">· MANUAL</strong>';
      else if (tb.source === 'mode') sourceLabel = '<strong style="color:var(--gold)">· CROWD VOTE</strong>';
      else sourceLabel = '<strong style="color:var(--pitch)">· AUTO-TRACKED</strong>';

      // Vote tally for mode tiebreakers
      let tally = '';
      if (tb.source === 'mode') {
        const votes = tallyVotes(tb.id);
        if (votes.length) {
          const items = votes.slice(0, 6).map(([abbr, count]) => {
            const team = TEAM_BY_ABBR[abbr];
            return `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:10px;">
              ${team ? Avatar.render(team, 'xs') : ''}
              <span>${escapeHtml(team?.name || abbr)} <strong style="color:var(--gold)">×${count}</strong></span>
            </span>`;
          }).join('');
          tally = `<div style="margin:10px 0;padding:10px;background:var(--bg);border-radius:4px;font-size:11px;color:var(--text-dim);">
            <div style="margin-bottom:6px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Current vote tally:</div>
            ${items}
          </div>`;
        } else {
          tally = `<div style="margin:10px 0;padding:10px;background:var(--bg);border-radius:4px;font-size:11px;color:var(--text-muted);">No votes yet</div>`;
        }
      }

      return `
        <div class="tiebreaker">
          <div class="tiebreaker-header">
            <span class="tiebreaker-label">${escapeHtml(tb.label)}</span>
            <span class="tiebreaker-points">+${tb.points} PTS</span>
          </div>
          <div class="tiebreaker-sub">${escapeHtml(tb.subLabel || '')} ${sourceLabel}</div>
          ${tally}
          <div class="tiebreaker-options">${options}</div>
        </div>`;
    }).join('');

    root.querySelectorAll('.tb-option').forEach(el => {
      el.onclick = async () => {
        const tbId = el.dataset.tb;
        const pick = el.dataset.pick;
        if (!gameState.finalTiebreakers) gameState.finalTiebreakers = {};
        if (gameState.finalTiebreakers[tbId] === pick) {
          delete gameState.finalTiebreakers[tbId];
        } else {
          gameState.finalTiebreakers[tbId] = pick;
        }
        await saveGameState();
        renderAdminTiebreakers();
      };
    });
  }

  function renderAdminPlayers() {
    const root = document.getElementById('adminPlayerList');
    if (!root) return;
    if (allPlayers.length === 0) {
      root.innerHTML = `<div class="empty-state">No players yet.</div>`;
      return;
    }

    const total = C.topN + C.botN;

    // Sort latest-first so duplicate cleanup is obvious:
    // the most-recently-updated submission of any duplicated name is at the top.
    // Players who never saved picks (no updatedAt) fall to the bottom.
    const sorted = allPlayers.slice().sort((a, b) => {
      const ta = a.updatedAt || a.joinedAt || 0;
      const tb = b.updatedAt || b.joinedAt || 0;
      return tb - ta;
    });

    // Count how many times each normalised name appears so we can flag dupes.
    const nameCounts = {};
    sorted.forEach(p => {
      const key = (p.name || '').trim().toLowerCase();
      nameCounts[key] = (nameCounts[key] || 0) + 1;
    });

    // Within a duplicate group, mark the LATEST as "KEEP" and the rest as "OLDER".
    const seenLatest = {};
    sorted.forEach(p => {
      const key = (p.name || '').trim().toLowerCase();
      if (nameCounts[key] > 1 && !seenLatest[key]) {
        seenLatest[key] = p.id;
      }
    });

    const fmtDateTime = (ts) => {
      if (!ts) return '—';
      const d = new Date(ts);
      return d.toLocaleString('en-GB', {
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false,
      });
    };

    root.innerHTML = sorted.map(p => {
      const topFilled = (p.top || []).filter(Boolean).length;
      const botFilled = (p.bot || []).filter(Boolean).length;
      const complete = (topFilled + botFilled) === total;
      const tbCount = Object.keys(p.tiebreakers || {}).length;
      const isMe = !!(me && p.id === me.id);
      const isLate = !!(gameState.firstLockedAt && p.joinedAt && p.joinedAt > gameState.firstLockedAt);

      const key = (p.name || '').trim().toLowerCase();
      const isDupe = nameCounts[key] > 1;
      const isLatest = seenLatest[key] === p.id;
      let dupeBadge = '';
      if (isDupe) {
        dupeBadge = isLatest
          ? '<span class="dupe-badge keep">KEEP — LATEST</span>'
          : '<span class="dupe-badge older">OLDER COPY</span>';
      }

      const savedStamp = p.updatedAt ? fmtDateTime(p.updatedAt) : '<span style="color:var(--text-muted)">never saved</span>';

      return `
        <div class="admin-player-row ${isLate ? 'late' : ''} ${isDupe && !isLatest ? 'older-dupe' : ''}">
          <div>
            <div class="admin-player-name">
              ${escapeHtml(p.name)}${isMe ? ' <span style="color:var(--accent);font-size:10px;">(YOU)</span>' : ''}
              ${isLate ? '<span class="late-badge">LATE</span>' : ''}
              ${dupeBadge}
            </div>
            <div class="admin-player-meta">
              ${complete ? '<span style="color:var(--pitch)">● COMPLETE</span>' : `<span style="color:var(--text-dim)">○ ${topFilled + botFilled}/${total} SLOTS</span>`}
              · ${tbCount} tiebreakers
              · <strong style="color:var(--text)">saved ${savedStamp}</strong>
              · ID: <code>${p.id}</code>
            </div>
          </div>
          <button class="btn btn-sm btn-danger admin-delete-player" data-id="${p.id}" data-name="${escapeHtml(p.name)}">Delete</button>
        </div>`;
    }).join('');

    root.querySelectorAll('.admin-delete-player').forEach(el => {
      el.onclick = async () => {
        const id = el.dataset.id;
        const name = el.dataset.name;
        if (!confirm(`Delete player "${name}" and all their picks? This cannot be undone.`)) return;
        await Store.delete('players:' + id, true);
        toast(`Deleted ${name}`);
        await refreshAll();
        renderAdminPlayers();
      };
    });
  }

  // ===============================================================
  // ACTIONS
  // ===============================================================
  function wireActions() {
    document.getElementById('saveBtn').onclick = savePicks;
    document.getElementById('clearBtn').onclick = clearPicks;
    document.getElementById('shareBtn').onclick = sharePicks;
    document.getElementById('changeNameBtn').onclick = changeName;

    document.getElementById('adminLoginBtn').onclick = tryAdminLogin;
    document.getElementById('adminPwInput').onkeydown = (e) => { if (e.key === 'Enter') tryAdminLogin(); };
    document.getElementById('adminLogoutBtn').onclick = () => {
      sessionStorage.removeItem('pmd_admin');
      renderAdminPage();
    };
    document.getElementById('lockGameBtn').onclick = () => updatePhase('locked');
    document.getElementById('reopenBtn').onclick = () => updatePhase('open');
    document.getElementById('resetGameBtn').onclick = resetGame;
    document.getElementById('finalizeBtn').onclick = finalize;
    document.getElementById('prefillBtn').onclick = prefillResults;
    document.getElementById('autoTbBtn').onclick = autoTiebreakers;
    document.getElementById('refreshTableBtn').onclick = async () => {
      toast('Refreshing…');
      await refreshLiveTable(true);
      toast('Table refreshed');
    };

    // Diagnostics — surfaces the real state of Firebase so we can tell what's broken
    document.getElementById('runDiagBtn').onclick = runDiagnostics;

    // Share modal close
    document.getElementById('modalCloseBtn').onclick = () => {
      document.getElementById('shareModal').style.display = 'none';
    };
    document.getElementById('modalCopyBtn').onclick = () => {
      const text = document.getElementById('modalPreview').textContent;
      navigator.clipboard.writeText(text).then(() => {
        toast('Copied to clipboard');
      }, () => toast('Copy failed'));
    };
  }

  async function savePicks() {
    if (!me || !me.id) {
      toast('Enter your name first');
      const input = document.getElementById('nameInput');
      if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }
    const topFilled = myPicks.top.filter(Boolean).length;
    const botFilled = myPicks.bot.filter(Boolean).length;
    if (topFilled !== C.topN || botFilled !== C.botN) {
      toast(`Fill all ${C.topN + C.botN} slots first`);
      return;
    }
    await Store.set('players:' + me.id, {
      id: me.id,
      name: me.name,
      top: myPicks.top,
      bot: myPicks.bot,
      tiebreakers: myTiebreakers,
      updatedAt: Date.now(),
    }, true);
    saved = true;
    toast('Picks saved — good luck');
    await refreshAll();
  }

  async function clearPicks() {
    if (!confirm('Clear your picks?')) return;
    myPicks.top = Array(C.topN).fill(null);
    myPicks.bot = Array(C.botN).fill(null);
    myTiebreakers = {};
    saved = false;
    renderSlots();
    renderPool();
    updateSaveStatus();
  }

  async function changeName() {
    if (!confirm('Switch user? This will clear the current user from this device.')) return;
    await Store.delete('me', false);
    me = null;
    selectedTeam = null;
    myPicks = emptyPicks();
    myTiebreakers = {};
    const input = document.getElementById('nameInput');
    if (input) input.value = '';
    // Return to gated entry screen
    showNameEntry();
  }

  async function updatePhase(phase) {
    gameState.phase = phase;
    // Record the first time the game was locked, so we can mark late joiners.
    // If the admin later reopens and re-locks, this timestamp is NOT updated —
    // the "first lock" is the reference point for late-entry detection.
    if (phase === 'locked' && !gameState.firstLockedAt) {
      gameState.firstLockedAt = Date.now();
    }
    await saveGameState();
    toast('Phase → ' + phase.toUpperCase());
    await refreshAll();
  }

  async function saveGameState() {
    await Store.set('game:state', gameState, true);
  }

  // ===============================================================
  // DIAGNOSTICS — full Firebase round-trip health check
  // ===============================================================
  async function runDiagnostics() {
    const out = document.getElementById('diagOutput');
    if (!out) return;

    const lines = [];
    const push = (status, title, detail) => {
      const icon = status === 'ok' ? '✅' : status === 'fail' ? '❌' : status === 'skip' ? '⏭️' : 'ℹ️';
      lines.push(`<div class="diag-row ${status}">
        <div class="diag-row-head">${icon} <strong>${escapeHtml(title)}</strong></div>
        ${detail ? `<div class="diag-row-detail">${detail}</div>` : ''}
      </div>`);
      out.innerHTML = lines.join('');
    };

    out.innerHTML = `<div class="diag-row">Running checks…</div>`;
    lines.length = 0;

    const cfg = window.PMD.Config || {};
    const url = (cfg.firebaseUrl || '').replace(/\/$/, '');
    const apiKey = cfg.firebaseApiKey || '';
    const ns = (window.COMPETITION && window.COMPETITION.key) || 'default';

    // CHECK 1: Firebase URL configured
    if (url && url.includes('firebasedatabase.app')) {
      push('ok', '1. Firebase URL configured', `<code>${escapeHtml(url.replace(/^https:\/\//, ''))}</code>`);
    } else {
      push('fail', '1. Firebase URL missing or malformed',
        'Check <code>firebaseUrl</code> in <code>js/app.js</code>. Should be a <code>*.firebasedatabase.app</code> URL.');
      return;
    }

    // CHECK 2: API key present
    if (apiKey && /^AIzaSy[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
      push('ok', '2. API key looks valid', `${apiKey.slice(0, 10)}… (${apiKey.length} chars)`);
    } else if (apiKey) {
      push('warn', '2. API key is set but format looks odd', `Got ${apiKey.length} chars — expected 39. Check for stray quotes or spaces.`);
    } else {
      push('fail', '2. API key missing',
        'Auth will be skipped. Players will only be saved locally. Set <code>firebaseApiKey</code> in <code>js/app.js</code>.');
      return;
    }

    // CHECK 3: Anonymous auth
    let idToken = null;
    try {
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true })
      });
      const data = await r.json();
      if (r.ok && data.idToken) {
        idToken = data.idToken;
        push('ok', '3. Anonymous auth works', `Got token (${data.idToken.length} chars), uid: <code>${escapeHtml(data.localId || '')}</code>`);
      } else {
        const errCode = (data.error && data.error.message) || `HTTP ${r.status}`;
        let hint = '';
        if (errCode.includes('ADMIN_ONLY') || errCode.includes('OPERATION_NOT_ALLOWED')) {
          hint = '<br>→ <strong>Fix:</strong> Firebase Console → Authentication → Sign-in method → enable <strong>Anonymous</strong>.';
        } else if (errCode.includes('API_KEY_INVALID') || errCode.includes('API key not valid')) {
          hint = '<br>→ <strong>Fix:</strong> Your API key is wrong. Firebase Console → Project settings → General → Web API Key.';
        } else if (errCode.includes('CONFIGURATION_NOT_FOUND')) {
          hint = '<br>→ <strong>Fix:</strong> Authentication isn\'t set up yet. Firebase Console → Authentication → Get started.';
        }
        push('fail', '3. Anonymous auth FAILED', `Error: <code>${escapeHtml(errCode)}</code>${hint}`);
        return;
      }
    } catch (e) {
      push('fail', '3. Anonymous auth — network error', `<code>${escapeHtml(String(e))}</code>`);
      return;
    }

    // CHECK 4: Read namespace root
    let namespaceKeys = [];
    try {
      const r = await fetch(`${url}/${ns}.json?shallow=true&auth=${encodeURIComponent(idToken)}`);
      if (r.ok) {
        const data = await r.json();
        namespaceKeys = data ? Object.keys(data) : [];
        if (namespaceKeys.length === 0) {
          push('warn', `4. Namespace "${ns}" is EMPTY`,
            'No data in Firebase at all. This means when players save, writes are failing — or nobody has saved yet. Continue to check 6.');
        } else {
          const preview = namespaceKeys.slice(0, 10).map(k => `<code>${escapeHtml(k)}</code>`).join(', ');
          push('ok', `4. Namespace read OK`,
            `Found <strong>${namespaceKeys.length}</strong> key(s): ${preview}${namespaceKeys.length > 10 ? ', …' : ''}`);
        }
      } else {
        const txt = await r.text();
        let hint = '';
        if (r.status === 401 || r.status === 403) {
          hint = '<br>→ <strong>Fix:</strong> Firebase rules blocking read. Set rules to <code>{ ".read": "auth != null", ".write": "auth != null" }</code>.';
        }
        push('fail', `4. Namespace read FAILED`, `HTTP ${r.status}: <code>${escapeHtml(txt.slice(0, 200))}</code>${hint}`);
        return;
      }
    } catch (e) {
      push('fail', '4. Namespace read — network error', `<code>${escapeHtml(String(e))}</code>`);
      return;
    }

    // CHECK 5: Filter player keys
    const playerKeys = namespaceKeys.filter(k => k.startsWith('players:'));
    if (playerKeys.length > 0) {
      const names = [];
      for (const k of playerKeys.slice(0, 5)) {
        try {
          const r = await fetch(`${url}/${ns}/${encodeURIComponent(k)}.json?auth=${encodeURIComponent(idToken)}`);
          if (r.ok) {
            const raw = await r.json();
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            names.push(escapeHtml(parsed?.name || '(unnamed)'));
          } else {
            names.push(`<em>read failed for ${escapeHtml(k)}</em>`);
          }
        } catch {
          names.push(`<em>parse error for ${escapeHtml(k)}</em>`);
        }
      }
      push('ok', `5. Player data found in Firebase`,
        `<strong>${playerKeys.length}</strong> player(s) saved: ${names.join(', ')}`);
    } else {
      push('warn', '5. No player records in Firebase',
        `Checked ${namespaceKeys.length} key(s) under <code>${escapeHtml(ns)}</code> and none start with <code>players:</code>. If you tried to save a player, the write silently failed — most likely because rules block unauthenticated writes and auth wasn't working at save time. Try saving a player again now that auth is confirmed working.`);
    }

    // CHECK 6: Round-trip write test
    const testKey = `_diag:test-${Date.now()}`;
    const testValue = { ok: true, at: new Date().toISOString() };
    try {
      const w = await fetch(`${url}/${ns}/${encodeURIComponent(testKey)}.json?auth=${encodeURIComponent(idToken)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testValue)
      });
      if (!w.ok) {
        const txt = await w.text();
        push('fail', '6. Write test FAILED',
          `HTTP ${w.status}: <code>${escapeHtml(txt.slice(0, 200))}</code><br>→ Rules probably block authed writes. Set <code>".write": "auth != null"</code>.`);
        return;
      }
      // Read it back
      const rb = await fetch(`${url}/${ns}/${encodeURIComponent(testKey)}.json?auth=${encodeURIComponent(idToken)}`);
      if (!rb.ok) {
        push('fail', '6. Write OK but read-back failed', `HTTP ${rb.status}`);
      } else {
        const got = await rb.json();
        if (got && got.ok === true) {
          push('ok', '6. Write + read round-trip OK',
            'Wrote a test blob and read it back. Firebase is fully working.');
          // Clean up
          await fetch(`${url}/${ns}/${encodeURIComponent(testKey)}.json?auth=${encodeURIComponent(idToken)}`, { method: 'DELETE' });
        } else {
          push('warn', '6. Round-trip returned unexpected data', `<code>${escapeHtml(JSON.stringify(got).slice(0, 200))}</code>`);
        }
      }
    } catch (e) {
      push('fail', '6. Write test — network error', `<code>${escapeHtml(String(e))}</code>`);
    }

    // Final verdict
    lines.push(`<div class="diag-row" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-dim);">
      Tip: if everything above is green but admin still shows <strong>No players yet</strong>, wait a few seconds and tap a nav link to refresh the page — the app polls every 4s.
    </div>`);
    out.innerHTML = lines.join('');
  }

  async function resetGame() {
    if (!confirm('WARNING: This deletes all players and results. Continue?')) return;
    if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
    const keys = await Store.list('players:', true);
    for (const k of keys) await Store.delete(k, true);
    gameState = {
      phase: 'open',
      finalTop: Array(C.topN).fill(null),
      finalBot: Array(C.botN).fill(null),
      finalTiebreakers: {},
    };
    await saveGameState();
    await Store.delete('me', false);
    me = null;
    selectedTeam = null;
    myPicks = emptyPicks();
    myTiebreakers = {};
    sessionStorage.removeItem('pmd_admin');
    window.location.hash = '#/';
    const input = document.getElementById('nameInput');
    if (input) input.value = '';
    renderPlayerState();
    renderSlots();
    renderPool();
    renderTiebreakers();
  }

  async function finalize() {
    if (gameState.finalTop.filter(Boolean).length !== C.topN
      || gameState.finalBot.filter(Boolean).length !== C.botN) {
      toast('Fill all final-result slots first');
      return;
    }
    if (!confirm('Finalize the results and score everyone?')) return;
    gameState.phase = 'finished';
    await saveGameState();
    toast('Results finalized — scoring now');
    await refreshAll();
  }

  async function prefillResults() {
    const sorted = liveTableData.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
    gameState.finalTop = sorted.slice(0, C.topN).map(t => t.abbr);
    gameState.finalBot = sorted.slice(20 - C.botN, 20).map(t => t.abbr);
    await saveGameState();
    renderSlots();
    renderPool();
    toast('Pre-filled from live table');
  }

  async function autoTiebreakers() {
    const { projTb } = computeProjectedResults();
    gameState.finalTiebreakers = Object.assign({}, gameState.finalTiebreakers || {}, projTb);
    await saveGameState();
    renderAdminTiebreakers();
    toast('Auto tiebreakers filled (manual ones unchanged)');
  }

  // ===============================================================
  // SHARE
  // ===============================================================
  function sharePicks() {
    const topFilled = myPicks.top.filter(Boolean).length;
    const botFilled = myPicks.bot.filter(Boolean).length;
    if (topFilled !== C.topN || botFilled !== C.botN) {
      toast('Fill all slots before sharing');
      return;
    }

    const lines = [];
    lines.push(`🏆 ${C.longName.toUpperCase()} PREDICTIONS`);
    lines.push(`Player: ${me ? me.name : '(not joined)'}`);
    lines.push('');
    lines.push(`${C.topLabel}:`);
    myPicks.top.forEach((abbr, i) => {
      const t = TEAM_BY_ABBR[abbr];
      lines.push(`  ${i + 1}. ${t ? t.name : '—'}`);
    });
    if (C.botN > 0) {
      lines.push('');
      lines.push(`${C.botLabel}:`);
      myPicks.bot.forEach((abbr, i) => {
        const t = TEAM_BY_ABBR[abbr];
        lines.push(`  ${21 - C.botN + i}. ${t ? t.name : '—'}`);
      });
    }

    // Tiebreakers
    const tbPicks = (C.tiebreakers || []).filter(tb => myTiebreakers[tb.id]);
    if (tbPicks.length) {
      lines.push('');
      lines.push('TIEBREAKERS:');
      tbPicks.forEach(tb => {
        const pick = myTiebreakers[tb.id];
        let display = pick;
        if (tb.candidatePlayers) {
          const p = tb.candidatePlayers.find(x => x.id === pick);
          if (p) display = p.name;
        } else {
          const t = TEAM_BY_ABBR[pick];
          if (t) display = t.name;
        }
        lines.push(`  ${tb.label}: ${display}`);
      });
    }

    lines.push('');
    lines.push(`Play: ${window.PMD.Config.siteUrl}`);

    const text = lines.join('\n');

    // Try Web Share API first (great on mobile)
    if (navigator.share) {
      navigator.share({
        title: 'My PMD Sports Predictor picks',
        text: text,
      }).catch(() => showShareModal(text));
    } else {
      showShareModal(text);
    }
  }

  function showShareModal(text) {
    document.getElementById('modalPreview').textContent = text;
    document.getElementById('shareModal').style.display = 'flex';
  }

  // ===============================================================
  // STORAGE MODE (no UI — kept as a no-op after cleanup pass)
  // ===============================================================
  function renderStorageMode() {
    // UI intentionally removed — users don't need backend details
  }

  // ===============================================================
  // UTILS
  // ===============================================================
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
    );
  }

  function timeAgo(ts) {
    if (!ts) return 'unknown';
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // Expose toast for debug
  window.PMD.toast = toast;

  // Kick off
  init();
})();
