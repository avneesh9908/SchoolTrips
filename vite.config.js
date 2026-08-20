import { rmSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Everything in public/ is copied into dist/ verbatim, and .gitignore has no
 * say in that. The local roster copy and config.local.json live there so the
 * dev server can serve them — which means a plain `vite build` puts real
 * student names, parent emails and mobile numbers into the deployed site.
 *
 * That actually happened on 2026-08-12: dist was deployed and
 * /local-roster/students.csv served 2,619 rows to anyone who asked.
 *
 * These files are local-only by definition. Deleting them from the bundle is
 * the guard, and it runs on every build including Netlify's.
 */
/**
 * `collage-demo.html` joined this list on 2026-08-20. It is a standalone preview of the
 * Photos tab's 3D motion collage, built with PLACEHOLDER stock images so the school could
 * see the effect before their own photographs are readable — their Drive folders are shared
 * with named people, not "anyone with the link". It must never reach the deployed site: the
 * app deliberately never substitutes a stock image for a missing photograph, and a page of
 * random pictures under the heading "Trip photos" would read to a parent as their child's
 * trip. Delete the file when the real photographs land.
 */
const LOCAL_ONLY = ['local-roster', 'config.local.json', 'collage-demo.html']

function stripLocalOnlyFiles() {
  return {
    name: 'strip-local-only-files',
    apply: 'build',
    closeBundle() {
      for (const name of LOCAL_ONLY) {
        rmSync(new URL(`./dist/${name}`, import.meta.url), { recursive: true, force: true })
      }
      console.log(`[build] removed local-only files from dist: ${LOCAL_ONLY.join(', ')}`)
    },
  }
}

export default defineConfig({
  plugins: [react(), stripLocalOnlyFiles()],
  server: {
    // 5180 is the origin registered for Google Sign-In, so it stays the
    // default; PORT lets a second dev server run alongside the first.
    port: Number(process.env.PORT) || 5180,
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
