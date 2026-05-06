import { redirect } from "next/navigation";
import { getSession, verifyPassword, createSession } from "@/lib/auth";

async function loginAction(formData: FormData): Promise<void> {
  "use server";
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/");
  const user = verifyPassword(password);
  if (!user) {
    redirect(`/login?error=1${from ? `&from=${encodeURIComponent(from)}` : ""}`);
  }
  await createSession(user);
  redirect(from || "/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const existing = await getSession();
  const sp = await searchParams;
  if (existing) redirect(sp.from || "/");
  const error = sp.error === "1";
  const from = sp.from ?? "/";
  return (
    <main className="min-h-screen flex items-center justify-center bg-zao-navy text-white px-4">
      <form
        action={loginAction}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-zao-ink p-7 shadow-2xl border border-white/10"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Iman x Zaal</h1>
          <p className="text-sm text-white/55">ZAO Devz action tracker</p>
        </div>
        <input type="hidden" name="from" value={from} />
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-white/60">Password</span>
          <input
            name="password"
            type="password"
            autoFocus
            required
            className="mt-1.5 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-zao-accent focus:ring-1 focus:ring-zao-accent/40"
            placeholder="enter password"
          />
        </label>
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            Wrong password. Try again.
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-zao-accent hover:bg-blue-500 px-4 py-2.5 font-medium transition"
        >
          Sign in
        </button>
        <div className="pt-2 border-t border-white/10 space-y-1.5 text-xs text-white/45">
          <p>Two users: Zaal + Iman. Each has their own password.</p>
          <p>
            New here? Ask Zaal for ur password. Forgot it? Same.
          </p>
        </div>
      </form>
    </main>
  );
}
