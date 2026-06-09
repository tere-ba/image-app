import { createClient } from "@/lib/supabase/server";
import { FusionTool } from "@/components/FusionTool";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    (user?.user_metadata?.name as string | undefined) ?? user?.email ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-10">
      <div className="mb-6 flex items-center justify-end gap-3 text-sm text-neutral-600">
        {displayName && (
          <span>
            Signed in as <span className="font-medium">{displayName}</span>
          </span>
        )}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Sign out
          </button>
        </form>
      </div>

      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Image Fusion</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Upload two images and fuse them into one.
        </p>
      </header>

      <FusionTool />
    </main>
  );
}
