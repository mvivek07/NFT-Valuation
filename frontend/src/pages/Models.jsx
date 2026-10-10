import { useState } from "react";
import { PageHead, Block } from "../components/Layout.jsx";
import { ChartCard, ModelBarChart, F1Chart, PcaChart, ConfusionHeatmap } from "../components/Charts.jsx";

const CLASSIFIERS = ["hybrid_knn", "gru_rnn", "soft_vote", "svm_rbf", "random_forest"];

const CARDS = [
  { key: "hybrid_knn", name: "Hybrid · KNN combiner", tag: "FINAL", note: "Looks at every other model's answer and picks the class that best matches. This is the system's final output." },
  { key: "gru_rnn", name: "GRU-RNN", tag: "NEURAL NET", note: "A recurrent network that reads the collection's 1-day, 7-day and 30-day numbers in order, so it can see momentum. Best single model." },
  { key: "svm_rbf", name: "SVM (RBF kernel)", tag: "CLASSIC", note: "Draws curved boundaries between classes. Very strong on the common classes, weaker on the rare expensive ones." },
  { key: "random_forest", name: "Random Forest", tag: "CLASSIC", note: "300 decision trees voting together. Lower accuracy, but more balanced across the rare price bands." },
  { key: "soft_vote", name: "Soft vote", tag: "AVERAGE", note: "A simple average of the Random Forest, SVM and GRU answers. A baseline for the combiner to beat." },
  { key: "linear_regression", name: "Linear regression", tag: "PRICE", note: "Estimates a dollar price for NFTs that sell. It cannot answer 'unsold', so it is judged by R² instead of accuracy." },
];

const INSIGHTS = [
  ["1", "blue", "Why 91.5% is a real result", "A model that always answers \"unsold\" already scores about 76%, because most NFTs never sell. The achievement is the roughly 15 points above that baseline."],
  ["2", "orange", "Why the neural network helps", "The GRU reads the 1-day, 7-day and 30-day market numbers as a sequence, so it notices a collection heating up or cooling down. The other models only see those as separate numbers."],
  ["3", "violet", "What macro-F1 tells you", "Accuracy is dominated by the huge \"unsold\" class. Macro-F1 scores each class separately and averages them, so it shows how a model copes with the rare expensive bands."],
  ["4", "aqua", "How the combiner stays honest", "The KNN combiner is trained only on predictions the base models made for NFTs they had not trained on. That keeps its 91.5% a fair estimate."],
  ["5", "magenta", "Why bin4 and bin5 are hard", "Only 211 NFTs ever sold for $10K–100K and 23 for more than $100K. That leaves 42 and 5 examples in the test set — too few for any model to learn reliably."],
  ["6", "green", "Mistakes are usually near misses", "When a model is wrong it nearly always picks the neighbouring band (bin2 instead of bin1), not a wild guess. You can see this next to the diagonal in the confusion matrix."],
];

