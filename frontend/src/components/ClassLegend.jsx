import { pct } from "../format.js";

const PLAIN = {
  unsold: "No buyer was ever found",
  bin1: "Entry-level sales",
  bin2: "Typical sold NFT",
  bin3: "High-value sales",
  bin4: "Premium, very rare",
  bin5: "Blue-chip, almost unique",
};

export default function ClassLegend({ meta }) {
  if (!meta) return null;
  return (
    <div className="legend">
      {meta.class_order.map((cls) => (
        <div className="legend-item" key={cls}>
          <div className="legend-swatch" style={{ background: `var(--cls-${cls})` }} />
          <div className="legend-cls">{cls}</div>
          <div className="legend-range">{meta.class_ranges[cls]}</div>
          <div className="legend-share">{PLAIN[cls]} · {pct(meta.class_distribution[cls] || 0)} of assets</div>
        </div>
      ))}
    </div>
  );
}
