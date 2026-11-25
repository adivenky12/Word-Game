export function pointsFor(word: string): number {
  return word.length >= 4 ? 5 : word.length === 3 ? 2 : 0;
}
export function generateBoard(): string[] {
  const dice=['AAEEGN','ABBJOO','ACHOPS','AFFKPS','AOOTTW','CIMOTU','DEILRX','DELRVY','DISTTY','EEGHNW','EEINSU','EHRTVW','EIOSST','ELRTTY','HIMNQU','HLNNRZ'];
  for(let i=dice.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[dice[i],dice[j]]=[dice[j],dice[i]];}
  return dice.map(d=>d[crypto.getRandomValues(new Uint32Array(1))[0]%d.length]);
}
export function canMakeWord(board:string[], word:string):boolean {
  if(board.length!==16||word.length<3||!/^[A-Z]+$/.test(word))return false;
  const visit=(p:number,k:number,used:number):boolean=>{
    const letters=board[p]==="Q"?"QU":board[p];
    if(!word.startsWith(letters,k))return false;
    const nextK=k+letters.length;
    if(nextK===word.length)return true;
    if(nextK>word.length)return false;
    const mask=used|(1<<p),r=Math.floor(p/4),c=p%4;
    for(let rr=Math.max(0,r-1);rr<=Math.min(3,r+1);rr++)for(let cc=Math.max(0,c-1);cc<=Math.min(3,c+1);cc++){
      const q=rr*4+cc;if(q!==p&&!(mask&(1<<q))&&visit(q,nextK,mask))return true;
    }return false;
  };
  for(let i=0;i<16;i++)if(visit(i,0,0))return true;
  return false;
}
