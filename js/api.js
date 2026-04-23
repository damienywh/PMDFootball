/* ================================================================
   LIVE DATA API — ESPN STANDINGS
   ================================================================
   ESPN's unofficial public API is CORS-enabled and requires no key.
   Endpoint for the PL:
     https://site.web.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=2025

   Returns full stats: rank, points, games played, W/D/L, goals for/against,
   goal difference. Team names are matched fuzzily via espnMatch arrays in
   the competition config.

   We cache in shared storage for 5 minutes (configurable) so every user
   benefits from one fetch per TTL window, rather than slamming ESPN.
   ================================================================ */

(function(root) {

  function matchEspnTeam(espnTeam, teams) {
    const candidates = [
      espnTeam.displayName,
      espnTeam.name,
      espnTeam.shortDisplayName,
      espnTeam.location,
    ].filter(Boolean).map(s => s.toLowerCase());

    for (const t of teams) {
      for (const candidate of candidates) {
        for (const m of (t.espnMatch || [])) {
          if (candidate === m.toLowerCase()) return t;
        }
      }
    }
    return null;
  }

  function extractStat(entry, ...names) {
    for (const name of names) {
      const stat = (entry.stats || []).find(s => s.name === name);
      if (!stat) continue;
      if (stat.value !== undefined) return stat.value;
      const n = parseFloat(stat.displayValue);
      if (!isNaN(n)) return n;
    }
    return null;
  }

  function parseStandings(data, teams) {
    let entries = null;

    // Most common shape: data.children[0].standings.entries
    if (data.children && Array.isArray(data.children)) {
      for (const c of data.children) {
        if (c.standings && c.standings.entries) {
          entries = c.standings.entries;
          break;
        }
      }
    }
    if (!entries && data.standings && data.standings.entries) {
      entries = data.standings.entries;
    }
    if (!entries) return null;

    const updates = [];
    entries.forEach(entry => {
      const matched = matchEspnTeam(entry.team || {}, teams);
      if (!matched) return;

      const rank = extractStat(entry, 'rank');
      const pts = extractStat(entry, 'points', 'pts');
      const gp = extractStat(entry, 'gamesPlayed', 'games');
      const w = extractStat(entry, 'wins');
      const d = extractStat(entry, 'ties', 'draws');
      const l = extractStat(entry, 'losses');
      const gf = extractStat(entry, 'pointsFor', 'goalsFor');
      const ga = extractStat(entry, 'pointsAgainst', 'goalsAgainst');
      const gd = extractStat(entry, 'pointDifferential', 'goalDifference');

      updates.push({
        abbr: matched.abbr,
        rank: rank ?? matched.baseline.rank,
        pts: pts ?? matched.baseline.pts,
        gp: gp ?? matched.baseline.gp,
        w: w ?? matched.baseline.w,
        d: d ?? matched.baseline.d,
        l: l ?? matched.baseline.l,
        gf: gf ?? matched.baseline.gf,
        ga: ga ?? matched.baseline.ga,
        gd: gd ?? matched.baseline.gd,
      });
    });

    // Sanity check: need at least 15 teams matched
    if (updates.length < 15) return null;
    return updates;
  }

  async function fetchLive(opts = {}) {
    const comp = root.COMPETITION;
    if (!comp || !comp.liveSource) return null;
    const { url, cacheMinutes } = comp.liveSource;
    const ttlMs = (cacheMinutes || 5) * 60 * 1000;
    const force = !!opts.force;

    // Try cache first (shared in Firebase so everyone benefits)
    const cacheRaw = await root.PMD.Storage.get('table:cache', true);
    const cache = root.PMD.Storage.safeParse(cacheRaw, null);

    const cacheFresh = cache && cache.fetchedAt && (Date.now() - cache.fetchedAt < ttlMs);
    if (!force && cacheFresh) {
      return { source: 'cached', fetchedAt: cache.fetchedAt, updates: cache.updates };
    }

    // Fetch fresh
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const updates = parseStandings(data, comp.teams);
      if (!updates) throw new Error('Bad response shape');
      const record = { fetchedAt: Date.now(), updates };
      await root.PMD.Storage.set('table:cache', record, true);
      return { source: 'live', fetchedAt: record.fetchedAt, updates };
    } catch (err) {
      console.warn('Live fetch failed', err);
      if (cache && cache.updates) {
        return { source: 'cached', fetchedAt: cache.fetchedAt, updates: cache.updates };
      }
      return { source: 'offline', fetchedAt: null, updates: null };
    }
  }

  root.PMD = root.PMD || {};
  root.PMD.Api = { fetchLive, parseStandings };
})(window);
