import type { EngineStatus } from "../types";

type StatusBarProps = {
  status: EngineStatus;
};

export function StatusBar({ status }: StatusBarProps) {
  return (
    <div className="gn-status" data-phase={status.phase}>
      <span className="gn-status__msg">{status.message}</span>
    </div>
  );
}
