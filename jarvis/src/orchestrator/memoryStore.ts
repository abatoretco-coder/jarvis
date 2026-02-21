import fs from 'node:fs/promises';
import path from 'node:path';

export type MemoryRole = 'user' | 'assistant';

export type MemoryMessage = {
  ts: string; // ISO
  role: MemoryRole;
  content: string;
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

function toLine(msg: MemoryMessage): string {
  return JSON.stringify(msg);
}

function parseLine(line: string): MemoryMessage | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const p = parsed as Record<string, unknown>;
    if (typeof p.ts !== 'string') return undefined;
    if (p.role !== 'user' && p.role !== 'assistant') return undefined;
    if (typeof p.content !== 'string') return undefined;
    return { ts: p.ts, role: p.role, content: p.content };
  } catch {
    return undefined;
  }
}

export class MemoryStore {
  constructor(
    private readonly dir: string,
    private readonly ttlHours: number,
    private readonly maxMessages: number
  ) {}

  private filePath(conversationId: string): string {
    const name = safeFileName(conversationId || 'default') || 'default';
    return path.join(this.dir, `${name}.ndjson`);
  }

  async loadRecent(conversationId: string, now: Date): Promise<MemoryMessage[]> {
    await ensureDir(this.dir);
    const file = this.filePath(conversationId);

    let raw = '';
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch (e: unknown) {
      // File doesn't exist yet.
      if (typeof e === 'object' && e && 'code' in e && (e as { code?: unknown }).code === 'ENOENT') {
        return [];
      }
      throw e;
    }

    const cutoff = now.getTime() - this.ttlHours * 60 * 60 * 1000;

    const msgs: MemoryMessage[] = [];
    for (const line of raw.split('\n')) {
      const m = parseLine(line);
      if (!m) continue;
      const t = Date.parse(m.ts);
      if (!Number.isFinite(t)) continue;
      if (t < cutoff) continue;
      msgs.push(m);
    }

    // Keep only last N messages.
    return msgs.slice(Math.max(0, msgs.length - this.maxMessages));
  }

  async append(conversationId: string, msg: MemoryMessage, now: Date): Promise<void> {
    await ensureDir(this.dir);
    const file = this.filePath(conversationId);

    // Append first.
    await fs.appendFile(file, toLine(msg) + '\n', 'utf8');

    // Prune opportunistically.
    const recent = await this.loadRecent(conversationId, now);
    const pruned = recent.slice(Math.max(0, recent.length - this.maxMessages));
    const content = pruned.map(toLine).join('\n') + (pruned.length ? '\n' : '');
    await fs.writeFile(file, content, 'utf8');
  }
}
