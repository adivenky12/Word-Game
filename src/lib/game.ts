import { dictionary } from './dictionary'

export const MIN_WORD_LENGTH = 3;
export const DEFAULT_SECONDS = 180;

export function pointsFor(word: string): number {
  return word.length >= 4 ? 5 : word.length === 3 ? 2 : 0;
}

const DICE = [
  "AAEEGN", "ABBJOO", "ACHOPS", "AFFKPS", "AOOTTW", "CIMOTU",
  "DEILRX", "DELRVY", "DISTTY", "EEGHNW", "EEINSU", "EHRTVW",
  "EIOSST", "ELRTTY", "HIMNQU", "HLNNRZ",
];
const MIN_THREE_LETTER_WORDS = 10;
const MIN_FOUR_LETTER_WORDS = 4;
const MAX_ATTEMPTS = 40;

type Trie = { [key: string]: Trie | true };
function buildTrie(words: Set<string>): Trie {
  const root: Trie = {};
  for (const word of words) {
    if (word.length < 3 || word.length > 20) continue;
    let node = root;
    for (const letter of word) {
      const child = node[letter];
      if (!child || child === true) node[letter] = {};
      node = node[letter] as Trie;
    }
    node.$ = true;
  }
  return root;
}
const WORD_TRIE = buildTrie(dictionary);

const NEIGHBORS = Array.from({ length: 16 }, (_, pos) => {
  const row = Math.floor(pos / 4), col = pos % 4;
  const result: number[] = [];
  for (let r = Math.max(0, row - 1); r <= Math.min(3, row + 1); r++) {
    for (let c = Math.max(0, col - 1); c <= Math.min(3, col + 1); c++) {
      const next = r * 4 + c;
      if (next !== pos) result.push(next);
    }
  }
  return result;
});

export function findBoardWords(board: string[]): Set<string> {
  const found = new Set<string>();
  if (board.length !== 16) return found;

  const visit = (pos: number, node: Trie, used: number, word: string) => {
    const letters = board[pos] === "Q" ? "QU" : board[pos];
    let nextNode = node;
    for (const letter of letters) {
      const child = nextNode[letter];
      if (!child || child === true) return;
      nextNode = child;
    }
    const nextWord = word + letters;
    if (nextWord.length >= 3 && nextNode.$ === true) found.add(nextWord);
    if (nextWord.length >= 20) return;
    const nextUsed = used | (1 << pos);
    for (const next of NEIGHBORS[pos]) {
      if ((nextUsed & (1 << next)) === 0) visit(next, nextNode, nextUsed, nextWord);
    }
  };

  for (let pos = 0; pos < 16; pos++) visit(pos, WORD_TRIE, 0, "");
  return found;
}

function randomDie(random: () => number): string[] {
  const dice = [...DICE];
  for (let i = dice.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [dice[i], dice[j]] = [dice[j], dice[i]];
  }
  return dice.map((die) => die[Math.floor(random() * die.length)]);
}

export function generateBoard(random: () => number = Math.random): string[] {
  let bestBoard: string[] | null = null;
  let bestScore = -1;

  // Try fresh random boards until the minimum word counts are met.
  // Five-letter and longer words are welcome, but never required.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = randomDie(random);
    const words = findBoardWords(candidate);
    const three = [...words].filter((word) => word.length === 3).length;
    const four = [...words].filter((word) => word.length === 4).length;
    const longer = [...words].filter((word) => word.length >= 5).length;

    if (three >= MIN_THREE_LETTER_WORDS && four >= MIN_FOUR_LETTER_WORDS) {
      return candidate;
    }
    const score = Math.min(three, MIN_THREE_LETTER_WORDS) * 100
      + Math.min(four, MIN_FOUR_LETTER_WORDS) * 100
      + Math.min(longer, 30);
    if (score > bestScore) {
      bestScore = score;
      bestBoard = candidate;
    }
  }

  // Never silently start a round with a board below the promised minimums.
  if (bestBoard) {
    const words = findBoardWords(bestBoard);
    const three = [...words].filter((word) => word.length === 3).length;
    const four = [...words].filter((word) => word.length === 4).length;
    if (three >= MIN_THREE_LETTER_WORDS && four >= MIN_FOUR_LETTER_WORDS) return bestBoard;
  }
  throw new Error("Could not generate a board with enough common words. Please try starting the round again.");
}

export function canMakeWord(board: string[], word: string): boolean {
  if (board.length !== 16 || word.length < 3 || !/^[A-Z]+$/.test(word)) return false;
  const visit = (pos: number, offset: number, used: number): boolean => {
    const letters = board[pos] === "Q" ? "QU" : board[pos];
    if (!word.startsWith(letters, offset)) return false;
    const nextOffset = offset + letters.length;
    if (nextOffset === word.length) return true;
    if (nextOffset > word.length) return false;
    const nextUsed = used | (1 << pos);
    for (const next of NEIGHBORS[pos]) {
      if ((nextUsed & (1 << next)) === 0 && visit(next, nextOffset, nextUsed)) return true;
    }
    return false;
  };
  for (let pos = 0; pos < 16; pos++) if (visit(pos, 0, 0)) return true;
  return false;
}
