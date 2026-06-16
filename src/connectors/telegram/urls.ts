export function buildChannelPreviewUrl(channel: string): string {
  const name = channel.replace(/^@/, "").trim();
  return `https://t.me/s/${name}`;
}

export function buildChannelSearchUrl(channel: string, query: string): string {
  const base = buildChannelPreviewUrl(channel);
  const q = query.trim();
  if (!q) return base;
  return `${base}?q=${encodeURIComponent(q)}`;
}
