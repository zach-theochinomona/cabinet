import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const AUTH_SALT_PATH = ".cabinet/auth-salt";
const DATA_DIR = process.env.CABINET_DATA_DIR || path.join(process.cwd(), "data");

function getSalt(): Uint8Array | null {
  try {
    return new Uint8Array(fs.readFileSync(path.join(DATA_DIR, AUTH_SALT_PATH)));
  } catch {
    return null;
  }
}

async function hashToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = getSalt();

  if (!salt) {
    // No salt yet — first run, use legacy hash for backward compat
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password + "cabinet-salt"));
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const key = await crypto.subtle.importKey("raw", data, "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256
  );

  const hashArray = Array.from(new Uint8Array(derived));
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

// Cache the expected token to avoid recomputing on every request
let cachedToken: { password: string; token: string } | null = null;

export async function middleware(req: NextRequest) {
  const password = process.env.KB_PASSWORD || "";

  // Auth disabled — no password set
  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // Allow login page and login API
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/auth/check") {
    return NextResponse.next();
  }

  // Allow health check
  if (pathname.startsWith("/api/health")) {
    return NextResponse.next();
  }

  // Check auth cookie
  const token = req.cookies.get("kb-auth")?.value;

  // Cache the expected token per password
  if (!cachedToken || cachedToken.password !== password) {
    cachedToken = { password, token: await hashToken(password) };
  }

  if (token !== cachedToken.token) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Pages redirect to login
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
