import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Copy, Crown, DoorOpen, Gamepad2, Link2, Loader2, RefreshCw, Users, Volume2, VolumeX } from 'lucide-react'
import { api, configured, supabase } from './lib/supabase'
import { DEFAULT_SECONDS, getRoundWordStats } from './lib/game'

type Player = { id: string; nickname: string; score: number; online: boolean; words: string[] }
type Room = { code: string; hostId: string; status: 'lobby'|'playing'|'finished'; players: Player[]; board: string[]; startedAt: number|null; deadline: number|null; seconds: number; liveScores: boolean; words: Record<string,string[]>; invalid: Record<string,string[]>; createdAt: number }
const randomId = () => crypto.randomUUID()
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong'
const getSaved = () => { try { return JSON.parse(sessionStorage.getItem('letter-league-player') || 'null') } catch { return null } }

export default function App() {
  const [room,setRoom]=useState<Room|null>(null)
  const [playerId]=useState<string>(getSaved()?.id || randomId())
  const [nickname,setNickname]=useState(getSaved()?.nickname || '')
  const [code,setCode]=useState(new URLSearchParams(location.search).get('room') || '')
  const [word,setWord]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [secondsLeft,setSecondsLeft]=useState(DEFAULT_SECONDS)
  const [serverOffset,setServerOffset]=useState(0)
  const [sound,setSound]=useState(false)
  const [selectedCells,setSelectedCells]=useState<number[]>([])
  const selectedCellsRef=useRef<number[]>([])
  const activePointerRef=useRef<number|null>(null)
  const audioRef=useRef<{context:AudioContext;oscillator:OscillatorNode;harmony:OscillatorNode;gain:GainNode;timer:number}|null>(null)
  const [seconds,setSeconds]=useState(DEFAULT_SECONDS)
  const [liveScores,setLiveScores]=useState(true)
  const [screen,setScreen]=useState<'home'|'lobby'|'game'|'results'>('home')
  const invite=useMemo(()=>room ? `${location.origin}${location.pathname}?room=${room.code}` : '',[room])

  async function run(action:string,payload:Record<string,unknown>={}) {
    setBusy(true); setMessage('')
    try { const data=await api<any>(action,{...payload,playerId}); if(typeof data.serverNow==='number') setServerOffset(data.serverNow-Date.now()); if(data.room) applyRoom(data.room); return data }
    catch(e){setMessage(errorText(e));return null}
    finally{setBusy(false)}
  }
  function applyRoom(next:Room) {
    setRoom(next)
    const p=next.players.find(x=>x.id===playerId)
    if(p) { sessionStorage.setItem('letter-league-player',JSON.stringify({id:playerId,nickname:p.nickname,code:next.code})); setNickname(p.nickname) }
    setScreen(next.status==='lobby'?'lobby':next.status==='playing'?'game':'results')
  }
  async function createRoom() {
    if(!nickname.trim()) return setMessage('Choose a temporary nickname first.')
    await run('create',{nickname:nickname.trim(),seconds,liveScores})
  }
  async function joinRoom() {
    if(!nickname.trim() || !code.trim()) return setMessage('Enter a nickname and room code.')
    await run('join',{nickname:nickname.trim(),code:code.trim().toUpperCase()})
  }
  async function refresh() {
    if(!room) return
    const data=await run('snapshot',{code:room.code})
    if(data?.room) applyRoom(data.room)
  }
  useEffect(() => {
    if (!room || !supabase) return

    const client = supabase

    const channel = client.channel(`room:${room.code}`)
        .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'game_rooms',
              filter: `code=eq.${room.code}`
            },
            () => { void refresh() }
        )
        .subscribe()

    const poll = window.setInterval(() => {
      void refresh()
    }, 5000)

    return () => {
      window.clearInterval(poll)
      void client.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[room?.code])
  useEffect(()=>{
    if(!room?.deadline) return
    const tick=()=>setSecondsLeft(Math.max(0,Math.ceil((room.deadline!-(Date.now()+serverOffset))/1000)))
    tick(); const t=window.setInterval(tick,250); return ()=>window.clearInterval(t)
  },[room?.deadline,serverOffset])
  useEffect(()=>{
    if(room?.status==='playing' && secondsLeft===0) void run('finish',{code:room.code})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[secondsLeft,room?.status])
  async function submitWord(value=word) {
    const candidate=value.trim().toUpperCase()
    if(!room || !candidate) return
    const result=await run('submit',{code:room.code,word:candidate})
    if(result?.ok) setMessage(`Nice find! ${candidate}`)
    setWord('')
    selectedCellsRef.current=[]
    setSelectedCells([])
  }
  function updateSelection(cells:number[]) {
    selectedCellsRef.current=cells
    setSelectedCells(cells)
    if(room) setWord(cells.map(i=>room.board[i]==='Q'?'QU':room.board[i]).join(''))
  }
  function selectTile(index:number) {
    if(secondsLeft===0 || room?.status!=='playing') return
    updateSelection([index])
  }
  function extendSelection(index:number) {
    const selected=selectedCellsRef.current
    if(selected.length===0 || !room) return
    if(selected.length>1 && index===selected[selected.length-2]) {
      updateSelection(selected.slice(0,-1))
      return
    }
    if(selected.includes(index)) return
    const last=selected[selected.length-1]
    const row=Math.floor(last/4), col=last%4
    const nextRow=Math.floor(index/4), nextCol=index%4
    if(Math.max(Math.abs(row-nextRow),Math.abs(col-nextCol))!==1) return
    updateSelection([...selected,index])
  }
  function handleBoardPointerDown(e:ReactPointerEvent<HTMLDivElement>) {
    const tile=(e.target as HTMLElement).closest<HTMLElement>('[data-index]')
    if(!tile) return
    e.preventDefault()
    activePointerRef.current=e.pointerId
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    selectTile(Number(tile.dataset.index))
  }
  function handleBoardPointerMove(e:ReactPointerEvent<HTMLDivElement>) {
    if(activePointerRef.current!==e.pointerId) return
    const tile=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-index]')
    if(tile) extendSelection(Number(tile.dataset.index))
  }
  function clearSelection() {
    activePointerRef.current=null
    selectedCellsRef.current=[]
    setSelectedCells([])
    setWord('')
  }
  function finishSelection() {
    const selected=selectedCellsRef.current
    activePointerRef.current=null
    if(selected.length>0 && room) {
      const selectedWord=selected.map(i=>room.board[i]==='Q'?'QU':room.board[i]).join('')
      if(selectedWord.length>=3) void submitWord(selectedWord)
      else clearSelection()
    }
  }
  async function toggleMusic() {
    const active=audioRef.current
    if(active) {
      window.clearInterval(active.timer)
      active.gain.gain.setTargetAtTime(0,active.context.currentTime,0.18)
      active.oscillator.stop(active.context.currentTime+0.7)
      active.harmony.stop(active.context.currentTime+0.7)
      window.setTimeout(()=>{void active.context.close()},800)
      audioRef.current=null
      setSound(false)
      return
    }
    try {
      const AudioContextCtor=window.AudioContext || (window as Window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext
      if(!AudioContextCtor) throw new Error('Audio is not supported in this browser.')
      const context=new AudioContextCtor()
      await context.resume()
      if(context.state!=='running') throw new Error('Tap the music button again to allow audio playback.')
      const gain=context.createGain()
      gain.gain.setValueAtTime(0.075,context.currentTime)
      gain.connect(context.destination)
      const oscillator=context.createOscillator()
      const harmony=context.createOscillator()
      oscillator.type='sine'
      harmony.type='triangle'
      const notes=[261.63,329.63,392,329.63,293.66,349.23,440,349.23]
      oscillator.frequency.value=notes[0]
      harmony.frequency.value=notes[0]/2
      const softGain=context.createGain()
      softGain.gain.value=0.72
      oscillator.connect(softGain)
      harmony.connect(softGain)
      softGain.connect(gain)
      oscillator.start()
      harmony.start()
      let step=0
      const timer=window.setInterval(()=>{
        step=(step+1)%notes.length
        oscillator.frequency.setTargetAtTime(notes[step],context.currentTime,0.25)
        harmony.frequency.setTargetAtTime(notes[step]/2,context.currentTime,0.25)
      },850)
      audioRef.current={context,oscillator,harmony,gain,timer}
      setSound(true)
    } catch {
      setMessage('Music could not start. Check that your device is not muted, then tap Music on again.')
    }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(invite);setMessage('Invitation link copied!') }
    catch { setMessage(invite) }
  }
  const me=room?.players.find(p=>p.id===playerId)
  const leaderboard=[...(room?.players||[])].sort((a,b)=>b.score-a.score || a.nickname.localeCompare(b.nickname))
  const placeFor = (index: number): number =>
      index > 0 && leaderboard[index]?.score === leaderboard[index - 1]?.score
          ? placeFor(index - 1)
          : index + 1
  const placeLabel=(place:number)=>`${place}${place===1?'st':place===2?'nd':place===3?'rd':'th'}`
  const myWords=me?.words||[]
  const roundWordStats=useMemo(()=>room ? getRoundWordStats(room.board,room.words) : {soloWords:[],sharedWords:[],missedWords:[]},[room?.board,room?.words])

  useEffect(()=>()=> {
    const active=audioRef.current
    if(active) {
      window.clearInterval(active.timer)
      try { active.oscillator.stop(); active.harmony.stop() } catch {}
      void active.context.close()
    }
  },[])
  useEffect(()=>{
    if(room?.status!=='playing' && audioRef.current) {
      const active=audioRef.current
      window.clearInterval(active.timer)
      active.gain.gain.setTargetAtTime(0,active.context.currentTime,0.18)
      active.oscillator.stop(active.context.currentTime+0.7)
      active.harmony.stop(active.context.currentTime+0.7)
      window.setTimeout(()=>{void active.context.close()},800)
      audioRef.current=null
      setSound(false)
    }
  },[room?.status])

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#" onClick={()=>{setRoom(null);setScreen('home')}}><span className="brand-icon"><Gamepad2 size={22}/></span> Letter League</a><span className="privacy-pill">Private family game</span></header>
    {screen==='home' && <section className="hero">
      <div className="hero-copy"><span className="eyebrow">A LITTLE FRIENDLY WORD RIVALRY</span><h1>Find the words.<br/><em>Beat the clock.</em></h1><p>A fast, feel-good word hunt for family and friends. Create a room, share the link, and play together.</p></div>
      <div className="panel home-panel">
        <label>Your temporary nickname<input value={nickname} maxLength={18} onChange={e=>setNickname(e.target.value)} placeholder="e.g. Word Wizard"/></label>
        <div className="section-rule"/>
        <h2><Crown size={18}/> Host a new game</h2>
        <label>Round length<select value={seconds} onChange={e=>setSeconds(Number(e.target.value))}><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option><option value={240}>4 minutes</option><option value={300}>5 minutes</option></select></label>
        <label className="checkline"><input type="checkbox" checked={liveScores} onChange={e=>setLiveScores(e.target.checked)}/> Show live scores</label>
        <button className="primary" disabled={busy||!configured} onClick={createRoom}>{busy?<Loader2 className="spin"/>:<Users size={18}/>} Create private room</button>
        <div className="section-rule"/>
        <h2><DoorOpen size={18}/> Join a room</h2>
        <label>Six-character room code<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ABC123"/></label>
        <button className="secondary" disabled={busy||!configured} onClick={joinRoom}>Join game</button>
        {!configured&&<p className="warning">Supabase is not configured yet. Follow the README setup steps before playing.</p>}
      </div>
    </section>}
    {screen==='lobby' && room && <section className="panel room-panel">
      <div className="room-heading"><div><span className="eyebrow">WAITING LOBBY</span><h1>Room <em>{room.code}</em></h1><p>Share the invite with your crew. Only the room creator is host and can start or restart the game.</p></div><div className="room-actions"><button className="secondary small" onClick={copyInvite}><Copy size={16}/> Copy invite</button><button className="ghost small" onClick={refresh}><RefreshCw size={16}/></button></div></div>
      <div className="invite-box"><Link2 size={17}/><span>{invite}</span><button onClick={copyInvite}>Copy</button></div>
      <h2><Users size={18}/> Players <span className="count">{room.players.length}/12</span></h2>
      <div className="player-grid">{room.players.map((p)=><div className="player-card" key={p.id}><span className="avatar">{p.nickname.slice(0,1).toUpperCase()}</span><span><b>{p.nickname}</b><small>{p.id===room.hostId?'Host':p.online?'Connected':'Reconnecting'}</small></span>{p.id===room.hostId&&<Crown size={16} className="crown"/>}</div>)}</div>
      {me?.id===room.hostId?<button className="primary wide" disabled={busy||room.players.length<2} onClick={()=>run('start',{code:room.code})}>Start game · {room.players.length} players</button>:<p className="waiting-note">Waiting for the host to start the round…</p>}
    </section>}
    {screen==='game' && room && <section className="game-layout">
      <div className="game-main panel">
        <div className="game-head"><div><span className="eyebrow">ROOM {room.code}</span><h1>Word <em>hunt</em></h1></div><div className={`timer ${secondsLeft<20?'urgent':''}`}><span>TIME LEFT</span><b>{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}</b></div></div>
        <p className="drag-hint">Touch and slide across neighboring letters · release to submit · or type below</p>
        <div className="board" onPointerDown={handleBoardPointerDown} onPointerMove={handleBoardPointerMove} onPointerUp={finishSelection} onPointerCancel={clearSelection} onLostPointerCapture={()=>{activePointerRef.current=null}} >
          {room.board.map((letter,i)=><div
            className={`tile ${selectedCells.includes(i)?'selected':''}`}
            key={i}
            data-index={i}
            aria-label={`Letter ${letter==='Q'?'Qu':letter}`}
          >{letter==='Q'?'Qu':letter}</div>)}
        </div>
        <form className="word-form" onSubmit={e=>{e.preventDefault();void submitWord()}}><input autoComplete="off" value={word} onChange={e=>{setWord(e.target.value);selectedCellsRef.current=[];setSelectedCells([])}} placeholder="Or type a word…" disabled={secondsLeft===0}/><button className="primary" disabled={busy||!word.trim()||secondsLeft===0}>Submit</button></form>
        <div className="word-list"><b>Your words ({myWords.length})</b><div>{myWords.length?myWords.map(w=><span className="word-chip" key={w}>{w}</span>):<small>Your discoveries will appear here.</small>}</div></div>
      </div>
      <aside className="panel score-panel"><div className="score-title"><h2><Crown size={18}/> Leaderboard</h2><button className="ghost small music-toggle" onClick={()=>void toggleMusic()} aria-label={sound?'Turn music off':'Turn music on'}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>} {sound?'Music on':'Enable music'}</button></div>{leaderboard.map((p,i)=>{const place=placeFor(i);return <div className={`score-row ${place<=3?`score-place-${place}`:''}`} key={p.id}><span className="rank">{placeLabel(place)}</span><span className="score-name">{p.nickname}{p.id===playerId?' (you)':''}</span>{room.liveScores&&<b>{p.score} pts</b>}</div>})}<p className="muted tiny scoring-help">Scoring: shared word = 1 point each · solo 3-letter word = 2 points · solo word of 4+ letters = 5 points.</p><button className="ghost wide" onClick={refresh}>Refresh status</button></aside>
    </section>}
    {screen==='results' && room && <section className="panel results-panel"><span className="eyebrow">ROUND COMPLETE</span><h1>Well <em>played!</em></h1><p className="muted">Here’s how your word hunters did.</p><div className="leaderboard">{leaderboard.map((p,i)=>{const place=placeFor(i);return <div className={`leader-row ${place<=3?`leader-place-${place}`:''}`} key={p.id}><span className="rank">{placeLabel(place)}</span><div className="leader-detail"><b>{p.nickname}{place===1?' · Winner':''}</b><small>{p.words.length} words found · {p.words.join(', ')||'No words found'}</small></div><strong>{p.score} pts</strong></div>})}</div>
      <div className="result-summary"><div><b>{roundWordStats.soloWords.length}</b><small>Unique words (one player)</small></div><div><b>{roundWordStats.sharedWords.length}</b><small>Shared words (2+ players)</small></div></div>
      <section className="missed-words"><div className="missed-heading"><div><h2>Words you missed</h2><p>Valid words from this round’s board that nobody submitted.</p></div><span className="missed-count">{roundWordStats.missedWords.length}</span></div>{roundWordStats.missedWords.length ? <div className="missed-word-list">{roundWordStats.missedWords.map(w=><span className="word-chip missed-chip" key={w}>{w}</span>)}</div> : <p className="all-found">Amazing! Your group found every valid word on this board.</p>}</section>
      {room.hostId===playerId?<button className="primary wide" onClick={()=>run('replay',{code:room.code})}> <RefreshCw size={17}/> Play again</button>:<p className="waiting-note">The host can start another round when ready.</p>}
    </section>}
    {message&&<div className="toast" role="status">{message}</div>}
    <footer><span>Letter League · Made for game night</span><a href="PRIVACY.md" target="_blank">Privacy notice</a><span>No accounts · No ads · No chat</span></footer>
  </main>
}