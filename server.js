/**
 * Production server for Railway.
 *
 * Why this file exists: Railway detects a Vite SPA and serves `dist` with
 * Caddy, a static file server. Caddy answers `POST /api/lookup` with
 * 405 Method Not Allowed, so nobody can sign in. Netlify has no such problem —
 * it runs `netlify/functions/lookup.js` as a function. This gives Railway the
 * equivalent: one Node process that serves the built SPA *and* the lookup.
 *
 * It imports `resolveParent` from the Netlify function rather than restating
 * the rules, which is what that module was written for ("the handler is a thin
 * wrapper... moves to Express, Vercel, Azure Functions unchanged"). The roster
 * matching, the grade gate, the admin list and the deliberately minimal reply
 * are therefore identical on both hosts, and cannot drift.
 *
 * Deliberately dependency-free — node:http, not Express. The routing is three
 * cases; adding a package would mean a lockfile entry and an install step on
 * every deploy for nothing.
 *
 * Netlify ignores this file entirely: its build only runs `npm run build` and
 * publishes `dist`. Adding it changes nothing there.
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveParent } from './netlify/functions/lookup.js'

const ROOT = fileURLToPath(new URL('./dist/', import.meta.url))
const PORT = Number(process.env.PORT) || 8080

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

function sendJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS)
  res.end(JSON.stringify(body))
}

/** Reads a JSON request body, capped so a large POST cannot exhaust memory. */
function readJsonBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('Body too large.'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('Expected a JSON body.'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Maps a URL path to a file inside `dist`, or null if it escapes it.
 * `normalize` collapses `..`, and the prefix check rejects anything that still
 * points outside the published directory.
 */
function resolveStatic(pathname) {
  const decoded = decodeURIComponent(pathname)
  const target = normalize(join(ROOT, decoded))
  if (!target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return null
  return target
}

async function serveFile(res, filePath, { fallbackOk = true } = {}) {
  let info
  try {
    info = await stat(filePath)
  } catch {
    info = null
  }

  if (!info || info.isDirectory()) {
    if (!fallbackOk) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    // SPA fallback: React Router owns every non-file path.
    const html = await readFile(join(ROOT, 'index.html'))
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' })
    res.end(html)
    return
  }

  const ext = extname(filePath).toLowerCase()
  // Vite fingerprints asset filenames, so they are safe to cache hard; the
  // entry HTML is not fingerprinted and must always be revalidated.
  const immutable = filePath.includes(`${sep}assets${sep}`)
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(filePath).pipe(res)
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (pathname === '/api/lookup') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Use POST.' })
      return
    }
    let body
    try {
      body = await readJsonBody(req)
    } catch (err) {
      sendJson(res, 400, { error: err.message })
      return
    }
    try {
      const { status, body: out } = await resolveParent(body?.value ?? body?.identifier)
      sendJson(res, status, out)
    } catch (err) {
      console.error('[lookup]', err)
      sendJson(res, 502, { error: 'Could not reach the school roster right now.' })
    }
    return
  }

  // Any other /api/* path is a real 404, not the SPA shell — returning HTML
  // there would make a typo in a fetch look like a working page.
  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'No such endpoint.' })
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' })
    res.end()
    return
  }

  const filePath = resolveStatic(pathname)
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Bad request')
    return
  }

  try {
    await serveFile(res, filePath)
  } catch (err) {
    console.error('[static]', err)
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Server error')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`schoolTrips listening on :${PORT}`)
})
