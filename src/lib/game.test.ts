import { describe, expect, it } from 'vitest'
import { canMakeWord, generateBoard, pointsFor } from './game'

describe('scoring',()=>{
  it('uses the configured scoring table',()=>{
    expect(pointsFor('CAT')).toBe(1); expect(pointsFor('MOUSE')).toBe(2)
    expect(pointsFor('PLANET')).toBe(3); expect(pointsFor('RAINBOW')).toBe(5)
    expect(pointsFor('NOTEBOOK')).toBe(11)
  })
})
describe('board',()=>{
  it('generates sixteen letters',()=>expect(generateBoard()).toHaveLength(16))
  it('finds a path across adjacent tiles',()=>expect(canMakeWord(['C','A','T',...'ABCDEFGHIJKLM'.split('')],'CAT')).toBe(true))
  it('rejects reuse of a tile',()=>expect(canMakeWord(['A','B','X','X','X','X','X','X','X','X','X','X','X','X','X','X'],'ABA')).toBe(false))
  it('rejects non-adjacent letters',()=>expect(canMakeWord(['C','X','X','X','X','X','X','X','X','X','X','X','X','X','X','A'],'CAT')).toBe(false))
})
