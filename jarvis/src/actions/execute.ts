import type { HomeAssistantClient } from '../lib/haClient';
import type { ExecutedAction, JarvisAction } from './types';

export async function executeActions(
  actions: JarvisAction[],
  deps: { ha: HomeAssistantClient }
): Promise<ExecutedAction[]> {
  const executed: ExecutedAction[] = [];

  for (const action of actions) {
    if (action.type !== 'home_assistant.service_call') {
      executed.push({ action, status: 'skipped' });
      continue;
    }

    try {
      const r = await deps.ha.callService({
        domain: action.domain,
        service: action.service,
        target: action.target,
        serviceData: action.serviceData,
      });
      executed.push({ action, status: 'executed', output: r });
    } catch (err) {
      const e = err as Error;
      executed.push({ action, status: 'failed', error: e.message });
    }
  }

  return executed;
}
