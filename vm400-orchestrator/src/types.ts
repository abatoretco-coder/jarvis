export type JarvisCommandResponse = {
  requestId: string;
  intent: string;
  skill: string;
  result: unknown;
  actions: Array<Record<string, unknown>>;
  mode?: 'plan' | 'execute';
};

export type InboxMessage = {
  source: 'sms' | 'whatsapp' | 'messenger';
  from?: string;
  text: string;
  timestamp: string;
};
