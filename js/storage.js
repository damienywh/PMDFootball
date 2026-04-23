/* ================================================================
   STORAGE ADAPTER
   ================================================================
   Two modes:

   1. ONLINE (Firebase Realtime Database)
      Set PMD.Config.firebaseUrl to your RTDB URL.
      Set PMD.Config.firebaseApiKey to your Web API key (for anon auth).
      Uses the public REST API — no SDK needed.

      If firebaseApiKey is present, we sign in anonymously and attach
      an idToken to every request. This lets you tighten your rules:
        { "rules": { ".read": "auth != null", ".write": "auth != null" } }

      If firebaseApiKey is empty, requests go unauthenticated. Your
      rules must then allow public read/write (NOT recommended).

   2. LOCAL (localStorage fallback)
      If no firebaseUrl is configured, state is per-browser.
   ================================================================ */

(function(root) {
  // -------------------------------------------------------------
  // Firebase Anonymous Auth — token management
  // -------------------------------------------------------------
  let _authToken = null;
  let _authTokenExpiry = 0;
  let _authPromise = null;

  async function getAuthToken() {
    const apiKey = (root.PMD && root.PMD.Config && root.PMD.Config.firebaseApiKey) || '';
    if (!apiKey) return null;

    if (_authToken && Date.now() < _authTokenExpiry - 120000) {
      return _authToken;
    }
    if (_authPromise) return _authPromise;

    _authPromise = (async () => {
      try {
        const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnSecureToken: true })
        });
        if (!r.ok) {
          const errText = await r.text();
          console.warn('Firebase anon auth failed:', r.status, errText);
          return null;
        }
        const data = await r.json();
        _authToken = data.idToken;
        _authTokenExpiry = Date.now() + (parseInt(data.expiresIn, 10) * 1000);
        return _authToken;
      } catch (e) {
        console.warn('Firebase anon auth error', e);
        return null;
      } finally {
        _authPromise = null;
      }
    })();

    return _authPromise;
  }

  async function authedFetch(url, opts) {
    const token = await getAuthToken();
    const sep = url.includes('?') ? '&' : '?';
    const authedUrl = token ? `${url}${sep}auth=${encodeURIComponent(token)}` : url;
    return fetch(authedUrl, opts || {});
  }

  // -------------------------------------------------------------
  // Mode + namespacing
  // -------------------------------------------------------------
  function mode() {
    const url = (root.PMD && root.PMD.Config && root.PMD.Config.firebaseUrl) || '';
    return url && url.includes('firebasedatabase.app') ? 'online' : 'local';
  }

  function authMode() {
    const key = (root.PMD && root.PMD.Config && root.PMD.Config.firebaseApiKey) || '';
    return key ? 'authed' : 'open';
  }

  function firebaseBase() {
    const url = (root.PMD && root.PMD.Config && root.PMD.Config.firebaseUrl) || '';
    return url.replace(/\/$/, '');
  }

  function namespace() {
    const comp = (root.COMPETITION && root.COMPETITION.key) || 'default';
    return comp;
  }

  function lsKey(key) {
    return `pmd:${namespace()}:${key}`;
  }

  function fbUrl(path) {
    return `${firebaseBase()}/${namespace()}/${path}.json`;
  }

  // -------------------------------------------------------------
  // Storage API
  // -------------------------------------------------------------
  async function get(key, shared = true) {
    if (!shared || mode() === 'local') {
      return localStorage.getItem(lsKey(key));
    }
    try {
      const r = await authedFetch(fbUrl(key));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (data === null || data === undefined) return null;
      return typeof data === 'string' ? data : JSON.stringify(data);
    } catch (e) {
      console.warn('Firebase get failed; falling back to local', e);
      return localStorage.getItem(lsKey(key));
    }
  }

  async function set(key, value, shared = true) {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    try { localStorage.setItem(lsKey(key), str); } catch (_) {}
    if (!shared || mode() === 'local') return true;
    try {
      const r = await authedFetch(fbUrl(key), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(str)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return true;
    } catch (e) {
      console.warn('Firebase set failed; kept locally', e);
      return false;
    }
  }

  async function del(key, shared = true) {
    try { localStorage.removeItem(lsKey(key)); } catch (_) {}
    if (!shared || mode() === 'local') return true;
    try {
      await authedFetch(fbUrl(key), { method: 'DELETE' });
      return true;
    } catch (e) {
      console.warn('Firebase delete failed', e);
      return false;
    }
  }

  async function list(prefix, shared = true) {
    if (!shared || mode() === 'local') {
      const keys = [];
      const ns = `pmd:${namespace()}:`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(ns)) {
          const inner = k.slice(ns.length);
          if (inner.startsWith(prefix)) keys.push(inner);
        }
      }
      return keys;
    }
    try {
      // Data is stored as flat keys at namespace root (e.g. `players:abc123`,
      // `game:state`). The colon is part of the key NAME, not a path segment.
      // So we fetch all top-level keys under the namespace and filter
      // client-side. `shallow=true` returns key names only, no values.
      const url = `${firebaseBase()}/${namespace()}.json?shallow=true`;
      const r = await authedFetch(url);
      if (!r.ok) return [];
      const data = await r.json();
      if (!data) return [];
      return Object.keys(data).filter(k => k.startsWith(prefix));
    } catch (e) {
      console.warn('Firebase list failed', e);
      return [];
    }
  }

  function safeParse(str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
  }

  root.PMD = root.PMD || {};
  root.PMD.Storage = { get, set, delete: del, list, mode, authMode, safeParse };
})(window);
