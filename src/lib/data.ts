import { promises as fs } from "node:fs";
import path from "node:path";

export type ActionStatus = "TODO" | "WIP" | "BLOCKED" | "DONE";

export const STATUSES: ActionStatus[] = ["TODO", "WIP", "BLOCKED", "DONE"];

export type Priority = "P1" | "P2" | "P3";
export const PRIORITIES: Priority[] = ["P1", "P2", "P3"];

export type Phase = "Define" | "Measure" | "Analyze" | "Improve" | "Control";
export const PHASES: Phase[] = ["Define", "Measure", "Analyze", "Improve", "Control"];

export type Category =
  | "ZAO Devz"
  | "WaveWarZ Zambia"
  | "Social"
  | "Site / Tech"
  | "Ops"
  | "Bounty"
  | "Other";
export const CATEGORIES: Category[] = [
  "ZAO Devz",
  "WaveWarZ Zambia",
  "Social",
  "Site / Tech",
  "Ops",
  "Bounty",
  "Other",
];

export type Owner = "Zaal" | "Iman" | "Both";
export const OWNERS: Owner[] = ["Zaal", "Iman", "Both"];

export type ActionItem = {
  id: string;
  title: string;
  owner: Owner | string;
  status: ActionStatus;
  category: Category | string;
  priority: Priority;
  phase: Phase;
  due: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ActionDoc = {
  updatedAt: string;
  items: ActionItem[];
};

const LOCAL_PATH = path.join(process.cwd(), "data", "actions.json");
const REMOTE_PATH = "data/actions.json";

function ghEnv() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  return { token, repo, branch };
}

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeItem(raw: Partial<ActionItem> & { id: string; title: string }): ActionItem {
  const created = raw.createdAt || nowIso();
  return {
    id: raw.id,
    title: raw.title,
    owner: (raw.owner as string) || "Both",
    status: (raw.status as ActionStatus) || "TODO",
    category: (raw.category as string) || "Other",
    priority: (raw.priority as Priority) || "P2",
    phase: (raw.phase as Phase) || "Define",
    due: raw.due || "",
    notes: raw.notes || "",
    createdAt: created,
    updatedAt: raw.updatedAt || created,
  };
}

function normalizeDoc(doc: ActionDoc): ActionDoc {
  return {
    updatedAt: doc.updatedAt || nowIso(),
    items: (doc.items || []).map((it) => normalizeItem(it as ActionItem)),
  };
}

async function readLocal(): Promise<ActionDoc> {
  const raw = await fs.readFile(LOCAL_PATH, "utf8");
  return normalizeDoc(JSON.parse(raw) as ActionDoc);
}

async function writeLocal(doc: ActionDoc): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, JSON.stringify(doc, null, 2) + "\n", "utf8");
}

type GhFileResp = { content: string; sha: string };

async function readRemote(): Promise<{ doc: ActionDoc; sha: string } | null> {
  const { token, repo, branch } = ghEnv();
  if (!token || !repo) return null;
  const url = `https://api.github.com/repos/${repo}/contents/${REMOTE_PATH}?ref=${branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (res.status === 404) {
    return { doc: { updatedAt: nowIso(), items: [] }, sha: "" };
  }
  if (!res.ok) {
    throw new Error(`GitHub read failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as GhFileResp;
  const decoded = Buffer.from(data.content, "base64").toString("utf8");
  return { doc: normalizeDoc(JSON.parse(decoded) as ActionDoc), sha: data.sha };
}

async function writeRemote(doc: ActionDoc, prevSha: string, message: string): Promise<void> {
  const { token, repo, branch } = ghEnv();
  if (!token || !repo) throw new Error("GitHub env missing");
  const url = `https://api.github.com/repos/${repo}/contents/${REMOTE_PATH}`;
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(JSON.stringify(doc, null, 2) + "\n", "utf8").toString("base64"),
    branch,
  };
  if (prevSha) body.sha = prevSha;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GitHub write failed: ${res.status} ${await res.text()}`);
  }
}

export async function getActions(): Promise<ActionDoc> {
  const remote = await readRemote();
  if (remote) return remote.doc;
  return readLocal();
}

export async function saveActions(
  doc: ActionDoc,
  actor: string,
  summary: string,
): Promise<void> {
  const next: ActionDoc = { ...doc, updatedAt: nowIso() };
  const remote = await readRemote();
  if (remote) {
    await writeRemote(next, remote.sha, `tracker: ${summary} (by ${actor})`);
  } else {
    await writeLocal(next);
  }
}

export function newId(existing: ActionItem[]): string {
  const max = existing.reduce((m, it) => {
    const n = parseInt(it.id, 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return String(max + 1);
}

export function ageDays(createdAt: string): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function cycleDays(createdAt: string, updatedAt: string, status: ActionStatus): number | null {
  if (status !== "DONE") return null;
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function isAging(it: ActionItem): boolean {
  if (it.status === "DONE") return false;
  return ageDays(it.createdAt) > 14;
}
