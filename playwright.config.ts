import { defineConfig, devices } from '@playwright/test'

// Las pruebas de pantalla: recorren la app como el productor, en el tamaño de
// un iPhone y en español, con la base vacía en cada prueba. Corren contra el
// servidor de desarrollo, que sirve los módulos de la app para sembrar datos.
const PUERTO = 5199

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: `http://127.0.0.1:${PUERTO}`,
    locale: 'es-DO',
    timezoneId: 'America/Santo_Domingo',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${PUERTO} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
