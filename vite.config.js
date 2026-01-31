import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        proxy: {
            '/notion-api': {
                target: 'https://api.notion.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/notion-api/, ''),
            },
            '/slack-api': {
                target: 'https://slack.com/api',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/slack-api/, ''),
            }
        }
    }
})
