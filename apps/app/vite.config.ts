import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

const API = process.env.VITE_API_PROXY ?? 'http://localhost:3333';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    mode === 'https' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'MOTORIZE — Credencial do Entregador',
        short_name: 'MOTORIZE',
        description: 'Cadastro e credencial municipal dos motociclistas de entrega de Toritama',
        lang: 'pt-BR',
        theme_color: '#1E2A5A',
        background_color: '#F3F4F7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icone-mascaravel.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Chave pública muda raramente: serve do cache se estiver sem sinal
            urlPattern: ({ url }) => url.pathname.endsWith('/publico/chave'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'motorize-chave' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': { target: API, changeOrigin: true } },
  },
  preview: { port: 4173, proxy: { '/api': { target: API, changeOrigin: true } } },
}));
