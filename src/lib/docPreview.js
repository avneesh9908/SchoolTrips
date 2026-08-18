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

/**
 * The URL that frames a Drive file inside the page, or null for the kinds that
 * cannot be framed.
 *
 * Added 2026-08-17 for the orientation decks, which the school wanted shown as a
 * preview in the box rather than as a card to click through ("like ppt docs or
 * slide preview"). It is the same mechanism the guideline sections use, with one
 * difference worth knowing: those are *published* documents, where `/pub` is
 * rewritten to `/embed`, while these are ordinary Drive links, where `/embed` and
 * `/preview` work for any file the reader may view.
 *
 * Whether the reader may view it is the whole question. A file that is not shared
 * answers 401 and the frame shows Google's request-access page — and **nothing in
 * the browser can tell the two apart**, because the frame is cross-origin and its
 * load event fires either way. Measured 2026-08-17: of the 7 orientation decks in
 * the sheet, 2 answer 200 and 5 answer 401.
 */
function embedFor(kind, id) {
  if (kind === 'slides') return `https://docs.google.com/presentation/d/${id}/embed?rm=minimal`
  if (kind === 'doc') return `https://docs.google.com/document/d/${id}/preview`
  if (kind === 'sheet') return `https://docs.google.com/spreadsheets/d/${id}/preview`
  if (kind === 'file') return `https://drive.google.com/file/d/${id}/preview`
  // A folder has no single page, and a Form's published id is not a Drive file id.
  return null
}

export function describeDoc(url) {
  if (!url) return { kind: 'link', id: null, thumb: null, embed: null, open: '' }

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
    return { kind, id, thumb, embed: embedFor(kind, id), open: url }
  }

  return { kind: 'link', id: null, thumb: null, embed: null, open: url }
}
