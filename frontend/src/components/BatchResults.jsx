import { useState } from "react";
import { fmtMoney } from "../format.js";

const VERDICT_LABEL = { fair: "Fair", undervalued: "Undervalued", overvalued: "Overvalued" };
const PAGE = 100;

function ClassPill({ cls }) {
  return <span className="cls-pill"><i style={{ background: `var(--cls-${cls})` }} />{cls}</span>;
}

function download(data, meta, filename) {
  const head = ["row", "nft", "predicted_class", "price_range", "gru_rnn", "svm", "random_forest",
    "gru_confidence", "estimated_price_usd", "asking_price_usd", "price_check", "actual_class",
    "sold_for_usd", "correct"];
  const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = data.rows.map((r) => [
    r.row, r.id, r.final, meta?.class_ranges[r.final] ?? "", r.gru_rnn, r.svm, r.random_forest,
    r.confidence, r.regression_price_usd, r.asking_usd, r.valuation, r.actual, r.sold_usd,
    r.correct == null ? "" : r.correct ? "yes" : "no",
  ].map(esc).join(","));
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Summary cards, class breakdown and the row-by-row table for a batch of
 * predictions. Used by both the CSV upload and the real-NFT batch.
 */
export default function BatchResults({ data, meta, onOpen, downloadName = "nft_predictions.csv" }) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("all"); // all | correct | missed

  const isTest = data.source === "test_set";
  const hasSold = data.rows.some((r) => r.sold_usd != null);
  const filtered = data.rows.filter((r) =>
    filter === "all" ? true : filter === "correct" ? r.correct === true : r.correct === false);
  const rows = showAll ? filtered : filtered.slice(0, PAGE);
  const maxCount = Math.max(1, ...data.class_counts.map((c) => c.count));
  const nMissed = data.n_scored - data.n_correct;

  return (
    <>
      <div className="sum-grid">
        <div className="sum-card">
          <div className="sum-v">{data.n_rows.toLocaleString()}</div>
          <div className="sum-l">
            {isTest ? "real NFTs drawn at random from the held-out test set" : `NFTs valued from ${data.filename}`}
          </div>
        </div>
        {!isTest && (
          <div className="sum-card">
            <div className="sum-v">{data.columns_used} <span className="sum-of">of {data.columns_total}</span></div>
            <div className="sum-l">input columns recognised{data.columns_used < data.columns_total ? " · the rest used typical values" : ""}</div>
          </div>
        )}
        {data.has_actual && (
          <div className="sum-card">
            <div className="sum-v">{(data.accuracy * 100).toFixed(1)}%</div>
            <div className="sum-l">
              {data.n_correct} of {data.n_scored} predictions matched {isTest ? "what really happened" : "your answer column"}
            </div>
          </div>
        )}
        {isTest && meta && (
          <div className="sum-card">
            <div className="sum-v">{(meta.accuracy.hybrid_knn * 100).toFixed(1)}%</div>
            <div className="sum-l">accuracy on all {data.n_test.toLocaleString()} test NFTs · a small batch will land a little above or below this</div>
          </div>
        )}
        {data.has_asking && (
          <div className="sum-card">
            <div className="sum-v">{data.verdict_counts.overvalued || 0}</div>
            <div className="sum-l">
              asking prices look overvalued · {data.verdict_counts.fair || 0} fair · {data.verdict_counts.undervalued || 0} undervalued
            </div>
          </div>
        )}
      </div>

      {!isTest && (data.truncated || data.columns_ignored?.length > 0) && (
        <div className="sample-banner">
          <span className="sample-dot" />
          <span>
            {data.truncated && <>Only the first {data.max_rows.toLocaleString()} rows were used. </>}
            {data.columns_ignored.length > 0 && <>Ignored columns that are not in the dataset: <strong>{data.columns_ignored.join(", ")}</strong>.</>}
          </span>
        </div>
      )}

      <div className="chart-card">
        <h3 className="chart-title">Predicted price classes in this batch</h3>
        <p className="chart-sub">How many of these NFTs the system placed in each price class.</p>
        <div className="proba">
          {data.class_counts.map(({ cls, count }) => (
            <div className="proba-row wide" key={cls} title={`${cls} (${meta?.class_ranges[cls] ?? ""}): ${count}`}>
              <span className="proba-name">{cls}</span>
              <span className="proba-track">
                <span className="proba-fill" style={{ width: `${(count / maxCount) * 100}%`, background: `var(--cls-${cls})`, minWidth: count ? 3 : 0 }} />
              </span>
              <span className="proba-val">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="table-note" style={{ marginTop: 0, marginBottom: 14 }}>
          <span className="result-title" style={{ margin: 0 }}>
            Row-by-row results · showing {rows.length} of {filtered.length}
          </span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {data.has_actual && (
              <span className="filter-tabs" role="group" aria-label="Filter rows">
                {[["all", `All ${data.n_rows}`], ["correct", `Correct ${data.n_correct}`], ["missed", `Missed ${nMissed}`]].map(([id, label]) => (
                  <button key={id} type="button" className={"mode-tab small" + (filter === id ? " active" : "")}
                    onClick={() => { setFilter(id); setShowAll(false); }}>{label}</button>
                ))}
              </span>
            )}
            <button className="btn secondary" type="button" onClick={() => download(data, meta, downloadName)}>
              Download results as CSV
            </button>
          </span>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>NFT</th>
                <th style={{ textAlign: "left" }}>Predicted</th>
                <th style={{ textAlign: "left" }}>Price range</th>
                <th>GRU-RNN</th><th>SVM</th><th>Forest</th>
                {!hasSold && <th>Est. price</th>}
                {data.has_asking && <><th>Asking</th><th style={{ textAlign: "left" }}>Price check</th></>}
                {data.has_actual && <th style={{ textAlign: "left" }}>Actual</th>}
                {hasSold && <th>Sold for</th>}
                {data.has_actual && <th>Result</th>}
                {onOpen && <th aria-label="Open" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row}>
                  <td>{r.id}</td>
                  <td style={{ textAlign: "left" }}><ClassPill cls={r.final} /></td>
                  <td style={{ textAlign: "left" }}>{meta?.class_ranges[r.final]}</td>
                  <td>{r.gru_rnn}</td><td>{r.svm}</td><td>{r.random_forest}</td>
                  {!hasSold && <td>{fmtMoney(r.regression_price_usd)}</td>}
                  {data.has_asking && (
                    <>
                      <td>{r.asking_usd ? fmtMoney(r.asking_usd) : "—"}</td>
                      <td style={{ textAlign: "left" }}>
                        {r.valuation ? <span className={`verdict-pill ${r.valuation}`}>{VERDICT_LABEL[r.valuation]}</span> : "—"}
                      </td>
                    </>
                  )}
                  {data.has_actual && <td style={{ textAlign: "left" }}>{r.actual ? <ClassPill cls={r.actual} /> : "—"}</td>}
                  {hasSold && <td>{r.sold_usd > 0 ? fmtMoney(r.sold_usd) : "not sold"}</td>}
                  {data.has_actual && (
                    <td>{r.correct == null ? "—" : <span className={r.correct ? "res-ok" : "res-miss"}>{r.correct ? "✓ correct" : "✗ missed"}</span>}</td>
                  )}
                  {onOpen && (
                    <td><button className="link-btn" type="button" onClick={() => onOpen(r.row_id)}>Details</button></td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center" }}>No rows match this filter.</td></tr>}
            </tbody>
          </table>
        </div>

        {!showAll && filtered.length > PAGE && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button className="btn secondary" type="button" onClick={() => setShowAll(true)}>
              Show all {filtered.length.toLocaleString()} rows
            </button>
          </div>
        )}
        <p className="footnote">
          "Predicted" is the hybrid's final answer; the three model columns show how each classifier
          voted. {isTest
            ? "\"Actual\" and \"Sold for\" are what really happened to each NFT on the market. Click Details to see all of an NFT's data."
            : "\"Est. price\" is the linear regression's dollar estimate, which assumes the NFT sells."}
        </p>
      </div>
    </>
  );
}
