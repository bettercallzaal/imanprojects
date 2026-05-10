"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  STATUSES,
  PRIORITIES,
  PHASES,
  CATEGORIES,
  OWNERS,
  ageDays,
  cycleDays,
  type ActionItem,
  type ActionStatus,
  type Owner,
  type Priority,
} from "@/lib/types";
import {
  quickCreate,
  patchField,
  updateItem,
  deleteItem,
} from "@/app/actions";

const STATUS_LABEL: Record<ActionStatus, string> = {
  TODO: "TO DO",
  WIP: "IN PROGRESS",
  BLOCKED: "BLOCKED",
  DONE: "DONE",
};

const STATUS_HEAD: Record<ActionStatus, string> = {
  TODO: "border-slate-500/40 text-slate-300",
  WIP: "border-amber-500/50 text-amber-300",
  BLOCKED: "border-red-500/50 text-red-300",
  DONE: "border-emerald-500/50 text-emerald-300",
};

const PRIORITY_DOT: Record<Priority, string> = {
  P1: "bg-red-500",
  P2: "bg-amber-400",
  P3: "bg-emerald-400",
};

const OWNER_BADGE: Record<string, string> = {
  Zaal: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  Iman: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  Both: "bg-slate-500/20 text-slate-200 border-slate-500/40",
};

const CATEGORY_COLOR: Record<string, string> = {
  // Dev
  "ZAO Devz": "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "Site / Tech": "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  Ops: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  Bounty: "bg-lime-500/15 text-lime-300 border-lime-500/30",
  Other: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  // Music
  "WaveWarZ Zambia": "bg-violet-500/15 text-violet-300 border-violet-500/30",
  Recording: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Distribution: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  Release: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  "Artist Onboarding": "bg-rose-500/15 text-rose-300 border-rose-500/30",
  // Marketing
  Social: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Brand: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Content: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  Campaigns: "bg-red-500/15 text-red-300 border-red-500/30",
};

function ownerInitial(o: string): string {
  if (!o) return "?";
  if (o === "Both") return "Z+I";
  return o.slice(0, 1).toUpperCase();
}

type Filters = {
  search: string;
  owner: string;
  category: string;
  priority: string;
  phase: string;
  mineOnly: boolean;
  agingOnly: boolean;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  owner: "",
  category: "",
  priority: "",
  phase: "",
  mineOnly: false,
  agingOnly: false,
};

function parseDueDate(raw: string): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

const TOUR_STEPS: Array<{ title: string; lines: string[] }> = [
  {
    title: "Welcome to The Zao Co-Works",
    lines: [
      "This is your shared action tracker with your co-worker.",
      "You can add tasks, assign responsibility, set priority + tags, and track progress.",
    ],
  },
  {
    title: "Add tasks (fast)",
    lines: [
      "Use the “+ add item” box at the top of any column and press Enter.",
      "Set Responsible, Priority, and Important/Urgent tags before submitting.",
    ],
  },
  {
    title: "Move tasks",
    lines: [
      "Use the status dropdown on each card to move it across columns.",
      "Mark a task DONE when it’s complete.",
    ],
  },
  {
    title: "Edit details",
    lines: [
      "Click the task title or “edit” to open full edit mode.",
      "Set owner, status, category, priority, tags, DMAIC phase, due date, and notes.",
    ],
  },
  {
    title: "Work smart",
    lines: [
      "Use filters at the top (Mine, Aging, Owner, Category, Priority, DMAIC).",
      "Tasks sort by tags first: Important+Urgent → Urgent → Important → others.",
    ],
  },
];

