import { describe, expect, it } from 'vitest'
import { isRootParent, normalizeId } from './ids'

/*
 * The payload mixes id types — the trigger's is the number 1, the rest are hex strings — so every
 * id is normalised at the boundary and compared as a string everywhere after. These are small
 * functions guarding a bug that would otherwise be very hard to see: a parent that matches nothing.
 */
describe('normalizeId', () => {
  it('turns numeric ids into strings', () => {
    expect(normalizeId(1)).toBe('1')
  })

  it('leaves string ids unchanged', () => {
    expect(normalizeId('b6a0c1')).toBe('b6a0c1')
  })
})

describe('isRootParent', () => {
  it.each([-1, '-1', null, undefined])('treats %s as the root marker', (parentId) => {
    expect(isRootParent(parentId)).toBe(true)
  })

  it.each([1, '1', 'd09c08', 0, ''])('treats %s as a real parent', (parentId) => {
    expect(isRootParent(parentId)).toBe(false)
  })
})
