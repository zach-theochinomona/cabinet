import { NextRequest, NextResponse } from "next/server";

// Edge Runtime compatible — no fs, no path, no process.cwd()

const SALT_PREFIX = "cabinet-v2-";

async function hashToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  // Deterministic salt from password — avoids filesystem in Edge Runtime
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

// Cache the expected token per password
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
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
