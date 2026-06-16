/** True when ONNX Runtime WebGPU backend failed (buffer download / OrtRun). */
export function isWebGpuFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /webgpu|gpubuffer|mapasync|ortrun|buffermanager|wgpu|invalid buffer/i.test(msg);
}