export function Board({
  items,
  currentUser,
  portalCategories,
  defaultCategory,
}: {
  items: ActionItem[];
  currentUser: string;
  portalCategories: string[];
  defaultCategory: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [activeMobileStatus, setActiveMobileStatus] = useState<ActionStatus>("TODO");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  const prevById = useRef<Map<string, ActionItem>>(new Map());

  const userLabel =
    currentUser.trim().toLowerCase() === "zaal"
      ? "Zaal"
      : currentUser.trim().toLowerCase() === "iman"
      ? "Iman"
      : currentUser;
  const storageUserKey = userLabel.trim().toLowerCase() || "user";
  const todayKey = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), 120_000);
    return () => window.clearInterval(id);
  }, [router]);

  useEffect(() => {
    const key = `zao-cowork-welcome-v1:${storageUserKey}`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key) === "1") return;
    setWelcomeOpen(true);
  }, [storageUserKey]);

  useEffect(() => {
    const lastSeenKey = `zao-cowork-last-seen:${storageUserKey}`;
    const lastSeenRaw = typeof window === "undefined" ? "" : window.localStorage.getItem(lastSeenKey) || "";
    const lastSeenMs = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0;

    const mine = storageUserKey;
    const openMine = items.filter((it) => {
      if (it.status === "DONE") return false;
      const o = String(it.owner).toLowerCase();
      return o === mine || o === "both";
    });
    const overdueMine = openMine.filter((it) => {
      const due = parseDueDate(it.due);
      if (!due) return false;
      const dueDay = due.toISOString().slice(0, 10);
      return dueDay < todayKey;
    });
    const completedByCoworker = items.filter((it) => {
      if (it.status !== "DONE") return false;
      if (!it.completedAt) return false;
      const doneMs = new Date(it.completedAt).getTime();
      if (!Number.isFinite(doneMs) || doneMs <= lastSeenMs) return false;
      const created = String(it.createdBy || "").toLowerCase();
      const completedBy = String(it.completedBy || "").toLowerCase();
      return created === mine && completedBy && completedBy !== mine;
    });

    const dailyKey = `zao-cowork-daily-v1:${storageUserKey}`;
    const shownFor = typeof window === "undefined" ? "" : window.localStorage.getItem(dailyKey) || "";
    if (shownFor !== todayKey && (openMine.length > 0 || overdueMine.length > 0 || completedByCoworker.length > 0)) {
      setDailyOpen(true);
      window.localStorage.setItem(dailyKey, todayKey);
    }
    window.localStorage.setItem(lastSeenKey, new Date().toISOString());
  }, [items, storageUserKey, todayKey]);

  useEffect(() => {
    const prev = prevById.current;
    const next = new Map<string, ActionItem>();
    for (const it of items) {
      next.set(it.id, it);
      const before = prev.get(it.id);
      if (!before) continue;
      if (before.status !== "DONE" && it.status === "DONE") {
        const mine = storageUserKey;
        const created = String(it.createdBy || "").toLowerCase();
        const completedBy = String(it.completedBy || "").toLowerCase();
        if (created === mine && completedBy && completedBy !== mine) {
          setToast({
            title: "Task completed",
            message: `${it.owner} completed: ${it.title}`,
          });
        }
      }
    }
    prevById.current = next;
  }, [items, storageUserKey]);

  const tagBucket = (it: ActionItem): number => {
    if (it.important && it.urgent) return 0;
    if (it.urgent) return 1;
    if (it.important) return 2;
    return 3;
  };

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return items.filter((it) => {
      if (q) {
        const hay = `${it.title} ${it.notes} ${it.category} ${it.owner}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.owner && it.owner !== filters.owner) return false;
      if (filters.category && it.category !== filters.category) return false;
      if (filters.priority && it.priority !== filters.priority) return false;
      if (filters.phase && it.phase !== filters.phase) return false;
      if (filters.mineOnly) {
        const mine = currentUser.toLowerCase();
        const o = String(it.owner).toLowerCase();
        if (o !== mine && o !== "both") return false;
      }
      if (filters.agingOnly && it.status !== "DONE") {
        if (ageDays(it.createdAt) <= 14) return false;
      } else if (filters.agingOnly && it.status === "DONE") {
        return false;
      }
      return true;
    });
  }, [items, filters, currentUser]);

  const byStatus = useMemo(() => {
    const map: Record<ActionStatus, ActionItem[]> = {
      TODO: [],
      WIP: [],
      BLOCKED: [],
      DONE: [],
    };
    for (const it of filtered) map[it.status].push(it);
    for (const s of STATUSES) {
      map[s].sort((a, b) => {
        const tb = tagBucket(a) - tagBucket(b);
        if (tb !== 0) return tb;
        const pr = PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
        if (pr !== 0) return pr;
        return ageDays(b.createdAt) - ageDays(a.createdAt);
      });
    }
    return map;
  }, [filtered, tagBucket]);

  const editingItem = items.find((x) => x.id === editingId) || null;
  const filtersActive =
    filters.search ||
    filters.owner ||
    filters.category ||
    filters.priority ||
    filters.phase ||
    filters.mineOnly ||
    filters.agingOnly;

  return (
    <div className="space-y-4">
      {welcomeOpen && (
        <WelcomeModal
          userLabel={userLabel}
          onClose={() => {
            window.localStorage.setItem(`zao-cowork-welcome-v1:${storageUserKey}`, "1");
            setWelcomeOpen(false);
          }}
          onTour={() => {
            window.localStorage.setItem(`zao-cowork-welcome-v1:${storageUserKey}`, "1");
            setWelcomeOpen(false);
            setTourStep(0);
            setTourOpen(true);
          }}
        />
      )}
      {tourOpen && (
        <TourModal
          step={tourStep}
          onClose={() => setTourOpen(false)}
          onBack={() => setTourStep((s) => Math.max(0, s - 1))}
          onNext={() => setTourStep((s) => Math.min(TOUR_STEPS.length - 1, s + 1))}
        />
      )}
      {dailyOpen && (
        <DailyReminderModal
          userLabel={userLabel}
          items={items}
          todayKey={todayKey}
          storageUserKey={storageUserKey}
          onClose={() => setDailyOpen(false)}
        />
      )}
      {toast && <Toast title={toast.title} message={toast.message} onClose={() => setToast(null)} />}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        currentUser={currentUser}
        onHelp={() => setHelpOpen(true)}
        portalCategories={portalCategories}
      />

      {filtersActive && (
        <div className="text-xs text-white/50">
          showing {filtered.length} of {items.length} items
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="ml-3 underline hover:text-white/80"
          >
            clear filters
          </button>
        </div>
      )}

      {/* mobile: status tabs + single column */}
      <div className="md:hidden">
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-zao-ink p-1 border border-white/10">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setActiveMobileStatus(s)}
              className={`px-2 py-1.5 text-xs rounded-md transition ${
                activeMobileStatus === s
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white/90"
              }`}
            >
              {STATUS_LABEL[s]}
              <span className="ml-1 opacity-60">({byStatus[s].length})</span>
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Column
            status={activeMobileStatus}
            items={byStatus[activeMobileStatus]}
            onEdit={setEditingId}
            currentUser={currentUser}
            defaultCategory={defaultCategory}
          />
        </div>
      </div>

      {/* desktop: 4 columns */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUSES.map((s) => (
          <Column
            key={s}
            status={s}
            items={byStatus[s]}
            onEdit={setEditingId}
            currentUser={currentUser}
            defaultCategory={defaultCategory}
          />
        ))}
      </div>

      {editingItem && (
        <EditModal
          item={editingItem}
          onClose={() => setEditingId(null)}
        />
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function FilterBar({
  filters,
  onChange,
  currentUser,
  onHelp,
  portalCategories,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  currentUser: string;
  onHelp: () => void;
  portalCategories: string[];
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const me = currentUser.charAt(0).toUpperCase() + currentUser.slice(1);
  return (
    <div className="space-y-2 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 p-3">
      <div className="flex gap-2">
        <input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search title, notes, owner..."
          className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-zao-accent"
        />
        <button
          onClick={onHelp}
          className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
          aria-label="Help"
          title="How to use"
        >
          ?
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Pill
          active={filters.mineOnly}
          onClick={() => set({ mineOnly: !filters.mineOnly })}
          label={`Mine (${me})`}
        />
        <Pill
          active={filters.agingOnly}
          onClick={() => set({ agingOnly: !filters.agingOnly })}
          label="Aging > 14d"
          tone="red"
        />
        <Divider />
        <SelectPill
          value={filters.owner}
          onChange={(v) => set({ owner: v })}
          options={["", ...OWNERS]}
          placeholder="Owner"
        />
        <SelectPill
          value={filters.category}
          onChange={(v) => set({ category: v })}
          options={["", ...portalCategories]}
          placeholder="Category"
        />
        <SelectPill
          value={filters.priority}
          onChange={(v) => set({ priority: v })}
          options={["", ...PRIORITIES]}
          placeholder="Priority"
        />
        <SelectPill
          value={filters.phase}
          onChange={(v) => set({ phase: v })}
          options={["", ...PHASES]}
          placeholder="DMAIC phase"
        />
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "red";
}) {
  const base =
    "px-3 py-1 rounded-full text-xs border transition whitespace-nowrap";
  const off = "border-white/10 text-white/60 hover:text-white hover:bg-white/5";
  const onBlue =
    "border-zao-accent/60 bg-zao-accent/15 text-blue-200";
  const onRed = "border-red-500/60 bg-red-500/15 text-red-200";
  const cls = active ? (tone === "red" ? onRed : onBlue) : off;
  return (
    <button onClick={onClick} className={`${base} ${cls}`}>
      {label}
    </button>
  );
}

function Divider() {
  return <span className="text-white/15 px-1 select-none">|</span>;
}

function SelectPill({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-full text-xs px-3 py-1 border whitespace-nowrap ${
        value
          ? "border-zao-accent/60 bg-zao-accent/15 text-blue-200"
          : "border-white/10 bg-transparent text-white/60"
      }`}
    >
      <option value="">{placeholder}</option>
      {options
        .filter((o) => o !== "")
        .map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
    </select>
  );
}

function Column({
  status,
  items,
  onEdit,
  currentUser,
  defaultCategory,
}: {
  status: ActionStatus;
  items: ActionItem[];
  onEdit: (id: string) => void;
  currentUser: string;
  defaultCategory: string;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className={`flex items-baseline justify-between border-b pb-1 ${STATUS_HEAD[status]}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider">
          {STATUS_LABEL[status]}
        </h3>
        <span className="text-xs text-white/40">{items.length}</span>
      </div>

      <QuickAddForm status={status} currentUser={currentUser} defaultCategory={defaultCategory} />

      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <Card key={it.id} item={it} onEdit={onEdit} />
        ))}
        {items.length === 0 && (
          <div className="text-xs text-white/30 italic px-1 py-2">No items.</div>
        )}
      </div>
    </div>
  );
}

function QuickAddForm({ status, currentUser, defaultCategory }: { status: ActionStatus; currentUser: string; defaultCategory: string }) {
  const [pending, start] = useTransition();
  const defaultOwner = ((): Owner => {
    const me = currentUser.trim().toLowerCase();
    if (me === "zaal") return "Zaal";
    if (me === "iman") return "Iman";
    return "Both";
  })();
  const [important, setImportant] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [priority, setPriority] = useState<Priority>("P2");
  const [owner, setOwner] = useState<Owner>(defaultOwner);
  return (
    <form
      action={(fd) => {
        fd.set("status", status);
        if (!fd.get("category")) fd.set("category", defaultCategory);
        fd.set("owner", owner);
        fd.set("priority", priority);
        if (important) fd.set("important", "1");
        if (urgent) fd.set("urgent", "1");
        start(() => quickCreate(fd));
        const titleEl = document.querySelector<HTMLInputElement>(
          `input[data-quick-add="${status}"]`,
        );
        if (titleEl) titleEl.value = "";
        setImportant(false);
        setUrgent(false);
        setPriority("P2");
        setOwner(defaultOwner);
      }}
      className="rounded-xl bg-black/20 border border-white/10 p-2"
    >
      <div className="grid grid-cols-12 gap-2">
        <input
          name="title"
          data-quick-add={status}
          placeholder="+ add item"
          className="col-span-12 lg:col-span-6 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-zao-accent/60 focus:bg-black/50"
          disabled={pending}
          required
        />
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value as Owner)}
          className="col-span-6 lg:col-span-2 rounded-lg bg-black/30 border border-white/10 px-2 py-2 text-sm text-white/80"
          disabled={pending}
          aria-label="Responsible"
          title="Responsible"
        >
          {OWNERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="col-span-6 lg:col-span-1 rounded-lg bg-black/30 border border-white/10 px-2 py-2 text-sm text-white/80"
          disabled={pending}
          aria-label="Priority"
          title="Priority"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="col-span-12 lg:col-span-3 rounded-lg bg-zao-accent hover:bg-blue-500 px-3 py-2 text-sm font-medium transition disabled:opacity-60"
          disabled={pending}
        >
          Enter task
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setImportant((v) => !v)}
          className={`px-2 py-1 rounded-md text-[11px] border transition ${
            important
              ? "border-yellow-400/60 bg-yellow-500/15 text-yellow-200"
              : "border-white/10 text-white/55 hover:text-white/80 hover:bg-white/5"
          }`}
          disabled={pending}
        >
          Important
        </button>
        <button
          type="button"
          onClick={() => setUrgent((v) => !v)}
          className={`px-2 py-1 rounded-md text-[11px] border transition ${
            urgent
              ? "border-red-400/60 bg-red-500/15 text-red-200"
              : "border-white/10 text-white/55 hover:text-white/80 hover:bg-white/5"
          }`}
          disabled={pending}
        >
          Urgent
        </button>
      </div>
    </form>
  );
}

function Card({ item, onEdit }: { item: ActionItem; onEdit: (id: string) => void }) {
  const [pending, start] = useTransition();
  const age = ageDays(item.createdAt);
  const cyc = cycleDays(item.createdAt, item.updatedAt, item.status);
  const aging = item.status !== "DONE" && age > 14;
  const ownerStr = String(item.owner);

  function setField(field: string, value: string) {
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("field", field);
    fd.set("value", value);
    start(() => patchField(fd));
  }

  return (
    <div
      className={`group relative rounded-lg bg-zao-ink border border-white/10 hover:border-white/20 p-3 text-sm transition ${
        pending ? "opacity-60" : ""
      } ${item.status === "DONE" ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          aria-label="Cycle priority"
          title={`Priority ${item.priority} - click to cycle`}
          onClick={() => {
            const next =
              item.priority === "P1" ? "P2" : item.priority === "P2" ? "P3" : "P1";
            setField("priority", next);
          }}
          className={`mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[item.priority]} hover:ring-2 ring-white/30`}
        />
        <button
          onClick={() => onEdit(item.id)}
          className="flex-1 text-left font-medium leading-snug hover:underline decoration-white/30"
        >
          {item.title}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border ${OWNER_BADGE[ownerStr] || OWNER_BADGE.Both}`}
          title={`Owner: ${ownerStr}`}
        >
          {ownerInitial(ownerStr)}
        </span>
        {item.urgent && (
          <span className="px-1.5 py-0.5 rounded text-[10px] border border-red-500/40 text-red-300 bg-red-500/10">
            URGENT
          </span>
        )}
        {item.important && (
          <span className="px-1.5 py-0.5 rounded text-[10px] border border-yellow-500/40 text-yellow-200 bg-yellow-500/10">
            IMPORTANT
          </span>
        )}
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] border ${CATEGORY_COLOR[String(item.category)] || CATEGORY_COLOR.Other}`}
        >
          {item.category}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] border border-white/10 text-white/60"
          title="DMAIC phase"
        >
          {item.phase}
        </span>
        {item.due && (
          <span className="px-1.5 py-0.5 rounded text-[10px] border border-white/10 text-white/60">
            due {item.due}
          </span>
        )}
        {aging && (
          <span className="px-1.5 py-0.5 rounded text-[10px] border border-red-500/40 text-red-300 bg-red-500/10">
            {age}d old
          </span>
        )}
        {cyc !== null && (
          <span className="px-1.5 py-0.5 rounded text-[10px] border border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
            cycle {cyc}d
          </span>
        )}
      </div>

      {item.notes && (
        <p className="mt-2 text-xs text-white/55 line-clamp-2 whitespace-pre-wrap">
          {item.notes}
        </p>
      )}

      <div className="mt-2 flex gap-1">
        <select
          value={item.status}
          onChange={(e) => setField("status", e.target.value)}
          className="flex-1 text-[11px] rounded bg-black/30 border border-white/10 px-1.5 py-1"
          disabled={pending}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          onClick={() => onEdit(item.id)}
          className="text-[11px] rounded border border-white/10 px-2 py-1 text-white/70 hover:bg-white/5"
        >
          edit
        </button>
      </div>
    </div>
  );
}

function EditModal({
  item,
  onClose,
}: {
  item: ActionItem;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-zao-ink border border-white/10 rounded-t-2xl md:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">
            Edit item <span className="text-white/40">#{item.id}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form
          action={(fd) => {
            fd.set("id", item.id);
            start(() => updateItem(fd));
            onClose();
          }}
          className="space-y-3"
        >
          <Field label="Title">
            <input
              name="title"
              defaultValue={item.title}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <select
                name="owner"
                defaultValue={String(item.owner)}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              >
                {OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                name="status"
                defaultValue={item.status}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                name="category"
                defaultValue={String(item.category)}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                name="priority"
                defaultValue={item.priority}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tags">
              <div className="flex flex-wrap gap-2 pt-2">
                <label className="inline-flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    name="important"
                    defaultChecked={item.important}
                    className="h-4 w-4"
                  />
                  Important
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    name="urgent"
                    defaultChecked={item.urgent}
                    className="h-4 w-4"
                  />
                  Urgent
                </label>
              </div>
            </Field>
            <Field label="DMAIC phase">
              <select
                name="phase"
                defaultValue={item.phase}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              >
                {PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due">
              <input
                name="due"
                defaultValue={item.due}
                placeholder="2026-05-13 or 'Wed session'"
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Notes (Customer / success criteria / measurements)">
            <textarea
              name="notes"
              defaultValue={item.notes}
              rows={4}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
            />
          </Field>

          <div className="flex items-center justify-between pt-2">
            <DeleteButton id={item.id} onDone={onClose} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-zao-accent hover:bg-blue-500 px-4 py-2 text-sm font-medium"
                disabled={pending}
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-white/60">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="text-xs text-red-400 hover:text-red-300"
      >
        Delete
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-red-300">Sure?</span>
      <button
        type="button"
        onClick={() => {
          const fd = new FormData();
          fd.set("id", id);
          start(() => deleteItem(fd));
          onDone();
        }}
        className="rounded border border-red-500/40 text-red-300 hover:bg-red-500/10 px-2 py-1"
        disabled={pending}
      >
        Yes, delete
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="text-white/50 hover:text-white/80"
      >
        cancel
      </button>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zao-ink border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">How to use</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
        <ol className="space-y-2 text-sm text-white/80 list-decimal list-inside">
          <li>
            <b className="text-white">Add items</b>: type in the "+ add item" box at top of any
            column, press Enter.
          </li>
          <li>
            <b className="text-white">Move items</b>: click the status dropdown on a card to
            change column.
          </li>
          <li>
            <b className="text-white">Set priority</b>: click the colored dot on the left of any
            card to cycle P1 {"->"} P2 {"->"} P3.
          </li>
          <li>
            <b className="text-white">Edit details</b>: click the title or "edit" to open full
            edit (owner, category, due, notes, etc).
          </li>
          <li>
            <b className="text-white">Filter</b>: use the chips at top. "Mine" shows what's on
            you. "Aging" shows items open more than 14 days.
          </li>
          <li>
            <b className="text-white">Mobile</b>: tap the status tabs at top to switch column.
          </li>
        </ol>
        <h3 className="mt-4 text-xs uppercase tracking-wider text-white/40">Six Sigma cheat</h3>
        <ul className="mt-1 space-y-1 text-xs text-white/70 list-disc list-inside">
          <li>
            <b className="text-white">DMAIC phase</b>: Define -&gt; Measure -&gt; Analyze -&gt;
            Improve -&gt; Control. Quick tasks can stay on Define.
          </li>
          <li>
            <b className="text-white">Notes template</b>: Customer / Success / Measurement.
          </li>
          <li>
            <b className="text-white">WIP limit</b>: aim for 5 active items per person max.
          </li>
        </ul>
        <p className="mt-3 text-xs text-white/40">See SIX-SIGMA.md in the repo for full notes.</p>
      </div>
    </div>
  );
}

function WelcomeModal({
  userLabel,
  onClose,
  onTour,
}: {
  userLabel: string;
  onClose: () => void;
  onTour: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto w-full max-w-md bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Hi {userLabel}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-white/70">
          Welcome to The Zao Co-Works. Want a quick tour of the interface and features?
        </p>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 text-white/70"
          >
            Not now
          </button>
          <button
            onClick={onTour}
            className="rounded-lg bg-zao-accent hover:bg-blue-500 px-4 py-2 text-sm font-medium"
          >
            Yes, tour me
          </button>
        </div>
      </div>
    </div>
  );
}

function TourModal({
  step,
  onClose,
  onBack,
  onNext,
}: {
  step: number;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const s = TOUR_STEPS[Math.max(0, Math.min(TOUR_STEPS.length - 1, step))];
  const last = step >= TOUR_STEPS.length - 1;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto w-full max-w-md bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/45">
            Tour {step + 1} / {TOUR_STEPS.length}
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>
        <h2 className="mt-2 text-base font-semibold">{s.title}</h2>
        <ul className="mt-2 space-y-2 text-sm text-white/75 list-disc list-inside">
          {s.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 text-white/70 disabled:opacity-40"
            disabled={step === 0}
          >
            Back
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 text-white/70"
            >
              Close
            </button>
            <button
              onClick={last ? onClose : onNext}
              className="rounded-lg bg-zao-accent hover:bg-blue-500 px-4 py-2 text-sm font-medium"
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DailyReminderModal({
  userLabel,
  items,
  todayKey,
  storageUserKey,
  onClose,
}: {
  userLabel: string;
  items: ActionItem[];
  todayKey: string;
  storageUserKey: string;
  onClose: () => void;
}) {
  const mine = storageUserKey;
  const openMine = items.filter((it) => {
    if (it.status === "DONE") return false;
    const o = String(it.owner).toLowerCase();
    return o === mine || o === "both";
  });
  const overdueMine = openMine.filter((it) => {
    const due = parseDueDate(it.due);
    if (!due) return false;
    const dueDay = due.toISOString().slice(0, 10);
    return dueDay < todayKey;
  });

  const lastSeenKey = `zao-cowork-last-seen:${storageUserKey}`;
  const lastSeenRaw = typeof window === "undefined" ? "" : window.localStorage.getItem(lastSeenKey) || "";
  const lastSeenMs = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0;
  const completedByCoworker = items.filter((it) => {
    if (it.status !== "DONE") return false;
    if (!it.completedAt) return false;
    const doneMs = new Date(it.completedAt).getTime();
    if (!Number.isFinite(doneMs) || doneMs <= lastSeenMs) return false;
    const created = String(it.createdBy || "").toLowerCase();
    const completedBy = String(it.completedBy || "").toLowerCase();
    return created === mine && completedBy && completedBy !== mine;
  });

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto w-full max-w-md bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Daily check-in</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-white/70">
          Hey {userLabel}, here’s what’s waiting for you today.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-white/45">My open</div>
            <div className="mt-0.5 text-xl font-bold leading-none">{openMine.length}</div>
          </div>
          <div className="rounded-xl bg-black/30 border border-red-500/25 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-white/45">Overdue</div>
            <div className="mt-0.5 text-xl font-bold leading-none text-red-200">
              {overdueMine.length}
            </div>
          </div>
          <div className="rounded-xl bg-black/30 border border-emerald-500/25 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-white/45">Completed</div>
            <div className="mt-0.5 text-xl font-bold leading-none text-emerald-200">
              {completedByCoworker.length}
            </div>
          </div>
        </div>
        {overdueMine.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-white/45">Overdue tasks</div>
            <ul className="mt-2 space-y-1 text-sm text-white/75">
              {overdueMine.slice(0, 5).map((it) => (
                <li key={it.id} className="flex items-baseline justify-between gap-3">
                  <span className="truncate">{it.title}</span>
                  <span className="text-xs text-white/45 whitespace-nowrap">{it.due}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {completedByCoworker.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-white/45">Updates</div>
            <ul className="mt-2 space-y-1 text-sm text-white/75">
              {completedByCoworker.slice(0, 5).map((it) => (
                <li key={it.id} className="truncate">
                  Completed by {it.completedBy || it.owner}: {it.title}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-zao-accent hover:bg-blue-500 px-4 py-2 text-sm font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 7000);
    return () => window.clearTimeout(id);
  }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm">
      <div className="rounded-2xl bg-zao-ink border border-white/10 shadow-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-1 text-sm text-white/70">{message}</div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
