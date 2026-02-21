import fs from 'node:fs/promises';
import path from 'node:path';

import type { JarvisAction } from '../actions/types';

export type PendingItem = {
  createdAt: string; // ISO
  expiresAt: string; // ISO
  action: JarvisAction;
};

function safeFileName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .slice(0, 120);
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function parsePending(raw: string): PendingItem | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return undefined;
    const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined;
    const expiresAt = typeof parsed.expiresAt === 'string' ? parsed.expiresAt : undefined;
    const action = (parsed as any).action as unknown;
    if (!createdAt || !expiresAt) return undefined;
    if (!isObject(action) || typeof (action as any).type !== 'string') return undefined;
    return { createdAt, expiresAt, action: action as JarvisAction };
  } catch {
    return undefined;
  }
}

export class PendingStore {
  constructor(
    private readonly dir: string,
    private readonly ttlMs: number
  ) {}

  private filePath(conversationId: string): string {
    const name = safeFileName(conversationId || 'default') || 'default';
    return path.join(this.dir, `${name}.json`);
  }

  private isExpired(item: PendingItem, now: Date): boolean {
    const t = Date.parse(item.expiresAt);
    return !Number.isFinite(t) || t <= now.getTime();
  }

  async get(conversationId: string, now: Date): Promise<PendingItem | undefined> {
    await ensureDir(this.dir);
    const file = this.filePath(conversationId);
    let raw = '';
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch (e: unknown) {
      if (typeof e === 'object' && e && 'code' in e && (e as { code?: unknown }).code === 'ENOENT') {
        return undefined;
      }
      throw e;
    }

    const item = parsePending(raw);
    if (!item) {
      await fs.rm(file, { force: true }).catch(() => undefined);
      return undefined;
    }
    if (this.isExpired(item, now)) {
      await fs.rm(file, { force: true }).catch(() => undefined);
      return undefined;
    }
    return item;
  }

  async set(conversationId: string, action: JarvisAction, now: Date): Promise<void> {
    await ensureDir(this.dir);
    const file = this.filePath(conversationId);
    const item: PendingItem = {
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
      action,
    };
    await fs.writeFile(file, JSON.stringify(item), 'utf8');
  }

  async clear(conversationId: string): Promise<void> {
    await ensureDir(this.dir);
    const file = this.filePath(conversationId);
    await fs.rm(file, { force: true }).catch(() => undefined);
  }

  async consume(conversationId: string, now: Date): Promise<PendingItem | undefined> {
    const item = await this.get(conversationId, now);
    if (item) await this.clear(conversationId);
    return item;
  }
}
