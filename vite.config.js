import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      /**
       * The school's roster feed sends no CORS headers, so a browser cannot
       * fetch it directly. Vite fetches it server-side and re-serves it as
       * same-origin, which sidesteps CORS entirely.
       *
       * DEV ONLY. `npm run build` produces static files with no proxy, so the
       * deployed site still needs a real server-side equivalent — and that one
       * should filter to the signed-in parent rather than serving the whole
       * roster. See src/data/apiAdapter.js.
       */
      '/roster': {
        target: 'https://nucleus.fountainheadschools.org',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/roster/, '/CSVDATA'),
      },
    },
  },
})
