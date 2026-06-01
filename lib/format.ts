export const formatBytes = (bytes?: number) => {
  if (!bytes) return "unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
};

export const msFromNs = (ns?: number) => (ns ? `${(ns / 1_000_000_000).toFixed(2)}s` : "n/a");

