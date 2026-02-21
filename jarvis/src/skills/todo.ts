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

function wantsList(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t === 'todo list' || t.startsWith('todo list ')) return true;
  if (t === 'list todo' || t.startsWith('list todo')) return true;
  return (
    t.includes('liste') && (t.includes('tâche') || t.includes('tache') || t.includes('todo'))
  ) ||
    (t.includes('montre') && (t.includes('tâche') || t.includes('tache') || t.includes('todo'))) ||
    (t.includes('mes tâches') || t.includes('mes taches'));
}

function extractTodoParams(rawTitle: string): { title: string; dueAt?: string; remindAt?: string } {
  // Support simple suffixes in command mode:
  //   todo: call dentist due=2026-02-23T09:00 remind=2026-02-23T08:50
  const dueMatch = rawTitle.match(/\bdue=([^\s]+)\b/i);
  const remindMatch = rawTitle.match(/\bremind=([^\s]+)\b/i);
  const dueAt = dueMatch ? dueMatch[1].trim() : undefined;
  const remindAt = remindMatch ? remindMatch[1].trim() : undefined;
  const title = rawTitle
    .replace(/\bdue=[^\s]+\b/gi, '')
    .replace(/\bremind=[^\s]+\b/gi, '')
    .trim();
  return { title, dueAt, remindAt };
}

export const todoSkill: Skill = {
  name: 'todo',
  match: (input) => {
    if (wantsList(input.text)) return { score: 0.75, intent: 'todo.list' };
    const title = extractTitle(input.text);
    if (title) return { score: 0.85, intent: 'todo.add_task' };
    if (input.text.toLowerCase().includes('todo')) return { score: 0.2, intent: 'todo.unknown' };
    return { score: 0 };
  },
  run: async (input, ctx) => {
    if (wantsList(input.text)) {
      return {
        intent: 'todo.list',
        result: {
          message: 'Planned todo list (execution happens on VM400/connector).',
          requestId: ctx.requestId,
        },
        actions: [
          {
            type: 'connector.request',
            connector: 'todo',
            operation: 'list',
            params: { limit: 10 },
          },
        ],
      };
    }

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

    const parsed = extractTodoParams(title);
    if (!parsed.title) {
      return {
        intent: 'todo.unknown',
        result: {
          message: 'Todo title is empty after parsing parameters.',
          examples: ['todo: buy milk', 'todo: call dentist due=2026-02-23T09:00 remind=2026-02-23T08:50'],
        },
        actions: [],
      };
    }

    return {
      intent: 'todo.add_task',
      result: {
        message: 'Planned todo task (execution happens on VM400/connector).',
        title: parsed.title,
        dueAt: parsed.dueAt,
        remindAt: parsed.remindAt,
        requestId: ctx.requestId,
      },
      actions: [{ type: 'todo.add_task', title: parsed.title, dueAt: parsed.dueAt, remindAt: parsed.remindAt }],
    };
  },
};
