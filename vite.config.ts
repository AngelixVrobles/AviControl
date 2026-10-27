import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    // Juntas, las librerías pasan de los 500 kB del aviso. Hacen falta todas al
    // abrir y quedan guardadas entre versiones, así que partirlas no ahorra nada.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Las librerías cambian poco: en su propio paquete conservan el nombre
        // entre versiones, y una actualización de la app no obliga a bajarlas
        // otra vez con la señal del campo.
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // La app registra el service worker ella misma, para avisar cuando hay
      // una versión nueva en vez de recargar de golpe.
      injectRegister: false,
      // El ícono del iPhone no se guarda con la app: el iPhone lo pide al añadirla
      // a la pantalla de inicio, y una copia vieja guardada le daba el logo de antes.
      includeAssets: ['icon.svg', 'favicon.svg'],
      workbox: {
        // Las letras van en el paquete y se guardan con la app: abre igual sin
        // internet desde la primera vez.
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
      manifest: {
        name: 'AviControl',
        short_name: 'AviControl',
        description: 'Gestión de pollos de engorde Cobb 500: ciclo, peso, alimento y ventas.',
        theme_color: '#F7F5EF',
        background_color: '#F7F5EF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // A sangre y sin esquinas: Android le pone la forma que use el teléfono.
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
