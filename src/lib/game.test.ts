import { describe, expect, it } from 'vitest'
import { canMakeWord, generateBoard, pointsFor } from './game'
import { isDictionaryWord } from './dictionary'

describe('scoring',()=>{
  it('awards 2 points for a solo three-letter word',()=>expect(pointsFor('CAT')).toBe(2))
  it('awards 5 points for a solo word of four or more letters',()=>{
    expect(pointsFor('WORD')).toBe(5)
    expect(pointsFor('FAMILY')).toBe(5)
  })
})
describe('board',()=>{
  it('generates sixteen letters',()=>expect(generateBoard()).toHaveLength(16))
  it('finds a path across adjacent tiles',()=>expect(canMakeWord(['C','A','T',...'ABCDEFGHIJKLM'.split('')],'CAT')).toBe(true))
  it('treats a Q tile as QU',()=>expect(canMakeWord(['Q','A','T',...'ABCDEFGHIJKLM'.split('')],'QUAT')).toBe(true))
  it('rejects reuse of a tile',()=>expect(canMakeWord(['A','B','X','X','X','X','X','X','X','X','X','X','X','X','X','X'],'ABA')).toBe(false))
  it('rejects non-adjacent letters',()=>expect(canMakeWord(['C','X','X','X','X','X','X','X','X','X','X','X','X','X','X','A'],'CAT')).toBe(false))
})

describe('dictionary',()=>{
  it('accepts common everyday words and inflected forms',()=>{
    for (const word of ['HELLO','WORLD','FAMILY','FRIENDS','PLAYING','WALKED','QUICK']) expect(isDictionaryWord(word)).toBe(true)
  })
  it('rejects words shorter than three letters',()=>expect(isDictionaryWord('AT')).toBe(false))
})
