export type ActionStatus = "TODO" | "WIP" | "BLOCKED" | "DONE";
export const STATUSES: ActionStatus[] = ["TODO", "WIP", "BLOCKED", "DONE"];

export type Priority = "P1" | "P2" | "P3";
export const PRIORITIES: Priority[] = ["P1", "P2", "P3"];

export type Phase = "Define" | "Measure" | "Analyze" | "Improve" | "Control";
export const PHASES: Phase[] = ["Define", "Measure", "Analyze", "Improve", "Control"];

export type Category =
  | "ZAO Devz"
  | "Site / Tech"
  | "Ops"
  | "Bounty"
  | "Other"
  | "WaveWarZ Zambia"
  | "Recording"
  | "Distribution"
  | "Release"
  | "Artist Onboarding"
  | "Social"
  | "Brand"
  | "Content"
  | "Campaigns";

export const CATEGORIES: Category[] = [
  "ZAO Devz", "Site / Tech", "Ops", "Bounty", "Other",
  "WaveWarZ Zambia", "Recording", "Distribution", "Release", "Artist Onboarding",
  "Social", "Brand", "Content", "Campaigns",
];

export const DEV_CATEGORIES: string[] = ["ZAO Devz", "Site / Tech", "Ops", "Bounty", "Other"];
export const MUSIC_CATEGORIES: string[] = ["WaveWarZ Zambia", "Recording", "Distribution", "Release", "Artist Onboarding"];
export const MARKETING_CATEGORIES: string[] = ["Social", "Brand", "Content", "Campaigns"];

export type Owner = "Zaal" | "Iman" | "Both";
export const OWNERS: Owner[] = ["Zaal", "Iman", "Both"];

export type ActionItem = {
  id: string;
  title: string;
  createdBy: string;
  owner: Owner | string;
  status: ActionStatus;
  category: Category | string;
  priority: Priority;
  important: boolean;
  urgent: boolean;
  completedAt: string;
  completedBy: string;
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

export function ageDays(createdAt: string): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function cycleDays(
  createdAt: string,
  updatedAt: string,
  status: ActionStatus,
): number | null {
  if (status !== "DONE") return null;
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function isAging(it: ActionItem): boolean {
  if (it.status === "DONE") return false;
  return ageDays(it.createdAt) > 14;
}
