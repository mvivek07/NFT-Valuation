import { Block } from "../components/Layout.jsx";
import { ChartCard, ModelBarChart } from "../components/Charts.jsx";
import ClassLegend from "../components/ClassLegend.jsx";
import { Icon } from "../icons.jsx";

const pct = (x) => (x * 100).toFixed(1) + "%";
const CLASSIFIERS = ["hybrid_knn", "gru_rnn", "soft_vote", "svm_rbf", "random_forest"];

function Tile({ hue, icon: Ic, value, title, label }) {
  return (
    <div className={`tile hue-${hue}`}>
      <div className="tile-icon"><Ic /></div>
      <div className="tile-value">{value}</div>
      <div className="tile-title">{title}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}

const EXPLORE = [
  { id: "predictor", hue: "violet", icon: Icon.bolt, title: "Try the predictor", text: "Pull a real NFT the models never saw, predict its price class, then reveal what actually happened." },
  { id: "dataset", hue: "aqua", icon: Icon.database, title: "Explore the dataset", text: "See real rows, what each column means, and how lopsided the NFT market really is." },
  { id: "models", hue: "orange", icon: Icon.chart, title: "Compare the models", text: "Five models side by side: accuracy, where each one goes wrong, and why the hybrid wins." },
  { id: "guide", hue: "green", icon: Icon.book, title: "Understand how it works", text: "The pipeline step by step, plus a plain-English glossary of every technical term." },
];

export default function Home({ meta, charts, colors }) {
  return (
    <div className="hue-blue">
      <header className="hero">
        <div className="hero-blob b1" /><div className="hero-blob b2" /><div className="hero-blob b3" />
        <div className="hero-inner">
          <div className="hero-badge"><span className="dot" /> Major project · Analysis of trending NFTs with machine learning</div>
          <h1 className="hero-title">
            Know what an NFT is <span className="hero-accent">really worth</span> before you buy
          </h1>
          <p className="hero-copy">
            NFT Valuator reads the two signals this market runs on — the creator's{" "}
            <strong>Twitter engagement</strong> and the collection's <strong>OpenSea track
            record</strong> — and predicts which price band an NFT belongs to, from{" "}
            <strong>never sold</strong> to <strong>$100K+</strong>. Then it tells you whether the
            asking price is fair.
          </p>
          <div className="hero-cta">
            <a className="hero-btn" href="#/predictor">Try it on a real NFT</a>
            <a className="hero-btn-ghost" href="#/guide">How does it work?</a>
          </div>
        </div>
      </header>

      <main className="page overlap">
        <section className="block">
          <div className="tiles">
            <Tile hue="aqua" icon={Icon.database} value={meta ? meta.n_assets.toLocaleString() : "—"}
              title="Real NFTs" label="Every asset tweeted with an OpenSea link, Jan–Mar 2021" />
            <Tile hue="blue" icon={Icon.target} value={meta ? pct(meta.accuracy.hybrid_knn) : "—"}
              title="Hybrid accuracy" label="Correct price class on 12,600 NFTs it never saw" />
            <Tile hue="orange" icon={Icon.wave} value={meta ? pct(meta.accuracy.gru_rnn) : "—"}
              title="Best single model" label="GRU-RNN reading 1, 7 and 30-day market trends" />
            <Tile hue="violet" icon={Icon.layers} value={meta ? meta.n_features : "—"}
              title="Signals per NFT" label="Twitter + OpenSea features, compressed by PCA" />
          </div>
        </section>

        <Block kicker="The story in three steps" title="Why this project exists"
          intro="NFT prices look random from the outside. This project shows they are far more predictable once social attention is measured alongside market data.">
          <div className="explain-grid">
            <div className="explain-card hue-magenta">
              <div className="explain-num">1</div>
              <div className="explain-title">The problem</div>
              <div className="explain-text">
                <strong>76% of NFTs never sell at all</strong>, while a lucky few fetch six figures.
                Most assets have one sale or none, so classic price forecasting has no history to
                learn from. Buyers are guessing.
              </div>
            </div>
            <div className="explain-card hue-violet">
              <div className="explain-num">2</div>
              <div className="explain-title">The idea</div>
              <div className="explain-text">
                Value here follows <strong>attention</strong>. Join each NFT's OpenSea record with
                its creator's Twitter numbers — followers, likes, retweets — and a model can learn
                which mixes of hype and market strength lead to which price level.
              </div>
            </div>
            <div className="explain-card hue-aqua">
              <div className="explain-num">3</div>
              <div className="explain-title">The result</div>
              <div className="explain-text">
                Instead of guessing an exact price, the system sorts each NFT into one of six price
                bands and gets it right <strong>{meta ? pct(meta.accuracy.hybrid_knn) : "91.5%"} of
                the time</strong> on unseen assets — about 15 points better than always answering
                "unsold".
              </div>
            </div>
          </div>
        </Block>

        <Block kicker="Explore" title="Four places to look"
          intro="Each tab in the navigation bar is its own page with its own data.">
          <div className="explore-grid">
            {EXPLORE.map((e) => (
              <a className={`explore-card hue-${e.hue}`} href={`#/${e.id}`} key={e.id}>
                <div className="explore-ic"><e.icon /></div>
                <div className="explore-title">{e.title}</div>
                <div className="explore-text">{e.text}</div>
                <div className="explore-go">Open page →</div>
              </a>
            ))}
          </div>
        </Block>

        <Block kicker="What gets predicted" title="The six price classes"
          intro="Sale prices range from cents to over half a million dollars, so each band is ten times wider than the one before it. The darker the bar, the more valuable the class.">
          <ClassLegend meta={meta} />
        </Block>

        {charts?.model_summary && (
          <Block kicker="Results at a glance" title="How the models compare"
            intro="Accuracy is the share of the 12,600 test NFTs placed in the right price class. Each model keeps the same colour everywhere on this site.">
            <div className="chart-grid">
              <ChartCard wide title="Accuracy by model"
                subtitle="The hybrid combines the other models' answers and edges out every one of them. Always guessing 'unsold' would score about 76%.">
                <ModelBarChart summary={charts.model_summary} metric="accuracy" colors={colors} keys={CLASSIFIERS} />
              </ChartCard>
            </div>
          </Block>
        )}
      </main>
    </div>
  );
}
