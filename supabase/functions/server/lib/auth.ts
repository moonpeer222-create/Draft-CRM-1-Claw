import { kv } from "https://deno.land/x/kv@v0.0.1/mod.ts";
import { SESSION_PREFIX } from "./constants.ts";
import { kvSet, kvDel } from "./supabase.ts";

export interface ServerSession {
  token: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  ip?: string;
}

const PW_SALT = "emerald-visa-crm-2024-salt-v1";

export async function hashPw(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(PW_SALT + plaintext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(userId: string, fullName: string, email: string, role: string, ip?: string): Promise<ServerSession> {
  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const session: ServerSession = { 
    token, 
    userId, 
    fullName, 
    email, 
    role, 
    createdAt: new Date().toISOString(), 
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), 
    ip 
  };
  await kvSet(`${SESSION_PREFIX}${token}`, session, "create-session");
  return session;
}

export async function validateSession(token: string): Promise<ServerSession | null> {
  if (!token) return null;
  const s = await kv.get(`${SESSION_PREFIX}${token}`) as any;
  if (!s || new Date(s.expiresAt).getTime() < Date.now()) return null;
  return s;
}

export async function destroySession(token: string): Promise<void> {
  if (token) await kvDel(`${SESSION_PREFIX}${token}`);
}
