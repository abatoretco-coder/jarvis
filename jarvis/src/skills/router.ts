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
        message: "Je n'ai pas reconnu cette commande.",
        hint: [
          'Exemples:',
          '- ping',
          '- time (ou: quelle heure est-il ?)',
          '- todo: acheter du lait (ou: ajoute une tâche appeler le dentiste)',
          '- allume la lumière cuisine 40%',
          '- ha: <domain>.<service> entity_id=<id> key=value ...',
          '- lis mes emails / résume mes messages whatsapp',
          '- joue daft punk (ou: play music <query>)',
        ].join('\n'),
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
