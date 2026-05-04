/**
 * cache.js — In-memory cache layer
 *
 * Designed so Redis can be dropped in later:
 *   - Replace get/set/del with ioredis calls
 *   - Keep the same API surface
 */

const store = new Map(); // key → { value, expiresAt }

/**
 * Get a cached value. Returns null if missing or expired.
 * @param {string} key
 */
function get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.value;
}

/**
 * Set a value with a TTL in milliseconds.
 * @param {string} key
 * @param {*} value
 * @param {number} ttlMs  — time-to-live in ms (default 5 s)
 */
function set(key, value, ttlMs = 5000) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Delete one or more keys (supports wildcard prefix via del('prefix:*')).
 * @param {string} key
 */
function del(key) {
    if (key.endsWith('*')) {
        const prefix = key.slice(0, -1);
        for (const k of store.keys()) {
            if (k.startsWith(prefix)) store.delete(k);
        }
    } else {
        store.delete(key);
    }
}

/** Flush everything (useful for testing). */
function flush() {
    store.clear();
}

/** How many entries are currently cached. */
function size() {
    return store.size;
}

module.exports = { get, set, del, flush, size };
