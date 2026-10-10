const TWITTER_FIELDS = [
  { name: "followers_count_mean", label: "Creator followers", placeholder: "e.g. 1500" },
  { name: "nlikes_mean", label: "Likes per tweet", placeholder: "e.g. 12" },
  { name: "nretweets_mean", label: "Retweets per tweet", placeholder: "e.g. 4" },
  { name: "nreplies_mean", label: "Replies per tweet", placeholder: "e.g. 2" },
  { name: "number_of_tweets", label: "Tweets about this NFT", placeholder: "e.g. 3" },
];

const OPENSEA_FIELDS = [
  { name: "floor_price", label: "Collection floor price (ETH)", placeholder: "e.g. 0.05" },
  { name: "average_price", label: "Collection average price (ETH)", placeholder: "e.g. 0.2" },
  { name: "total_sales", label: "Collection total sales", placeholder: "e.g. 800" },
  { name: "num_owners", label: "Collection owners", placeholder: "e.g. 450" },
  { name: "numEvents", label: "Events on this NFT", placeholder: "e.g. 6" },
  { name: "successful", label: "Completed sales of this NFT", placeholder: "e.g. 1" },
];

export const EMPTY_FORM = Object.fromEntries(
  [...TWITTER_FIELDS, ...OPENSEA_FIELDS].map((f) => [f.name, ""])
    .concat([["verified", false], ["listing_usd", ""]])
);

function Field({ field, value, onChange }) {
  return (
    <label>
      {field.label}
      <input
        type="number" step="any" min="0" name={field.name} placeholder={field.placeholder}
        value={value} onChange={(e) => onChange(field.name, e.target.value)}
      />
    </label>
  );
}

export default function PredictForm({ values, status, onChange, onClear, onPredict }) {
  const busy = status === "predicting…";
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><h2>Describe your NFT</h2></div>
        <div className="head-actions">
          <button className="btn ghost" type="button" onClick={onClear}>Clear all</button>
        </div>
      </div>
      <p className="hint">
        A what-if sandbox. Fill in whatever you know — <strong>anything left blank is replaced by
        the typical (median) value</strong> from the dataset, so two or three numbers are enough.
        Try raising followers and likes to watch social hype move the prediction.
      </p>

      <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); onPredict(); }}>
        <fieldset className="hue-blue">
          <legend>Twitter signals</legend>
          <div className="fields">
            {TWITTER_FIELDS.map((f) => (
              <Field key={f.name} field={f} value={values[f.name]} onChange={onChange} />
            ))}
            <label className="check">
              <input type="checkbox" checked={values.verified} onChange={(e) => onChange("verified", e.target.checked)} />
              Verified creator account
            </label>
          </div>
        </fieldset>
        <fieldset className="hue-aqua">
          <legend>OpenSea market data</legend>
          <div className="fields">
            {OPENSEA_FIELDS.map((f) => (
              <Field key={f.name} field={f} value={values[f.name]} onChange={onChange} />
            ))}
          </div>
        </fieldset>
        <fieldset className="hue-magenta">
          <legend>Price check · optional</legend>
          <div className="fields">
            <label>
              Seller's asking price (USD)
              <input type="number" step="any" min="0" name="listing_usd" placeholder="e.g. 250"
                value={values.listing_usd} onChange={(e) => onChange("listing_usd", e.target.value)} />
            </label>
            <p className="lbl-note" style={{ alignSelf: "end", margin: "0 0 10px" }}>
              Add a price and you'll be told whether it looks undervalued, fair or overvalued.
            </p>
          </div>
        </fieldset>
        <button className="btn primary full" type="submit" disabled={busy}>
          {busy ? "Predicting…" : "Predict & value"}
        </button>
      </form>
    </div>
  );
}
