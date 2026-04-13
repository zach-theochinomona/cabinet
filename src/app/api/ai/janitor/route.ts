import { NextRequest, NextResponse } from "next/server";
import {
  getJanitorConfig,
  saveJanitorConfig,
  getJanitorStats,
  runJanitor,
} from "@/lib/ai/janitor";

/**
 * GET /api/ai/janitor
 * Get janitor status and configuration
 */
export async function GET() {
  try {
    const config = await getJanitorConfig();
    const stats = await getJanitorStats();

    return NextResponse.json({
      config,
      stats,
      status: "ready",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/ai/janitor
 * Update janitor configuration or run tasks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, config } = body;

    if (action === "run") {
      // Run janitor tasks
      const result = await runJanitor();
      return NextResponse.json(result);
    }

    if (action === "update-config" && config) {
      // Update configuration
      const currentConfig = await getJanitorConfig();
      const newConfig = { ...currentConfig, ...config };
      await saveJanitorConfig(newConfig);
      
      return NextResponse.json({
        success: true,
        config: newConfig,
      });
    }

    if (action === "enable") {
      const currentConfig = await getJanitorConfig();
      currentConfig.enabled = true;
      await saveJanitorConfig(currentConfig);
      
      return NextResponse.json({
        success: true,
        config: currentConfig,
      });
    }

    if (action === "disable") {
      const currentConfig = await getJanitorConfig();
      currentConfig.enabled = false;
      await saveJanitorConfig(currentConfig);
      
      return NextResponse.json({
        success: true,
        config: currentConfig,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use: run, update-config, enable, disable" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
