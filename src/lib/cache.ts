type CacheEntry<T> = {
  expiresAt: number;
  createdAt: number;
  value: T;
};

const PREFIX = 'rtm:v1:';
const DEFAULT_TTL_MS = 1000 * 60 * 10;
const MAX_ITEM_CHARS = 750_000;

const memory = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const now = Date.now();
  const memoryEntry = memory.get(key) as CacheEntry<T> | undefined;
  if (memoryEntry) {
    if (memoryEntry.expiresAt > now) return memoryEntry.value;
    memory.delete(key);
  }

  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed.expiresAt <= now) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    memory.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  const entry: CacheEntry<T> = {
    value,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs
  };
  memory.set(key, entry);

  if (typeof localStorage === 'undefined') return;
  try {
    const serialized = JSON.stringify(entry);
    if (serialized.length > MAX_ITEM_CHARS) return;
    localStorage.setItem(PREFIX + key, serialized);
  } catch {
    // Storage can be full or unavailable in private browsing. Memory cache remains active.
  }
}

export function clearRepoTimeMachineCache(): void {
  memory.clear();
  if (typeof localStorage === 'undefined') return;
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
  }
}

export function cacheKey(parts: Array<string | number | boolean | undefined | null>): string {
  return parts.map((part) => encodeURIComponent(String(part ?? ''))).join(':');
}
