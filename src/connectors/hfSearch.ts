import { fetchRemoteJson } from "../fetch/remoteJson";
import { cacheGet, cacheSet } from "./apiCache";
import {
  hfResultLimit,
  hfSearchTerms,
  parseHfModelRef,
  parseHfSpaceRef,
  wantsHfModels,
  wantsHfSpaces,
} from "./searchIntent";
import type { ArticleRecord } from "../types";

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

type HfSpaceSummary = {
  id?: string;
  author?: string;
  sdk?: string;
  likes?: number;
  tags?: string[];
  lastModified?: string;
  cardData?: { title?: string; short_description?: string };
};

const MODEL_CACHE = "hf_models";
const SPACE_CACHE = "hf_spaces";

function modelId(m: HfModelSummary): string {
  return m.id ?? m.modelId ?? "";
}

export function hfModelToArticle(m: HfModelSummary): ArticleRecord {
  const id = modelId(m);
  const tags = (m.tags ?? []).slice(0, 8);
  const ts = Date.parse(m.lastModified ?? "") || Date.now();
  const url = `https://huggingface.co/${id}`;
  const now = Date.now();

  return {
    id: `hf-live::model::${id.replace(/\//g, "::")}`,
    url,
    source: "Hugging Face · Model",
    sourceKey: "hf_model",
    title: id,
    image: "https://huggingface.co/front/assets/huggingface_logo-noborder.svg",
    publishDate: new Date(ts).toISOString(),
    publishedTs: ts,
    articleText: [
      m.pipeline_tag ? `Pipeline: ${m.pipeline_tag}` : "",
      tags.length ? `Tags: ${tags.join(", ")}` : "",
      `Downloads: ${m.downloads ?? 0}`,
      `Likes: ${m.likes ?? 0}`,
    ]
      .filter(Boolean)
      .join("\n"),
    summary: `${m.pipeline_tag ?? "Model"} — ${(m.downloads ?? 0).toLocaleString()} downloads on Hugging Face Hub`,
    keyFacts: [
      `Type: Model`,
      m.pipeline_tag ? `Pipeline: ${m.pipeline_tag}` : "",
      `⬇ ${(m.downloads ?? 0).toLocaleString()} downloads`,
      `♥ ${m.likes ?? 0} likes`,
      `Model card: ${url}`,
      `Files: ${url}/tree/main`,
      tags.length ? `Tags: ${tags.slice(0, 4).join(", ")}` : "",
    ].filter(Boolean),
    keywords: ["huggingface", "model", ...tags],
    entities: [m.author ?? id.split("/")[0] ?? ""],
    clusterId: `hf-live::model::${id}`,
    confidence: (m.downloads ?? 0) > 10_000 ? "HIGH" : (m.downloads ?? 0) > 500 ? "MEDIUM" : "LOW",
    fetchedAt: now,
    summarizedAt: 0,
    language: "en",
    feedCategory: "ai",
    intelSource: "huggingface",
  };
}

export function hfSpaceToArticle(s: HfSpaceSummary): ArticleRecord {
  const id = s.id ?? "";
  const tags = (s.tags ?? []).slice(0, 8);
  const ts = Date.parse(s.lastModified ?? "") || Date.now();
  const url = `https://huggingface.co/spaces/${id}`;
  const title = s.cardData?.title?.trim() || id;
  const desc = s.cardData?.short_description?.trim() ?? "";
  const now = Date.now();

  return {
    id: `hf-live::space::${id.replace(/\//g, "::")}`,
    url,
    source: "Hugging Face · Space",
    sourceKey: "hf_space",
    title: `${id}${title !== id ? ` — ${title}` : ""}`,
    image: "https://huggingface.co/front/assets/huggingface_logo-noborder.svg",
    publishDate: new Date(ts).toISOString(),
    publishedTs: ts,
    articleText: [desc, s.sdk ? `SDK: ${s.sdk}` : "", tags.length ? `Tags: ${tags.join(", ")}` : ""]
      .filter(Boolean)
      .join("\n"),
    summary: desc || `${s.sdk ?? "App"} Space on Hugging Face — ${s.likes ?? 0} likes`,
    keyFacts: [
      `Type: Space`,
      s.sdk ? `SDK: ${s.sdk}` : "",
      `♥ ${s.likes ?? 0} likes`,
      `Space page: ${url}`,
      `README: ${url}/blob/main/README.md`,
      tags.length ? `Tags: ${tags.slice(0, 4).join(", ")}` : "",
    ].filter(Boolean),
    keywords: ["huggingface", "space", s.sdk ?? "", ...tags],
    entities: [s.author ?? id.split("/")[0] ?? ""],
    clusterId: `hf-live::space::${id}`,
    confidence: (s.likes ?? 0) > 500 ? "HIGH" : (s.likes ?? 0) > 50 ? "MEDIUM" : "LOW",
    fetchedAt: now,
    summarizedAt: 0,
    language: "en",
    feedCategory: "ai",
    intelSource: "huggingface",
  };
}

