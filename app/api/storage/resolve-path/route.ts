import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminClient, STORAGE_BUCKET } from "@/lib/admin-supabase";
import { getAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signed URL for a known private storage path (question media / materials). */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const path = (url.searchParams.get("path") || "").trim();
    const expiresIn = Math.min(Number(url.searchParams.get("expiresIn") || "3600"), 7200);

    if (!path || path.includes("..") || path.startsWith("/")) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const admin = await getAdminSession();
    if (!admin) {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const client = getAdminClient();
    const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
        return NextResponse.json(
            { error: error?.message || "Could not sign URL" },
            { status: 500 }
        );
    }

    return NextResponse.json({ signedUrl: data.signedUrl, path });
}
