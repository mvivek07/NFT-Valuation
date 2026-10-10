// Thin wrapper around the Flask API.
async function json(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) {
    let msg = `server ${r.status}`;
    try { msg = (await r.json()).error || msg; } catch { /* non-JSON error */ }
    throw new Error(msg);
  }
  return r.json();
}

const post = (url, body) =>
  json(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const getMeta = () => json("/api/meta");
export const getCharts = () => json("/api/charts");
export const getSample = () => json("/api/sample");
export const getPreview = () => json("/api/preview");
export const postPredict = (body) => post("/api/predict", body);
export const postLive = (body) => post("/api/live", body);
