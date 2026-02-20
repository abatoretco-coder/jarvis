import type { Skill } from './types';

export const robotSkill: Skill = {
  name: 'robot',
  match: (input) => {
    const t = input.text.trim().toLowerCase();
    if (t.startsWith('robot:')) return { score: 0.8, intent: 'robot.start' };
    if (t.includes('robot') || t.includes('aspirateur') || t.includes('vacuum'))
      return { score: 0.4, intent: 'robot.plan' };
    return { score: 0 };
  },
  run: async (input, ctx) => {
    const t = input.text.trim().toLowerCase();
    const robot = t.includes('vacuum') || t.includes('aspirateur') ? 'vacuum' : 'robot';

    return {
      intent: 'robot.plan',
      result: {
        message: 'Robot skill is a stub in v0.1 (add your robot connector on VM400).',
        requestId: ctx.requestId,
        hint: 'Later: map to HA vacuum.* services or vendor API',
      },
      actions: [{ type: 'robot.start', robot, mode: 'auto' }],
    };
  },
};
