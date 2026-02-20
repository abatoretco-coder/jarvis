import { appendFile, readFile } from 'node:fs/promises';

import type { InboxMessage } from './types';

export async function appendMessage(path: string, msg: InboxMessage) {
  await appendFile(path, `${JSON.stringify(msg)}\n`, { encoding: 'utf8' });
}

export async function readLatest(path: string, limit: number): Promise<InboxMessage[]> {
  try {
    const raw = await readFile(path, 'utf8');
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const slice = lines.slice(Math.max(0, lines.length - limit));
    const msgs: InboxMessage[] = [];
    for (const line of slice) {
      try {
        msgs.push(JSON.parse(line) as InboxMessage);
      } catch {
        // skip
      }
    }
    return msgs;
  } catch {
    return [];
  }
}
