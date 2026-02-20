import type { Skill } from './types';

function extractTitle(text: string): string | undefined {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (lower.startsWith('todo:')) return t.slice(5).trim() || undefined;
  if (lower.startsWith('to-do:')) return t.slice(5).trim() || undefined;

  const m = lower.match(/^(add|ajoute|ajouter)\s+(a\s+)?(todo|to-do|tâche|tache)\s+(.+)$/);
  if (m) return t.slice(t.length - m[4].length).trim() || undefined;

  return undefined;
}

export const todoSkill: Skill = {
  name: 'todo',
  match: (input) => {
    const title = extractTitle(input.text);
    if (title) return { score: 0.85, intent: 'todo.add_task' };
    if (input.text.toLowerCase().includes('todo')) return { score: 0.2, intent: 'todo.unknown' };
    return { score: 0 };
  },
  run: async (input, ctx) => {
    const title = extractTitle(input.text);
    if (!title) {
      return {
        intent: 'todo.unknown',
        result: {
          message: 'Todo skill needs an explicit title in v0.1.',
          examples: ['todo: buy milk', 'ajoute une tâche appeler le dentiste'],
        },
        actions: [],
      };
    }

    return {
      intent: 'todo.add_task',
      result: {
        message: 'Planned todo task (execution happens on VM400/connector).',
        title,
        requestId: ctx.requestId,
      },
      actions: [{ type: 'todo.add_task', title }],
    };
  },
};
