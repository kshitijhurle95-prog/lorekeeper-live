import initSqlJs, { type Database } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

let db: Database;
let transactionDepth=0;
const file = path.resolve(process.env.DB_FILE ?? 'data/lorekeeper.sqlite');

export async function openDb() {
  const SQL = await initSqlJs({ locateFile: (name) => path.resolve('node_modules/sql.js/dist', name) });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = fs.existsSync(file) ? new SQL.Database(new Uint8Array(fs.readFileSync(file))) : new SQL.Database();
  db.run(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS nominations(id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, user_id TEXT NOT NULL, username TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rounds(id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, nomination_id INTEGER NOT NULL REFERENCES nominations(id), status TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_round_per_channel ON rounds(channel) WHERE status='active';
    CREATE TABLE IF NOT EXISTS votes(id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER NOT NULL REFERENCES rounds(id), user_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(round_id,user_id));
    CREATE TABLE IF NOT EXISTS memories(id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, nomination_id INTEGER NOT NULL UNIQUE REFERENCES nominations(id), title TEXT NOT NULL, summary TEXT NOT NULL, summary_source TEXT NOT NULL DEFAULT 'fallback', original_text TEXT NOT NULL, vote_count INTEGER NOT NULL, featured INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);`);
  db.run('CREATE TABLE IF NOT EXISTS channel_config(channel TEXT PRIMARY KEY, overlay_token TEXT NOT NULL UNIQUE)');
  if (!all<{ name: string }>('PRAGMA table_info(memories)').some((column) => column.name === 'summary_source')) {
    db.run("ALTER TABLE memories ADD COLUMN summary_source TEXT NOT NULL DEFAULT 'fallback'");
  }
  save();
  return db;
}
export function save() { const temp=`${file}.tmp`;fs.writeFileSync(temp,Buffer.from(db.export()));fs.renameSync(temp,file); }
type SqlParam=string|number|Uint8Array|null;
export function all<T = Record<string, unknown>>(sql: string, ...params: SqlParam[]): T[] { const s=db.prepare(sql,params);const rows:T[]=[];try{while(s.step())rows.push(s.getAsObject() as T)}finally{s.free()}return rows; }
export function one<T = Record<string, unknown>>(sql: string, ...params: SqlParam[]): T | undefined { return all<T>(sql,...params)[0]; }
export function run(sql: string, ...params: SqlParam[]) { db.run(sql,params);const changes=db.getRowsModified();const lastInsertRowid=Number(one<{id:number}>('SELECT last_insert_rowid() id')?.id??0);if(!transactionDepth)save();return {changes,lastInsertRowid}; }
export function transaction<T>(fn: () => T): T { db.run('BEGIN IMMEDIATE');transactionDepth++;try{const result=fn();db.run('COMMIT');transactionDepth--;save();return result}catch(error){db.run('ROLLBACK');transactionDepth--;throw error} }
export function overlayChannel(token:string): string | undefined { return one<{channel:string}>('SELECT channel FROM channel_config WHERE overlay_token=?',token)?.channel; }
export function ensureOverlay(channel:string, token:string): string { const row=one<{overlay_token:string}>('SELECT overlay_token FROM channel_config WHERE channel=?',channel);if(row)return row.overlay_token;db.run('INSERT INTO channel_config(channel,overlay_token) VALUES(?,?)',[channel,token]);save();return token; }
