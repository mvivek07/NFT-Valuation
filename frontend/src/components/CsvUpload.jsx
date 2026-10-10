import { useRef, useState } from "react";
import { postCsv } from "../api.js";
import BatchResults from "./BatchResults.jsx";
import { Icon } from "../icons.jsx";

export default function CsvUpload({ meta, csv, setCsv }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef(null);

  const choose = (f) => {
    if (!f) return;
    setError("");
    if (!/\.csv$/i.test(f.name)) { setError("Please choose a file that ends in .csv"); return; }
    setFile(f);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      setCsv(await postCsv(file));
    } catch (e) {
      setCsv(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="grid-two">
        {/* ---- upload card ---- */}
        <div className="card">
          <div className="card-head"><div className="card-title"><h2>Upload a CSV of NFTs</h2></div></div>
          <p className="hint">
            Value many NFTs in one go. Each row is one NFT; every row is run through all the
            models and the combiner, exactly like a single prediction.
          </p>

          <label
            className={"dropzone" + (over ? " over" : "") + (file ? " has-file" : "")}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files?.[0]); }}
          >
            <input ref={input} type="file" accept=".csv,text/csv" hidden
              onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
            <span className="dz-ic"><Icon.upload /></span>
            {file ? (
              <>
                <span className="dz-title">{file.name}</span>
                <span className="dz-sub">{(file.size / 1024).toFixed(1)} KB · click to choose a different file</span>
              </>
            ) : (
              <>
                <span className="dz-title">Drop a .csv file here, or click to browse</span>
                <span className="dz-sub">Up to 5,000 rows and 12 MB</span>
              </>
            )}
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}

          <button className="btn primary full" type="button" onClick={run} disabled={!file || busy} style={{ marginTop: 18 }}>
            {busy ? "Predicting every row…" : "Predict all rows"}
          </button>
        </div>

        {/* ---- help card ---- */}
        <div className="card">
          <div className="card-head"><div className="card-title"><h2>What the file should contain</h2></div></div>
          <ul className="csv-help">
            <li><strong>A header row</strong> with the dataset's column names, such as <code>followers_count_mean</code>, <code>nlikes_mean</code>, <code>floor_price</code>, <code>total_sales</code>.</li>
            <li><strong>Any subset of the 121 columns works.</strong> Missing columns are filled with the dataset's typical value; columns it doesn't recognise are ignored. More columns give better predictions.</li>
            <li><strong>Optional:</strong> <code>name</code> to label each row, <code>listing_price_usd</code> to get a fair-price check, and <code>price_label</code> (0–5) if you know the true answer and want the predictions scored.</li>
          </ul>
          <div className="sample-box">
            <div className="sample-title">No file yet? Try a sample</div>
            <div className="sample-links">
              <a className="btn secondary" href="/api/sample-csv/full" download>
                Full sample · 20 real NFTs, all columns, with answers
              </a>
              <a className="btn secondary" href="/api/sample-csv/minimal" download>
                Minimal sample · 10 real NFTs, 11 columns
              </a>
            </div>
            <p className="lbl-note" style={{ margin: "10px 0 0" }}>
              Both come from the held-out test set, so the models never trained on these NFTs.
            </p>
          </div>
        </div>
      </div>

      {csv && <BatchResults data={csv} meta={meta} downloadName="nft_predictions.csv" />}
    </div>
  );
}
