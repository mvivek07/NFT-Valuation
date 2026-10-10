// Small stroke-icon set shared across the app.
const base = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
};

export const Icon = {
  home: () => <svg {...base}><path d="M3.5 11 12 4l8.5 7" /><path d="M6 10v9.5h12V10" /><path d="M10 19.5v-5h4v5" /></svg>,
  bolt: () => <svg {...base}><path d="M13 2 4.5 13.5H11L10 22l9.5-12.5H13Z" /></svg>,
  database: () => <svg {...base}><ellipse cx="12" cy="5.5" rx="7.5" ry="3" /><path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13" /><path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" /></svg>,
  chart: () => <svg {...base}><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></svg>,
  book: () => <svg {...base}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 21H20" /><path d="M9 8h7M9 12h5" /></svg>,
  sun: () => <svg {...base}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" /></svg>,
  moon: () => <svg {...base}><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" /></svg>,
  dice: () => <svg {...base}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><circle cx="8.5" cy="8.5" r=".9" fill="currentColor" /><circle cx="15.5" cy="15.5" r=".9" fill="currentColor" /><circle cx="12" cy="12" r=".9" fill="currentColor" /><circle cx="15.5" cy="8.5" r=".9" fill="currentColor" /><circle cx="8.5" cy="15.5" r=".9" fill="currentColor" /></svg>,
  globe: () => <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>,
  pencil: () => <svg {...base}><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 7.5 3 3" /></svg>,
  chat: () => <svg {...base}><path d="M4 5h16v11H9l-5 4Z" /><path d="M8 9.5h8M8 12.5h5" /></svg>,
  store: () => <svg {...base}><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12v8h13v-8" /></svg>,
  target: () => <svg {...base}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>,
  layers: () => <svg {...base}><path d="M12 3 21 8l-9 5-9-5Z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 17 9 5 9-5" opacity=".5" /></svg>,
  wave: () => <svg {...base}><path d="M2.5 12c2.2-5 4.2-5 6.4 0s4.2 5 6.4 0 4.2-5 6.2 0" /></svg>,
  tag: () => <svg {...base}><path d="M3.5 12.5V4.5h8l9 9-8 8Z" /><circle cx="8" cy="9" r="1.3" /></svg>,
  refresh: () => <svg {...base}><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20 4v5h-5" /></svg>,
};
