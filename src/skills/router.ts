import type { Skill, SkillInput, SkillRunContext } from './types';

export type RoutedSkillResult = {
  skill: string;
  intent: string;
  result: unknown;
  actions: import('../actions/types').JarvisAction[];
};

export async function routeAndRun(
  skills: Skill[],
  input: SkillInput,
  ctx: SkillRunContext
): Promise<RoutedSkillResult> {
  let best: { skill: Skill; score: number; intent: string } | undefined;

  for (const skill of skills) {
    const m = skill.match(input);
    const score = Number.isFinite(m.score) ? m.score : 0;
    if (!best || score > best.score) {
      best = {
        skill,
        score,
        intent: m.intent ?? skill.name,
      };
    }
  }

  if (!best || best.score <= 0) {
    return {
      skill: 'fallback',
      intent: 'unknown',
      result: {
        message: "I didn't recognize that command.",
        hint: 'Try: ping | ha: <domain>.<service> entity_id=<entity_id> | play music <query>',
      },
      actions: [],
    };
  }

  const ran = await best.skill.run(input, ctx);
  return {
    skill: best.skill.name,
    intent: ran.intent,
    result: ran.result,
    actions: ran.actions,
  };
}
