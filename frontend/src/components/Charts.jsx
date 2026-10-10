import { Fragment } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, LineChart, Line, ReferenceLine, Cell, LabelList,
} from "recharts";
import { MODEL_NAMES } from "../theme.js";

const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";

export function ChartCard({ title, subtitle, children, wide }) {
  return (
    <div className={"chart-card" + (wide ? " wide" : "")}>
      <h3 className="chart-title">{title}</h3>
      {subtitle && <p className="chart-sub">{subtitle}</p>}
      {children}
    </div>
  );
}

function tooltipStyle(c) {
  return {
    contentStyle: {
      background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12,
      fontSize: 12.5, color: c.ink, boxShadow: "0 8px 24px rgba(0,0,0,.18)",
    },
    labelStyle: { color: c.ink, fontWeight: 700 },
    itemStyle: { color: c.ink2 },
    cursor: { fill: c.grid, opacity: 0.4 },
  };
}

const axis = (c) => ({
  tick: { fill: c.muted, fontSize: 12 },
  axisLine: { stroke: c.grid },
  tickLine: false,
});
const valueLabel = (c) => ({ fill: c.ink2, fontSize: 11.5, fontWeight: 700 });

/* Share of assets per price class — bars use the ordered class ramp. */
export function ClassDistChart({ data, colors: c }) {
  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart data={data} margin={{ top: 26, right: 8, left: 0, bottom: 0 }} barCategoryGap="26%">
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="cls" {...axis(c)} />
        <YAxis {...axis(c)} tickFormatter={(v) => pct(v, 0)} width={46} />
        <Tooltip
          {...tooltipStyle(c)}
          formatter={(v, _n, p) => [`${pct(v)} · ${p.payload.count.toLocaleString()} assets`, p.payload.range]}
        />
        <Bar dataKey="share" radius={[4, 4, 0, 0]} maxBarSize={62}>
          <LabelList dataKey="share" position="top" formatter={(v) => pct(v)} style={valueLabel(c)} />
          {data.map((d) => <Cell key={d.cls} fill={c.classes[d.cls]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Price histogram of sold assets (log-spaced bins). */
export function PriceHistChart({ data, colors: c }) {
  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" {...axis(c)} interval={3} />
        <YAxis {...axis(c)} width={46} />
        <Tooltip {...tooltipStyle(c)} formatter={(v) => [`${v.toLocaleString()} assets`, "sold near this price"]} />
        <Bar dataKey="count" fill={c.seq} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Feature-to-price correlations (positive vs negative). */
export function CorrChart({ data, colors: c }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={c.grid} />
        <XAxis type="number" domain={[-0.1, 0.4]} ticks={[-0.1, 0, 0.1, 0.2, 0.3, 0.4]} {...axis(c)} tickFormatter={(v) => v.toFixed(1)} />
        <YAxis type="category" dataKey="feature" width={196} {...axis(c)} tick={{ fill: c.ink2, fontSize: 12 }} />
        <Tooltip {...tooltipStyle(c)} formatter={(v) => [`r = ${v}`, "correlation with price"]} />
        <ReferenceLine x={0} stroke={c.muted} />
        <Bar dataKey="r" radius={[0, 4, 4, 0]} maxBarSize={16}>
          <LabelList dataKey="r" position="right" style={valueLabel(c)} />
          {data.map((d) => <Cell key={d.feature} fill={d.r >= 0 ? c.seq : c.warn} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* One metric across models — every model keeps its own colour app-wide. */
export function ModelBarChart({ summary, metric, colors: c, keys }) {
  const data = keys
    .filter((k) => summary[k])
    .map((k) => ({ key: k, name: MODEL_NAMES[k], value: summary[k][metric] }));
  const asPct = metric === "accuracy";
  return (
    <ResponsiveContainer width="100%" height={data.length * 46 + 30}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={c.grid} />
        <XAxis type="number" domain={[0, 1]} {...axis(c)} tickFormatter={(v) => (asPct ? pct(v, 0) : v.toFixed(1))} />
        <YAxis type="category" dataKey="name" width={112} {...axis(c)} tick={{ fill: c.ink2, fontSize: 12.5, fontWeight: 600 }} />
        <Tooltip {...tooltipStyle(c)} formatter={(v) => [asPct ? pct(v) : v.toFixed(3), asPct ? "accuracy" : "macro-F1"]} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          <LabelList dataKey="value" position="right" formatter={(v) => (asPct ? pct(v) : v.toFixed(3))} style={valueLabel(c)} />
          {data.map((d) => <Cell key={d.key} fill={c.models[d.key]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Per-class F1 for SVM vs Random Forest (their app-wide model colours). */
export function F1Chart({ perClass, colors: c }) {
  const classes = [...new Set(perClass.map((d) => d.cls))];
  const data = classes.map((cls) => {
    const rf = perClass.find((d) => d.cls === cls && d.model === "Random Forest");
    const svm = perClass.find((d) => d.cls === cls && d.model === "SVM (RBF)");
    return { cls, rf: rf?.f1 ?? 0, svm: svm?.f1 ?? 0, support: rf?.support ?? 0 };
  });
  const small = { fill: c.ink2, fontSize: 10, fontWeight: 600 };
  return (
    <>
      <div className="chart-legend">
        <span><i style={{ background: c.models.svm_rbf }} /> SVM</span>
        <span><i style={{ background: c.models.random_forest }} /> Random Forest</span>
      </div>
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="14%" barGap={8}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="cls" {...axis(c)} />
          <YAxis domain={[0, 1]} {...axis(c)} width={36} />
          <Tooltip
            {...tooltipStyle(c)}
            formatter={(v, name) => [v.toFixed(3), name]}
            labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload.support.toLocaleString() ?? ""} test assets`}
          />
          <Bar dataKey="svm" name="SVM" fill={c.models.svm_rbf} radius={[4, 4, 0, 0]} maxBarSize={24}>
            <LabelList dataKey="svm" position="top" formatter={(v) => v.toFixed(2)} style={small} />
          </Bar>
          <Bar dataKey="rf" name="Random Forest" fill={c.models.random_forest} radius={[4, 4, 0, 0]} maxBarSize={24}>
            <LabelList dataKey="rf" position="top" formatter={(v) => v.toFixed(2)} style={small} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

/* PCA cumulative explained variance. */
export function PcaChart({ data, colors: c }) {
  return (
    <ResponsiveContainer width="100%" height={290}>
      <LineChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 6 }}>
        <CartesianGrid stroke={c.grid} />
        <XAxis dataKey="n" type="number" domain={[1, data.length]} ticks={[1, 10, 20, 30, 40, data.length]} {...axis(c)} height={48}
          label={{ value: "number of components kept", position: "insideBottom", offset: 0, fill: c.muted, fontSize: 11.5 }} />
        <YAxis domain={[0, 1]} {...axis(c)} tickFormatter={(v) => pct(v, 0)} width={46} />
        <Tooltip {...tooltipStyle(c)} formatter={(v) => [pct(v), "information kept"]} labelFormatter={(l) => `${l} components`} />
        <ReferenceLine y={0.95} stroke={c.warn} strokeDasharray="5 4"
          label={{ value: "95% target", fill: c.warn, fontSize: 11.5, position: "insideBottomRight" }} />
        <Line type="monotone" dataKey="v" stroke={c.seq} strokeWidth={2} dot={false}
          activeDot={{ r: 5, fill: c.seq, stroke: c.surface, strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* Confusion matrix heatmap (single-hue intensity). */
export function ConfusionHeatmap({ labels, matrix, counts, colors: c }) {
  return (
    <div className="cm-wrap">
      <div className="cm-grid" style={{ gridTemplateColumns: `78px repeat(${labels.length}, 1fr)` }}>
        <div className="cm-corner">actual ↓ / predicted →</div>
        {labels.map((l) => <div key={"c" + l} className="cm-col">{l}</div>)}
        {labels.map((row, i) => (
          <Fragment key={row}>
            <div className="cm-row">{row}</div>
            {labels.map((col, j) => {
              const v = matrix[i][j];
              return (
                <div
                  key={row + col}
                  className="cm-cell"
                  title={`actual ${row} → predicted ${col}: ${counts[i][j].toLocaleString()} assets (${pct(v)})`}
                  style={{
                    background: `color-mix(in srgb, ${c.seq} ${Math.round(v * 90)}%, ${c.surface})`,
                    color: v > 0.45 ? "#fff" : c.ink2,
                  }}
                >
                  {v >= 0.005 ? pct(v, 0) : "·"}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="cm-caption">Each row adds up to 100% · the diagonal is where the model was right · hover a cell for the exact count</div>
    </div>
  );
}
