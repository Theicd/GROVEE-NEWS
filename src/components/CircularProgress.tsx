type CircularProgressProps = {
  percent: number;
  size?: number;
  label?: string;
  indeterminate?: boolean;
};

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CircularProgress({
  percent,
  size = 128,
  label,
  indeterminate = false,
}: CircularProgressProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div
      className={`gn-ring${indeterminate ? " gn-ring--pulse" : ""}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="gn-ring__track" cx="60" cy="60" r={RADIUS} />
        <circle
          className="gn-ring__fill"
          cx="60"
          cy="60"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={indeterminate ? CIRCUMFERENCE * 0.72 : offset}
        />
      </svg>
      <div className="gn-ring__center" dir="ltr">
        <span className="gn-ring__pct">{indeterminate ? "…" : `${Math.round(clamped)}%`}</span>
        {label ? <span className="gn-ring__label">{label}</span> : null}
      </div>
    </div>
  );
}
