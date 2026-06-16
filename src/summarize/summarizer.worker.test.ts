import { describe, expect, it } from "vitest";
import { isWebGpuFailure } from "./webgpuErrors";

describe("isWebGpuFailure", () => {
  it("detects OrtRun / GPUBuffer errors", () => {
    const msg =
      "failed to call OrtRun(). ERROR_CODE: 1, ERROR_MESSAGE: ... Failed to download data from buffer: Failed to execute 'mapAsync' on 'GPUBuffer'";
    expect(isWebGpuFailure(new Error(msg))).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isWebGpuFailure(new Error("Network request failed"))).toBe(false);
  });
});
