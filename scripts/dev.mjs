/**
 * Start `next dev`, working around Node's experimental Web Storage global.
 *
 * Node 25 exposes a `localStorage` global that is present but non-functional
 * unless `--localstorage-file` names a writable path. Next 15.3 probes it
 * during server rendering and every request dies with
 * `TypeError: localStorage.getItem is not a function` — a 500 on every page,
 * with the real cause only visible in the dev server's own stderr.
 *
 * Nothing in this app uses Web Storage (the analysis cache is IndexedDB, which
 * exists only in the browser), so the global is pure liability here and the fix
 * is to switch it off in the child process.
 *
 * The flag is only passed when this process actually has the broken global, because
 * `--no-experimental-webstorage` does not exist on older releases and Node exits
 * with "bad option" if handed a flag it does not know. That keeps one `npm run dev`
 * working on Node 22 LTS and on 25 alike.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const needsWorkaround = typeof globalThis.localStorage !== 'undefined';
const nodeArgs = needsWorkaround ? ['--no-experimental-webstorage'] : [];

if (needsWorkaround) {
  console.log(
    '[dev] Node %s exposes an unconfigured localStorage global; ' +
      'starting with --no-experimental-webstorage.',
    process.versions.node,
  );
}

const child = spawn(
  process.execPath,
  [...nodeArgs, nextBin, 'dev', '--turbopack', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
