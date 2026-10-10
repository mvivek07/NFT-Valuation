import { useState } from "react";
import { fmtMoney, fmtNum } from "../format.js";

const TW = [
  ["followers_count_mean", "Creator followers"],
  ["nlikes_mean", "Likes per tweet"],
  ["nretweets_mean", "Retweets per tweet"],
  ["number_of_tweets", "Tweets about it"],
];

export default function LiveForm({ status, live, onLookup }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [tw, setTw] = useState({});
  const [error, setError] = useState("");
  const busy = status === "fetching live data…";

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><h2>Value a live NFT from OpenSea</h2></div>
      </div>
      <p className="hint">
        Paste any OpenSea NFT link. The server asks the <strong>OpenSea API</strong> for the
        collection's current stats, then runs every model. <strong>Use an API key</strong> for reliable results:
        OpenSea allows only an occasional lookup without one, and only a key unlocks the NFT's own
        event history and listing price, which the fair-price check needs.
      </p>

      <form autoComplete="off" onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try { await onLookup({ url, api_key: key, twitter: tw }); } catch (err) { setError(err.message); }
      }}>
        <label>
          OpenSea NFT link
          <input className="text" type="url" required placeholder="https://opensea.io/assets/ethereum/0x…/1234"
            value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label style={{ marginTop: 14 }}>
          OpenSea API key <span className="lbl-note">(recommended)</span>
          <input className="text" type="password" placeholder="paste your key" value={key} onChange={(e) => setKey(e.target.value)} />
          <span className="lbl-note">
            Free: on opensea.io open Settings → Developer, or get an instant 7-day test key by
            running <code>curl -X POST https://api.opensea.io/api/v2/auth/keys</code>
          </span>
        </label>

        <fieldset className="hue-blue" style={{ marginTop: 18 }}>
          <legend>Creator's Twitter numbers · optional</legend>
          <p className="lbl-note" style={{ margin: "0 0 12px" }}>
            Twitter/X no longer offers free data access, so type these in if you know them.
            Blank fields use the dataset's typical value.
          </p>
          <div className="fields">
            {TW.map(([k, label]) => (
              <label key={k}>
                {label}
                <input type="number" min="0" step="any" value={tw[k] ?? ""}
                  onChange={(e) => setTw({ ...tw, [k]: e.target.value })} />
              </label>
            ))}
          </div>
        </fieldset>

        {error && <div className="form-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

        <button className="btn primary full" type="submit" disabled={busy}>
          {busy ? "Fetching from OpenSea…" : "Fetch & value this NFT"}
        </button>
      </form>

      {live && live.skipped?.length > 0 && (
        <div className="sample-banner" style={{ marginTop: 20 }}>
          <span className="sample-dot" />
          <span>
            {live.key_rejected ? "OpenSea rejected that API key (wrong or expired)" : "Fetched without an API key"}, so the NFT's <strong>{live.skipped.join(" and ")}</strong>{" "}
            could not be read. Those inputs used typical values{live.skipped.includes("listing price") ? " and there is no fair-price check" : ""}. {live.key_rejected ? "Check the key and try again." : "Add a key above for the full lookup."}
          </span>
        </div>
      )}

      {live && (
        <div className="live-asset">
          {live.image_url && <img src={live.image_url} alt="" className="live-img" />}
          <div>
            <div className="live-name">{live.name}</div>
            <div className="live-sub">
              {live.collection} · {live.chain}
              {live.n_events != null ? ` · ${live.n_events} events found` : ""} · {live.n_features} live inputs used
            </div>
            <div className="live-sub">
              {live.listing_native != null
                ? `Listed at ${fmtNum(live.listing_native)} ETH${live.listing_usd ? ` ≈ ${fmtMoney(live.listing_usd)}` : ""}`
                : live.skipped?.includes("listing price") ? "Listing price needs an API key" : "Not currently listed for sale"}
            </div>
            <a className="live-link" href={live.opensea_url} target="_blank" rel="noopener noreferrer">View on OpenSea ↗</a>
          </div>
        </div>
      )}
    </div>
  );
}
