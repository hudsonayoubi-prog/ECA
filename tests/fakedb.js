// Minimal in-memory stand-in for the artifact db + user capabilities, for testing the sync layer.
window.__store = JSON.parse(sessionStorage.getItem('fakestore') || '{}'); window.__writes = [];
(function(){
  const listeners = [];
  const snapCol = col => { const docs = Object.entries(window.__store).filter(([p]) => p.split('/').slice(0,-1).join('/') === col).map(([p, b]) => ({ id: p.split('/').pop(), exists: true, data: () => b, metadata: { fromCache: false, hasPendingWrites: false } }));
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }; };
  const emit = () => listeners.forEach(l => setTimeout(() => l.fire(), 5));
  const doc = path => ({ id: path.split('/').pop(), path,
    async set(b) { window.__writes.push(path); window.__store[path] = JSON.parse(JSON.stringify(b)); sessionStorage.setItem('fakestore', JSON.stringify(window.__store)); emit(); },
    async get() { const b = window.__store[path]; return { id: path.split('/').pop(), exists: !!b, data: () => b, metadata: {} }; },
    onSnapshot(next) { const l = { fire: () => { const b = window.__store[path]; next({ id: path.split('/').pop(), exists: !!b, data: () => b, metadata: {} }); } }; listeners.push(l); setTimeout(l.fire, 20); return () => {}; } });
  const collection = col => ({ path: col, doc: id => doc(col + '/' + (id || Math.random().toString(36).slice(2))),
    onSnapshot(next) { const l = { fire: () => next(snapCol(col)) }; listeners.push(l); setTimeout(l.fire, 20); return () => {}; } });
  window.__external = (path, body) => { window.__store[path] = body; emit(); };
  const db = { doc, collection }; const user = { can: async () => true, id: async () => 'u_test', isOwner: () => true, canEdit: () => true };
  window.claude = { use: async n => (n === 'db' ? db : n === 'user' ? user : null) };
})();
