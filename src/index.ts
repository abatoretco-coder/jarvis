import { loadEnv } from './config/env';
import { buildServer } from './server';
import { homeAssistantSkill } from './skills/homeAssistant';
import { musicSkill } from './skills/music';
import { pingSkill } from './skills/ping';
import { timeSkill } from './skills/time';
import { timerSkill } from './skills/timer';

async function main() {
  const env = loadEnv();
  const skills = [pingSkill, timeSkill, timerSkill, homeAssistantSkill, musicSkill];

  const app = await buildServer(env, skills);

  const close = async (signal: string) => {
    app.log.info({ signal }, 'shutdown_requested');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'shutdown_error');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void close('SIGINT'));
  process.on('SIGTERM', () => void close('SIGTERM'));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
