// Shared page furniture: coloured page header and titled content blocks.

export function PageHead({ kicker, title, children, chips = [] }) {
  return (
    <header className="page-head">
      <div className="page-head-inner">
        <div className="page-kicker">{kicker}</div>
        <h1>{title}</h1>
        <p className="page-lede">{children}</p>
        {chips.length > 0 && (
          <div className="page-chips">
            {chips.map(([value, label]) => (
              <div className="page-chip" key={label}>
                <div className="page-chip-v">{value}</div>
                <div className="page-chip-l">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export function Block({ kicker, title, intro, hue, children }) {
  return (
    <section className={"block" + (hue ? ` hue-${hue}` : "")}>
      {(title || kicker) && (
        <div className="block-head">
          {kicker && <span className="block-kicker">{kicker}</span>}
          {title && <h2>{title}</h2>}
          {intro && <p>{intro}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
