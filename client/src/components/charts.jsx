/**
 * Graphiques SVG simples et accessibles : chaque graphique a un titre/description
 * et un tableau de données équivalent pour les lecteurs d'écran.
 */
import { fmtDateShort } from '../format.js';

export function LineChart({ points, title, height = 200, yMax = 100, unit = '%' }) {
  if (!points.length) return null;
  const w = 640;
  const pad = { l: 36, r: 12, t: 12, b: 28 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const x = (i) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => pad.t + ih - (v / yMax) * ih;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const ticks = [0, 25, 50, 75, 100].map((t) => (t / 100) * yMax);
  const labelEvery = Math.ceil(points.length / 8);
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-labelledby="lc-title">
        <title id="lc-title">{title}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line className="axis" x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <line className="bar-target" x1={pad.l} x2={w - pad.r} y1={y(yMax / 2)} y2={y(yMax / 2)} />
        <path className="line" d={path} />
        {points.map((p, i) => (
          <g key={i}>
            <circle className="dot" cx={x(i)} cy={y(p.value)} r="4"><title>{`${p.label} : ${Math.round(p.value)} ${unit}`}</title></circle>
            {i % labelEvery === 0 && <text x={x(i)} y={height - 8} textAnchor="middle">{p.short}</text>}
          </g>
        ))}
      </svg>
      <figcaption className="sr-only">
        <table>
          <caption>{title}</caption>
          <tbody>{points.map((p, i) => <tr key={i}><th scope="row">{p.label}</th><td>{Math.round(p.value)} {unit}</td></tr>)}</tbody>
        </table>
      </figcaption>
    </figure>
  );
}

export function BarList({ items, title, max = 100, unit = '%' }) {
  return (
    <figure style={{ margin: 0 }} aria-label={title}>
      <ul className="list">
        {items.map((it) => (
          <li key={it.label} style={{ padding: '8px 0' }}>
            <div className="row-between small">
              <span>{it.label}</span>
              <strong>{it.value == null ? '—' : `${Math.round(it.value)} ${unit}`}</strong>
            </div>
            <div className="progress" role="progressbar" aria-valuenow={Math.round(it.value || 0)} aria-valuemin={0} aria-valuemax={max} aria-label={it.label}>
              <span style={{ width: `${((it.value || 0) / max) * 100}%`, background: it.color }} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function timelinePoints(attempts) {
  return attempts.map((a) => ({ value: a.percent, label: `${fmtDateShort(a.finished_at)} — ${a.kind}`, short: fmtDateShort(a.finished_at) }));
}
