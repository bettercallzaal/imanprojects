"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, requireSession } from "@/lib/auth";
import {
  getActions,
  saveActions,
  newId,
  type ActionItem,
  type ActionStatus,
} from "@/lib/data";

const STATUSES: ActionStatus[] = ["TODO", "WIP", "BLOCKED", "DONE"];

function asStatus(v: unknown): ActionStatus {
  return STATUSES.includes(v as ActionStatus) ? (v as ActionStatus) : "TODO";
}

function toItem(form: FormData, id: string): ActionItem {
  return {
    id,
    title: String(form.get("title") ?? "").trim(),
    owner: String(form.get("owner") ?? "").trim(),
    status: asStatus(form.get("status")),
    due: String(form.get("due") ?? "").trim(),
    notes: String(form.get("notes") ?? "").trim(),
  };
}

export async function createItem(form: FormData): Promise<void> {
  const user = await requireSession();
  const doc = await getActions();
  const id = newId(doc.items);
  const item = toItem(form, id);
  if (!item.title) return;
  doc.items.push(item);
  await saveActions(doc, user, `add #${id} ${item.title.slice(0, 40)}`);
  revalidatePath("/");
}

export async function updateItem(form: FormData): Promise<void> {
  const user = await requireSession();
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const doc = await getActions();
  const idx = doc.items.findIndex((x) => x.id === id);
  if (idx < 0) return;
  doc.items[idx] = toItem(form, id);
  await saveActions(doc, user, `edit #${id}`);
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

export async function quickStatus(form: FormData): Promise<void> {
  const user = await requireSession();
  const id = String(form.get("id") ?? "");
  const status = asStatus(form.get("status"));
  if (!id) return;
  const doc = await getActions();
  const idx = doc.items.findIndex((x) => x.id === id);
  if (idx < 0) return;
  doc.items[idx] = { ...doc.items[idx], status };
  await saveActions(doc, user, `status #${id} -> ${status}`);
  revalidatePath("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
