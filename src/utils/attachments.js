import { getAttachmentName } from './nodeDescription'

/**
 * An attachment is a URL in this payload, and nothing else — so an uploaded file has to become one.
 *
 * With a real backend the file would be POSTed to an upload endpoint and the URL it answered with
 * stored on the node. There is no backend here, so the file becomes a `data:` URL: the value *is*
 * the file. That keeps the payload's shape exactly as it is, at the cost of carrying the bytes
 * around in memory — which is why there is a size limit.
 */

/** Small enough to hold in memory, and in every undo snapshot taken after it. */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg']

/** The part of a data URL before the comma: "data:image/png;base64". */
const dataUrlHeader = (value) => value.slice(0, value.indexOf(','))

export const isUploaded = (value) => typeof value === 'string' && value.startsWith('data:')

/**
 * Whether the attachment can be shown as a picture: by media type for an uploaded file, and by the
 * file name for a link, which is all a URL gives away without fetching it.
 *
 * Guessing from the extension is a guess, and knowingly so. The alternative is requesting every
 * link the flow mentions just to decide how to draw a tile — slow, and it would leak which flows a
 * user is editing to whoever hosts those files. Being wrong costs a broken image where a paperclip
 * belonged; being right costs nothing.
 *
 * @param {string} value
 */
export function isImageAttachment(value) {
  if (typeof value !== 'string') return false
  if (isUploaded(value)) return dataUrlHeader(value).startsWith('data:image/')

  const name = getAttachmentName(value).toLowerCase()
  return IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))
}

/**
 * What to call the attachment on screen. A link is named by its file; an uploaded file has no name
 * left in the value, so it is named by what it is.
 * @param {string} value
 * @returns {string}
 */
export function getAttachmentLabel(value) {
  if (typeof value !== 'string' || !value) return 'No file'
  if (!isUploaded(value)) return getAttachmentName(value)

  const [, mediaType = ''] = dataUrlHeader(value).split(':')
  const [type = '', subtype = ''] = mediaType.split(';')[0].split('/')
  return subtype ? `Uploaded ${subtype.toUpperCase()}` : `Uploaded ${type || 'file'}`
}

/**
 * Reads a file into the value the payload stores, or explains why it can't.
 * @param {File} file
 * @returns {Promise<string>} a data URL
 * @throws {Error} when the file is too big to carry
 */
export function readAttachment(file) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    const limit = Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)
    throw new Error(`“${file.name}” is larger than ${limit} MB`)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`Could not read “${file.name}”`))
    reader.readAsDataURL(file)
  })
}
