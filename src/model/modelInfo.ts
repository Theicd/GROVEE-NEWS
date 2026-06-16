/** Qwen 2.5 0.5B Instruct ONNX q4 — approximate browser download size. */
export const QWEN_MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";
export const QWEN_ESTIMATED_BYTES = 380_000_000;

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function detectWebGpu(): Promise<boolean> {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}
