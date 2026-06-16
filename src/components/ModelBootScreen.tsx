import { useEffect, useState } from "react";
import { INTELLIGENCE_FEEDS } from "../feeds/englishFeeds";
import { detectWebGpu, formatBytes, QWEN_ESTIMATED_BYTES, QWEN_MODEL_ID } from "../model/modelInfo";
import {
  bootSummarizer,
  getModelBootState,
  subscribeModelBoot,
  type ModelBootState,
} from "../summarize/summarizerClient";
import { CircularProgress } from "./CircularProgress";

type ModelBootScreenProps = {
  onReady: () => void;
};

export function ModelBootScreen({ onReady }: ModelBootScreenProps) {
  const [boot, setBoot] = useState<ModelBootState>(getModelBootState());
  const [webgpu, setWebgpu] = useState<boolean | null>(null);
  const [started, setStarted] = useState(boot.phase !== "idle");

  useEffect(() => {
    void detectWebGpu().then(setWebgpu);
    return subscribeModelBoot((s) => {
      setBoot(s);
      if (s.phase !== "idle") setStarted(true);
    });
  }, []);

  const onDownload = () => {
    setStarted(true);
    bootSummarizer();
  };

  const idle = boot.phase === "idle" && !started;
  const downloading = boot.phase === "downloading" || boot.phase === "loading";
  const canEngage = boot.phase === "ready";
  const showProgress = started && !idle;

  const byteLine =
    boot.loaded > 0 && boot.total > 0
      ? `${formatBytes(boot.loaded)} / ${formatBytes(boot.total)}`
      : boot.pct > 0
        ? `~${formatBytes((boot.pct / 100) * QWEN_ESTIMATED_BYTES)} / ${formatBytes(QWEN_ESTIMATED_BYTES)}`
        : `~${formatBytes(QWEN_ESTIMATED_BYTES)} total download`;

  return (
    <div className="gn-boot" data-phase={boot.phase}>
      <div className="gn-boot__glow" aria-hidden="true" />
      <header className="gn-boot__brand">
        <span className="gn-boot__logo">GROVEE NEWS</span>
        <span className="gn-boot__badge">INTELLIGENCE ENGINE</span>
      </header>

      <section className="gn-boot__panel" aria-live="polite">
        {showProgress ? (
          <CircularProgress
            percent={boot.pct}
            label="QWEN"
            indeterminate={downloading && boot.pct < 2}
          />
        ) : (
          <div className="gn-boot__icon" aria-hidden="true">
            ⬇
          </div>
        )}

        <h1 className="gn-boot__title">
          {idle ? "Download AI model to browser" : "Loading local AI model"}
        </h1>
        <p className="gn-boot__model" dir="ltr">
          {QWEN_MODEL_ID}
        </p>

        <p className="gn-boot__status">
          {idle
            ? "Required for article summaries and smart search. Runs locally — no cloud."
            : boot.message || "Starting download…"}
        </p>

        {showProgress ? (
          <p className="gn-boot__bytes" dir="ltr">
            {byteLine}
            {boot.device ? ` · ${boot.device}` : null}
          </p>
        ) : (
          <p className="gn-boot__bytes" dir="ltr">
            {formatBytes(QWEN_ESTIMATED_BYTES)} · WebGPU or WASM · cached in browser
          </p>
        )}

        {webgpu === false ? (
          <p className="gn-boot__warn">WebGPU not available — will use WASM (slower).</p>
        ) : webgpu === true ? (
          <p className="gn-boot__ok">WebGPU detected</p>
        ) : null}

        {boot.phase === "error" ? (
          <p className="gn-boot__error" role="alert">
            {boot.error ?? "Model load failed"}
          </p>
        ) : null}

        <div className="gn-boot__actions">
          {idle ? (
            <button type="button" className="gn-boot__download" onClick={onDownload}>
              <span className="gn-boot__download-icon" aria-hidden="true">
                ↓
              </span>
              <span className="gn-boot__download-text">
                <strong>Download model to browser</strong>
                <small>~{formatBytes(QWEN_ESTIMATED_BYTES)} · Qwen 2.5 0.5B</small>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className={`gn-boot__btn${canEngage ? " gn-boot__btn--ready" : ""}`}
              disabled={!canEngage}
              onClick={onReady}
            >
              <span className="gn-boot__btn-code" dir="ltr">
                ENGAGE
              </span>
              <span className="gn-boot__btn-label">
                {canEngage
                  ? "Start news intelligence"
                  : downloading
                    ? "Downloading model…"
                    : "Initializing…"}
              </span>
            </button>
          )}

          {boot.phase === "error" ? (
            <button
              type="button"
              className="gn-boot__retry"
              onClick={() => {
                setStarted(true);
                bootSummarizer(true);
              }}
            >
              Retry download
            </button>
          ) : null}
        </div>

        <ul className="gn-boot__features">
          <li>RSS feeds → article extraction → Qwen summary → search index</li>
          <li>Duplicate detection across sources · confidence score</li>
          <li>{INTELLIGENCE_FEEDS.length} intelligence sources · IndexedDB · FlexSearch</li>
        </ul>
      </section>
    </div>
  );
}
