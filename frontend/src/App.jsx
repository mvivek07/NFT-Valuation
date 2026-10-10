import { useEffect, useState } from "react";
import { getMeta, getCharts, getSample, postPredict, postLive } from "./api.js";
import { useTheme } from "./theme.js";
import Navbar, { ROUTES } from "./components/Navbar.jsx";
import Logo from "./components/Logo.jsx";
import { EMPTY_FORM } from "./components/PredictForm.jsx";
import Home from "./pages/Home.jsx";
import Predictor from "./pages/Predictor.jsx";
import Dataset from "./pages/Dataset.jsx";
import Models from "./pages/Models.jsx";
import Guide from "./pages/Guide.jsx";

const routeFromHash = () => {
  const id = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.some((r) => r.id === id) ? id : "home";
};

export default function App() {
  const { isDark, toggle, colors } = useTheme();
  const [route, setRoute] = useState(routeFromHash);
  const [meta, setMeta] = useState(null);
  const [charts, setCharts] = useState(null);

  // predictor state lives here so it survives switching pages
  const [mode, setMode] = useState("real");
  const [values, setValues] = useState(EMPTY_FORM);
  const [sample, setSample] = useState(null);
  const [result, setResult] = useState(null);
  const [live, setLive] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    const onHash = () => { setRoute(routeFromHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    getMeta().then(setMeta).catch(() => setStatus("could not reach server"));
    getCharts().then(setCharts).catch(() => {});
  }, []);

  const switchMode = (m) => { setMode(m); setResult(null); setLive(null); setStatus("idle"); };
  const handleChange = (name, value) => setValues((v) => ({ ...v, [name]: value }));
  const handleClear = () => { setValues(EMPTY_FORM); setResult(null); setStatus("idle"); };

  const handleLoadSample = async () => {
    setStatus("loading asset…");
    setResult(null);
    try {
      const s = await getSample();
      setSample(s);
      setStatus(`asset #${s.row_id} loaded`);
    } catch {
      setStatus("load failed");
    }
  };

  const handlePredict = async () => {
    setStatus("predicting…");
    try {
      const body = {};
      if (mode === "real" && sample) {
        body.row_id = sample.row_id;
      } else {
        body.row_id = null;
        const features = {};
        for (const [k, v] of Object.entries(values)) {
          if (k === "listing_usd") continue;
          if (k === "verified") features[k] = v ? 1 : 0;
          else if (v !== "") features[k] = parseFloat(v);
        }
        body.features = features;
        body.listing_usd = values.listing_usd === "" ? null : parseFloat(values.listing_usd);
      }
      setResult(await postPredict(body));
      setStatus("done");
    } catch (e) {
      setStatus("error");
      alert("Prediction failed: " + e.message);
    }
  };

  const handleLookup = async (payload) => {
    setStatus("fetching live data…");
    setResult(null);
    setLive(null);
    try {
      const r = await postLive(payload);
      setLive(r.live);
      setResult(r);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      alert(e.message);
    }
  };

  return (
    <>
      <Navbar route={route} meta={meta} isDark={isDark} onToggleTheme={toggle} />

      {route === "home" && <Home meta={meta} charts={charts} colors={colors} />}
      {route === "predictor" && (
        <Predictor
          meta={meta} mode={mode} setMode={switchMode} sample={sample} values={values}
          status={status} result={result} live={live}
          onChange={handleChange} onLoadSample={handleLoadSample} onClear={handleClear}
          onPredict={handlePredict} onLookup={handleLookup}
        />
      )}
      {route === "dataset" && <Dataset meta={meta} charts={charts} colors={colors} />}
      {route === "models" && <Models charts={charts} colors={colors} />}
      {route === "guide" && <Guide />}

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-logo"><Logo size={42} id="ft" /></div>
          <div className="footer-title">Analysis of Trending NFTs using Time-Series Data and Machine Learning</div>
          <div>Dataset: TweetBoost / FinWeb · 62,997 OpenSea NFTs · Jan–Mar 2021</div>
          <div>Department of CSE (Data Science) · 2026-27</div>
        </div>
      </footer>
    </>
  );
}
