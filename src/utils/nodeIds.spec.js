import { describe, expect, it, vi } from 'vitest'
import { generateNodeId } from './nodeIds'

const HEX_CHARACTERS = '0123456789abcdef'
const isHex = (value) => [...value].every((character) => HEX_CHARACTERS.includes(character))

/** Makes crypto return fixed bytes, so an id can be predicted or forced to collide. */
function stubRandomBytes(...sequences) {
  let call = 0
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    array.set(sequences[Math.min(call, sequences.length - 1)])
    call += 1
    return array
  })
}

describe('generateNodeId', () => {
  it('looks like a payload id: 6 lowercase hex characters', () => {
    const id = generateNodeId()

    expect(id).toHaveLength(6)
    expect(isHex(id)).toBe(true)
  })

  it('pads bytes so the id is always 6 characters', () => {
    stubRandomBytes([0x00, 0x0f, 0xff])
    expect(generateNodeId()).toBe('000fff')
  })

  it('generates different ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateNodeId()))
    expect(ids.size).toBe(50)
  })

  it('skips ids that are already taken', () => {
    stubRandomBytes([0xa3, 0xf0, 0x9c], [0xa3, 0xf0, 0x9c], [0x11, 0x22, 0x33])

    expect(generateNodeId(['a3f09c'])).toBe('112233')
  })

  it.each([['a3f09c'], new Set(['a3f09c'])])('accepts existing ids as %s', (existing) => {
    stubRandomBytes([0xa3, 0xf0, 0x9c], [0x11, 0x22, 0x33])
    expect(generateNodeId(existing)).toBe('112233')
  })

  it('gives up rather than looping forever when every id collides', () => {
    stubRandomBytes([0xa3, 0xf0, 0x9c])

    expect(() => generateNodeId(['a3f09c'])).toThrow('Could not generate a unique node id')
  })
})
