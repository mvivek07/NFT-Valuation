// Human-readable number formatting for the asset profile and results.
export function fmtNum(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(abs >= 10_000 ? 0 : 1) + "K";
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(abs < 1 ? 2 : 1);
}

export function fmtMoney(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.01) return "<$0.01";
  if (n < 1) return "$" + n.toFixed(2);
  return "$" + fmtNum(n);
}

export const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
