import type { ArticleRecord } from "../types";

export function articleTimestamp(a: ArticleRecord): number {
  if (a.publishedTs > 0) return a.publishedTs;
  const parsed = Date.parse(a.publishDate);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return a.summarizedAt || a.fetchedAt || 0;
}

/** Relative time for feed headers — hour-level freshness */
export function formatRelativeTime(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 45_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatFullDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function isFresh(ts: number, maxHours = 6): boolean {
  if (!ts) return false;
  return Date.now() - ts < maxHours * 60 * 60 * 1000;
}
