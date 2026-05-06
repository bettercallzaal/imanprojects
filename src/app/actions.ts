"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, requireSession } from "@/lib/auth";
import {
  getActions,
  saveActions,
  newId,
  normalizeItem,
  type ActionItem,
  type ActionStatus,
  type Priority,
  type Phase,
  STATUSES,
  PRIORITIES,
  PHASES,
  CATEGORIES,
} from "@/lib/data";

function asStatus(v: unknown): ActionStatus {
  return STATUSES.includes(v as ActionStatus) ? (v as ActionStatus) : "TODO";
}
function asPriority(v: unknown): Priority {
  return PRIORITIES.includes(v as Priority) ? (v as Priority) : "P2";
}
function asPhase(v: unknown): Phase {
  return PHASES.includes(v as Phase) ? (v as Phase) : "Define";
}
function asCategory(v: unknown): string {
  const s = String(v ?? "Other").trim();
  return CATEGORIES.includes(s as (typeof CATEGORIES)[number]) ? s : "Other";
}

function readForm(form: FormData, id: string, prev?: ActionItem): ActionItem {
  const now = new Date().toISOString();
  return normalizeItem({
    id,
    title: String(form.get("title") ?? prev?.title ?? "").trim(),
    owner: String(form.get("owner") ?? prev?.owner ?? "Both").trim(),
    status: asStatus(form.get("status") ?? prev?.status),
    category: asCategory(form.get("category") ?? prev?.category),
    priority: asPriority(form.get("priority") ?? prev?.priority),
    phase: asPhase(form.get("phase") ?? prev?.phase),
    due: String(form.get("due") ?? prev?.due ?? "").trim(),
    notes: String(form.get("notes") ?? prev?.notes ?? "").trim(),
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  });
}

export async function createItem(form: FormData): Promise<void> {
  const user = await requireSession();
  const doc = await getActions();
  const id = newId(doc.items);
  const item = readForm(form, id);
  if (!item.title) return;
  doc.items.push(item);
  await saveActions(doc, user, `add #${id} ${item.title.slice(0, 40)}`);
  revalidatePath("/");
}

export async function quickCreate(form: FormData): Promise<void> {
  const user = await requireSession();
  const title = String(form.get("title") ?? "").trim();
  if (!title) return;
  const doc = await getActions();
  const id = newId(doc.items);
  const status = asStatus(form.get("status"));
  const category = asCategory(form.get("category"));
  const item = readForm(form, id);
  item.title = title;
  item.status = status;
  item.category = category;
  doc.items.push(item);
  await saveActions(doc, user, `quick-add #${id} ${title.slice(0, 40)}`);
  revalidatePath("/");
}

export async function updateItem(form: FormData): Promise<void> {
  const user = await requireSession();
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const doc = await getActions();
  const idx = doc.items.findIndex((x) => x.id === id);
  if (idx < 0) return;
  doc.items[idx] = readForm(form, id, doc.items[idx]);
  await saveActions(doc, user, `edit #${id}`);
  revalidatePath("/");
}

export async function patchField(form: FormData): Promise<void> {
  const user = await requireSession();
  const id = String(form.get("id") ?? "");
  const field = String(form.get("field") ?? "");
  const value = String(form.get("value") ?? "");
  if (!id || !field) return;
  const doc = await getActions();
  const idx = doc.items.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const cur = doc.items[idx];
  const next: ActionItem = { ...cur, updatedAt: new Date().toISOString() };
  switch (field) {
    case "title":
      next.title = value.trim();
      break;
    case "owner":
      next.owner = value.trim() || "Both";
      break;
    case "status":
      next.status = asStatus(value);
      break;
    case "category":
      next.category = asCategory(value);
      break;
    case "priority":
      next.priority = asPriority(value);
      break;
    case "phase":
      next.phase = asPhase(value);
      break;
    case "due":
      next.due = value.trim();
      break;
    case "notes":
      next.notes = value.trim();
      break;
    default:
      return;
  }
  doc.items[idx] = next;
  await saveActions(doc, user, `${field} #${id}`);
  revalidatePath("/");
}

export async function deleteItem(form: FormData): Promise<void> {
  const user = await requireSession();
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const doc = await getActions();
  doc.items = doc.items.filter((x) => x.id !== id);
  await saveActions(doc, user, `delete #${id}`);
  revalidatePath("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
