// @ts-check

import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

// React and Blueprint are provided by the host at load time through the require-provider (see the
// frontend's `requireProvider`), so they are kept external and resolved via `require(...)` calls in
// the CommonJS output. Everything else (mantine/hooks, classnames, conductor conduit, the common
// step protocol) is bundled. wrap.mjs then wraps the CJS output into the host's factory contract.
const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@blueprintjs/core',
];

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/index.cjs',
    format: 'cjs',
    exports: 'default',
  },
  external,
  plugins: [
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    typescript({ exclude: ['**/__tests__/**'] }),
    terser(),
  ],
  onwarn(warning, warn) {
    // Suppress the warnings about 'use client' from @mantine
    if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
    warn(warning);
  },
});
