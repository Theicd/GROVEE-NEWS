import { fetchRemoteJson } from "../fetch/remoteJson";
import type { ExternalIntelItem } from "./types";

type GhSearchResponse = {
  items?: GhRepo[];
};

type GhRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  topics?: string[];
  owner?: { avatar_url?: string };
  created_at: string;
  updated_at: string;
};

type GhReadme = {
  content?: string;
  encoding?: string;
};

function decodeReadme(data: GhReadme): string {
  if (!data.content) return "";
  try {
    const raw = data.encoding === "base64" ? atob(data.content.replace(/\n/g, "")) : data.content;
    return raw.slice(0, 5000);
  } catch {
    return "";
  }
}

async function fetchReadme(fullName: string): Promise<string> {
  try {
    const data = await fetchRemoteJson<GhReadme>(
      `https://api.github.com/repos/${fullName}/readme`,
      12_000,
    );
    return decodeReadme(data);
  } catch {
    return "";
  }
}

export async function fetchGithubTrending(limit = 12): Promise<ExternalIntelItem[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const url = `https://api.github.com/search/repositories?q=created:>=${since}+stars:>5&sort=stars&order=desc&per_page=${Math.min(limit, 20)}`;

  const data = await fetchRemoteJson<GhSearchResponse>(url);
  const repos = data.items ?? [];
  const items: ExternalIntelItem[] = [];

  for (const repo of repos.slice(0, limit)) {
    const readme = items.length < 6 ? await fetchReadme(repo.full_name) : "";
    const desc = repo.description?.trim() ?? "";
    const body = [desc, readme, `Topics: ${(repo.topics ?? []).join(", ")}`, `Stars: ${repo.stargazers_count}`]
      .filter(Boolean)
      .join("\n\n");

    const ts = Date.parse(repo.created_at) || Date.now();

    items.push({
      id: `github::${repo.id}`,
      url: repo.html_url,
      title: repo.full_name,
      description: desc,
      bodyText: body || desc || repo.full_name,
      image: repo.owner?.avatar_url ?? "",
      source: "GitHub",
      sourceKey: "github_hub",
      feedCategory: "dev",
      publishedTs: ts,
      publishDate: new Date(ts).toISOString(),
      intelSource: "github",
      meta: { stars: repo.stargazers_count },
    });
  }

  return items;
}
