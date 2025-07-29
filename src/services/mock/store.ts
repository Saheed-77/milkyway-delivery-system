/**
 * Shared state for the demo backend: the in-memory database, change events
 * and cross-tab sync. Both the mock API and the delivery simulator mutate the
 * database through `commit()` so every open tab stays consistent.
 */
import { toLocalISODate } from "@/lib/format";
import type { ChangeTopic } from "../api";
import { buildSeed } from "./seed";
import { DB_KEY, loadDb, loadSession, saveDb, saveSession, SESSION_KEY, type DemoDb } from "./db";

type Listener = (topic: ChangeTopic) => void;

const ALL_TOPICS: ChangeTopic[] = [
  "orders",
  "wallet",
  "stock",
  "farmers",
  "payments",
  "contributions",
  "subscriptions",
  "pricing",
  "rider_locations",
];

class DemoStore {
  db: DemoDb;
  sessionUserId: string | null;
  private listeners = new Set<{ topics: Set<ChangeTopic>; cb: Listener }>();
  private authListeners = new Set<() => void>();

  constructor() {
    this.db = this.loadOrSeed();
    this.sessionUserId = loadSession();
    if (this.sessionUserId && !this.db.profiles.some((p) => p.id === this.sessionUserId)) {
      this.sessionUserId = null;
      saveSession(null);
    }

    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === DB_KEY) {
          const next = loadDb();
          if (next) {
            this.db = next;
            ALL_TOPICS.forEach((t) => this.emit(t));
          }
        } else if (e.key === SESSION_KEY) {
          this.sessionUserId = loadSession();
          this.authListeners.forEach((cb) => cb());
        }
      });
    }
  }

  private loadOrSeed(): DemoDb {
    const existing = loadDb();
    if (existing && existing.seededOn === toLocalISODate()) return existing;
    const fresh = buildSeed();
    saveDb(fresh);
    return fresh;
  }

  reset(): void {
    this.db = buildSeed();
    saveDb(this.db);
    ALL_TOPICS.forEach((t) => this.emit(t));
  }

  /** Persist and notify. */
  commit(...topics: ChangeTopic[]): void {
    saveDb(this.db);
    topics.forEach((t) => this.emit(t));
  }

  emit(topic: ChangeTopic): void {
    this.listeners.forEach((l) => {
      if (l.topics.has(topic)) l.cb(topic);
    });
  }

  subscribe(topics: ChangeTopic[], cb: Listener): () => void {
    const entry = { topics: new Set(topics), cb };
    this.listeners.add(entry);
    return () => this.listeners.delete(entry);
  }

  setSession(userId: string | null): void {
    this.sessionUserId = userId;
    saveSession(userId);
    this.authListeners.forEach((cb) => cb());
  }

  onAuth(cb: () => void): () => void {
    this.authListeners.add(cb);
    return () => this.authListeners.delete(cb);
  }
}

let instance: DemoStore | null = null;

export function getStore(): DemoStore {
  if (!instance) instance = new DemoStore();
  return instance;
}

export type { DemoStore };
