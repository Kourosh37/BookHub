import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

function contentTypeFromFileName(fileName: string) {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "application/octet-stream";
}

export async function GET(_: Request, { params }: { params: { fileName: string } }) {
  try {
    const safeName = path.basename(params.fileName || "");
    if (!safeName) return NextResponse.json({ error: "Invalid file name" }, { status: 400 });

    const fullPath = path.join(process.cwd(), "public", "uploads", "avatars", safeName);
    const file = await readFile(fullPath);

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFromFileName(safeName),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

