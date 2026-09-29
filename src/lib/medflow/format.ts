// MedFlow Transcribe AI — formatting helpers

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatAudioMinutes(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  return (seconds / 60).toFixed(1) + " min";
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  let str: string;
  if (abs < min) str = `${Math.floor(abs / 1000)}s`;
  else if (abs < hour) str = `${Math.floor(abs / min)}m`;
  else if (abs < day) str = `${Math.floor(abs / hour)}h`;
  else str = `${Math.floor(abs / day)}d`;
  return future ? `in ${str}` : `${str} ago`;
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export function formatSlaRemaining(deadline: string | Date | null | undefined): { text: string; tone: "ok" | "warn" | "danger" } {
  if (!deadline) return { text: "—", tone: "ok" };
  const d = typeof deadline === "string" ? new Date(deadline) : deadline;
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return { text: `Overdue ${formatRelative(d)}`, tone: "danger" };
  const hours = diffMs / (3600 * 1000);
  if (hours < 2) return { text: `${Math.max(1, Math.floor(hours))}h remaining`, tone: "danger" };
  if (hours < 6) return { text: `${Math.floor(hours)}h remaining`, tone: "warn" };
  return { text: `${Math.floor(hours)}h remaining`, tone: "ok" };
}

export function pct(n: number | null | undefined, digits = 0): string {
  if (n == null) return "—";
  return (n * 100).toFixed(digits) + "%";
}

export function usd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
