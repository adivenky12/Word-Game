import { describe, expect, it } from 'vitest'
import { canMakeWord, findBoardWords, generateBoard, getRoundWordStats, pointsFor } from './game'
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
  it('always provides at least ten 3-letter and four 4-letter dictionary words',()=>{
    for(let round=0;round<5;round++){
      const words=[...findBoardWords(generateBoard())]
      expect(words.filter(word=>word.length===3).length).toBeGreaterThanOrEqual(10)
      expect(words.filter(word=>word.length===4).length).toBeGreaterThanOrEqual(4)
    }
  })
  it('uses a verified fallback rather than failing when random rolls never qualify',()=>{
    const board=generateBoard(()=>0)
    const words=[...findBoardWords(board)]
    expect(board).toHaveLength(16)
    expect(words.filter(word=>word.length===3).length).toBeGreaterThanOrEqual(10)
    expect(words.filter(word=>word.length===4).length).toBeGreaterThanOrEqual(4)
  })
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


describe('round word results',()=>{
  it('counts distinct solo and shared words once and lists missed board words',()=>{
    const board=['C','A','T','D','O','G','R','E','S','T','L','I','N','P','A','Y'];
    const stats=getRoundWordStats(board,{CAT:['p1'],DOG:['p1','p2'],CAR:['p1','p1']});
    expect(stats.soloWords).toContain('CAT');
    expect(stats.soloWords).toContain('CAR');
    expect(stats.sharedWords).toEqual(['DOG']);
    expect(stats.missedWords).toEqual(expect.arrayContaining(['REST','PLAY']));
    expect(stats.soloWords.length).toBe(new Set(stats.soloWords).size);
  });
});
