import { NextRequest, NextResponse } from "next/server";
import {
  storeApiKey,
  getApiKey,
  listApiKeys,
  removeApiKey,
  testApiKey,
} from "@/lib/security/api-key-storage";

/**
 * GET /api/keys
 * List all stored API keys (without revealing the actual keys)
 */
export async function GET() {
  try {
    const keys = await listApiKeys();
    
    return NextResponse.json({
      keys: keys.map(k => ({
        provider: k.provider,
        name: k.name,
        createdAt: k.createdAt,
        hasKey: true,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/keys
 * Store a new API key or update existing one
 * 
 * Body:
 * - provider: string (required) - Provider name (openrouter, gemini, openai, etc.)
 * - key: string (required) - The API key
 * - name: string (optional) - Display name for the key
 * - test: boolean (optional) - Test the key before storing
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, key, name, test: shouldTest } = body;

    if (!provider || !key) {
      return NextResponse.json(
        { error: "Missing required fields: provider, key" },
        { status: 400 }
      );
    }

    // Test the key if requested
    if (shouldTest) {
      const testResult = await testApiKey(provider, key);
      if (!testResult.valid) {
        return NextResponse.json(
          { error: `API key test failed: ${testResult.error || "Invalid key"}` },
          { status: 400 }
        );
      }
    }

    // Store the key
    await storeApiKey(provider, key, name);

    return NextResponse.json({
      ok: true,
      provider,
      name: name || provider,
      message: `API key for ${provider} stored successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/keys
 * Remove an API key
 * 
 * Query parameters:
 * - provider: string (required) - Provider name to remove
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: "Missing required parameter: provider" },
        { status: 400 }
      );
    }

    await removeApiKey(provider);

    return NextResponse.json({
      ok: true,
      provider,
      message: `API key for ${provider} removed`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
