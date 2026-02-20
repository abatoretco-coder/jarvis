export type ParsedArgs = Record<string, unknown>;

export function parseKeyValueArgs(input: string): ParsedArgs {
  const out: ParsedArgs = {};

  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === ' ') {
      const t = current.trim();
      if (t) tokens.push(t);
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) tokens.push(tail);

  for (const token of tokens) {
    const eq = token.indexOf('=');
    if (eq === -1) continue;
    const key = token.slice(0, eq).trim();
    const raw = token.slice(eq + 1).trim();
    if (!key) continue;

    if (/^\d+$/.test(raw)) out[key] = Number(raw);
    else if (raw === 'true') out[key] = true;
    else if (raw === 'false') out[key] = false;
    else out[key] = raw;
  }

  return out;
}
