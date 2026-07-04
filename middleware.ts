import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_COOKIE, verifyToken } from "@/lib/admin-session";

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Internal + public API helpers — no auth redirect (they handle their own).
    if (
        pathname.startsWith("/api/storage/resolve-material") ||
        pathname.startsWith("/api/health") ||
        pathname.startsWith("/api/cron")
    ) {
        return NextResponse.next();
    }

    // Admin routes — gated by the signed admin cookie, NOT the student session.
    if (pathname.startsWith("/admin")) {
        const token = request.cookies.get(SESSION_COOKIE)?.value;
        const session = await verifyToken(
            token,
            process.env.ADMIN_SESSION_SECRET ?? ""
        );
        const isLoginPage = pathname === "/admin";

        if (session && isLoginPage) {
            return NextResponse.redirect(new URL("/admin/materials", request.url));
        }
        if (!session && !isLoginPage) {
            return NextResponse.redirect(new URL("/admin", request.url));
        }
        return NextResponse.next();
    }

    // ─── Student (Supabase) auth for everything else ─────────
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (pathname === "/login") {
        if (user) return NextResponse.redirect(new URL("/dashboard", request.url));
        return supabaseResponse;
    }

    if (!user) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
