import { useEffect, useMemo, useState } from 'react'
import { Copy, Crown, DoorOpen, Gamepad2, Link2, Loader2, RefreshCw, Users, Volume2, VolumeX } from 'lucide-react'
import { api, configured, supabase } from './lib/supabase'
import { DEFAULT_SECONDS } from './lib/game'

type Player = { id: string; nickname: string; score: number; online: boolean; words: string[] }
type Room = { code: string; hostId: string; status: 'lobby'|'playing'|'finished'; players: Player[]; board: string[]; startedAt: number|null; deadline: number|null; seconds: number; liveScores: boolean; words: Record<string,string[]>; invalid: Record<string,string[]>; createdAt: number }
const randomId = () => crypto.randomUUID()
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong'
const getSaved = () => { try { return JSON.parse(sessionStorage.getItem('letter-league-player') || 'null') } catch { return null } }

export default function App() {
  const [room,setRoom]=useState<Room|null>(null)
  const [playerId,setPlayerId]=useState<string>(getSaved()?.id || randomId())
  const [nickname,setNickname]=useState(getSaved()?.nickname || '')
  const [code,setCode]=useState(new URLSearchParams(location.search).get('room') || '')
  const [word,setWord]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [secondsLeft,setSecondsLeft]=useState(DEFAULT_SECONDS)
  const [serverOffset,setServerOffset]=useState(0)
  const [sound,setSound]=useState(false)
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
  useEffect(()=>{
    if(!room || !supabase) return
    const channel=supabase.channel(`room:${room.code}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'game_rooms',filter:`code=eq.${room.code}`},()=>{ void refresh() })
      .subscribe()
    const poll=window.setInterval(()=>{void refresh()},5000)
    return ()=>{window.clearInterval(poll);void supabase.removeChannel(channel)}
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
  async function submitWord() {
    if(!room || !word.trim()) return
    const result=await run('submit',{code:room.code,word:word.trim()})
    if(result?.ok) setWord('')
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(invite);setMessage('Invitation link copied!') }
    catch { setMessage(invite) }
  }
  const me=room?.players.find(p=>p.id===playerId)
  const leaderboard=[...(room?.players||[])].sort((a,b)=>b.score-a.score)
  const myWords=me?.words||[]

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
      <div className="room-heading"><div><span className="eyebrow">WAITING LOBBY</span><h1>Room <em>{room.code}</em></h1><p>Share the invite with your crew. The host starts when everyone is ready.</p></div><div className="room-actions"><button className="secondary small" onClick={copyInvite}><Copy size={16}/> Copy invite</button><button className="ghost small" onClick={refresh}><RefreshCw size={16}/></button></div></div>
      <div className="invite-box"><Link2 size={17}/><span>{invite}</span><button onClick={copyInvite}>Copy</button></div>
      <h2><Users size={18}/> Players <span className="count">{room.players.length}/12</span></h2>
      <div className="player-grid">{room.players.map((p,i)=><div className="player-card" key={p.id}><span className="avatar">{p.nickname.slice(0,1).toUpperCase()}</span><span><b>{p.nickname}</b><small>{p.id===room.hostId?'Host':p.online?'Connected':'Reconnecting'}</small></span>{p.id===room.hostId&&<Crown size={16} className="crown"/>}</div>)}</div>
      {me?.id===room.hostId?<button className="primary wide" disabled={busy||room.players.length<2} onClick={()=>run('start',{code:room.code})}>Start game · {room.players.length} players</button>:<p className="waiting-note">Waiting for the host to start the round…</p>}
    </section>}
    {screen==='game' && room && <section className="game-layout">
      <div className="game-main panel">
        <div className="game-head"><div><span className="eyebrow">ROOM {room.code}</span><h1>Word <em>hunt</em></h1></div><div className={`timer ${secondsLeft<20?'urgent':''}`}><span>TIME LEFT</span><b>{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}</b></div></div>
        <div className="board">{room.board.map((letter,i)=><div className="tile" key={i}>{letter==='Q'?'Qu':letter}</div>)}</div>
        <form className="word-form" onSubmit={e=>{e.preventDefault();void submitWord()}}><input autoComplete="off" value={word} onChange={e=>setWord(e.target.value)} placeholder="Type a word…" disabled={secondsLeft===0}/><button className="primary" disabled={busy||!word.trim()||secondsLeft===0}>Submit</button></form>
        <div className="word-list"><b>Your words ({myWords.length})</b><div>{myWords.length?myWords.map(w=><span className="word-chip" key={w}>{w}</span>):<small>Your discoveries will appear here.</small>}</div></div>
      </div>
      <aside className="panel score-panel"><div className="score-title"><h2><Users size={18}/> Players</h2><button className="ghost small" onClick={()=>setSound(!sound)}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}</button></div>{leaderboard.map((p,i)=><div className="score-row" key={p.id}><span className="rank">{i+1}</span><span className="score-name">{p.nickname}{p.id===playerId?' (you)':''}</span>{room.liveScores&&<b>{p.score}</b>}</div>)}<p className="muted tiny">Scores are validated by the game service.</p><button className="ghost wide" onClick={refresh}>Refresh status</button></aside>
    </section>}
    {screen==='results' && room && <section className="panel results-panel"><span className="eyebrow">ROUND COMPLETE</span><h1>Well <em>played!</em></h1><p className="muted">Here’s how your word hunters did.</p><div className="leaderboard">{leaderboard.map((p,i)=><div className="leader-row" key={p.id}><span className="rank">{i+1}</span><div className="leader-detail"><b>{p.nickname}</b><small>{p.words.length} unique words · {p.words.join(', ')||'No words found'}</small></div><strong>{p.score} pts</strong></div>)}</div>
      <div className="result-summary"><div><b>{Object.values(room.words).flat().length}</b><small>Unique submissions</small></div><div><b>{Object.values(room.words).flat().filter(w=>Object.values(room.words).filter(a=>a.includes(w)).length>1).length}</b><small>Shared words</small></div></div>
      {room.hostId===playerId?<button className="primary wide" onClick={()=>run('replay',{code:room.code})}> <RefreshCw size={17}/> Play again</button>:<p className="waiting-note">The host can start another round when ready.</p>}
    </section>}
    {message&&<div className="toast" role="status">{message}</div>}
    <footer><span>Letter League · Made for game night</span><a href="PRIVACY.md" target="_blank">Privacy notice</a><span>No accounts · No ads · No chat</span></footer>
  </main>
}