// Bundles src/index.ts (and everything it imports — commander, ws,
// @modelcontextprotocol/sdk, our own tools/*) into a single dependency-free
// dist/index.js. The packaged Downlodr app ships this file without
// downlodr-mcp's node_modules (see forge.config.ts's packager ignore rules),
// so at runtime it must not need a `require()` for anything outside Node's
// own built-ins.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: true,
});
