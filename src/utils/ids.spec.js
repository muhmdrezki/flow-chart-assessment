import { describe, expect, it } from 'vitest'
import { isRootParent, normalizeId } from './ids'

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
