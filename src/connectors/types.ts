/** Normalized item from API connectors (GitHub, Hugging Face Hub, …). */
export type ExternalIntelItem = {
  id: string;
  url: string;
  title: string;
  description: string;
  bodyText: string;
  image: string;
  source: string;
  sourceKey: string;
  feedCategory: string;
  publishedTs: number;
  publishDate: string;
  intelSource: "github" | "huggingface";
  meta: Record<string, string | number>;
};
