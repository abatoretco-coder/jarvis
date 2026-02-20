export type JarvisCommandResponse = {
  requestId: string;
  intent: string;
  skill: string;
  result: unknown;
  actions: JarvisAction[];
  mode?: 'plan' | 'execute';
};

export type ConnectorName = 'email' | 'whatsapp' | 'messenger' | 'sms';

export type ConnectorRequestAction = {
  type: 'connector.request';
  connector: ConnectorName;
  operation: 'read_latest' | 'summarize' | 'search';
  params?: {
    limit?: number;
    [key: string]: unknown;
  };
};

export type UnknownAction = {
  type: string;
  [key: string]: unknown;
};

export type JarvisAction = ConnectorRequestAction | UnknownAction;

export type InboxMessage = {
  source: 'sms' | 'whatsapp' | 'messenger';
  from?: string;
  text: string;
  timestamp: string;
};
