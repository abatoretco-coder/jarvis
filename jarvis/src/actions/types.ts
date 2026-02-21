export type HomeAssistantServiceCallAction = {
  type: 'home_assistant.service_call';
  domain: string;
  service: string;
  target?: Record<string, unknown>;
  serviceData?: Record<string, unknown>;
};

export type TodoAddTaskAction = {
  type: 'todo.add_task';
  title: string;
  list?: string;
  /** Optional due date/time ISO string, e.g. 2026-02-21T09:00:00+01:00 */
  dueAt?: string;
  /** Optional reminder date/time ISO string */
  remindAt?: string;
};

export type MusicPlayRequestAction = {
  type: 'music.play_request';
  query: string;
};

export type RobotStartAction = {
  type: 'robot.start';
  robot: string;
  mode?: string;
};

export type TimerRequestedAction = {
  type: 'timer.requested';
  seconds: number;
  requestedAt: string;
};

export type WeatherQueryAction = {
  type: 'weather.query';
  /** Optional explicit Home Assistant weather entity_id (weather.xxx). */
  entityId?: string;
  /** now = current conditions, today/tomorrow/week use forecast when available. */
  when: 'now' | 'today' | 'tomorrow' | 'week';
};

export type ConnectorName = 'email' | 'whatsapp' | 'messenger' | 'sms' | 'todo';

export type ConnectorOperation = 'read_latest' | 'summarize' | 'search' | 'list' | 'create';

export type ConnectorRequestAction = {
  type: 'connector.request';
  connector: ConnectorName;
  operation: ConnectorOperation;
  params?: Record<string, unknown>;
};

export type JarvisAction =
  | HomeAssistantServiceCallAction
  | TodoAddTaskAction
  | MusicPlayRequestAction
  | RobotStartAction
  | TimerRequestedAction
  | WeatherQueryAction
  | ConnectorRequestAction;

export type ExecutedAction = {
  action: JarvisAction;
  status: 'executed' | 'skipped' | 'failed';
  output?: unknown;
  error?: string;
};
