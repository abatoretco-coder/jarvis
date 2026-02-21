import type { Env } from '../config/env';

export type HomeAssistantServiceCall = {
  domain: string;
  service: string;
  serviceData?: Record<string, unknown>;
  target?: Record<string, unknown>;
};

export class HomeAssistantClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(env: Env) {
    this.baseUrl = env.HA_BASE_URL.replace(/\/$/, '');
    this.token = env.HA_TOKEN;
    this.timeoutMs = env.HA_TIMEOUT_MS;
  }

  async callService(input: HomeAssistantServiceCall): Promise<{ status: number; data: unknown }> {
    const url = `${this.baseUrl}/api/services/${encodeURIComponent(input.domain)}/${encodeURIComponent(input.service)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const body: Record<string, unknown> = {
      ...(input.serviceData ?? {}),
      ...(input.target ?? {}),
    };

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const contentType = resp.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json') ? await resp.json() : await resp.text();
      return { status: resp.status, data };
    } catch (err) {
      const e = err as Error;
      throw new Error(`Home Assistant request failed: ${e.name}: ${e.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
