import Logo from "./Logo.jsx";
import { Icon } from "../icons.jsx";

export const ROUTES = [
  { id: "home", label: "Home", hue: "blue", icon: Icon.home, hint: () => "Project overview" },
  { id: "predictor", label: "Predictor", hue: "violet", icon: Icon.bolt, hint: () => "Value an NFT live" },
  { id: "dataset", label: "Dataset", hue: "aqua", icon: Icon.database, hint: (m) => (m ? `${m.n_assets.toLocaleString()} real NFTs` : "The data") },
  { id: "models", label: "Models", hue: "orange", icon: Icon.chart, hint: (m) => (m ? `${(m.accuracy.hybrid_knn * 100).toFixed(1)}% accuracy` : "Results") },
  { id: "guide", label: "How it works", hue: "green", icon: Icon.book, hint: () => "Pipeline & glossary" },
];

export default function Navbar({ route, meta, isDark, onToggleTheme }) {
  return (
    <>
      <div className="infobar">
        <span><i className="live-dot" /> Models loaded and running</span>
        {meta && <span>{meta.n_assets.toLocaleString()} real NFTs</span>}
        <span>245,159 tweets analysed</span>
        <span>4 models + KNN combiner</span>
        {meta && <span>{(meta.accuracy.hybrid_knn * 100).toFixed(1)}% accuracy on {meta.n_test.toLocaleString()} unseen NFTs</span>}
      </div>
      <nav className="navbar">
        <a className="nav-brand" href="#/home">
          <Logo size={36} id="nav" />
          <span>
            <div className="nav-brand-name">NFT Valuator</div>
            <div className="nav-brand-sub">Social-signal asset valuation</div>
          </span>
        </a>
        <div className="nav-tabs">
          {ROUTES.map((r) => (
            <a
              key={r.id}
              href={`#/${r.id}`}
              className={`nav-tab hue-${r.hue}` + (route === r.id ? " active" : "")}
              aria-current={route === r.id ? "page" : undefined}
            >
              <span className="nav-tab-ic"><r.icon /></span>
              <span className="nav-tab-text">
                <span className="nav-tab-label">{r.label}</span>
                <span className="nav-tab-hint">{r.hint(meta)}</span>
              </span>
            </a>
          ))}
        </div>
        <button
          className="theme-toggle" type="button" onClick={onToggleTheme}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          title={isDark ? "Light theme" : "Dark theme"}
        >
          {isDark ? <Icon.sun /> : <Icon.moon />}
        </button>
      </nav>
    </>
  );
}
