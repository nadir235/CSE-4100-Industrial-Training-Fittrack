'use strict';
/** Minimal in-memory stand-in for the Firestore Admin SDK (only what the API uses). */

function createFakeDb() {
  const store = new Map(); // path -> data
  let idSeq = 0;
  let lock = Promise.resolve();

  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const depth = (p) => p.split('/').length;

  function docRef(path) {
    return {
      id: path.split('/').pop(),
      path,
      get parent() { return colRef(path.split('/').slice(0, -1).join('/')); },
      async get() { return snap(path); },
      async set(data, opts) {
        store.set(path, opts?.merge ? { ...(store.get(path) || {}), ...clone(data) } : clone(data));
      },
      async update(data) {
        if (!store.has(path)) throw new Error(`update on missing doc ${path}`);
        store.set(path, { ...store.get(path), ...clone(data) });
      },
      async delete() { store.delete(path); },
      collection(name) { return colRef(`${path}/${name}`); },
    };
  }

  function snap(path) {
    const exists = store.has(path);
    return { exists, id: path.split('/').pop(), ref: docRef(path), data: () => clone(store.get(path)) };
  }

  function listDocs(colPath) {
    const prefix = colPath + '/';
    return [...store.keys()].filter((k) => k.startsWith(prefix) && depth(k) === depth(colPath) + 1);
  }

  function query(colPath, filters = [], order = null, lim = null) {
    const run = () => {
      let paths = listDocs(colPath);
      for (const [f, op, v] of filters) {
        paths = paths.filter((p) => {
          const x = store.get(p)[f];
          if (op === '==') return x === v;
          if (op === '>=') return x >= v;
          if (op === '>') return x > v;
          if (op === '<=') return x <= v;
          throw new Error('unsupported op ' + op);
        });
      }
      if (order) {
        const [f, dir] = order;
        paths.sort((a, b) => { const x = store.get(a)[f], y = store.get(b)[f]; return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1); });
      }
      if (lim != null) paths = paths.slice(0, lim);
      return paths;
    };
    return {
      where: (f, op, v) => query(colPath, [...filters, [f, op, v]], order, lim),
      orderBy: (f, dir = 'asc') => query(colPath, filters, [f, dir], lim),
      limit: (n) => query(colPath, filters, order, n),
      async get() {
        const docs = run().map((p) => snap(p));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      count: () => ({ get: async () => ({ data: () => ({ count: run().length }) }) }),
    };
  }

  function colRef(colPath) {
    return {
      ...query(colPath),
      path: colPath,
      doc(id) { return docRef(`${colPath}/${id || `auto${++idSeq}`}`); },
      async add(data) { const r = colRef(colPath).doc(); await r.set(data); return r; },
    };
  }

  return {
    _store: store,
    collection: (p) => colRef(p),
    batch() {
      const ops = [];
      return {
        set: (ref, data) => ops.push(() => ref.set(data)),
        delete: (ref) => ops.push(() => ref.delete()),
        async commit() { for (const op of ops) await op(); },
      };
    },
    // Serialised, like Firestore's optimistic concurrency would force with retries.
    async runTransaction(fn) {
      const prev = lock;
      let release;
      lock = new Promise((r) => (release = r));
      await prev;
      try {
        const writes = [];
        const tx = {
          get: async (ref) => ref.get(),
          set: (ref, data) => writes.push(() => ref.set(data)),
          update: (ref, data) => writes.push(() => ref.update(data)),
        };
        const out = await fn(tx);
        for (const w of writes) await w();
        return out;
      } finally {
        release();
      }
    },
  };
}

function createFakeAuth(users) {
  return {
    async verifyIdToken(token) {
      const u = users[token];
      if (!u) throw new Error('bad token');
      return u;
    },
  };
}

module.exports = { createFakeDb, createFakeAuth };
