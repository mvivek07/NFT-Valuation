import { PageHead, Block } from "../components/Layout.jsx";

const FLOW = [
  ["blue", "Raw data", "Twitter + OpenSea"],
  ["aqua", "Clean & enrich", "121 → 135 features"],
  ["violet", "PCA", "135 → 47 components"],
  ["orange", "4 models", "SVM · Forest · GRU · Regression"],
  ["magenta", "KNN combiner", "final price class"],
  ["green", "Valuation", "asking price vs prediction"],
];

const STEPS = [
  ["01", "blue", "Collect and join", "Tweets that link to OpenSea are matched with each NFT's market record using the NFT's OpenSea address. Result: 62,997 NFTs with both social and market data. A live OpenSea client can fetch new NFTs too."],
  ["02", "aqua", "Clean", "Duplicates are removed, missing values are filled with the typical value for that column, and a few corrupted listing prices are thrown away."],
  ["03", "yellow", "Engineer features", "Very skewed counts (followers, volume) are log-scaled, and helpful ratios are added, such as engagement per follower. 121 columns become 135."],
  ["04", "violet", "Compress with PCA", "Many columns say nearly the same thing. PCA merges them into about 47 combined components that still hold 95% of the information."],
  ["05", "orange", "Train four models", "An SVM, a Random Forest, a GRU recurrent network that reads 1/7/30-day market trends in order, and a linear regression that estimates a dollar price."],
  ["06", "magenta", "Combine and value", "A KNN combiner weighs all four answers and picks the final class. The seller's asking price is then compared with that class: undervalued, fair or overvalued."],
];

const TERMS = [
  ["blue", "NFT (non-fungible token)", "A unique digital item recorded on a blockchain. Unlike a coin, no two are interchangeable, so each has its own price."],
  ["blue", "OpenSea", "The largest NFT marketplace. Its records show every listing, bid, sale and transfer of an NFT."],
  ["aqua", "Price class", "One of six price bands (unsold, bin1 … bin5). The models predict the band, not an exact dollar figure."],
  ["aqua", "Held-out test set", "20% of the NFTs (12,600) kept away from training. Scores measured on them show how the system behaves on NFTs it has never seen."],
  ["violet", "Feature", "One measurable fact about an NFT that a model can read, such as 'creator followers' or 'collection floor price'."],
  ["violet", "PCA (principal component analysis)", "A method that squeezes many overlapping columns into fewer combined ones while keeping most of the information."],
  ["orange", "SVM (support vector machine)", "A model that separates classes by drawing the widest possible boundary between them."],
  ["orange", "Random Forest", "Hundreds of simple decision trees that each vote; the majority wins."],
  ["orange", "GRU-RNN", "A neural network built for sequences. Here it reads a collection's 1-day, 7-day and 30-day numbers in order to sense momentum."],
  ["magenta", "KNN combiner", "Looks up past NFTs where the base models answered similarly and returns the class those NFTs actually had."],
  ["green", "Accuracy", "The share of NFTs put in the correct class. Easy to read, but flattered by the very large 'unsold' class."],
  ["green", "Macro-F1", "A 0-to-1 score computed per class and then averaged, so rare classes count as much as common ones."],
  ["yellow", "R²", "For price estimates: how much of the variation in real prices the model explains. 1 is perfect, 0 is no better than guessing the average."],
  ["yellow", "Undervalued / overvalued", "The asking price is below / above the price band the system predicts for that NFT."],
];

const LIMITS = [
  ["1", "The data is a 2021 snapshot", "Market behaviour changes. Predictions describe how NFTs with these signals performed in early 2021, not a guarantee about today."],
  ["2", "Rare classes are uncertain", "With only 211 and 23 examples, predictions for bin4 and bin5 are much less reliable than for the common classes."],
  ["3", "Twitter data is typed in for live NFTs", "Twitter/X no longer provides free data access, so live lookups use OpenSea data plus any Twitter numbers you enter."],
  ["4", "This is not financial advice", "The valuation verdict is a statistical signal from a student research project. Use it as one input, never the only one."],
];

const STACK = [
  ["Frontend", "React + Vite", "This multi-page interface with interactive Recharts graphs."],
  ["Backend", "Python Flask", "A small REST API that loads the trained models and serves predictions."],
  ["Machine learning", "scikit-learn + PyTorch", "PCA, SVM, Random Forest, KNN and regression; the GRU network is PyTorch."],
  ["Data", "TweetBoost / FinWeb", "62,997 NFTs joined from Twitter and OpenSea, plus a live OpenSea client."],
];

export default function Guide() {
  return (
    <div className="hue-green">
      <PageHead
        kicker="How it works"
        title="From raw tweets and trades to a price class, step by step"
        chips={[
          ["6", "pipeline stages"],
          ["135 → 47", "features after PCA"],
          ["4 + 1", "models plus a combiner"],
        ]}
      >
        This page explains the whole system without assuming any machine-learning background. Read
        the pipeline first; use the glossary whenever a term on another page is unfamiliar.
      </PageHead>

      <main className="page">
        <Block kicker="The big picture" title="The system in one line"
          intro="Data flows left to right. Every model reads the same compressed inputs, and the combiner turns their answers into one result.">
          <div className="flow">
            {FLOW.map(([hue, label, sub], i) => (
              <div className="flow-item" key={label}>
                <div className={`flow-box hue-${hue}`}>
                  <div className="flow-label">{label}</div>
                  <div className="flow-sub">{sub}</div>
                </div>
                {i < FLOW.length - 1 && <div className="flow-arrow">→</div>}
              </div>
            ))}
          </div>
        </Block>

        <Block kicker="Step by step" title="What happens at each stage">
          <div className="steps">
            {STEPS.map(([n, hue, title, text]) => (
              <div className={`step hue-${hue}`} key={n}>
                <div className="step-n">{n}</div>
                <div className="step-title">{title}</div>
                <div className="step-text">{text}</div>
              </div>
            ))}
          </div>
        </Block>

        <Block kicker="Why classes, not prices" title="The key design decision"
          intro="Three out of four NFTs never sell, and the rest range from cents to over $500,000. Predicting an exact price under those conditions is unreliable. Sorting NFTs into ten-fold price bands is a question the data can actually answer, and it is still what a buyer needs to know: is this a $50 item or a $5,000 one?" />

        <Block kicker="Glossary" title="Every technical term, in plain English">
          <dl className="glossary">
            {TERMS.map(([hue, term, text]) => (
              <div className={`term hue-${hue}`} key={term}>
                <dt>{term}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </Block>

        <Block kicker="Be careful" title="What this system cannot do">
          <div className="insight-list">
            {LIMITS.map(([n, title, text]) => (
              <div className="insight hue-yellow" key={n}>
                <span className="insight-ic">{n}</span>
                <span><strong>{title}</strong>{text}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block kicker="Under the hood" title="Technology used">
          <div className="stack">
            {STACK.map(([layer, name, text]) => (
              <div className="stack-item" key={layer}>
                <div className="stack-layer">{layer}</div>
                <div className="stack-name">{name}</div>
                <div className="stack-text">{text}</div>
              </div>
            ))}
          </div>
        </Block>
      </main>
    </div>
  );
}
