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
import { createGzip } from 'node:zlib'
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

/**
 * Caddy gzipped every text-shaped response and a bare node:http server does
 * not, which tripled the bytes on the wire — 230 kB of JavaScript instead of
 * 75 kB. Worth restoring because the origin is US West and the parents are in
 * India, so every extra kilobyte crosses the Pacific. Images, fonts and PDFs
 * arrive already compressed, so only the text types are listed.
 */
const COMPRESSIBLE = /^(?:text\/|application\/(?:json|javascript))/
const COMPRESS_MIN_BYTES = 1024

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
 *
 * The try/catch is not cosmetic. A malformed escape — `/%` is enough — makes
 * decodeURIComponent throw URIError, and unguarded that threw inside the async
 * request handler, which Node treats as a fatal unhandled rejection. One such
 * request killed the process, and with restartPolicyMaxRetries: 10 ten of them
 * took the service down until someone redeployed by hand. A bad escape is
 * simply not a path, so it is refused like any other.
 */
function resolveStatic(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const target = normalize(join(ROOT, decoded))
  if (!target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return null
  return target
}

async function serveFile(req, res, filePath, { fallbackOk = true } = {}) {
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
  const type = MIME[ext] || 'application/octet-stream'
  // Vite fingerprints asset filenames, so they are safe to cache hard; the
  // entry HTML is not fingerprinted and must always be revalidated.
  const immutable = filePath.includes(`${sep}assets${sep}`)
  const gzip =
    COMPRESSIBLE.test(type) &&
    info.size >= COMPRESS_MIN_BYTES &&
    /\bgzip\b/.test(req.headers['accept-encoding'] || '')

  const headers = {
    'Content-Type': type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  }
  if (gzip) {
    // Content-Length is omitted deliberately: info.size describes the file on
    // disk, not the compressed stream, and sending it would truncate the reply.
    headers['Content-Encoding'] = 'gzip'
    headers.Vary = 'Accept-Encoding'
  } else {
    headers['Content-Length'] = info.size
  }

  res.writeHead(200, headers)
  const file = createReadStream(filePath)
  if (gzip) file.pipe(createGzip()).pipe(res)
  else file.pipe(res)
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  /**
   * Railway's healthcheck points here. It answers JSON, which Caddy serving
   * `dist` could never do — so a deploy that silently fell back to the static
   * builder fails the check instead of going live and breaking every login,
   * which is exactly how this host shipped broken for six days.
   */
  if (pathname === '/healthz') {
    sendJson(res, 200, { ok: true })
    return
  }

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
    await serveFile(req, res, filePath)
  } catch (err) {
    console.error('[static]', err)
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Server error')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`schoolTrips listening on :${PORT}`)
})
