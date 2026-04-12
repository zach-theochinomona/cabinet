import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const KB_PASSWORD = process.env.KB_PASSWORD || "";
const AUTH_ENABLED = KB_PASSWORD.length > 0;
const SALT_PREFIX = "cabinet-v2-";

async function hashToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = encoder.encode(SALT_PREFIX + password.length.toString());

  const key = await crypto.subtle.importKey("raw", data, "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256
  );

  return Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Simple in-memory rate limiting (per-process, resets on restart)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  if (!AUTH_ENABLED) {
    return NextResponse.json({ ok: true });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 }
    );
  }

  const { password } = await req.json();

  if (password !== KB_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await hashToken(password);
  const cookieStore = await cookies();
  cookieStore.set("kb-auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.KB_ALLOW_HTTP !== "1",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return NextResponse.json({ ok: true });
}
