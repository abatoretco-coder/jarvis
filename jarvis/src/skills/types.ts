import type { JarvisAction } from '../actions/types';

export type SkillRunContext = {
  requestId: string;
  now: Date;
  execute: boolean;
  env: {
    haEntityAliases?: Record<string, string>;
    memoryDir?: string;
  };
  ha: {
    callService: (input: {
      domain: string;
      service: string;
      serviceData?: Record<string, unknown>;
      target?: Record<string, unknown>;
    }) => Promise<{ status: number; data: unknown }>;
  };
};

export type SkillMatch = { score: number; intent?: string };

export type SkillRunResult = {
  intent: string;
  result: unknown;
  actions: JarvisAction[];
};

export type SkillInput = {
  text: string;
  context?: Record<string, unknown>;
};

export type Skill = {
  name: string;
  match: (input: SkillInput) => SkillMatch;
  run: (input: SkillInput, ctx: SkillRunContext) => Promise<SkillRunResult>;
};
