import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

export default defineConfig({
  // La misma versión que ve la app, para probar que lo nuevo es de esta.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
