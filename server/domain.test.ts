import { beforeAll, describe, expect, it } from 'vitest';
import { openDb } from './db.js';
import { endVote, moderate, nominate, parseCommand, startVote, vote } from './domain.js';

beforeAll(async()=>{await openDb()});
describe('community lore workflow',()=>{
  it('parses commands without treating ordinary chat as commands',()=>{expect(parseCommand('hello chat')).toBeNull();expect(parseCommand('!nominate A fine dragon moment')).toEqual({command:'nominate',value:'A fine dragon moment'})});
  it('validates nomination length and prevents rapid repeats',()=>{expect(()=>nominate('test-short','u','viewer','tiny')).toThrow();nominate('test-cooldown','u','viewer','A persistent memory');expect(()=>nominate('test-cooldown','u','viewer','Another persistent memory')).toThrow(/wait a minute/) });
  it('rejects duplicate votes, closes a round, and approves a persistent memory',()=>{const n=nominate('test-flow','viewer1','viewer1','We discovered the moonlit dragon');const round=startVote('test-flow',Number((n as any).id));vote('test-flow','voter1',Number((round as any).id));expect(()=>vote('test-flow','voter1',Number((round as any).id))).toThrow(/already voted/);const winner=endVote('test-flow',Number((round as any).id));expect(winner.voteCount).toBe(1);expect(moderate('test-flow',Number((n as any).id),true)).toMatchObject({vote_count:1,original_text:'We discovered the moonlit dragon'})});
  it('isolates channels and rejects voting in another channel',()=>{const n=nominate('channel-a','v','viewer','A memorable cross-channel moment');const round=startVote('channel-a',Number((n as any).id));expect(()=>vote('channel-b','voter',Number((round as any).id))).toThrow(/closed or belongs/)});
  it('allows only one active vote per channel and rejects invalid transitions',()=>{const n=nominate('one-vote','v','viewer','A moment for this vote');startVote('one-vote',Number((n as any).id));expect(()=>startVote('one-vote',Number((n as any).id))).toThrow(/already active/)});
});