export default function Models({ charts, colors }) {
  const [model, setModel] = useState("svm_rbf");
  if (!charts) return <div className="hue-orange"><main className="page">Loading results…</main></div>;
  const ms = charts.model_summary || {};
  const cm = charts.confusion[model];
  const pctOf = (k) => (ms[k] ? (ms[k].accuracy * 100).toFixed(1) + "%" : "—");

  return (
    <div className="hue-orange">
      <PageHead
        kicker="Models"
        title="Five models, one test, and where each of them goes wrong"
        chips={[
          [pctOf("hybrid_knn"), "hybrid accuracy (final)"],
          [pctOf("gru_rnn"), "best single model"],
          ["12,600", "test NFTs, never seen in training"],
          ["~76%", "score of always guessing 'unsold'"],
        ]}
      >
        Every model was trained on 50,397 NFTs and then tested on <strong>12,600 it had never
        seen</strong>. All numbers on this page come from that test. Each model keeps one colour
        across the whole site.
      </PageHead>

      <main className="page">
        <Block kicker="The line-up" title="Meet the models"
          intro="Four models make their own prediction. A fifth, the combiner, reads their answers and makes the final call.">
          <div className="model-grid">
            {CARDS.map((m) => {
              const r = ms[m.key];
              if (!r) return null;
              const isLR = m.key === "linear_regression";
              return (
                <div className={"ms-card" + (m.key === "hybrid_knn" ? " best" : "")} key={m.key}
                  style={{ "--mc": `var(--m-${m.key})` }}>
                  <div className="ms-top"><span className="ms-name">{m.name}</span><span className="ms-tag">{m.tag}</span></div>
                  {isLR ? (
                    <>
                      <div className="ms-acc">R² {r.r2_sold_assets.toFixed(2)}</div>
                      <div className="ms-sub">on {r.n_sold_test.toLocaleString()} sold test NFTs</div>
                    </>
                  ) : (
                    <>
                      <div className="ms-acc">{(r.accuracy * 100).toFixed(1)}%</div>
                      <div className="ms-sub">accuracy · macro-F1 {r.macro_f1.toFixed(2)}</div>
                    </>
                  )}
                  <div className="ms-note">{m.note}</div>
                </div>
              );
            })}
          </div>
        </Block>

        <Block kicker="Side by side" title="Two ways to score the same models"
          intro="Accuracy asks how many NFTs were classified correctly. Macro-F1 asks how well each class is handled on average. A good model should do well on both.">
          <div className="chart-grid">
            <ChartCard title="Accuracy"
              subtitle="Share of test NFTs placed in the correct price class. Higher is better.">
              <ModelBarChart summary={ms} metric="accuracy" colors={colors} keys={CLASSIFIERS} />
            </ChartCard>
            <ChartCard title="Macro-F1"
              subtitle="Average quality across all six classes, from 0 to 1. Rewards models that handle rare classes.">
              <ModelBarChart summary={ms} metric="macro_f1" colors={colors} keys={CLASSIFIERS} />
            </ChartCard>
          </div>
        </Block>

        <Block kicker="Where the errors are" title="Confusion matrix"
          intro="Each row is a true price class; each column is what the model predicted. A perfect model would have 100% along the diagonal and nothing elsewhere.">
          <div className="chart-grid">
            <ChartCard wide title={model === "svm_rbf" ? "SVM predictions" : "Random Forest predictions"}
              subtitle="Mistakes cluster right next to the diagonal: the model usually picks the neighbouring price band. The bin4 and bin5 rows are noisy because they contain only 42 and 5 test NFTs.">
              <div className="cm-switch">
                <button className={"mode-tab small" + (model === "svm_rbf" ? " active" : "")} onClick={() => setModel("svm_rbf")} type="button">SVM</button>
                <button className={"mode-tab small" + (model === "random_forest" ? " active" : "")} onClick={() => setModel("random_forest")} type="button">Random Forest</button>
              </div>
              <ConfusionHeatmap labels={charts.confusion_labels} matrix={cm.norm} counts={cm.counts} colors={colors} />
            </ChartCard>
          </div>
        </Block>

        <Block kicker="Class by class" title="Common classes are easy, rare ones are hard"
          intro="The left chart shows the score for each price class. The right chart shows how PCA shrinks the inputs every model reads.">
          <div className="chart-grid">
            <ChartCard title="F1 score per price class"
              subtitle="Both classic models are almost perfect on 'unsold'. Scores drop for the expensive bands, where there are very few examples to learn from.">
              <F1Chart perClass={charts.per_class} colors={colors} />
            </ChartCard>
            <ChartCard title="PCA: fewer inputs, same information"
              subtitle={`Keeping ${charts.pca.length} combined components out of 135 features preserves 95% of the information, which makes every model faster to train.`}>
              <PcaChart data={charts.pca} colors={colors} />
            </ChartCard>
          </div>
        </Block>

        <Block kicker="In plain words" title="How to read these results">
          <div className="insight-list">
            {INSIGHTS.map(([n, hue, title, text]) => (
              <div className={`insight hue-${hue}`} key={n}>
                <span className="insight-ic">{n}</span>
                <span><strong>{title}</strong>{text}</span>
              </div>
            ))}
          </div>
        </Block>
      </main>
    </div>
  );
}
