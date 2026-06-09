import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public paths that an unauthenticated visitor is allowed to reach.
const PUBLIC_PATHS = ["/login", "/signup"];

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    // API routes enforce their own auth and return JSON errors, so we don't
    // redirect them to the HTML login page (a fetch would follow the redirect
    // and receive HTML instead of a clean 401).
    pathname.startsWith("/api/")
  );
}

// Refreshes the auth session cookie and enforces the app-wide login gate.
// Must run in middleware so the session token is rotated on every request.
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without these the Supabase client throws and every request 500s with an
  // opaque MIDDLEWARE_INVOCATION_FAILED. Fail loudly with a clear message
  // instead — the env vars must be set in the hosting provider's config.
  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !supabaseAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    console.error(
      `Auth misconfigured: missing environment variable(s): ${missing}. ` +
        `Set them in your hosting provider's env config and redeploy.`,
    );
    return new NextResponse(
      `Server auth is misconfigured (missing ${missing}). ` +
        `Set the required environment variables and redeploy.`,
      { status: 500, headers: { "Content-Type": "text/plain" } },
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser() —
  // it can cause hard-to-debug session-refresh bugs.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Not logged in and visiting a gated page → send to /login.
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Already logged in but on an auth page → send to the app.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
