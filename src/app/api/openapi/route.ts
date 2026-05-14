import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const content = await readFile(join(process.cwd(), "openapi", "openapi.json"), "utf8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "OpenAPI spec not found. Run npm run openapi:generate before start." },
      { status: 404 },
    );
  }
}

