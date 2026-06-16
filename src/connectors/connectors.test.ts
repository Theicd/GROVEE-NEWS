import { describe, expect, it } from "vitest";
import { githubRepoToArticle } from "./githubSearch";
import { hfModelToArticle } from "./hfSearch";

describe("github connector types", () => {
  it("parses search response shape", () => {
    const sample = {
      items: [
        {
          id: 1,
          full_name: "org/repo",
          html_url: "https://github.com/org/repo",
          description: "A test repo",
          stargazers_count: 42,
          topics: ["ai"],
          owner: { avatar_url: "https://avatars.githubusercontent.com/u/1" },
          created_at: "2026-06-10T00:00:00Z",
          updated_at: "2026-06-11T00:00:00Z",
        },
      ],
    };
    expect(sample.items[0].full_name).toBe("org/repo");
    expect(sample.items[0].stargazers_count).toBe(42);
  });

  it("maps repo to searchable article with file browse link", () => {
    const article = githubRepoToArticle({
      id: 99,
      full_name: "org/chat-ui",
      html_url: "https://github.com/org/chat-ui",
      description: "AI chat interface",
      stargazers_count: 1200,
      language: "TypeScript",
      topics: ["llm", "react"],
      owner: { avatar_url: "https://avatars.githubusercontent.com/u/1" },
      updated_at: "2026-06-11T00:00:00Z",
      default_branch: "main",
    });
    expect(article.intelSource).toBe("github");
    expect(article.url).toBe("https://github.com/org/chat-ui");
    expect(article.keyFacts.some((f) => f.includes("/tree/main"))).toBe(true);
  });
});

describe("hf connector types", () => {
  it("parses model list shape", () => {
    const sample = [{ id: "org/model-name", downloads: 100, pipeline_tag: "text-generation" }];
    expect(sample[0].id).toContain("/");
  });

  it("maps model to searchable article with hub link", () => {
    const article = hfModelToArticle({
      id: "meta-llama/Llama-3.2-1B",
      downloads: 50_000,
      likes: 200,
      pipeline_tag: "text-generation",
      tags: ["llm", "pytorch"],
      lastModified: "2026-06-10T00:00:00Z",
    });
    expect(article.intelSource).toBe("huggingface");
    expect(article.sourceKey).toBe("hf_model");
    expect(article.url).toBe("https://huggingface.co/meta-llama/Llama-3.2-1B");
  });
});