import { google } from 'googleapis';

import type { Env } from './env';

export type GmailItem = {
  id: string;
  from?: string;
  subject?: string;
  snippet?: string;
  internalDateMs?: number;
};

function requireGmail(env: Env) {
  const missing: string[] = [];
  if (!env.GMAIL_CLIENT_ID) missing.push('GMAIL_CLIENT_ID');
  if (!env.GMAIL_CLIENT_SECRET) missing.push('GMAIL_CLIENT_SECRET');
  if (!env.GMAIL_REFRESH_TOKEN) missing.push('GMAIL_REFRESH_TOKEN');
  if (!env.GMAIL_USER_EMAIL) missing.push('GMAIL_USER_EMAIL');
  if (missing.length)
    throw new Error(`Gmail connector not configured. Missing: ${missing.join(', ')}`);
}

export async function readLatestEmails(env: Env, limit: number): Promise<GmailItem[]> {
  requireGmail(env);
  const oauth2 = new google.auth.OAuth2(
    env.GMAIL_CLIENT_ID,
    env.GMAIL_CLIENT_SECRET,
    env.GMAIL_REDIRECT_URI
  );
  oauth2.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  const list = await gmail.users.messages.list({
    userId: env.GMAIL_USER_EMAIL!,
    maxResults: limit,
  });
  const ids = (list.data.messages ?? []).map((m) => m.id).filter(Boolean) as string[];

  const items: GmailItem[] = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({
      userId: env.GMAIL_USER_EMAIL!,
      id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const headers = msg.data.payload?.headers ?? [];
    const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value;
    const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value;
    items.push({
      id,
      from,
      subject,
      snippet: msg.data.snippet ?? undefined,
      internalDateMs: msg.data.internalDate ? Number(msg.data.internalDate) : undefined,
    });
  }
  return items;
}
