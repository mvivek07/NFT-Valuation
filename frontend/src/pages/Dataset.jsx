import { useEffect, useState } from "react";
import { PageHead, Block } from "../components/Layout.jsx";
import { ChartCard, ClassDistChart, PriceHistChart, CorrChart } from "../components/Charts.jsx";
import ClassLegend from "../components/ClassLegend.jsx";
import { getPreview } from "../api.js";
import { fmtNum, fmtMoney } from "../format.js";
import { Icon } from "../icons.jsx";

const COLS = [
  ["followers_count_mean", "Followers", "tw", fmtNum],
  ["nlikes_mean", "Likes", "tw", fmtNum],
  ["number_of_tweets", "Tweets", "tw", fmtNum],
  ["floor_price", "Floor (ETH)", "os", fmtNum],
  ["total_sales", "Sales", "os", fmtNum],
  ["num_owners", "Owners", "os", fmtNum],
  ["numEvents", "Events", "os", fmtNum],
  ["listing_price_usd", "Asking", "os", fmtMoney],
  ["avg_price_usd", "Sold for", "y", (v) => (v > 0 ? fmtMoney(v) : "not sold")],
];

function PreviewTable() {
  const [rows, setRows] = useState(null);
  const load = () => getPreview().then((d) => setRows(d.rows)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>NFT</th>
              {COLS.map(([k, label, grp]) => <th key={k} className={`grp-${grp}`}>{label}</th>)}
              <th className="grp-y">Class</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r) => (
              <tr key={r.row_id}>
                <td>#{r.row_id}</td>
                {COLS.map(([k, , , fmt]) => <td key={k}>{fmt(r[k])}</td>)}
                <td><span className="cls-pill"><i style={{ background: `var(--cls-${r.price_class})` }} />{r.price_class}</span></td>
              </tr>
            ))}
            {rows === null && <tr><td colSpan={COLS.length + 2}>Loading real rows…</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-note">
        <span>
          <span className="key"><i style={{ background: "#2a78d6" }} /> from Twitter</span>
          <span className="key"><i style={{ background: "#1baf7a" }} /> from OpenSea</span>
          <span className="key"><i style={{ background: "#d55181" }} /> what the models predict</span>
        </span>
        <button className="btn secondary" type="button" onClick={load}>Show different rows</button>
      </div>
    </>
  );
}

export default function Dataset({ meta, charts, colors }) {
  return (
    <div className="hue-aqua">
      <PageHead
        kicker="Dataset"
        title="62,997 real NFTs, each with its tweets and its market record"
        chips={[
          ["62,997", "NFT assets"],
          ["245,159", "tweets analysed"],
          ["17,155", "Twitter users"],
          ["16,001", "collections"],
          ["Jan–Mar 2021", "collection period"],
        ]}
      >
        The project uses the <strong>TweetBoost / FinWeb research dataset</strong>. Researchers
        collected every tweet that contained an OpenSea link, then looked up each linked NFT's full
        market record. The two halves are joined on the NFT's OpenSea address. Nothing here is
        simulated.
      </PageHead>

      <main className="page">
        <Block kicker="What is in one row" title="Every NFT is described by three kinds of information"
          intro="Each row of the dataset is one NFT. The models read the first two groups and try to predict the third.">
          <div className="fg-grid">
            <div className="fg-card hue-blue">
              <div className="fg-head"><div className="fg-ic"><Icon.chat /></div><div><div className="fg-title">Twitter signals</div><div className="fg-count">77 columns</div></div></div>
              <div className="fg-text">How much attention the NFT and its promoter get. Several people may tweet about one NFT, so each number is stored as an average, median, minimum and maximum.</div>
              <div className="fg-tags">{["followers", "following", "likes", "retweets", "replies", "hashtags", "verified", "tweet count", "account age"].map((t) => <span className="fg-tag" key={t}>{t}</span>)}</div>
            </div>
            <div className="fg-card hue-aqua">
              <div className="fg-head"><div className="fg-ic"><Icon.store /></div><div><div className="fg-title">OpenSea market data</div><div className="fg-count">44 columns</div></div></div>
              <div className="fg-text">How the NFT and its collection behave on the marketplace: trading volume over 1, 7 and 30 days, floor price, number of owners, and every event on the asset.</div>
              <div className="fg-tags">{["floor price", "volume", "1/7/30-day sales", "market cap", "owners", "supply", "bids", "offers", "transfers"].map((t) => <span className="fg-tag" key={t}>{t}</span>)}</div>
            </div>
            <div className="fg-card hue-magenta">
              <div className="fg-head"><div className="fg-ic"><Icon.tag /></div><div><div className="fg-title">The answer to predict</div><div className="fg-count">1 label, 6 classes</div></div></div>
              <div className="fg-text">The NFT's average selling price, grouped into six bands. This is hidden from the models during testing and only used to check whether a prediction was right.</div>
              <div className="fg-tags">{["unsold", "bin1", "bin2", "bin3", "bin4", "bin5"].map((t) => <span className="fg-tag" key={t}>{t}</span>)}</div>
            </div>
          </div>
        </Block>

        <Block kicker="Look at the real thing" title="A few actual rows from the dataset"
          intro="Nine of the 121 columns are shown. Notice how many NFTs have an asking price but were never sold — that gap is exactly what the project tries to predict.">
          <PreviewTable />
        </Block>

        {charts && (
          <Block kicker="The shape of the market" title="What the data looks like as a whole"
            intro="Two facts explain most design decisions in this project: most NFTs never sell, and those that do span an enormous price range.">
            <div className="chart-grid">
              <ChartCard title="Three out of four NFTs never sell"
                subtitle="Share of all 62,997 NFTs in each price class. Because one class is so large, accuracy alone can be misleading — see the Models page.">
                <ClassDistChart data={charts.class_counts} colors={colors} />
              </ChartCard>
              <ChartCard title="Sold NFTs range from cents to $500K+"
                subtitle={`How many of the ${charts.n_sold.toLocaleString()} sold NFTs went for each price. Each step on the bottom axis is a multiple, not a fixed amount, which is why the classes are ten-fold bands.`}>
                <PriceHistChart data={charts.price_hist} colors={colors} />
              </ChartCard>
              <ChartCard wide title="Which signals move with price"
                subtitle="Correlation of each input with the average selling price. Zero means no relationship; larger bars move more closely with price. Collection-level market numbers lead, and Twitter engagement adds signal on top.">
                <CorrChart data={charts.correlations} colors={colors} />
              </ChartCard>
            </div>
          </Block>
        )}

        <Block kicker="The target" title="The six price classes"
          intro="Share of the dataset in each class. The imbalance is real: only 23 NFTs out of 62,997 ever sold for more than $100K.">
          <ClassLegend meta={meta} />
        </Block>
      </main>
    </div>
  );
}
