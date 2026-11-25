import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { generateBoard, pointsFor } from "../_shared/game.ts";
import { isDictionaryWord } from "../_shared/dictionary.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const ROOM_TTL_MS = 1000 * 60 * 60 * 3;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const json = (body: unknown, status=200) => {
  const payload = body && typeof body === "object" ? { ...(body as Record<string, unknown>), serverNow: now() } : body;
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
};
const cleanName = (s: unknown) => typeof s === "string" ? s.trim().replace(/[<>]/g,"").slice(0,18) : "";
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), n => alphabet[n % alphabet.length]).join("");
const now = () => Date.now();

async function purge() { await db.from("game_rooms").delete().lt("expires_at", new Date().toISOString()); }
async function load(code: string) {
  const { data, error } = await db.from("game_rooms").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at).getTime() < now()) return null;
  return data;
}
async function save(code: string, state: any) {
  const { error } = await db.from("game_rooms").upsert({ code, state, updated_at: new Date().toISOString(), expires_at: new Date(now()+ROOM_TTL_MS).toISOString() });
  if (error) throw error;
}
function publicRoom(state: any) { return state; }
function player(state: any, id: string) { return state.players.find((p:any)=>p.id===id); }

// A Boggle Q tile represents the two letters QU.
function canMakeWord(board: string[], word: string): boolean {
  if (board.length !== 16 || word.length < 3 || !/^[A-Z]+$/.test(word)) return false;
  const visit = (pos: number, offset: number, used: number): boolean => {
    const letters = board[pos] === "Q" ? "QU" : board[pos];
    if (!word.startsWith(letters, offset)) return false;
    const nextOffset = offset + letters.length;
    if (nextOffset === word.length) return true;
    if (nextOffset > word.length) return false;
    const nextUsed = used | (1 << pos);
    const row = Math.floor(pos / 4), col = pos % 4;
    for (let r = Math.max(0, row - 1); r <= Math.min(3, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(3, col + 1); c++) {
        const next = r * 4 + c;
        if (next === pos || (nextUsed & (1 << next))) continue;
        if (visit(next, nextOffset, nextUsed)) return true;
      }
    }
    return false;
  };
  for (let i = 0; i < 16; i++) if (visit(i, 0, 0)) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const id = String(body.playerId || "");
    if (!/^[0-9a-f-]{30,40}$/i.test(id)) return json({error:"Invalid temporary player token"},400);
    await purge();

    if (action === "create") {
      const nickname=cleanName(body.nickname);
      if (!nickname) return json({error:"Choose a nickname."},400);
      let code="";
      for(let i=0;i<8;i++){const candidate=newCode();const existing=await load(candidate);if(!existing){code=candidate;break;}}
      if(!code) return json({error:"Could not allocate a room. Try again."},503);
      const state={code,hostId:id,status:"lobby",players:[{id,nickname,score:0,online:true,words:[]}],board:[],startedAt:null,deadline:null,seconds:Math.min(300,Math.max(60,Number(body.seconds)||180)),liveScores:body.liveScores!==false,words:{},invalid:{},createdAt:now()};
      await save(code,state); return json({room:publicRoom(state)});
    }

    const code=String(body.code||"").toUpperCase();
    if(!/^[A-Z0-9]{6}$/.test(code)) return json({error:"Enter a valid six-character room code."},400);
    const row=await load(code);
    if(!row) return json({error:"Room not found or expired."},404);
    const state=row.state;
    const me=player(state,id);

    if(action==="join") {
      const nickname=cleanName(body.nickname);
      if(!nickname) return json({error:"Choose a nickname."},400);
      if(!me) {
        if(state.status!=="lobby") return json({error:"This round has already started."},409);
        if(state.players.length>=12) return json({error:"This room is full."},409);
        state.players.push({id,nickname,score:0,online:true,words:[]});
      } else { me.online=true; }
      await save(code,state); return json({room:publicRoom(state)});
    }
    if(!me) return json({error:"You are not a member of this room. Join it first."},403);
    if(action==="snapshot") { me.online=true; await save(code,state); return json({room:publicRoom(state)}); }
    if(action==="leave") { me.online=false; await save(code,state); return json({room:publicRoom(state)}); }

    if(action==="start" || action==="replay") {
      if(state.hostId!==id) return json({error:"Only the host can start a round."},403);
      if(action==="start" && state.players.length<2) return json({error:"At least two players are required."},400);
      if(action==="replay" && state.status!=="finished") return json({error:"The current round is not finished."},409);
      state.board=generateBoard(); state.status="playing"; state.startedAt=now(); state.deadline=now()+state.seconds*1000; state.words={}; state.invalid={};
      for(const p of state.players){p.score=0;p.words=[];}
      await save(code,state); return json({room:publicRoom(state)});
    }
    if(action==="submit") {
      if(state.status!=="playing" || now()>state.deadline) return json({error:"The round has ended."},409);
      const word=String(body.word||"").trim().toUpperCase();
      if(!/^[A-Z]{3,20}$/.test(word)) return json({error:"Words must contain 3–20 letters."},400);
      if(me.words.includes(word)) return json({error:"You already submitted that word."},409);
      if(!isDictionaryWord(word) || !canMakeWord(state.board,word)) {
        state.invalid[id]=[...(state.invalid[id]||[]),word].slice(-100);
        await save(code,state); return json({error:"That word is not valid on this board."},400);
      }
      const previousOwners = state.words[word] || [];
      state.words[word]=[...previousOwners,id];
      me.words.push(word);
      if(previousOwners.length===0) {
        me.score+=pointsFor(word);
      } else if(previousOwners.length===1) {
        // The first submitter was provisionally awarded points. Remove that
        // one award once the word becomes shared. Later submitters do nothing.
        const firstOwner=player(state,previousOwners[0]);
        if(firstOwner) firstOwner.score=Math.max(0,firstOwner.score-pointsFor(word));
      }
      await save(code,state); return json({ok:true,room:publicRoom(state)});
    }
    if(action==="finish") {
      if(state.status==="playing" && now()>=state.deadline) { state.status="finished"; await save(code,state); }
      return json({room:publicRoom(state)});
    }
    return json({error:"Unknown action."},400);
  } catch (e) {
    console.error("game request failed:", e);
    return json({
      error: e instanceof Error ? e.message : "The game service encountered an error. Check function logs."
    }, 500);
  }
});
