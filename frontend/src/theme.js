import { useEffect, useState } from "react";

// Chart colours. Model colours and the price-class ramp were checked with the
// palette validator against both surfaces (colour-blind separation, contrast).
export const PALETTES = {
  light: {
    ink: "#0f1222", ink2: "#4a4f66", muted: "#7f849b",
    grid: "#e4e7f1", surface: "#ffffff",
    good: "#0c7a0c", warn: "#d03b3b",
    seq: "#2a78d6",
    // one fixed colour per model, everywhere in the app
    models: {
      hybrid_knn: "#2a78d6", gru_rnn: "#eb6834", svm_rbf: "#1baf7a",
      random_forest: "#eda100", soft_vote: "#e87ba4", linear_regression: "#008300",
    },
    // price classes are ordered, so they share one hue (light -> dark); unsold is neutral
    classes: {
      unsold: "#a9aec2", bin1: "#86b6ef", bin2: "#5598e7",
      bin3: "#2a78d6", bin4: "#1c5cab", bin5: "#104281",
    },
  },
  dark: {
    ink: "#eef0f6", ink2: "#b6b9c9", muted: "#83869a",
    grid: "#2a2d3c", surface: "#151722",
    good: "#27b327", warn: "#e66767",
    seq: "#3987e5",
    models: {
      hybrid_knn: "#3987e5", gru_rnn: "#d95926", svm_rbf: "#199e70",
      random_forest: "#c98500", soft_vote: "#d55181", linear_regression: "#008300",
    },
    classes: {
      unsold: "#6b6f84", bin1: "#184f95", bin2: "#256abf",
      bin3: "#3987e5", bin4: "#6da7ec", bin5: "#9ec5f4",
    },
  },
};

export const MODEL_NAMES = {
  hybrid_knn: "Hybrid (KNN)",
  gru_rnn: "GRU-RNN",
  svm_rbf: "SVM",
  random_forest: "Random Forest",
  soft_vote: "Soft vote",
  linear_regression: "Linear regression",
};

function initialTheme() {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* storage unavailable */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [mode, setMode] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem("theme", mode); } catch { /* storage unavailable */ }
  }, [mode]);

  const isDark = mode === "dark";
  const toggle = () => setMode(isDark ? "light" : "dark");
  return { isDark, toggle, colors: PALETTES[mode] };
}
