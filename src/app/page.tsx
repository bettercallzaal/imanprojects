import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getActions, ageDays } from "@/lib/data";
import { logout } from "./actions";
import { Board } from "@/components/Board";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getSession();
  if (!user) redirect("/login");
  const doc = await getActions();

  const open = doc.items.filter((x) => x.status !== "DONE");
  const wipMine = doc.items.filter(
    (x) => x.status === "WIP" && (String(x.owner).toLowerCase() === user || String(x.owner) === "Both"),
  ).length;
  const blocked = doc.items.filter((x) => x.status === "BLOCKED").length;
  const aging = doc.items.filter(
    (x) => x.status !== "DONE" && ageDays(x.createdAt) > 14,
  ).length;
  const done7d = doc.items.filter((x) => {
    if (x.status !== "DONE") return false;
    const d = new Date(x.updatedAt).getTime();
    return Date.now() - d < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const userLabel = user === "zaal" ? "Zaal" : "Iman";

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Iman x Zaal</h1>
          <p className="text-white/50 text-xs md:text-sm">
            Action tracker. Updated {new Date(doc.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UserBadge name={userLabel} />
          <form action={logout}>
            <button className="text-xs rounded-lg border border-white/10 px-2.5 py-1.5 hover:bg-white/5 text-white/70">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Open" value={open.length} />
        <Stat label="My WIP" value={wipMine} tone={wipMine > 5 ? "warn" : "ok"} hint="target ≤ 5" />
        <Stat label="Blocked" value={blocked} tone={blocked > 0 ? "red" : "ok"} />
        <Stat label="Aging > 14d" value={aging} tone={aging > 0 ? "red" : "ok"} />
        <Stat label="Done 7d" value={done7d} tone="ok" />
      </section>

      <Board items={doc.items} currentUser={user} />

      <footer className="pt-6 text-xs text-white/30 border-t border-white/5">
        <a href="https://github.com/bettercallzaal/imanprojects" className="hover:text-white/60">
          source on github
        </a>
        {" - "}
        <span>see SIX-SIGMA.md + BACKLOG.md in repo for process + future phases</span>
      </footer>
    </main>
  );
}

function UserBadge({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  const tone = name === "Zaal" ? "bg-blue-500/30 border-blue-400/50" : "bg-purple-500/30 border-purple-400/50";
  return (
    <div className={`flex items-center gap-2 rounded-full border ${tone} px-2.5 py-1`}>
      <span className="h-5 w-5 rounded-full bg-black/40 flex items-center justify-center text-xs font-bold">
        {initial}
      </span>
      <span className="text-xs">{name}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "ok",
  hint,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "red";
  hint?: string;
}) {
  const toneCls =
    tone === "red"
      ? "text-red-300 border-red-500/30"
      : tone === "warn"
      ? "text-amber-300 border-amber-500/30"
      : "text-white border-white/10";
  return (
    <div className={`rounded-xl bg-zao-ink/70 border ${toneCls} px-3 py-2.5`}>
      <div className="text-[10px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-0.5 text-2xl font-bold leading-none">{value}</div>
      {hint && <div className="text-[10px] text-white/35 mt-0.5">{hint}</div>}
    </div>
  );
}
