import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const BUCKET = "study-material-bucket";

function basename(p: string) {
  const parts = p.split("/").filter(Boolean);
  return parts[parts.length - 1] || p;
}

async function listAllFiles(supabase: any, prefix: string = ""): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } });

  if (error) {
    return [];
  }

  const results: string[] = [];
  for (const item of data || []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    const isFolder = item.metadata === null || (!item.metadata?.size && item.id === null);
    if (isFolder) {
      const sub = await listAllFiles(supabase, fullPath);
      results.push(...sub);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filename = (url.searchParams.get("filename") || "").trim();
  const expiresIn = Number(url.searchParams.get("expiresIn") || "3600");

  if (!filename) {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const all = await listAllFiles(supabase);
  const matches = all.filter((p) => basename(p).toLowerCase() === filename.toLowerCase());

  if (matches.length === 0) {
    return NextResponse.json({ error: "Object not found", filename }, { status: 404 });
  }

  // Prefer shortest path (usually closest to root) if duplicates exist
  matches.sort((a, b) => a.length - b.length);
  const resolvedPath = matches[0];

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(resolvedPath, expiresIn);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || "Could not sign URL" }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, resolvedPath });
}

