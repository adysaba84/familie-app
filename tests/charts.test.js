import { test, eq, ok } from './harness.js';
import { wealthLine, labelledIndexes } from '../js/charts.js';
import { TABS } from '../js/ui.js';

test('labelledIndexes: the last point is always labelled; touching points are skipped, far ones kept', () => {
  eq([...labelledIndexes([10, 200, 201])].sort(), [0, 2]); // two points a day apart: only the last one
  eq([...labelledIndexes([10, 100, 190])].sort(), [0, 1, 2]);
  const xs = [10, 40, 70, 100, 130];
  const picked = [...labelledIndexes(xs, 48)].map((i) => xs[i]).sort((a, b) => a - b);
  for (let i = 1; i < picked.length; i++) ok(picked[i] - picked[i - 1] >= 48, 'labels are at least 48 apart');
  ok(labelledIndexes(xs, 48).has(xs.length - 1));
  eq([...labelledIndexes([50])], [0]); eq([...labelledIndexes([])], []);
});

const labels = (svg) => [...svg.querySelectorAll('text')].map((t) => t.textContent);
test('wealthLine: points a day apart never produce two overlapping value labels', () => {
  const pts = [{ date: '2025-12-31', ron: 43350000 }, { date: '2026-09-26', ron: 57110000 }, { date: '2026-10-14', ron: 60120000 }, { date: '2026-10-15', ron: 60140000 }];
  const svg = wealthLine(pts);
  eq(svg.querySelectorAll('circle').length, 4); // every point keeps its dot
  const values = labels(svg).filter((t) => t.endsWith('k'));
  ok(values.includes('601,4k'), 'the last point is labelled');
  ok(!values.includes('601,2k') || !values.includes('601,4k'), 'the day-before label is not drawn on top of it');
  // no two value labels closer than the gap (compare their x)
  const xs = [...svg.querySelectorAll('text')].filter((t) => t.textContent.endsWith('k')).map((t) => Number(t.getAttribute('x'))).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) ok(xs[i] - xs[i - 1] >= 40, 'value labels are apart: ' + (xs[i] - xs[i - 1]));
});
test('wealthLine: one point and well-spaced points still work', () => {
  eq(labels(wealthLine([{ date: '2026-10-15', ron: 100000 }])).length, 2);
  eq(labels(wealthLine([{ date: '2026-01-15', ron: 100000 }, { date: '2026-06-15', ron: 200000 }, { date: '2026-10-15', ron: 300000 }])).length, 6);
});

test('bottom bar: seven destinations, none dropped, in the order of the old chips + Mai mult', () => {
  eq(TABS.map((t) => t[0]), ['#/active', '#/bursa', '#/depozite', '#/fizice', '#/conturi', '#/situatii', '#/mai-mult']);
  eq(TABS.map((t) => t[1]), ['active', 'bursa', 'depozite', 'fizice', 'conturi', 'situatii', 'more']);
  eq(new Set(TABS.map((t) => t[1])).size, 7);
});
