import { config } from '../config'
import { describeDoc } from './docPreview'

/**
 * Lists a public Drive folder so one `Documents` row can stand in for many
 * files — management drops a deck in the folder and it appears, with no sheet
 * edit at all.
 *
 * Needs a Drive API key, which ships in the bundle. The key is read-only and
 * only reaches files already shared "anyone with the link", so it grants
 * nothing a parent could not already open — but restrict it by HTTP referrer
 * in the Google Cloud console so it cannot be reused elsewhere.
 *
 * Without a key this is never called, and the folder row stays a single link
 * card. That is the graceful default, not a failure.
 */

const FIELDS = 'files(id,name,mimeType,webViewLink,modifiedTime)'

export function folderIdOf(url) {
  const { kind, id } = describeDoc(url)
  return kind === 'folder' ? id : null
}

function labelFor(name) {
  // Drive names carry an extension; the card is prose, so drop it.
  return String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim() || 'Untitled'
}

export async function listFolder(folderId) {
  const { driveApiKey, driveApiBase } = config()
  if (!driveApiKey || !folderId) return []

  const q = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    key: driveApiKey,
    fields: FIELDS,
    orderBy: 'folder,name',
    pageSize: '100',
  })

  // A local base points at a static fixture that ignores the query — enough to
  // exercise the expansion and render path without a Google account.
  const base = driveApiBase.replace(/\/$/, '')
  const url = base.startsWith('http') ? `${base}/files?${q}` : `${base}/files.json`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Drive folder listing failed (HTTP ${res.status}). Check the folder is shared publicly and the API key allows this origin.`)
  }

  const data = await res.json()
  return (data.files || []).map((f) => ({
    id: f.id,
    label: labelFor(f.name),
    url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    mimeType: f.mimeType,
  }))
}

/**
 * Replaces each folder row with one row per file inside it. A folder that
 * cannot be read is left exactly as it was, so the page degrades to the plain
 * link rather than losing the section.
 */
export async function expandFolderDocuments(documents) {
  const { driveApiKey } = config()
  if (!driveApiKey) return documents

  const expanded = await Promise.all(
    documents.map(async (doc) => {
      const folderId = folderIdOf(doc.url)
      if (!folderId) return [doc]
      try {
        const files = await listFolder(folderId)
        if (files.length === 0) return [doc]
        return files.map((f) => ({
          grade: doc.grade,
          label: f.label,
          url: f.url,
          category: doc.category,
        }))
      } catch (err) {
        console.warn(`[drive] keeping "${doc.label}" as a link:`, err.message)
        return [doc]
      }
    })
  )

  return expanded.flat()
}
