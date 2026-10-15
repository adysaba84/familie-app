import { svg } from './dom.js';

// Plain, labelled SVG charts (no library). Amounts come in RON minor units (bani).
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const monthLabel = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];

// 12.345,00 RON-bani -> "+12,3" (thousands, one decimal)
export function fmtK(minor, signed = true) {
  const k = Math.round(minor / 10000) / 10; // minor/100 = RON, /1000 = thousands
  const t = Math.abs(k).toFixed(1).replace('.', ',');
  return (k < 0 ? '−' : signed && k > 0 ? '+' : '') + t;
}

// Wealth 1 over the dates that have real entries: dots on a line, x proportional to the actual date (no monthly
// buckets, no interpolation). Value labels in thousands above the dots, dates below.
export function wealthLine(points, { width = 326, height = 124 } = {}) {
  const ms = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  const lo = Math.min(...points.map((p) => p.ron)), hi = Math.max(...points.map((p) => p.ron));
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
  const min = lo - pad, max = hi + pad;
  const left = 22, right = 42, top = 20, bottom = 36;
  const t0 = ms(points[0].date), span = ms(points[points.length - 1].date) - t0;
  const x = (p, i) => (points.length === 1 || !span ? width / 2 : left + ((ms(p.date) - t0) / span) * (width - left - right));
  const y = (v) => top + (1 - (v - min) / (max - min)) * (height - top - bottom);
  const kids = [svg('line', { x1: 0, y1: height - bottom + 6, x2: width, y2: height - bottom + 6, stroke: '#D5DAD6' })];
  if (points.length > 1) kids.push(svg('path', { d: 'M' + points.map((p, i) => `${x(p, i).toFixed(1)},${y(p.ron).toFixed(1)}`).join(' L'), fill: 'none', stroke: '#1F6F5C', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
  points.forEach((p, i) => {
    const cx = x(p, i), last = i === points.length - 1;
    kids.push(svg('circle', { cx, cy: y(p.ron), r: 4, fill: last ? '#1F6F5C' : '#FFFFFF', stroke: '#1F6F5C', 'stroke-width': 2 }));
    const anchor = i === 0 && points.length > 1 ? 'start' : last && points.length > 1 ? 'end' : 'middle';
    const tx = anchor === 'start' ? cx - 6 : anchor === 'end' ? cx + 6 : cx;
    // a point close to the previous one: value label to the right of its dot and date on a second row, so labels never overlap
    const near = i > 0 && cx - x(points[i - 1], i - 1) < 50;
    const nextNear = i < points.length - 1 && x(points[i + 1], i + 1) - cx < 50;
    kids.push(svg('text', { x: near ? cx + 8 : nextNear ? cx - 6 : tx, y: near ? y(p.ron) + 3 : y(p.ron) - 8, 'text-anchor': near ? 'start' : nextNear ? 'end' : anchor, 'font-size': 9, fill: '#16201C', 'font-weight': last ? 600 : 400 }, fmtK(p.ron, false) + 'k'));
    kids.push(svg('text', { x: tx, y: near ? height - 16 : height - 6, 'text-anchor': anchor, 'font-size': 9, fill: last ? '#16201C' : '#5B6661', 'font-weight': last ? 600 : 400 }, `${Number(p.date.slice(8, 10))} ${monthLabel(p.date)}`));
  });
  return svg('svg', { class: 'chart', role: 'img', viewBox: `0 0 ${width} ${height}`, 'aria-label': `Wealth 1 la ${points.length} date cu înregistrări reale` }, kids);
}

// Invested (dashed) vs value (solid) over time, RON.
export function investedVsValue(series, { width = 326, height = 110 } = {}) {
  const all = series.flatMap((p) => [p.investedRon, p.valueRon]);
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1;
  const min = lo - pad, max = hi + pad;
  const x = (i) => (series.length === 1 ? width / 2 : (i * width) / (series.length - 1));
  const y = (v) => height - ((v - min) / (max - min)) * height;
  const pts = (key) => series.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`);
  let stepPath = `M${x(0).toFixed(1)},${y(series[0].investedRon).toFixed(1)}`;
  for (let i = 1; i < series.length; i++) stepPath += ` H${x(i).toFixed(1)} V${y(series[i].investedRon).toFixed(1)}`;
  const grid = [0.25, 0.5, 0.75].map((f) => svg('line', { x1: 0, y1: height * f, x2: width, y2: height * f, stroke: '#EEF1EE' }));
  const v = pts('valueRon');
  return svg('svg', {
    class: 'chart', role: 'img', viewBox: `0 0 ${width} ${height}`,
    'aria-label': 'Suma investită față de valoarea contului în ultimele luni',
  },
  grid,
  svg('path', { d: `M${v.join(' L')} L${width},${height} L0,${height} Z`, fill: '#5FA48F', 'fill-opacity': 0.16 }),
  svg('path', { d: stepPath, fill: 'none', stroke: '#5B6661', 'stroke-width': 1.6, 'stroke-dasharray': '4 3' }),
  svg('path', { d: `M${v.join(' L')}`, fill: 'none', stroke: '#1F6F5C', 'stroke-width': 2.4, 'stroke-linejoin': 'round' }));
}

// Maturity bars: principal maturing per month (RON). The month holding more than half of the
// total is drawn red (everything maturing at once is a risk worth seeing).
export function maturityBars(buckets, { width = 326, height = 112 } = {}) {
  const max = Math.max(1, ...buckets.map((b) => b.totalRon));
  const sum = buckets.reduce((s, b) => s + b.totalRon, 0) || 1;
  const step = width / buckets.length, bw = Math.min(20, step - 4), base = 92, plot = 78;
  const kids = [svg('line', { x1: 0, y1: base, x2: width, y2: base, stroke: '#D5DAD6' })];
  buckets.forEach((b, i) => {
    const x = i * step + (step - bw) / 2, cx = x + bw / 2;
    const h = (b.totalRon / max) * plot;
    const hot = b.totalRon / sum > 0.5;
    if (b.totalRon > 0) {
      kids.push(svg('rect', { x, y: base - h, width: bw, height: Math.max(h, 2), rx: 3, fill: hot ? '#B3412E' : '#1F6F5C' }));
      kids.push(svg('text', { x: cx, y: base - h - 4, 'text-anchor': 'middle', 'font-size': 9, fill: hot ? '#B3412E' : '#16201C' }, fmtK(b.totalRon, false).replace(',0', '') + 'k'));
    }
    kids.push(svg('text', { x: cx, y: height - 4, 'text-anchor': 'middle', 'font-size': 9, fill: i === 0 ? '#16201C' : '#5B6661', 'font-weight': i === 0 ? 600 : 400 }, monthLabel(b.month)));
  });
  return svg('svg', { class: 'chart', role: 'img', viewBox: `0 0 ${width} ${height}`, 'aria-label': 'Scadențele depozitelor pe luni, următoarele 12 luni' }, kids);
}

// A small labelled history line with dots (gold value, savings balance). `baseline` draws a dashed reference.
export function sparkline(points, { width = 326, height = 60, color = '#C9A24A', baseline = null } = {}) {
  if (points.length === 0) return svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
  const vals = points.map((p) => p.value).concat(baseline != null ? [baseline] : []);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i) => (points.length === 1 ? width / 2 : 8 + (i * (width - 16)) / (points.length - 1));
  const y = (v) => height - 8 - ((v - lo) / span) * (height - 16);
  const kids = [];
  if (baseline != null) kids.push(svg('line', { x1: 0, y1: y(baseline), x2: width, y2: y(baseline), stroke: '#D5DAD6', 'stroke-dasharray': '3 3' }));
  if (points.length > 1) kids.push(svg('path', { d: 'M' + points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' L'), fill: 'none', stroke: color, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }));
  points.forEach((p, i) => kids.push(svg('circle', { cx: x(i), cy: y(p.value), r: 4, fill: i === points.length - 1 ? color : '#FFFFFF', stroke: color, 'stroke-width': 2 })));
  return svg('svg', { class: 'chart', role: 'img', viewBox: `0 0 ${width} ${height}`, 'aria-label': `Istoric: ${points.length} valori introduse` }, kids);
}
