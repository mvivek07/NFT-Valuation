import { fmtNum, fmtMoney } from "../format.js";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SPEC = [
  {
    key: "twitter", hue: "blue", title: "Creator's Twitter presence",
    fields: [
      ["followers_count_mean", "Followers", fmtNum],
      ["friends_count_mean", "Following", fmtNum],
      ["statuses_count_mean", "Lifetime tweets", fmtNum],
      ["nlikes_mean", "Likes per tweet", fmtNum],
      ["nretweets_mean", "Retweets per tweet", fmtNum],
      ["nreplies_mean", "Replies per tweet", fmtNum],
      ["number_of_tweets", "Tweets about this NFT", fmtNum],
      ["verified", "Verified account", (v) => (v == null ? "—" : v >= 0.5 ? "Yes" : "No")],
    ],
  },
  {
    key: "market", hue: "aqua", title: "Its collection on OpenSea",
    fields: [
      ["floor_price", "Floor price (ETH)", fmtNum],
      ["average_price", "Average price (ETH)", fmtNum],
      ["total_sales", "Total sales", fmtNum],
      ["total_volume", "Volume traded (ETH)", fmtNum],
      ["market_cap", "Market cap (ETH)", fmtNum],
      ["num_owners", "Owners", fmtNum],
      ["total_supply", "Items in collection", fmtNum],
    ],
  },
  {
    key: "activity", hue: "orange", title: "This NFT's own activity",
    fields: [
      ["numEvents", "Total events", fmtNum],
      ["successful", "Completed sales", fmtNum],
      ["transfer", "Transfers", fmtNum],
      ["created", "Times listed", fmtNum],
      ["bid_entered", "Bids received", fmtNum],
      ["offer_entered", "Offers received", fmtNum],
    ],
  },
];

export default function AssetProfile({ sample }) {
  const created = sample.created?.year
    ? `minted ${MONTHS[Number(sample.created.month) || 0]} ${Number(sample.created.year)}`
    : "mint date unknown";

  return (
    <div className="card">
      <div className="asset-head">
        <div className="asset-avatar">#{String(sample.row_id).slice(-3)}</div>
        <div>
          <div className="asset-id">Real NFT · asset #{sample.row_id}</div>
          <div className="asset-sub">Drawn at random from the 12,600 test NFTs the models never trained on · {created}</div>
        </div>
      </div>

      {sample.listing_price_usd > 0 && (
        <div className="asking">
          <span className="asking-l">Seller's asking price</span>
          <span className="asking-v">{fmtMoney(sample.listing_price_usd)}</span>
        </div>
      )}

      <div className="sample-banner">
        <span className="sample-dot" />
        <span>
          Below is <strong>exactly the data the models receive</strong> about this NFT. What actually
          happened to it on the market stays hidden until you press Predict.
        </span>
      </div>

      {SPEC.map((group) => (
        <div className={`profile-group hue-${group.hue}`} key={group.key}>
          <div className="profile-group-title">{group.title}</div>
          <div className="profile-grid">
            {group.fields.map(([col, label, fmt]) => {
              const v = sample.profile?.[group.key]?.[col];
              return (
                <div className={"pstat" + (v == null ? " na" : "")} key={col}>
                  <div className="pstat-v">{fmt(v)}</div>
                  <div className="pstat-l">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
