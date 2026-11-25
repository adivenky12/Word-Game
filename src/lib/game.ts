export const MIN_WORD_LENGTH = 3
export const DEFAULT_SECONDS = 180
const SCORES: Record<number, number> = { 3: 1, 4: 1, 5: 2, 6: 3, 7: 5 }
export function pointsFor(word: string): number {
  return word.length >= 8 ? 11 : (SCORES[word.length] ?? 0)
}
export function normalizeWord(word: string): string { return word.trim().toUpperCase() }

export function canMakeWord(board: string[], rawWord: string): boolean {
  const word = normalizeWord(rawWord)
  if (board.length !== 16 || word.length < MIN_WORD_LENGTH || !/^[A-Z]+$/.test(word)) return false
  const visit = (pos: number, offset: number, used: number): boolean => {
    if (board[pos] !== word[offset]) return false
    if (offset === word.length - 1) return true
    const nextUsed = used | (1 << pos)
    const row = Math.floor(pos / 4), col = pos % 4
    for (let r=Math.max(0,row-1);r<=Math.min(3,row+1);r++) {
      for (let c=Math.max(0,col-1);c<=Math.min(3,col+1);c++) {
        const next=r*4+c
        if (next===pos || (nextUsed & (1<<next))) continue
        if (visit(next, offset+1, nextUsed)) return true
      }
    }
    return false
  }
  for (let i=0;i<16;i++) if (visit(i,0,0)) return true
  return false
}

export function generateBoard(random = Math.random): string[] {
  const dice = ['AAEEGN','ABBJOO','ACHOPS','AFFKPS','AOOTTW','CIMOTU','DEILRX','DELRVY','DISTTY','EEGHNW','EEINSU','EHRTVW','EIOSST','ELRTTY','HIMNQU','HLNNRZ']
  const shuffled=[...dice]
  for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
  return shuffled.map(d=>d[Math.floor(random()*d.length)])
}
