import React, { useRef, useEffect, useState, useCallback } from 'react';
import './DIChartRenderer.css';

// ── Color Palette (dark-theme friendly) ──────────────────────────────
const CHART_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // purple
];

const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const AXIS_COLOR = 'rgba(255, 255, 255, 0.2)';
const TEXT_COLOR = 'rgba(255, 255, 255, 0.75)';
const TEXT_MUTED = 'rgba(255, 255, 255, 0.45)';
const TITLE_COLOR = 'rgba(255, 255, 255, 0.9)';

// ── Utility functions ────────────────────────────────────────────────
function niceNum(range, round) {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

function getNiceScale(minVal, maxVal, maxTicks = 6) {
  if (minVal === maxVal) {
    return { min: 0, max: maxVal * 2 || 10, step: maxVal || 1 };
  }
  const range = niceNum(maxVal - Math.min(0, minVal), false);
  const step = niceNum(range / (maxTicks - 1), true);
  const niceMin = Math.floor(Math.min(0, minVal) / step) * step;
  const niceMax = Math.ceil(maxVal / step) * step;
  return { min: niceMin, max: niceMax, step };
}

function formatNum(n) {
  if (Math.abs(n) >= 1e7) return (n / 1e7).toFixed(1) + 'Cr';
  if (Math.abs(n) >= 1e5) return (n / 1e5).toFixed(1) + 'L';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

// ── Bar Chart ────────────────────────────────────────────────────────
function drawBarChart(ctx, data, w, h, animProgress) {
  const padding = { top: 50, right: 20, bottom: 70, left: 65 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  // Title
  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = TITLE_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(data.title || 'Bar Chart', w / 2, 28);

  const cats = data.categories || [];
  const series = data.series || [];
  if (cats.length === 0 || series.length === 0) return;

  // Compute scale
  let allVals = series.flatMap(s => s.values || []);
  const { min: scaleMin, max: scaleMax, step } = getNiceScale(Math.min(0, ...allVals), Math.max(...allVals));

  // Grid + Y axis labels
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = scaleMin; v <= scaleMax + step * 0.01; v += step) {
    const y = padding.top + chartH - ((v - scaleMin) / (scaleMax - scaleMin)) * chartH;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText(formatNum(v), padding.left - 8, y);
  }

  // Y-axis label
  if (data.yLabel) {
    ctx.save();
    ctx.translate(14, padding.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'center';
    ctx.fillText(data.yLabel, 0, 0);
    ctx.restore();
  }

  // Bars
  const groupWidth = chartW / cats.length;
  const barPadding = groupWidth * 0.15;
  const totalBarSpace = groupWidth - barPadding * 2;
  const barWidth = totalBarSpace / series.length;
  const barGap = Math.min(2, barWidth * 0.08);

  cats.forEach((cat, ci) => {
    const groupX = padding.left + ci * groupWidth;

    series.forEach((s, si) => {
      const val = (s.values || [])[ci] || 0;
      const barH = ((val - scaleMin) / (scaleMax - scaleMin)) * chartH * animProgress;
      const x = groupX + barPadding + si * barWidth + barGap / 2;
      const bw = barWidth - barGap;
      const y = padding.top + chartH - barH;

      // Bar fill
      ctx.fillStyle = CHART_COLORS[si % CHART_COLORS.length];
      ctx.beginPath();
      const radius = Math.min(3, bw / 4);
      ctx.moveTo(x, padding.top + chartH);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + bw - radius, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + radius);
      ctx.lineTo(x + bw, padding.top + chartH);
      ctx.closePath();
      ctx.fill();

      // Value on top
      if (animProgress > 0.9 && bw > 18) {
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(formatNum(val), x + bw / 2, y - 4);
      }
    });

    // X-axis label
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = truncateText(ctx, cat, groupWidth - 4);
    ctx.fillText(label, groupX + groupWidth / 2, padding.top + chartH + 10);
  });

  // X-axis label
  if (data.xLabel) {
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'center';
    ctx.fillText(data.xLabel, padding.left + chartW / 2, h - 10);
  }

  // Axes
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(w - padding.right, padding.top + chartH);
  ctx.stroke();

  // Legend
  drawLegend(ctx, series, w, h - 28);
}

// ── Stacked Bar Chart ────────────────────────────────────────────────
function drawStackedBarChart(ctx, data, w, h, animProgress) {
  const padding = { top: 50, right: 20, bottom: 70, left: 65 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = TITLE_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(data.title || 'Stacked Bar Chart', w / 2, 28);

  const cats = data.categories || [];
  const series = data.series || [];
  if (cats.length === 0 || series.length === 0) return;

  // Compute max stacked value
  const maxStacked = Math.max(...cats.map((_, ci) => series.reduce((sum, s) => sum + ((s.values || [])[ci] || 0), 0)));
  const { min: scaleMin, max: scaleMax, step } = getNiceScale(0, maxStacked);

  // Grid
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = scaleMin; v <= scaleMax + step * 0.01; v += step) {
    const y = padding.top + chartH - ((v - scaleMin) / (scaleMax - scaleMin)) * chartH;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText(formatNum(v), padding.left - 8, y);
  }

  const barWidth = (chartW / cats.length) * 0.6;
  const barGap = (chartW / cats.length) * 0.4;

  cats.forEach((cat, ci) => {
    const x = padding.left + ci * (chartW / cats.length) + barGap / 2;
    let cumY = 0;

    series.forEach((s, si) => {
      const val = ((s.values || [])[ci] || 0) * animProgress;
      const barH = (val / (scaleMax - scaleMin)) * chartH;
      const y = padding.top + chartH - cumY - barH;

      ctx.fillStyle = CHART_COLORS[si % CHART_COLORS.length];
      ctx.fillRect(x, y, barWidth, barH);
      cumY += barH;
    });

    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(truncateText(ctx, cat, barWidth + barGap - 4), x + barWidth / 2, padding.top + chartH + 10);
  });

  // Axes
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(w - padding.right, padding.top + chartH);
  ctx.stroke();

  drawLegend(ctx, series, w, h - 28);
}

// ── Line Chart ───────────────────────────────────────────────────────
function drawLineChart(ctx, data, w, h, animProgress) {
  const padding = { top: 50, right: 20, bottom: 70, left: 65 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = TITLE_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(data.title || 'Line Chart', w / 2, 28);

  const cats = data.categories || [];
  const series = data.series || [];
  if (cats.length === 0 || series.length === 0) return;

  let allVals = series.flatMap(s => s.values || []);
  const { min: scaleMin, max: scaleMax, step } = getNiceScale(Math.min(...allVals), Math.max(...allVals));

  // Grid
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = scaleMin; v <= scaleMax + step * 0.01; v += step) {
    const y = padding.top + chartH - ((v - scaleMin) / (scaleMax - scaleMin)) * chartH;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText(formatNum(v), padding.left - 8, y);
  }

  if (data.yLabel) {
    ctx.save();
    ctx.translate(14, padding.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'center';
    ctx.fillText(data.yLabel, 0, 0);
    ctx.restore();
  }

  // Lines
  const pointSpacing = chartW / Math.max(1, cats.length - 1);

  series.forEach((s, si) => {
    const color = CHART_COLORS[si % CHART_COLORS.length];
    const vals = s.values || [];
    const pointsToDraw = Math.ceil(vals.length * animProgress);

    // Area fill
    ctx.beginPath();
    for (let i = 0; i < pointsToDraw; i++) {
      const x = padding.left + i * pointSpacing;
      const y = padding.top + chartH - ((vals[i] - scaleMin) / (scaleMax - scaleMin)) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (pointsToDraw > 0) {
      const lastX = padding.left + (pointsToDraw - 1) * pointSpacing;
      ctx.lineTo(lastX, padding.top + chartH);
      ctx.lineTo(padding.left, padding.top + chartH);
      ctx.closePath();
      ctx.fillStyle = color + '12';
      ctx.fill();
    }

    // Line stroke
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < pointsToDraw; i++) {
      const x = padding.left + i * pointSpacing;
      const y = padding.top + chartH - ((vals[i] - scaleMin) / (scaleMax - scaleMin)) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Data points
    for (let i = 0; i < pointsToDraw; i++) {
      const x = padding.left + i * pointSpacing;
      const y = padding.top + chartH - ((vals[i] - scaleMin) / (scaleMax - scaleMin)) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0f1629';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Value label
      if (animProgress > 0.9) {
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(formatNum(vals[i]), x, y - 8);
      }
    }
  });

  // X-axis labels
  cats.forEach((cat, ci) => {
    const x = padding.left + ci * pointSpacing;
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(truncateText(ctx, cat, pointSpacing - 4), x, padding.top + chartH + 10);
  });

  if (data.xLabel) {
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'center';
    ctx.fillText(data.xLabel, padding.left + chartW / 2, h - 10);
  }

  // Axes
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(w - padding.right, padding.top + chartH);
  ctx.stroke();

  drawLegend(ctx, series, w, h - 28);
}

// ── Pie Chart ────────────────────────────────────────────────────────
function drawPieChart(ctx, data, w, h, animProgress) {
  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = TITLE_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(data.title || 'Pie Chart', w / 2, 28);

  const cats = data.categories || [];
  const series = data.series || [];
  if (cats.length === 0 || series.length === 0) return;

  const vals = series[0]?.values || [];
  const total = vals.reduce((a, b) => a + b, 0);
  if (total === 0) return;

  const cx = w / 2;
  const cy = (h - 40) / 2 + 40;
  const radius = Math.min(cx - 30, cy - 50) * 0.75;
  const innerRadius = radius * 0.35; // donut

  let startAngle = -Math.PI / 2;
  const endAnimAngle = -Math.PI / 2 + Math.PI * 2 * animProgress;

  vals.forEach((val, i) => {
    const sliceAngle = (val / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;

    if (startAngle < endAnimAngle) {
      const drawEnd = Math.min(endAngle, endAnimAngle);
      const color = CHART_COLORS[i % CHART_COLORS.length];

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(startAngle) * innerRadius, cy + Math.sin(startAngle) * innerRadius);
      ctx.arc(cx, cy, radius, startAngle, drawEnd);
      ctx.arc(cx, cy, innerRadius, drawEnd, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0f1629';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      if (animProgress > 0.9 && sliceAngle > 0.15) {
        const midAngle = startAngle + sliceAngle / 2;
        const labelR = radius + 20;
        const lx = cx + Math.cos(midAngle) * labelR;
        const ly = cy + Math.sin(midAngle) * labelR;
        const pct = ((val / total) * 100).toFixed(1) + '%';

        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${cats[i]} (${pct})`, lx, ly);
      }
    }
    startAngle = endAngle;
  });

  // Center text
  if (animProgress > 0.9) {
    ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.fillStyle = TITLE_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatNum(total), cx, cy - 6);
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText('Total', cx, cy + 12);
  }
}

// ── Legend Drawing (shared) ──────────────────────────────────────────
function drawLegend(ctx, series, canvasWidth, y) {
  if (series.length <= 1) return;
  ctx.font = '11px Inter, system-ui, sans-serif';
  const items = series.map((s, i) => ({
    name: s.name || `Series ${i + 1}`,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const itemWidths = items.map(item => ctx.measureText(item.name).width + 24);
  const totalWidth = itemWidths.reduce((a, b) => a + b, 0) + (items.length - 1) * 16;
  let x = (canvasWidth - totalWidth) / 2;

  items.forEach((item, i) => {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(x, y - 5, 12, 12, 2);
    ctx.fill();
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.name, x + 18, y + 1);
    x += itemWidths[i] + 16;
  });
}

// ── Table Renderer (HTML, not Canvas) ────────────────────────────────
const TableRenderer = ({ data }) => {
  const cats = data.categories || [];
  const series = data.series || [];

  return (
    <div className="di-table-wrapper">
      {data.title && <div className="di-table-title">{data.title}</div>}
      <div className="di-table-scroll">
        <table className="di-table">
          <thead>
            <tr>
              <th>{data.xLabel || ''}</th>
              {series.map((s, i) => (
                <th key={i}>{s.name || `Col ${i + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map((cat, ci) => (
              <tr key={ci}>
                <td className="di-table-cat">{cat}</td>
                {series.map((s, si) => (
                  <td key={si}>{(s.values || [])[ci] ?? '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Main DIChartRenderer Component ───────────────────────────────────
const DIChartRenderer = ({ chartData }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const [dims, setDims] = useState({ w: 500, h: 350 });

  const drawChart = useCallback((progress) => {
    const canvas = canvasRef.current;
    if (!canvas || !chartData) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = dims.w;
    const h = dims.h;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);

    const type = (chartData.type || 'bar').toLowerCase();
    switch (type) {
      case 'bar':
        drawBarChart(ctx, chartData, w, h, progress);
        break;
      case 'stacked_bar':
      case 'stackedbar':
        drawStackedBarChart(ctx, chartData, w, h, progress);
        break;
      case 'line':
        drawLineChart(ctx, chartData, w, h, progress);
        break;
      case 'pie':
      case 'donut':
        drawPieChart(ctx, chartData, w, h, progress);
        break;
      default:
        drawBarChart(ctx, chartData, w, h, progress);
    }
  }, [chartData, dims]);

  // Animate on mount / data change
  useEffect(() => {
    if (!chartData || chartData.type === 'table') return;

    let start = null;
    const duration = 800;

    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      drawChart(eased);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [drawChart, chartData]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) {
          const type = (chartData?.type || 'bar').toLowerCase();
          const h = type === 'pie' || type === 'donut' ? Math.min(380, w * 0.85) : Math.min(380, w * 0.7);
          setDims({ w, h: Math.max(280, h) });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [chartData]);

  if (!chartData) return null;

  // Table type: use HTML renderer
  if ((chartData.type || '').toLowerCase() === 'table') {
    return (
      <div ref={containerRef} className="di-chart-container">
        <TableRenderer data={chartData} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="di-chart-container">
      <canvas ref={canvasRef} className="di-chart-canvas" />
    </div>
  );
};

export default DIChartRenderer;
