import { all, one, run, transaction } from './db.js';

const now = () => new Date().toISOString();
export function parseCommand(text: string): { command: string; value: string } | null {
  const match = text.trim().match(/^!(nominate|vote|lore)\b(?:\s+(.+))?$/i);
  return match ? { command: match[1]!.toLowerCase(), value: (match[2] ?? '').trim() } : null;
}
export function nominate(channel: string, userId: string, username: string, text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length < 8 || clean.length > 280) throw new Error('Nominations must be 8–280 characters.');
  const recent = one<{ n: number }>('SELECT COUNT(*) n FROM nominations WHERE channel=? AND user_id=? AND created_at>?', channel,userId,new Date(Date.now()-60_000).toISOString());
  if ((recent?.n ?? 0) > 0) throw new Error('Please wait a minute before nominating again.');
  const r = run('INSERT INTO nominations(channel,user_id,username,text,created_at) VALUES(?,?,?,?,?)',channel,userId,username.slice(0,25),clean,now());
  run('INSERT INTO activity(channel,kind,message,created_at) VALUES(?,?,?,?)',channel,'nomination',`${username} nominated a moment`,now());
  return one('SELECT * FROM nominations WHERE id=?',r.lastInsertRowid);
}
export function startVote(channel: string, nominationId: number) {
  if (one('SELECT id FROM rounds WHERE channel=? AND status="active"',channel)) throw new Error('A vote is already active for this channel.');
  if (!one('SELECT id FROM nominations WHERE id=? AND channel=? AND status="pending"',nominationId,channel)) throw new Error('That nomination is not eligible for voting.');
  const r=run('INSERT INTO rounds(channel,nomination_id,status,started_at) VALUES(?,?,"active",?)',channel,nominationId,now());
  return one('SELECT * FROM rounds WHERE id=?',r.lastInsertRowid);
}
export function vote(channel: string,userId: string,roundId: number) {
  const round=one<{id:number,nomination_id:number}>('SELECT id,nomination_id FROM rounds WHERE id=? AND channel=? AND status="active"',roundId,channel);
  if(!round) throw new Error('That vote is closed or belongs to another channel.');
  try { run('INSERT INTO votes(round_id,user_id,created_at) VALUES(?,?,?)',round.id,userId,now()); }
  catch { throw new Error('You have already voted in this round.'); }
  run('INSERT INTO activity(channel,kind,message,created_at) VALUES(?,?,?,?)',channel,'vote','A viewer cast a vote',now());
  return one('SELECT COUNT(*) count FROM votes WHERE round_id=?',round.id);
}
export function endVote(channel:string,roundId:number) {
  return transaction(()=>{
    const r=one<{id:number,nomination_id:number}>('SELECT id,nomination_id FROM rounds WHERE id=? AND channel=? AND status="active"',roundId,channel);
    if(!r) throw new Error('No active vote found.');
    const count=one<{count:number}>('SELECT COUNT(*) count FROM votes WHERE round_id=?',r.id)?.count??0;
    run('UPDATE rounds SET status="closed",ended_at=? WHERE id=?',now(),r.id);
    run('UPDATE nominations SET status="winner" WHERE id=?',r.nomination_id);
    return {nomination:one('SELECT * FROM nominations WHERE id=?',r.nomination_id),voteCount:count};
  });
}
export function moderate(channel:string,id:number,approve:boolean) {
  const n=one<{id:number,text:string,status:string}>('SELECT id,text,status FROM nominations WHERE id=? AND channel=?',id,channel);
  if(!n || !['winner','pending'].includes(n.status)) throw new Error('Nomination cannot be moderated in its current state.');
  if(!approve){run('UPDATE nominations SET status="rejected" WHERE id=?',id);run('INSERT INTO activity(channel,kind,message,created_at) VALUES(?,?,?,?)',channel,'moderation','A nomination was rejected',now());return null;}
  const votes=one<{count:number}>('SELECT COUNT(*) count FROM votes v JOIN rounds r ON r.id=v.round_id WHERE r.nomination_id=?',id)?.count??0;
  transaction(()=>{run('UPDATE nominations SET status="approved" WHERE id=?',id);run('INSERT INTO memories(channel,nomination_id,title,summary,summary_source,original_text,vote_count,created_at) VALUES(?,?,?,?,?,?,?,?)',channel,id,n.text.slice(0,70),n.text,'fallback',n.text,votes,now());run('INSERT INTO activity(channel,kind,message,created_at) VALUES(?,?,?,?)',channel,'memory','A community memory was approved',now());});
  return one('SELECT * FROM memories WHERE nomination_id=?',id);
}
export function feature(channel:string,id:number){transaction(()=>{run('UPDATE memories SET featured=0 WHERE channel=?',channel);const r=run('UPDATE memories SET featured=1 WHERE channel=? AND id=?',channel,id);if(!r.changes)throw new Error('Memory not found.');});}
export function archive(channel:string,id:number){const r=run('UPDATE memories SET archived=1,featured=0 WHERE channel=? AND id=?',channel,id);if(!r.changes)throw new Error('Memory not found.');}
export function snapshot(channel:string){
 const memories=all('SELECT * FROM memories WHERE channel=? AND archived=0 ORDER BY created_at DESC',channel);
 const nominations=all('SELECT n.*, (SELECT COUNT(*) FROM votes v JOIN rounds r ON v.round_id=r.id WHERE r.nomination_id=n.id) votes FROM nominations n WHERE channel=? AND status IN ("pending","winner") ORDER BY created_at DESC',channel);
 const active=one('SELECT r.*,n.text nomination_text,(SELECT COUNT(*) FROM votes v WHERE v.round_id=r.id) votes FROM rounds r JOIN nominations n ON n.id=r.nomination_id WHERE r.channel=? AND r.status="active"',channel);
 return {memories,nominations,active,activity:all('SELECT * FROM activity WHERE channel=? ORDER BY id DESC LIMIT 12',channel),stats:{total:one<{count:number}>('SELECT COUNT(*) count FROM memories WHERE channel=?',channel)?.count??0,pending:one<{count:number}>('SELECT COUNT(*) count FROM nominations WHERE channel=? AND status="pending"',channel)?.count??0}};
}
