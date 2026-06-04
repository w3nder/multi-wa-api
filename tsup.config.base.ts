import { defineConfig } from 'tsup'

export const baseConfig = defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  dts: true,
  clean: true,
  sourcemap: true,
  tsconfig: '../../tsconfig.build.json',
  external: [/^@multi-wa\//]
})
