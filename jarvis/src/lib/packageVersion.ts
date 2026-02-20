import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function getPackageVersion(): string {
  try {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkgRaw = readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgRaw) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
