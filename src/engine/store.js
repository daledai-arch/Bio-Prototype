/* Saved progress. Storage can be blocked (private mode, previews), so every call is guarded. */
const KEY = "livingCellLab.v1";
export function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
export function save(data){ try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* not saved */ } }
export function clear(){ try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ } }
