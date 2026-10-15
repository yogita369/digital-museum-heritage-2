// In-memory stand-in for a Cloudflare Workers KV namespace.
// Implements only the subset of the KV API that application/worker.js uses
// (get, put, delete, list), so the Worker can be tested and previewed locally
// without a Cloudflare account.

export class MemoryKV {
  constructor(entries = {}) {
    this.store = new Map(Object.entries(entries));
  }

  async get(key, options) {
    const type = typeof options === "string" ? options : options?.type;
    if (!this.store.has(key)) return null;
    const value = this.store.get(key);
    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.store.set(key, String(value));
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list({ prefix = "", limit = 1000, cursor } = {}) {
    const names = [...this.store.keys()].filter((k) => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = names.slice(start, start + limit);
    const end = start + page.length;
    const complete = end >= names.length;
    return {
      keys: page.map((name) => ({ name })),
      list_complete: complete,
      cursor: complete ? undefined : String(end),
    };
  }
}
