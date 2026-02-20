import type { ConnectorName } from '../actions/types';
import type { Skill } from './types';

function normalize(s: string): string {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

function detectConnector(text: string): ConnectorName | undefined {
  const t = normalize(text);
  if (t.includes('whatsapp') || t.includes("what'sapp")) return 'whatsapp';
  if (t.includes('messenger') || t.includes('facebook messenger')) return 'messenger';
  if (t.includes('sms') || t.includes('texto') || t.includes('textos')) return 'sms';
  if (
    t.includes('email') ||
    t.includes('e-mail') ||
    t.includes('mail') ||
    t.includes('mails') ||
    t.includes('gmail') ||
    t.includes('outlook')
  )
    return 'email';
  return undefined;
}

function wantsSummarize(text: string): boolean {
  const t = normalize(text);
  return (
    t.includes('résume') || t.includes('resume') || t.includes('summary') || t.includes('summarize')
  );
}

export const inboxSkill: Skill = {
  name: 'inbox',
  match: (input) => {
    const connector = detectConnector(input.text);
    if (!connector) return { score: 0 };

    const t = normalize(input.text);
    if (t.includes('lis') || t.includes('read') || t.includes('check') || t.includes('latest')) {
      return { score: 0.7, intent: `${connector}.read_latest` };
    }

    if (wantsSummarize(input.text)) {
      return { score: 0.75, intent: `${connector}.summarize` };
    }

    return { score: 0.4, intent: `${connector}.inbox` };
  },
  run: async (input, ctx) => {
    const connector = detectConnector(input.text);
    if (!connector) {
      return {
        intent: 'inbox.unknown',
        result: {
          message: 'Inbox skill could not detect a connector.',
          supported: ['email', 'whatsapp', 'messenger', 'sms'],
        },
        actions: [],
      };
    }

    const summarize = wantsSummarize(input.text);

    const operation = summarize ? 'summarize' : 'read_latest';
    const params: Record<string, unknown> = {
      limit: 5,
      includePreview: true,
      language: 'auto',
    };

    return {
      intent: `${connector}.${operation}`,
      result: {
        message:
          'Planned inbox read. VM400 connector should execute this and optionally call Jarvis again with a summary.',
        connector,
        operation,
        params,
        requestId: ctx.requestId,
      },
      actions: [
        {
          type: 'connector.request',
          connector,
          operation,
          params,
        },
      ],
    };
  },
};
