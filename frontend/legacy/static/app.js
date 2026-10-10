/* NFT Valuator frontend logic */
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $("form");
  let META = null;
  let sampleRowId = null; // set when a real asset is loaded

  const fmt = (n) => n.toLocaleString("en-US");
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";

  // ---------- meta / stat tiles ----------
  async function loadMeta() {
    const r = await fetch("/api/meta");
    META = await r.json();
    $("t-assets").textContent = fmt(META.n_assets);
    $("t-svm").textContent = pct(META.accuracy.svm);
    $("t-rf").textContent = pct(META.accuracy.random_forest);
    $("t-feat").innerHTML = `${META.n_features}<span class="unit"> feats</span>`;

    const legend = $("legend");
    legend.innerHTML = "";
    for (const cls of META.class_order) {
      const el = document.createElement("div");
      el.className = "legend-item";
      el.innerHTML = `
        <div class="legend-cls">${cls}</div>
        <div class="legend-range">${META.class_ranges[cls]}</div>
        <div class="legend-share">${pct(META.class_distribution[cls] || 0)} of assets</div>`;
      legend.appendChild(el);
    }
  }

  // ---------- sample loading ----------
  async function loadSample() {
    setStatus("loading asset…");
    const r = await fetch("/api/sample");
    const s = await r.json();
    sampleRowId = s.row_id;
    for (const [k, v] of Object.entries(s.values)) {
      const input = form.elements[k];
      if (!input) continue;
      if (input.type === "checkbox") input.checked = !!v && v >= 0.5;
      else input.value = v === null ? "" : v;
    }
    setStatus(`real asset #${s.row_id} loaded`);
  }

  function clearForm() {
    form.reset();
    sampleRowId = null;
    $("result").hidden = true;
    $("result-empty").hidden = false;
    setStatus("idle");
  }

  function setStatus(txt) { $("status-chip").textContent = txt; }

  // Any manual edit invalidates the loaded sample (we'd otherwise predict the
  // stored full row, not what the user sees).
  form.addEventListener("input", () => { sampleRowId = null; });

  // ---------- prediction ----------
  async function predict(ev) {
    ev.preventDefault();
    const btn = $("btn-predict");
    btn.disabled = true;
    setStatus("predicting…");

    const body = { row_id: sampleRowId };
    if (sampleRowId === null) {
      const features = {};
      for (const el of form.elements) {
        if (!el.name) continue;
        if (el.type === "checkbox") features[el.name] = el.checked ? 1 : 0;
        else if (el.value !== "") features[el.name] = parseFloat(el.value);
      }
      body.features = features;
    }

    try {
      const r = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("server " + r.status);
      render(await r.json());
      setStatus("done");
    } catch (e) {
      setStatus("error");
      alert("Prediction failed: " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  function render(res) {
    $("result-empty").hidden = true;
    $("result").hidden = false;

    // headline = best model (SVM)
    $("v-class").textContent = res.svm;
    $("v-range").textContent = META.class_ranges[res.svm] || "";

    $("m-svm").textContent = res.svm;
    $("m-rf").textContent = res.random_forest;
    const agree = $("m-agree");
    agree.textContent = res.agree ? "models agree ✓" : "models differ";
    agree.className = "model-pred " + (res.agree ? "ok" : "diff");

    // truth row (only for real held-out assets)
    const truthRow = $("truth-row");
    if (res.actual) {
      truthRow.hidden = false;
      $("truth-class").textContent = res.actual + " (" + (META.class_ranges[res.actual] || "") + ")";
      const hit = res.actual === res.svm;
      const flag = $("truth-flag");
      flag.textContent = hit ? "correct ✓" : "missed ✗";
      flag.className = "truth-flag " + (hit ? "hit" : "miss");
      $("truth-price").textContent = "";
    } else {
      truthRow.hidden = true;
    }

    // probability bars (RF) — one hue, winner emphasized by weight not color
    const proba = $("proba");
    proba.innerHTML = "";
    const winner = res.random_forest;
    for (const { cls, p } of res.rf_probabilities) {
      const row = document.createElement("div");
      row.className = "proba-row" + (cls === winner ? " winner" : "");
      row.innerHTML = `
        <span class="proba-name">${cls}</span>
        <span class="proba-track"><span class="proba-fill" style="width:0%"></span></span>
        <span class="proba-val">${pct(p)}</span>`;
      row.title = `${cls} (${META.class_ranges[cls]}): ${pct(p, 2)}`;
      proba.appendChild(row);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          row.querySelector(".proba-fill").style.width = Math.max(p * 100, 0.8) + "%";
        })
      );
    }
  }

  // ---------- wire up ----------
  $("btn-sample").addEventListener("click", loadSample);
  $("btn-clear").addEventListener("click", clearForm);
  form.addEventListener("submit", predict);
  loadMeta().catch((e) => setStatus("meta load failed"));
})();