async function fetchHfModelDirect(fullName: string): Promise<ArticleRecord | null> {
  const key = `model::${fullName.toLowerCase()}`;
  const cached = cacheGet<ArticleRecord>(MODEL_CACHE, key);
  if (cached) return cached;
  try {
    const m = await fetchRemoteJson<HfModelSummary>(
      `https://huggingface.co/api/models/${fullName}`,
      12_000,
    );
    const article = hfModelToArticle(m);
    cacheSet(MODEL_CACHE, key, article);
    return article;
  } catch {
    return null;
  }
}

async function fetchHfSpaceDirect(fullName: string): Promise<ArticleRecord | null> {
  const key = `space::${fullName.toLowerCase()}`;
  const cached = cacheGet<ArticleRecord>(SPACE_CACHE, key);
  if (cached) return cached;
  try {
    const s = await fetchRemoteJson<HfSpaceSummary>(
      `https://huggingface.co/api/spaces/${fullName}`,
      12_000,
    );
    const article = hfSpaceToArticle(s);
    cacheSet(SPACE_CACHE, key, article);
    return article;
  } catch {
    return null;
  }
}

export async function searchHfModels(query: string, limit = 8): Promise<ArticleRecord[]> {
  const terms = hfSearchTerms(query);
  const cacheKey = `q::${terms}::${limit}`;
  const cached = cacheGet<ArticleRecord[]>(MODEL_CACHE, cacheKey);
  if (cached) return cached;

  const url = `https://huggingface.co/api/models?search=${encodeURIComponent(terms)}&sort=downloads&direction=-1&limit=${Math.min(limit, 12)}&full=false`;
  const list = await fetchRemoteJson<HfModelSummary[]>(url, 18_000);
  const items = list.slice(0, limit).map(hfModelToArticle);
  cacheSet(MODEL_CACHE, cacheKey, items);
  return items;
}

export async function searchHfSpaces(query: string, limit = 8): Promise<ArticleRecord[]> {
  const terms = hfSearchTerms(query);
  const cacheKey = `q::${terms}::${limit}`;
  const cached = cacheGet<ArticleRecord[]>(SPACE_CACHE, cacheKey);
  if (cached) return cached;

  const url = `https://huggingface.co/api/spaces?search=${encodeURIComponent(terms)}&sort=likes&direction=-1&limit=${Math.min(limit, 12)}&full=false`;
  const list = await fetchRemoteJson<HfSpaceSummary[]>(url, 18_000);
  const items = list.slice(0, limit).map(hfSpaceToArticle);
  cacheSet(SPACE_CACHE, cacheKey, items);
  return items;
}

/** Models + Spaces — only call when query explicitly mentions Hugging Face. */
export async function searchHfOnDemand(query: string): Promise<ArticleRecord[]> {
  const modelRef = parseHfModelRef(query);
  if (modelRef) {
    const direct = await fetchHfModelDirect(modelRef);
    return direct ? [direct] : [];
  }

  const spaceRef = parseHfSpaceRef(query);
  if (spaceRef) {
    const direct = await fetchHfSpaceDirect(spaceRef);
    return direct ? [direct] : [];
  }

  const limit = hfResultLimit(query);
  const searchModels = wantsHfModels(query);
  const searchSpaces = wantsHfSpaces(query);

  if (searchModels && searchSpaces) {
    const half = Math.max(3, Math.ceil(limit / 2));
    const [models, spaces] = await Promise.all([
      searchHfModels(query, half),
      searchHfSpaces(query, half),
    ]);
    return [...models, ...spaces].slice(0, limit);
  }

  if (searchSpaces) return searchHfSpaces(query, limit);
  return searchHfModels(query, limit);
}
