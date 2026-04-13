import { NextRequest, NextResponse } from "next/server";
import {
  getMemoryPermissions,
  saveMemoryPermissions,
  grantReadAccess,
  grantWriteAccess,
  revokeReadAccess,
  revokeWriteAccess,
  setMemoryPublic,
  listReadableBy,
  listWritableBy,
} from "@/lib/memory/memory-permissions";

/**
 * GET /api/memory/:slug/permissions
 * Get permissions for an agent's memory
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const permissions = await getMemoryPermissions(slug);

    return NextResponse.json({
      slug,
      permissions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/memory/:slug/permissions
 * Update permissions for an agent's memory
 * 
 * Body:
 * - action: "grant_read" | "grant_write" | "revoke_read" | "revoke_write" | "set_public"
 * - target: Agent slug to grant/revoke access for (not needed for set_public)
 * - public: boolean (only for set_public action)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const { action, target, public: isPublic } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing 'action' field" }, { status: 400 });
    }

    switch (action) {
      case "grant_read":
        if (!target) {
          return NextResponse.json({ error: "Missing 'target' field for grant_read" }, { status: 400 });
        }
        await grantReadAccess(slug, target);
        break;

      case "grant_write":
        if (!target) {
          return NextResponse.json({ error: "Missing 'target' field for grant_write" }, { status: 400 });
        }
        await grantWriteAccess(slug, target);
        break;

      case "revoke_read":
        if (!target) {
          return NextResponse.json({ error: "Missing 'target' field for revoke_read" }, { status: 400 });
        }
        await revokeReadAccess(slug, target);
        break;

      case "revoke_write":
        if (!target) {
          return NextResponse.json({ error: "Missing 'target' field for revoke_write" }, { status: 400 });
        }
        await revokeWriteAccess(slug, target);
        break;

      case "set_public":
        if (typeof isPublic !== "boolean") {
          return NextResponse.json({ error: "Missing 'public' field for set_public" }, { status: 400 });
        }
        await setMemoryPublic(slug, isPublic);
        break;

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    // Return updated permissions
    const permissions = await getMemoryPermissions(slug);

    return NextResponse.json({
      ok: true,
      slug,
      action,
      target,
      public: isPublic,
      permissions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
