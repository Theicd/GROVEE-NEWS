/**
 * Strict live-API gating: call GitHub / Hugging Face only when the user
 * explicitly names the site or pastes its URL — never for generic dev/news queries.
 */

const GH_URL = /github\.com\/([\w.-]+)\/([\w.-]+)/i;

const HF_SPACE_URL = /huggingface\.co\/spaces\/([\w.-]+\/[\w.-]+)/i;
const HF_MODEL_URL = /huggingface\.co\/(?!spaces\/)([\w.-]+\/[\w.-]+)/i;

function mentionsGithub(query: string): boolean {
  return /\bgithub\b/i.test(query) || GH_URL.test(query);
}

function mentionsHuggingface(query: string): boolean {
  return (
    /\b(huggingface|hugging\s*face)\b/i.test(query) ||
    /\bhf\s+hub\b/i.test(query) ||
    /\bhug\b/i.test(query) ||
    HF_SPACE_URL.test(query) ||
    HF_MODEL_URL.test(query)
  );
}

/** Repo slug only when GitHub is explicitly requested or URL is present. */
export function parseGithubRepoRef(query: string): string | null {
  const q = query.trim();
  const urlMatch = q.match(GH_URL);
  if (urlMatch) {
    return `${urlMatch[1]}/${urlMatch[2]}`.replace(/\.git$/i, "");
  }
  if (!mentionsGithub(q)) return null;
  const slugMatch = q.match(/\b([\w.-]+\/[\w.-]+)\b/);
  return slugMatch?.[1] ?? null;
}

export function parseHfModelRef(query: string): string | null {
  const q = query.trim();
  const urlMatch = q.match(HF_MODEL_URL);
  if (urlMatch) return urlMatch[1];
  if (!mentionsHuggingface(q)) return null;
  if (/\bspaces?\b/i.test(q)) return null;
  const slugMatch = q.match(/\b([\w.-]+\/[\w.-]+)\b/);
  return slugMatch?.[1] ?? null;
}

export function parseHfSpaceRef(query: string): string | null {
  const q = query.trim();
  const urlMatch = q.match(HF_SPACE_URL);
  if (urlMatch) return urlMatch[1];
  if (!mentionsHuggingface(q)) return null;
  const spaceMatch = q.match(/\bspaces?\s+([\w.-]+\/[\w.-]+)\b/i);
  if (spaceMatch) return spaceMatch[1];
  return null;
}

export function shouldSearchGithub(query: string): boolean {
  const q = query.trim();
  return q.length > 0 && mentionsGithub(q);
}

export function shouldSearchHf(query: string): boolean {
  const q = query.trim();
  return q.length > 0 && mentionsHuggingface(q);
}

/** Strip site keywords so API search uses the actual topic. */
export function githubSearchTerms(query: string): string {
  const stripped = query
    .replace(GH_URL, "$1 $2")
    .replace(/\bhttps?:\/\//gi, "")
    .replace(/\bgithub\.com\b/gi, "")
    .replace(/\b(github|repository|repositories|repo)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || query.trim();
}

export function hfSearchTerms(query: string): string {
  const stripped = query
    .replace(HF_SPACE_URL, "$1")
    .replace(HF_MODEL_URL, "$1")
    .replace(/\bhttps?:\/\/huggingface\.co\/?/gi, "")
    .replace(/\b(huggingface|hugging\s*face|hf\s+hub|hug)\b/gi, " ")
    .replace(/\b(space|spaces|model|models|hub)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || query.trim();
}

export function githubResultLimit(query: string): number {
  return parseGithubRepoRef(query) ? 1 : 8;
}

export function hfResultLimit(query: string): number {
  if (parseHfModelRef(query) || parseHfSpaceRef(query)) return 1;
  return 8;
}

export function wantsHfSpaces(query: string): boolean {
  return /\b(space|spaces|gradio|streamlit|demo|app)\b/i.test(query);
}

export function wantsHfModels(query: string): boolean {
  return /\b(model|models|checkpoint|lora|gguf|weights)\b/i.test(query) || !wantsHfSpaces(query);
}
