/** The player's name, remembered in this browser. */
const KEY = 'lockdown-name';
export function getName() { try { return localStorage.getItem(KEY) || 'Challenger'; } catch { return 'Challenger'; } }
export function saveName(name) { const safe = (name || '').trim().slice(0, 20) || 'Challenger'; try { localStorage.setItem(KEY, safe); } catch {} return safe; }
