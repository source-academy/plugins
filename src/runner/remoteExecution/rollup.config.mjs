// @ts-check

import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default defineConfig({
  input: 'src/index.ts',
  external: id => id.includes('py-slang'),
  output: [
    {
      file: 'dist/index.cjs',
      format: 'cjs',
    },
    {
      file: 'dist/index.mjs',
      format: 'esm',
    },
  ],
  plugins: [nodeResolve(), typescript({ exclude: ['**/__tests__/**'] }), terser()],
});
