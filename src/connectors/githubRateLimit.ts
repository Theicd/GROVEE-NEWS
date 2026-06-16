/** Client-side cooldown after GitHub 403 / rate-limit responses. */

let cooldownUntil = 0;

export function isGithubApiPaused(): boolean {
  return Date.now() < cooldownUntil;
}

export function pauseGithubApi(minutes = 15): void {
  cooldownUntil = Date.now() + minutes * 60 * 1000;
}

export function githubApiPausedMinutesLeft(): number {
  if (!isGithubApiPaused()) return 0;
  return Math.ceil((cooldownUntil - Date.now()) / 60_000);
}

export function isGithubRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /HTTP 403|HTTP 429|rate limit|secondary rate/i.test(msg);
}
