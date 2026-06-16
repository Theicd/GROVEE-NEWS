/// <reference lib="webworker" />

import { pipeline, env } from "@huggingface/transformers";
import { parseExpansionOutput, parseSummarizerOutput, parseTranslateOutput } from "./prompts";
import { isWebGpuFailure } from "./webgpuErrors";

const MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";

env.allowLocalModels = false;
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let generator: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loading: Promise<any> | null = null;
let activeDevice: "WEBGPU" | "WASM" = "WEBGPU";
let preferredDevice: "webgpu" | "wasm" = "webgpu";

/** Serialize inference — concurrent OrtRun on WebGPU corrupts GPU buffers. */
let inferenceTail = Promise.resolve();

const post = (data: unknown) => self.postMessage(data);

type HfProgress = {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

function progressFromHf(p: HfProgress): { pct: number; loaded: number; total: number; message: string } {
  const loaded = typeof p.loaded === "number" ? p.loaded : 0;
  const total = typeof p.total === "number" ? p.total : 0;
  let pct = 0;
  if (loaded > 0 && total > 0) {
    pct = Math.round((loaded / total) * 100);
  } else if (typeof p.progress === "number") {
    pct = p.progress <= 1 ? Math.round(p.progress * 100) : Math.round(p.progress);
  }
  const file = p.file ? p.file.split("/").pop() ?? p.file : "";
  const message = file ? `Downloading ${file}` : "Loading model weights…";
  return { pct, loaded, total, message };
}

function makeProgressCallback(device: string) {
  return (p: HfProgress) => {
    const st = p.status ?? "";
    if (st === "progress" || st === "progress_total" || st === "download") {
      const { pct, loaded, total, message } = progressFromHf(p);
      post({ type: "progress", message, pct, loaded, total, device });
    }
    if (st === "initiate") {
      post({ type: "progress", message: "Preparing model files…", pct: 1, device });
    }
  };
}


function withInferenceLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = inferenceTail.then(() => fn());
  inferenceTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function unloadGenerator(): Promise<void> {
  generator = null;
  loading = null;
}

async function loadOnDevice(device: "webgpu" | "wasm") {
  activeDevice = device === "webgpu" ? "WEBGPU" : "WASM";
  post({ type: "progress", message: `Initializing on ${activeDevice}…`, pct: 2, device: activeDevice });
  const pipe = await pipeline("text-generation", MODEL_ID, {
    device,
    dtype: "q4",
    progress_callback: makeProgressCallback(activeDevice),
  });
  generator = pipe;
  post({ type: "progress", message: "Warming up tokenizer…", pct: 98, device: activeDevice });
  return pipe;
}

async function loadGenerator() {
  if (generator) return generator;
  if (loading) return loading;
  loading = (async () => {
    post({
      type: "progress",
      message: "Starting Qwen 2.5 0.5B download…",
      pct: 0,
      device: preferredDevice === "wasm" ? "WASM" : "WEBGPU",
    });
    if (preferredDevice === "wasm") {
      return await loadOnDevice("wasm");
    }
    try {
      return await loadOnDevice("webgpu");
    } catch {
      post({ type: "progress", message: "WebGPU failed — falling back to WASM…", pct: 5, device: "WASM" });
      preferredDevice = "wasm";
      post({ type: "device_switched", device: "WASM", reason: "load_failed" });
      return await loadOnDevice("wasm");
    }
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

async function switchToWasmAfterInferenceFailure(err: unknown): Promise<void> {
  if (activeDevice !== "WEBGPU" || !isWebGpuFailure(err)) {
    throw err;
  }
  post({
    type: "progress",
    message: "WebGPU inference error — reloading on WASM (CPU)…",
    pct: 95,
    device: "WASM",
  });
  preferredDevice = "wasm";
  post({ type: "device_switched", device: "WASM", reason: "inference_failed" });
  await unloadGenerator();
  await loadOnDevice("wasm");
}

async function runGenerate(prompt: string, maxNewTokens = 256): Promise<string> {
  const pipe = await loadGenerator();
  const messages = [
    {
      role: "system",
      content:
        "You are a news intelligence assistant. Always write TITLE_EN, SUMMARY, and FACTS in clear English for the user interface, even when the source article is in another language.",
    },
    { role: "user", content: prompt },
  ];
  const out = await pipe(messages, {
    max_new_tokens: maxNewTokens,
    temperature: 0.25,
    top_p: 0.9,
    do_sample: maxNewTokens > 64,
  });

  if (Array.isArray(out) && out[0]?.generated_text) {
    const gt = out[0].generated_text;
    if (Array.isArray(gt)) {
      const last = gt[gt.length - 1];
      if (last && typeof last === "object" && "content" in last) {
        return String((last as { content: string }).content).trim();
      }
    }
    if (typeof gt === "string") return gt.trim();
  }
  const text = (out as { generated_text?: string })?.generated_text;
  return typeof text === "string" ? text.trim() : "";
}

async function runGenerateSafe(prompt: string, maxNewTokens: number): Promise<string> {
  try {
    return await runGenerate(prompt, maxNewTokens);
  } catch (err) {
    await switchToWasmAfterInferenceFailure(err);
    return await runGenerate(prompt, Math.min(maxNewTokens, 220));
  }
}

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data as {
    type: string;
    articleText?: string;
    query?: string;
    title?: string;
    body?: string;
    requestId?: string;
    device?: "webgpu" | "wasm";
  };

  try {
    if (msg.type === "init") {
      if (msg.device === "webgpu" || msg.device === "wasm") {
        preferredDevice = msg.device;
      }
      void loadGenerator()
        .then(() => post({ type: "ready", device: activeDevice }))
        .catch((err) => post({ type: "error", message: err instanceof Error ? err.message : String(err) }));
      return;
    }

    if (msg.type === "translate" && msg.requestId) {
      await withInferenceLock(async () => {
        const raw = await runGenerateSafe(
          `Translate this news to English.\n\nTITLE_EN: English headline\nSUMMARY: 1-2 English sentences\n\nHeadline:\n${msg.title}\n\nSnippet:\n${(msg.body ?? "").slice(0, 1200)}`,
          140,
        );
        post({
          type: "translate_done",
          requestId: msg.requestId!,
          result: parseTranslateOutput(raw),
        });
      });
      return;
    }

    if (msg.type === "summarize" && msg.articleText && msg.requestId) {
      await withInferenceLock(async () => {
        const raw = await runGenerateSafe(msg.articleText!, 280);
        post({
          type: "summarize_done",
          requestId: msg.requestId!,
          result: parseSummarizerOutput(raw),
        });
      });
      return;
    }

    if (msg.type === "expand" && msg.query && msg.requestId) {
      await withInferenceLock(async () => {
        const raw = await runGenerateSafe(msg.query!, 100);
        post({
          type: "expand_done",
          requestId: msg.requestId!,
          keywords: parseExpansionOutput(raw),
        });
      });
      return;
    }
  } catch (err) {
    post({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
      requestId: msg.requestId,
    });
  }
};
