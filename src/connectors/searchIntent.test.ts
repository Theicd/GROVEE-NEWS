import { describe, expect, it } from "vitest";
import {
  githubResultLimit,
  githubSearchTerms,
  hfSearchTerms,
  parseGithubRepoRef,
  parseHfModelRef,
  parseHfSpaceRef,
  shouldSearchGithub,
  shouldSearchHf,
} from "./searchIntent";

describe("searchIntent — strict site gating", () => {
  it("parses GitHub URL only with explicit github context", () => {
    expect(parseGithubRepoRef("https://github.com/langchain-ai/langchain")).toBe("langchain-ai/langchain");
    expect(parseGithubRepoRef("facebook/react")).toBeNull();
    expect(parseGithubRepoRef("github facebook/react")).toBe("facebook/react");
  });

  it("does not call GitHub for news or generic dev queries", () => {
    expect(shouldSearchGithub("trump war ukraine")).toBe(false);
    expect(shouldSearchGithub("react chat ui library")).toBe(false);
    expect(shouldSearchGithub("open source llm agent")).toBe(false);
    expect(shouldSearchGithub("facebook/react")).toBe(false);
  });

  it("calls GitHub only when github is mentioned or URL is pasted", () => {
    expect(shouldSearchGithub("github react chat ui")).toBe(true);
    expect(shouldSearchGithub("find repos on github for rag")).toBe(true);
    expect(shouldSearchGithub("https://github.com/vercel/next.js")).toBe(true);
  });

  it("does not call HF without huggingface / hug", () => {
    expect(shouldSearchHf("llama 3 model")).toBe(false);
    expect(shouldSearchHf("diffusion checkpoint")).toBe(false);
    expect(shouldSearchHf("trump election")).toBe(false);
  });

  it("calls HF only when huggingface / hug / URL is mentioned", () => {
    expect(shouldSearchHf("huggingface llama chat model")).toBe(true);
    expect(shouldSearchHf("hug diffusion space")).toBe(true);
    expect(shouldSearchHf("https://huggingface.co/meta-llama/Llama-3.2-1B")).toBe(true);
    expect(shouldSearchHf("huggingface spaces gradio chatbot")).toBe(true);
  });

  it("parses HF model and space refs", () => {
    expect(parseHfModelRef("huggingface meta-llama/Llama-3.2-1B")).toBe("meta-llama/Llama-3.2-1B");
    expect(parseHfSpaceRef("huggingface space gradio-apps/chatbot")).toBe("gradio-apps/chatbot");
  });

  it("strips site keywords from API search terms", () => {
    expect(githubSearchTerms("github react ui library")).toBe("react ui library");
    expect(hfSearchTerms("huggingface llama chat model")).toMatch(/llama chat/);
  });

  it("uses single-result limit for direct refs", () => {
    expect(githubResultLimit("github vercel/next.js")).toBe(1);
    expect(githubResultLimit("github react framework")).toBe(8);
  });
});
