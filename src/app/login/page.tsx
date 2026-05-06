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
        className="w-full max-w-sm space-y-4 rounded-2xl bg-zao-ink p-6 shadow-xl border border-white/10"
      >
        <div>
          <h1 className="text-2xl font-bold">Iman x Zaal</h1>
          <p className="text-sm text-white/60 mt-1">ZAO Devz action tracker</p>
        </div>
        <input type="hidden" name="from" value={from} />
        <label className="block">
          <span className="text-sm text-white/80">Password</span>
          <input
            name="password"
            type="password"
            autoFocus
            required
            className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-zao-accent"
            placeholder="enter password"
          />
        </label>
        {error && (
          <p className="text-sm text-red-400">Wrong password. Try again.</p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-zao-accent hover:bg-blue-500 px-4 py-2 font-medium transition"
        >
          Sign in
        </button>
        <p className="text-xs text-white/40">
          Two users: Zaal + Iman. Passwords set by site admin.
        </p>
      </form>
    </main>
  );
}
