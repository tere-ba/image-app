import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for client components (login/signup forms).
// Uses the public URL + publishable anon key; RLS enforces access server-side.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
