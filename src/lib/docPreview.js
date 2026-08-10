/**
 * Turns a Google share URL into { kind, id, thumb, open }.
 *
 * `thumb` is an image the browser can render inline; `open` is where the card
 * navigates on click. Drive's thumbnail endpoint covers Docs, Slides, Sheets,
 * PDFs and images alike, so one URL shape serves every kind — but it only
 * answers for files shared "anyone with the link can view". When it 403s the
 * card falls back to a typed placeholder, which is why every consumer must
 * handle the image erroring.
 */
const PATTERNS = [
  { kind: 'slides', re: /presentation\/d\/([a-zA-Z0-9_-]+)/ },
  { kind: 'doc', re: /document\/d\/([a-zA-Z0-9_-]+)/ },
  { kind: 'sheet', re: /spreadsheets\/d\/([a-zA-Z0-9_-]+)/ },
  { kind: 'form', re: /forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/ },
  { kind: 'folder', re: /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/ },
  { kind: 'file', re: /(?:drive\.google\.com\/file\/d\/|[?&]id=)([a-zA-Z0-9_-]+)/ },
]

export const KIND_LABEL = {
  slides: 'Presentation',
  doc: 'Document',
  sheet: 'Spreadsheet',
  form: 'Form',
  folder: 'Drive folder',
  file: 'File',
  link: 'Link',
}

export function describeDoc(url) {
  if (!url) return { kind: 'link', id: null, thumb: null, open: '' }

  for (const { kind, re } of PATTERNS) {
    const m = url.match(re)
    if (!m) continue
    const id = m[1]
    // A folder has no single page to render, and a Form's published id is not a
    // Drive file id — neither has a usable thumbnail.
    const thumb =
      kind === 'folder' || kind === 'form'
        ? null
        : `https://drive.google.com/thumbnail?id=${id}&sz=w1000`
    return { kind, id, thumb, open: url }
  }

  return { kind: 'link', id: null, thumb: null, open: url }
}
