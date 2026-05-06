import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getActions, type ActionItem, type ActionStatus } from "@/lib/data";
import {
  createItem,
  updateItem,
  deleteItem,
  quickStatus,
  logout,
} from "./actions";

const STATUSES: ActionStatus[] = ["TODO", "WIP", "BLOCKED", "DONE"];

const STATUS_STYLE: Record<ActionStatus, string> = {
  TODO: "bg-slate-700 text-slate-200",
  WIP: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  BLOCKED: "bg-red-500/20 text-red-300 border border-red-500/40",
  DONE: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
};

export default async function Page() {
  const user = await getSession();
  if (!user) redirect("/login");
  const doc = await getActions();
  const open = doc.items.filter((x) => x.status !== "DONE");
  const done = doc.items.filter((x) => x.status === "DONE");

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Iman x Zaal</h1>
          <p className="text-white/60 text-sm">
            ZAO Devz action tracker - last updated {new Date(doc.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/60">
            signed in as <span className="text-white font-medium">{user}</span>
          </span>
          <form action={logout}>
            <button className="text-sm rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="rounded-2xl bg-zao-ink border border-white/10 p-5">
        <h2 className="text-lg font-semibold mb-3">Add new item</h2>
        <NewItemForm />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Open items ({open.length})</h2>
        </div>
        <div className="space-y-3">
          {open.map((it) => (
            <ItemCard key={it.id} item={it} />
          ))}
          {open.length === 0 && (
            <p className="text-white/50 text-sm">No open items. Nice.</p>
          )}
        </div>
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Done ({done.length})</h2>
          <div className="space-y-3 opacity-70">
            {done.map((it) => (
              <ItemCard key={it.id} item={it} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function NewItemForm() {
  return (
    <form action={createItem} className="grid gap-3 md:grid-cols-6">
      <input
        name="title"
        required
        placeholder="Title"
        className="md:col-span-3 rounded-lg bg-black/40 border border-white/10 px-3 py-2"
      />
      <input
        name="owner"
        placeholder="Owner"
        className="rounded-lg bg-black/40 border border-white/10 px-3 py-2"
      />
      <select
        name="status"
        defaultValue="TODO"
        className="rounded-lg bg-black/40 border border-white/10 px-3 py-2"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        name="due"
        placeholder="Due (e.g. 2026-05-13)"
        className="rounded-lg bg-black/40 border border-white/10 px-3 py-2"
      />
      <textarea
        name="notes"
        placeholder="Notes"
        rows={2}
        className="md:col-span-6 rounded-lg bg-black/40 border border-white/10 px-3 py-2"
      />
      <button className="md:col-span-6 rounded-lg bg-zao-accent hover:bg-blue-500 px-4 py-2 font-medium">
        Add item
      </button>
    </form>
  );
}

function ItemCard({ item }: { item: ActionItem }) {
  return (
    <details className="group rounded-xl bg-zao-ink border border-white/10 p-4">
      <summary className="flex items-start gap-3 cursor-pointer list-none">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[item.status]}`}
        >
          {item.status}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium">{item.title}</div>
          <div className="text-xs text-white/50 mt-0.5">
            {item.owner || "unassigned"} - {item.due || "no due"} - #{item.id}
          </div>
        </div>
        <form action={quickStatus} className="flex items-center gap-1">
          <input type="hidden" name="id" value={item.id} />
          <select
            name="status"
            defaultValue={item.status}
            className="text-xs rounded bg-black/40 border border-white/10 px-2 py-1"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="text-xs rounded border border-white/10 px-2 py-1 hover:bg-white/5">
            set
          </button>
        </form>
      </summary>
      {item.notes && (
        <p className="mt-3 text-sm text-white/70 whitespace-pre-wrap">{item.notes}</p>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-6">
        <form action={updateItem} className="contents">
          <input type="hidden" name="id" value={item.id} />
          <input
            name="title"
            defaultValue={item.title}
            className="md:col-span-3 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          />
          <input
            name="owner"
            defaultValue={item.owner}
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          />
          <select
            name="status"
            defaultValue={item.status}
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            name="due"
            defaultValue={item.due}
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          />
          <textarea
            name="notes"
            defaultValue={item.notes}
            rows={2}
            className="md:col-span-6 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          />
          <button className="md:col-span-5 rounded-lg bg-zao-accent hover:bg-blue-500 px-3 py-2 text-sm font-medium">
            Save edits
          </button>
        </form>
        <form action={deleteItem}>
          <input type="hidden" name="id" value={item.id} />
          <button className="w-full rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 px-3 py-2 text-sm">
            Delete
          </button>
        </form>
      </div>
    </details>
  );
}
