import { fetchRemoteJson } from "../fetch/remoteJson";
import type { ExternalIntelItem } from "./types";

type HfModelSummary = {
  id?: string;
  modelId?: string;
  author?: string;
  downloads?: number;
  likes?: number;
  pipeline_tag?: string;
  tags?: string[];
  lastModified?: string;
};

type HfModelDetail = HfModelSummary & {
  cardData?: { summary?: string; license?: string };
  siblings?: Array<{ rfilename?: string }>;
};

function modelId(m: HfModelSummary): string {
  return m.id ?? m.modelId ?? "";
}

async function fetchModelDetail(id: string): Promise<HfModelDetail | null> {
  try {
    return await fetchRemoteJson<HfModelDetail>(
      `https://huggingface.co/api/models/${encodeURIComponent(id)}`,
      12_000,
    );
  } catch {
    return null;
  }
}

export async function fetchHfNewModels(limit = 12): Promise<ExternalIntelItem[]> {
  const list = await fetchRemoteJson<HfModelSummary[]>(
    `https://huggingface.co/api/models?sort=lastModified&direction=-1&limit=${Math.min(limit + 4, 24)}&full=false`,
  );

  const items: ExternalIntelItem[] = [];

  for (const m of list) {
    if (items.length >= limit) break;
    const id = modelId(m);
    if (!id) continue;

    const detail = items.length < 8 ? await fetchModelDetail(id) : m;
    const card = (detail as HfModelDetail)?.cardData;
    const summary = card?.summary?.trim() ?? "";
    const tags = (detail?.tags ?? m.tags ?? []).slice(0, 8).join(", ");
    const desc = [
      summary,
      detail?.pipeline_tag ? `Pipeline: ${detail.pipeline_tag}` : "",
      tags ? `Tags: ${tags}` : "",
      `Downloads: ${detail?.downloads ?? m.downloads ?? 0}`,
      `Likes: ${detail?.likes ?? m.likes ?? 0}`,
    ]
      .filter(Boolean)
      .join("\n");

    const ts = Date.parse(detail?.lastModified ?? m.lastModified ?? "") || Date.now();
    const url = `https://huggingface.co/${id}`;

    items.push({
      id: `hf::${id.replace(/\//g, "::")}`,
      url,
      title: id,
      description: summary.slice(0, 280) || `New model on Hugging Face — ${detail?.pipeline_tag ?? "model"}`,
      bodyText: desc || id,
      image: `https://huggingface.co/front/assets/huggingface_logo-noborder.svg`,
      source: "Hugging Face Hub",
      sourceKey: "hf_hub",
      feedCategory: "ai",
      publishedTs: ts,
      publishDate: new Date(ts).toISOString(),
      intelSource: "huggingface",
      meta: {
        downloads: detail?.downloads ?? m.downloads ?? 0,
        likes: detail?.likes ?? m.likes ?? 0,
      },
    });
  }

  return items;
}
