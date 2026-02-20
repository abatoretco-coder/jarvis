import type { Env } from './env';
import type { JarvisCommandResponse } from './types';

export async function callJarvisPlan(env: Env, text: string): Promise<JarvisCommandResponse> {
  const base = env.JARVIS_BASE_URL.replace(/\/$/, '');
  const url = `${base}/v1/command`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (env.JARVIS_API_KEY) headers['x-api-key'] = env.JARVIS_API_KEY;

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, options: { execute: false } }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Jarvis call failed: ${resp.status}: ${JSON.stringify(data)}`);
  }
  return data as JarvisCommandResponse;
}
