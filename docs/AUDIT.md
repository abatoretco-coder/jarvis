# Audit (2026-02-20)

## Summary

Ran `npm audit`.

- Production dependencies (`npm audit --omit=dev`): **0 vulnerabilities** after upgrading Fastify.
- Dev/tooling dependencies: may still report advisories; these do not ship in the production Docker image because the runtime stage installs `--omit=dev`.

## Changes applied

- Upgraded `fastify` to `^5.7.4` to address `npm audit --omit=dev` high severity advisories.

## How to verify

```bash
npm run build
npm test
npm run lint
npm audit --omit=dev
```
