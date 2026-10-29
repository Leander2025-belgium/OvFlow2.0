import { rmSync } from 'node:fs';
// Prevent stale static output from overriding the Worker build during packaging.
rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });
