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

export type JarvisAction =
  | HomeAssistantServiceCallAction
  | TodoAddTaskAction
  | MusicPlayRequestAction
  | RobotStartAction
  | TimerRequestedAction;

export type ExecutedAction = {
  action: JarvisAction;
  status: 'executed' | 'skipped' | 'failed';
  output?: unknown;
  error?: string;
};
