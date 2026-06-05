// Tiny dependency-free SVG charts. Offline, no Chart.js.

const NS = "http://www.w3.org/2000/svg";

export function lineChart(points, opts = {}) {
  // points: [{x:Date|number, y:number, label?}]
  const w = opts.width || 320, h = opts.height || 140;
  const pad = { l: 34, r: 10, t: 12, b: 22 };
  if (!points.length) return empty(w, h, "No data yet");
  const xs = points.map((p, i) => i);
  const ys = points.map((p) => p.y);
  const ymin = opts.ymin ?? Math.min(...ys);
  const ymax = opts.ymax ?? Math.max(...ys);
  const yr = ymax - ymin || 1;
  const px = (i) => pad.l + (xs.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (xs.length - 1)) * (w - pad.l - pad.r));
  const py = (v) => pad.t + (1 - (v - ymin) / yr) * (h - pad.t - pad.b);

  let svg = `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="none">`;
  // y gridlines
  for (let g = 0; g <= 3; g++) {
    const v = ymin + (yr * g) / 3;
    const y = py(v);
    svg += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" class="grid"/>`;
    svg += `<text x="0" y="${y + 3}" class="axis">${fmt(v)}</text>`;
  }
  const d = points.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(p.y).toFixed(1)}`).join(" ");
  // area
  const area = `${d} L${px(points.length - 1)} ${py(ymin)} L${px(0)} ${py(ymin)} Z`;
  svg += `<path d="${area}" class="area" style="fill:${opts.color || "#185FA5"}"/>`;
  svg += `<path d="${d}" class="line" style="stroke:${opts.color || "#185FA5"}"/>`;
  points.forEach((p, i) => {
    svg += `<circle cx="${px(i)}" cy="${py(p.y)}" r="3" style="fill:${opts.color || "#185FA5"}"><title>${p.label || ""} ${fmt(p.y)}</title></circle>`;
  });
  // x labels (first / last)
  if (points[0].label) svg += `<text x="${pad.l}" y="${h - 6}" class="axis">${points[0].label}</text>`;
  if (points.length > 1 && points.at(-1).label)
    svg += `<text x="${w - pad.r}" y="${h - 6}" class="axis" text-anchor="end">${points.at(-1).label}</text>`;
  svg += `</svg>`;
  return svg;
}

export function stackedBars(weeks, keys, colors, opts = {}) {
  // weeks: [{label, values:{key:number}}]
  const w = opts.width || 320, h = opts.height || 160;
  const pad = { l: 30, r: 8, t: 10, b: 22 };
  if (!weeks.length) return empty(w, h, "No data yet");
  const totals = weeks.map((wk) => keys.reduce((s, k) => s + (wk.values[k] || 0), 0));
  const ymax = opts.ymax ?? Math.max(...totals, 1);
  const bw = (w - pad.l - pad.r) / weeks.length;
  const py = (v) => pad.t + (1 - v / ymax) * (h - pad.t - pad.b);
  let svg = `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="none">`;
  for (let g = 0; g <= 2; g++) {
    const v = (ymax * g) / 2, y = py(v);
    svg += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" class="grid"/>`;
    svg += `<text x="0" y="${y + 3}" class="axis">${fmt(v)}</text>`;
  }
  weeks.forEach((wk, i) => {
    let yb = py(0);
    const x = pad.l + i * bw + bw * 0.15;
    const barW = bw * 0.7;
    keys.forEach((k, ki) => {
      const val = wk.values[k] || 0;
      if (!val) return;
      const ht = (val / ymax) * (h - pad.t - pad.b);
      yb -= ht;
      svg += `<rect x="${x}" y="${yb}" width="${barW}" height="${Math.max(0, ht)}" rx="1.5" style="fill:${colors[ki % colors.length]}"><title>${k}: ${fmt(val)}</title></rect>`;
    });
    if (i === 0 || i === weeks.length - 1 || weeks.length <= 6)
      svg += `<text x="${x + barW / 2}" y="${h - 6}" class="axis" text-anchor="middle">${wk.label}</text>`;
  });
  svg += `</svg>`;
  return svg;
}

function empty(w, h, msg) {
  return `<svg viewBox="0 0 ${w} ${h}" class="chart"><text x="${w / 2}" y="${h / 2}" class="axis" text-anchor="middle">${msg}</text></svg>`;
}
function fmt(v) {
  return Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
}
