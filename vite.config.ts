import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/skillmeter-study/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'SkillMeter Study',
        short_name: 'SkillMeter',
        description: 'Adaptive studying by class, skill, difficulty, and question mode.',
        theme_color: '#f7f4ef',
        background_color: '#f7f4ef',
        display: 'standalone',
        start_url: '/skillmeter-study/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
