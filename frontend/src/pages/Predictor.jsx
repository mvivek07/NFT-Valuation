import { useState } from "react";
import { PageHead, Block } from "../components/Layout.jsx";
import AssetProfile from "../components/AssetProfile.jsx";
import PredictForm from "../components/PredictForm.jsx";
import LiveForm from "../components/LiveForm.jsx";
import CsvUpload from "../components/CsvUpload.jsx";
import BatchResults from "../components/BatchResults.jsx";
import ResultPanel from "../components/ResultPanel.jsx";
import ClassLegend from "../components/ClassLegend.jsx";
import { Icon } from "../icons.jsx";

const MODES = [
  ["real", "Real NFT from the test set"],
  ["manual", "Build your own"],
  ["live", "Live from OpenSea"],
  ["csv", "Upload a CSV"],
];
const BATCH_SIZES = [10, 25, 50, 100, 250];

function RealBatch({ meta, batch, busy, onLoad, onOpen }) {
  const [n, setN] = useState(25);
  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><div className="card-title"><h2>Predict many real NFTs at once</h2></div></div>
        <p className="hint">
          Draws a random batch from the 12,600 test NFTs the models never trained on, predicts every
          one, and lists the results row by row next to <strong>what really happened</strong> to
          each NFT. A new batch is drawn every time, so the score changes a little from run to run.
        </p>
        <div className="batch-controls">
          <span className="batch-label">How many NFTs?</span>
          <span className="filter-tabs" role="group" aria-label="Batch size">
            {BATCH_SIZES.map((size) => (
              <button key={size} type="button" className={"mode-tab small" + (n === size ? " active" : "")}
                onClick={() => setN(size)}>{size}</button>
            ))}
          </span>
          <button className="btn primary" type="button" onClick={() => onLoad(n)} disabled={busy}>
            {busy ? "Predicting…" : batch ? `Draw another ${n}` : `Load & predict ${n} real NFTs`}
          </button>
        </div>
      </div>

      {batch && (
        <BatchResults data={batch} meta={meta} onOpen={onOpen} downloadName="real_nft_predictions.csv" />
      )}
    </div>
  );
}

export default function Predictor({
  meta, mode, setMode, sample, values, status, result, live, csv, setCsv,
  realView, setRealView, batch, batchBusy, onLoadBatch, onOpenRow,
  onChange, onLoadSample, onClear, onPredict, onLookup,
}) {
  const twoColumn = mode === "manual" || mode === "live" || (mode === "real" && realView === "single");

  return (
    <div className="hue-violet">
      <PageHead
        kicker="Predictor"
        title="Predict an NFT's price class and check its asking price"
        chips={[
          ["12,600", "unseen test NFTs to draw from"],
          ["5", "models vote on every prediction"],
          ["6", "possible price classes"],
        ]}
      >
        Pick one NFT in three different ways, or value many at once, and see what every model
        thinks. For real test NFTs the <strong>true outcome is revealed afterwards</strong>, so you
        can judge the system honestly.
      </PageHead>

      <main className="page">
        <Block kicker="How to use this page" title="Three steps">
          <div className="howto">
            <div className="howto-step"><span className="howto-n">1</span><span><strong>Choose your NFTs</strong>Draw real ones from the test set (one or many), describe your own, fetch one live from OpenSea, or upload a CSV.</span></div>
            <div className="howto-step"><span className="howto-n">2</span><span><strong>Press Predict</strong>Four models score each NFT and a combiner picks the final price class.</span></div>
            <div className="howto-step"><span className="howto-n">3</span><span><strong>Read the result</strong>See the price class, whether the asking price is fair, and — for test NFTs — what really happened.</span></div>
          </div>

          <div className="mode-tabs" role="tablist">
            {MODES.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={mode === id}
                className={"mode-tab" + (mode === id ? " active" : "")} onClick={() => setMode(id)}>
                {label}
              </button>
            ))}
          </div>

          {mode === "real" && (
            <div className="sub-tabs" role="tablist" aria-label="Real NFT view">
              <button type="button" role="tab" aria-selected={realView === "single"}
                className={"sub-tab" + (realView === "single" ? " active" : "")} onClick={() => setRealView("single")}>
                One NFT in detail
              </button>
              <button type="button" role="tab" aria-selected={realView === "batch"}
                className={"sub-tab" + (realView === "batch" ? " active" : "")} onClick={() => setRealView("batch")}>
                Many NFTs, row by row
              </button>
            </div>
          )}

          {mode === "csv" && <CsvUpload meta={meta} csv={csv} setCsv={setCsv} />}

          {mode === "real" && realView === "batch" && (
            <RealBatch meta={meta} batch={batch} busy={batchBusy} onLoad={onLoadBatch} onOpen={onOpenRow} />
          )}

          {twoColumn && (
            <div className="grid-two">
              {mode === "real" && (
                sample ? (
                  <div style={{ display: "grid", gap: 18 }}>
                    <AssetProfile sample={sample} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                      <button className="btn primary" onClick={onPredict} disabled={status === "predicting…"} type="button">
                        {status === "predicting…" ? "Predicting…" : "Predict & value"}
                      </button>
                      <button className="btn secondary" onClick={onLoadSample} type="button">Load another</button>
                    </div>
                  </div>
                ) : (
                  <div className="card loader-card">
                    <div className="loader-ic"><Icon.dice /></div>
                    <h3>Draw a real NFT</h3>
                    <p>
                      Picks one of the 12,600 NFTs that were held back from training. You will see its
                      real Twitter numbers, real OpenSea history and the seller's real asking price —
                      exactly what the models see.
                    </p>
                    <button className="btn primary" onClick={onLoadSample} disabled={status === "loading asset…"} type="button">
                      {status === "loading asset…" ? "Loading…" : "Load a random real NFT"}
                    </button>
                  </div>
                )
              )}
              {mode === "manual" && (
                <PredictForm values={values} status={status} onChange={onChange} onClear={onClear} onPredict={onPredict} />
              )}
              {mode === "live" && <LiveForm status={status} live={live} onLookup={onLookup} />}

              <ResultPanel meta={meta} result={result} status={status} mode={mode} />
            </div>
          )}
        </Block>

        <Block kicker="Reading the answer" title="What each price class means"
          intro="The prediction is always one of these six bands. Each band is ten times wider than the last because NFT prices span a huge range.">
          <ClassLegend meta={meta} />
        </Block>
      </main>
    </div>
  );
}
