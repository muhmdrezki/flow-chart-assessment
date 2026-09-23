import { describe, expect, it, vi } from 'vitest'
import {
  MAX_ATTACHMENT_BYTES,
  getAttachmentLabel,
  isImageAttachment,
  isUploaded,
  readAttachment,
} from './attachments'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const PDF = 'data:application/pdf;base64,JVBERi0='
const LINK = 'https://fastly.picsum.photos/id/396/536/354.jpg?hmac=GmUos'

describe('isUploaded', () => {
  it('knows a file the user chose from a link', () => {
    expect(isUploaded(PNG)).toBe(true)
    expect(isUploaded(LINK)).toBe(false)
  })

  it.each([undefined, null, 42, ''])('copes with %j', (value) => {
    expect(isUploaded(value)).toBe(false)
  })
})

describe('isImageAttachment', () => {
  it('reads an uploaded file by what it is', () => {
    expect(isImageAttachment(PNG)).toBe(true)
    expect(isImageAttachment(PDF)).toBe(false)
  })

  it('reads a link by its file name, which is all a URL gives away', () => {
    expect(isImageAttachment(LINK)).toBe(true)
    expect(isImageAttachment('https://files.test/terms.pdf')).toBe(false)
  })

  it('ignores the case of the extension', () => {
    expect(isImageAttachment('https://files.test/MENU.PNG')).toBe(true)
  })

  it.each([undefined, null, ''])('copes with %j', (value) => {
    expect(isImageAttachment(value)).toBe(false)
  })
})

describe('getAttachmentLabel', () => {
  it('names a link after its file', () => {
    expect(getAttachmentLabel(LINK)).toBe('354.jpg')
  })

  it('names an uploaded file after what it is, since the value has no name left', () => {
    expect(getAttachmentLabel(PNG)).toBe('Uploaded PNG')
    expect(getAttachmentLabel(PDF)).toBe('Uploaded PDF')
  })

  it('copes with a data URL that says nothing about its type', () => {
    expect(getAttachmentLabel('data:,hello')).toBe('Uploaded file')
  })

  it.each([undefined, null, ''])('says there is no file for %j', (value) => {
    expect(getAttachmentLabel(value)).toBe('No file')
  })
})

describe('readAttachment', () => {
  /** A stand-in for the browser's File, which jsdom builds from parts. */
  const fileOf = (bytes, name = 'menu.png') =>
    new File([new Uint8Array(bytes)], name, { type: 'image/png' })

  it('reads a file into the value the payload stores', async () => {
    const value = await readAttachment(fileOf(8))

    expect(value.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('refuses a file too big to carry in memory', async () => {
    const tooBig = fileOf(0)
    vi.spyOn(tooBig, 'size', 'get').mockReturnValue(MAX_ATTACHMENT_BYTES + 1)

    expect(() => readAttachment(tooBig)).toThrow('“menu.png” is larger than 2 MB')
  })

  it('accepts a file exactly at the limit', async () => {
    const atLimit = fileOf(8)
    vi.spyOn(atLimit, 'size', 'get').mockReturnValue(MAX_ATTACHMENT_BYTES)

    await expect(readAttachment(atLimit)).resolves.toContain('data:')
  })

  it('says which file it could not read', async () => {
    const broken = fileOf(8, 'broken.png')
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function fail() {
      this.onerror(new Error('boom'))
    })

    await expect(readAttachment(broken)).rejects.toThrow('Could not read “broken.png”')
  })
})
