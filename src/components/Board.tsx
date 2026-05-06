"use client";

import { useMemo, useState, useTransition } from "react";
import {
  STATUSES,
  PRIORITIES,
  PHASES,
  CATEGORIES,
  OWNERS,
  type ActionItem,
  type ActionStatus,
  type Priority,
  type Phase,
} from "@/lib/data";
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
  "ZAO Devz": "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "WaveWarZ Zambia": "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Social: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  "Site / Tech": "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  Ops: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  Bounty: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  Other: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

function ageDays(createdAt: string): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function cycleDays(it: ActionItem): number | null {
  if (it.status !== "DONE") return null;
  const ms = new Date(it.updatedAt).getTime() - new Date(it.createdAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

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

export function Board({ items, currentUser }: { items: ActionItem[]; currentUser: string }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [activeMobileStatus, setActiveMobileStatus] = useState<ActionStatus>("TODO");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

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
        const pr = PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
        if (pr !== 0) return pr;
        return ageDays(b.createdAt) - ageDays(a.createdAt);
      });
    }
    return map;
  }, [filtered]);

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
      <FilterBar
        filters={filters}
        onChange={setFilters}
        currentUser={currentUser}
        onHelp={() => setHelpOpen(true)}
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
          />
        </div>
      </div>

      {/* desktop: 4 columns */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUSES.map((s) => (
          <Column key={s} status={s} items={byStatus[s]} onEdit={setEditingId} />
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
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  currentUser: string;
  onHelp: () => void;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const me = currentUser.charAt(0).toUpperCase() + currentUser.slice(1);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search title, notes, owner..."
          className="flex-1 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-zao-accent"
        />
        <button
          onClick={onHelp}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
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
          options={["", ...CATEGORIES]}
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
}: {
  status: ActionStatus;
  items: ActionItem[];
  onEdit: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className={`flex items-baseline justify-between border-b pb-1 ${STATUS_HEAD[status]}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider">
          {STATUS_LABEL[status]}
        </h3>
        <span className="text-xs text-white/40">{items.length}</span>
      </div>

      <QuickAddForm status={status} />

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

function QuickAddForm({ status }: { status: ActionStatus }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        fd.set("status", status);
        if (!fd.get("category")) fd.set("category", "Other");
        start(() => quickCreate(fd));
        const titleEl = document.querySelector<HTMLInputElement>(
          `input[data-quick-add="${status}"]`,
        );
        if (titleEl) titleEl.value = "";
      }}
      className="flex gap-1"
    >
      <input
        name="title"
        data-quick-add={status}
        placeholder="+ add item, press Enter"
        className="flex-1 rounded-lg bg-black/30 border border-white/5 px-2.5 py-1.5 text-sm placeholder-white/30 focus:outline-none focus:border-zao-accent/60 focus:bg-black/50"
        disabled={pending}
        required
      />
    </form>
  );
}

function Card({ item, onEdit }: { item: ActionItem; onEdit: (id: string) => void }) {
  const [pending, start] = useTransition();
  const age = ageDays(item.createdAt);
  const cyc = cycleDays(item);
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
            card to cycle P1 -> P2 -> P3.
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
