import { useEffect, useState } from "react";
import { fmtMoney, pct } from "../format.js";

function ProbaBar({ cls, p, winner, range }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setWidth(Math.max(p * 100, 0.8)));
    return () => cancelAnimationFrame(t);
  }, [p]);
  return (
    <div className={"proba-row" + (cls === winner ? " winner" : "")} title={`${cls} (${range}): ${pct(p, 2)}`}>
      <span className="proba-name">{cls}</span>
      <span className="proba-track"><span className="proba-fill" style={{ width: width + "%" }} /></span>
      <span className="proba-val">{pct(p)}</span>
    </div>
  );
}

// result key, label, colour variable
const VOTERS = [
  ["gru_rnn", "GRU-RNN", "gru_rnn"],
  ["svm", "SVM", "svm_rbf"],
  ["random_forest", "Random Forest", "random_forest"],
  ["linear_regression", "Linear regression", "linear_regression"],
];

const EMPTY_TEXT = {
  real: "Load a real NFT on the left and press Predict. Every model's answer and the true outcome will appear here.",
  manual: "Fill in what you know about an NFT and press Predict. Blank fields use the dataset's typical value.",
  live: "Paste an OpenSea NFT link and press Fetch. Its live market data is read from OpenSea and valued here.",
};
const VERDICT_TEXT = { fair: "Fairly priced", undervalued: "Looks undervalued", overvalued: "Looks overvalued" };

export default function ResultPanel({ meta, result, status, mode }) {
  const hit = result?.actual && result.actual === result.final;
  const val = result?.valuation;

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><h2>Result</h2></div>
        <span className="chip">{status}</span>
      </div>

      {!result && (
        <div className="empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2 L21 9 L12 22 L3 9 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          <p>{EMPTY_TEXT[mode]}</p>
        </div>
      )}

      {result && meta && (
        <div>
          <div className="verdict">
            <div className="verdict-label">Predicted price class</div>
            <div className="verdict-class">{result.final}</div>
            <div className="verdict-range">{meta.class_ranges[result.final] || ""}</div>
          </div>

          {result.actual && (
            <div className={"truth " + (hit ? "hit" : "miss")}>
              <span>
                What really happened:{" "}
                <strong>
                  {result.actual} ({meta.class_ranges[result.actual] || ""}
                  {result.actual_price > 0 ? `, sold for ${fmtMoney(result.actual_price)}` : ""})
                </strong>
              </span>
              <span className="truth-flag">{hit ? "✓ prediction correct" : "✗ prediction missed"}</span>
            </div>
          )}

          {val && (
            <div className="result-block">
              <h3 className="result-title">Is the asking price fair?</h3>
              <div className={"valuation " + val.verdict}>
                <div className="valuation-head">
                  <span className="valuation-verdict">{VERDICT_TEXT[val.verdict]}</span>
                  <span className="valuation-listing">asking {fmtMoney(val.listing_usd)}</span>
                </div>
                <div className="valuation-note">{val.note}</div>
              </div>
            </div>
          )}

          <div className="result-block">
            <h3 className="result-title">How each model voted · {result.agreement} of 3 classifiers agree</h3>
            <div className="votes">
              {VOTERS.map(([key, label, colorKey]) => {
                const v = result.models[key];
                const isReg = key === "linear_regression";
                const agree = v === result.final;
                return (
                  <div className={"vote " + (agree ? "agree" : "differ")} key={key}>
                    <span className="vote-dot" style={{ background: `var(--m-${colorKey})` }} />
                    <span className="vote-name">
                      {label}
                      {isReg && <span className="vote-sub">price estimate ≈ {fmtMoney(result.regression_price_usd)}</span>}
                    </span>
                    <span className="vote-val">
                      {v}
                      {!isReg && <span className="vote-flag">{agree ? "✓" : "≠"}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="result-block">
            <h3 className="result-title">How confident is the GRU-RNN?</h3>
            <div className="proba" role="img" aria-label="GRU-RNN probability for each price class">
              {result.gru_probabilities.map(({ cls, p }) => (
                <ProbaBar key={cls} cls={cls} p={p} winner={result.models.gru_rnn} range={meta.class_ranges[cls]} />
              ))}
            </div>
          </div>

          <p className="footnote">
            The final class is picked by the KNN combiner, which weighs every model's answer. Linear
            regression only estimates a price for NFTs that sell, so it never answers "unsold" and
            is not counted in the agreement score.
          </p>
        </div>
      )}
    </div>
  );
}
