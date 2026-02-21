import { execSync } from 'node:child_process';

const image = process.env.IMAGE;
const tag = process.env.TAG;

if (!image || !tag) {
  console.error(
    'Missing IMAGE or TAG env vars. Example: IMAGE=ghcr.io/abatoretco-coder/jarvis TAG=0.1.0 npm run docker:push'
  );
  process.exit(2);
}

execSync(`docker push ${image}:${tag}`, { stdio: 'inherit' });
