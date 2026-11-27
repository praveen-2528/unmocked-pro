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
function toNumericVal(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim();
  if (!s || s === '?' || s === '-' || s === '—' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a') {
    return NaN;
  }
  const cleaned = s.replace(/,/g, '').replace(/%$/, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function niceNum(range, round) {
  if (!Number.isFinite(range) || range <= 0) return 1;
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
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    return { min: 0, max: 10, step: 2 };
  }
  if (minVal === maxVal) {
    if (minVal === 0) return { min: 0, max: 10, step: 2 };
    const abs = Math.abs(minVal);
    const step = niceNum(abs / 2, true) || 1;
    return minVal > 0
      ? { min: 0, max: Math.ceil((minVal * 1.2) / step) * step, step }
      : { min: Math.floor((minVal * 1.2) / step) * step, max: 0, step };
  }
  const low = Math.min(0, minVal);
  const high = Math.max(0, maxVal);
  const range = niceNum(high - low, false);
  const step = Math.max(1e-6, niceNum(range / (maxTicks - 1), true));
  const niceMin = Math.floor(low / step) * step;
  const niceMax = Math.ceil(high / step) * step;
  return { min: niceMin, max: niceMax <= niceMin ? niceMin + step : niceMax, step };
}

function formatNum(n) {
  if (!Number.isFinite(n)) return '?';
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
  const cats = data.categories || [];
  const series = data.series || [];
  const padding = { top: 48, right: 20, bottom: series.length > 1 ? 84 : 60, left: 65 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  // Title
  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = TITLE_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(truncateText(ctx, data.title || 'Bar Chart', w - 32), w / 2, 26);

  if (cats.length === 0 || series.length === 0) return;

  // Compute scale safely ignoring missing values ("?" or "-")
  const allVals = series.flatMap(s => (s.values || []).map(toNumericVal)).filter(Number.isFinite);
  if (allVals.length === 0) return;
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
    ctx.fillText(truncateText(ctx, data.yLabel, chartH), 0, 0);
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
      const rawVal = (s.values || [])[ci];
      const val = toNumericVal(rawVal);
      const x = groupX + barPadding + si * barWidth + barGap / 2;
      const bw = Math.max(2, barWidth - barGap);

      if (!Number.isFinite(val)) {
        if (animProgress > 0.9) {
          ctx.font = 'bold 11px Inter, system-ui, sans-serif';
          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText('?', x + bw / 2, padding.top + chartH - 6);
        }
        return;
      }

      const barH = Math.max(0, ((val - scaleMin) / (scaleMax - scaleMin)) * chartH * animProgress);
      const y = padding.top + chartH - barH;

      // Bar fill
      ctx.fillStyle = CHART_COLORS[si % CHART_COLORS.length];
      ctx.beginPath();
      const radius = Math.min(3, bw / 4, barH / 2);
      ctx.moveTo(x, padding.top + chartH);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + bw - radius, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + radius);
      ctx.lineTo(x + bw, padding.top + chartH);
      ctx.closePath();
      ctx.fill();

      // Value on top
      if (animProgress > 0.9 && bw > 16) {
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
    const label = truncateText(ctx, String(cat), groupWidth - 4);
    ctx.fillText(label, groupX + groupWidth / 2, padding.top + chartH + 8);
  });

  // X-axis title
  if (data.xLabel) {
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(truncateText(ctx, data.xLabel, chartW), padding.left + chartW / 2, padding.top + chartH + 26);
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
  drawLegend(ctx, series, w, h - 22);
}

// ── Stacked Bar Chart ────────────────────────────────────────────────
function drawStackedBarChart(ctx, data, w, h, animProgress) {
  const cats = data.categories || [];
  const series = data.series || [];
  const padding = { top: 48, right: 20, bottom: series.length > 1 ? 84 : 60, left: 65 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = TITLE_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(truncateText(ctx, data.title || 'Stacked Bar Chart', w - 32), w / 2, 26);

  if (cats.length === 0 || series.length === 0) return;

  // Compute max stacked value safely
  const stackTotals = cats.map((_, ci) =>
    series.reduce((sum, s) => {
      const n = toNumericVal((s.values || [])[ci]);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0)
  );
  const maxStacked = Math.max(...stackTotals, 0);
  if (maxStacked <= 0) return;
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
      const n = toNumericVal((s.values || [])[ci]);
      if (!Number.isFinite(n)) return;
      const val = n * animProgress;
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
    ctx.fillText(truncateText(ctx, String(cat), barWidth + barGap - 4), x + barWidth / 2, padding.top + chartH + 8);
  });

  if (data.xLabel) {
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(truncateText(ctx, data.xLabel, chartW), padding.left + chartW / 2, padding.top + chartH + 26);
  }

  // Axes
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(w - padding.right, padding.top + chartH);
  ctx.stroke();

  drawLegend(ctx, series, w, h - 22);
}

// ── Line Chart ───────────────────────────────────────────────────────
function drawLineChart(ctx, data, w, h, animProgress) {
  const cats = data.categories || [];
  const series = data.series || [];
  const padding = { top: 48, right: 24, bottom: series.length > 1 ? 84 : 60, left: 65 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = TITLE_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(truncateText(ctx, data.title || 'Line Chart', w - 32), w / 2, 26);

  if (cats.length === 0 || series.length === 0) return;

  const allVals = series.flatMap(s => (s.values || []).map(toNumericVal)).filter(Number.isFinite);
  if (allVals.length === 0) return;
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
    ctx.fillText(truncateText(ctx, data.yLabel, chartH), 0, 0);
    ctx.restore();
  }

  // Lines
  const pointSpacing = cats.length > 1 ? chartW / (cats.length - 1) : 0;
  const getX = (i) => cats.length > 1 ? padding.left + i * pointSpacing : padding.left + chartW / 2;

  series.forEach((s, si) => {
    const color = CHART_COLORS[si % CHART_COLORS.length];
    const vals = (s.values || []).map(toNumericVal);
    const pointsToDraw = Math.ceil(vals.length * animProgress);

    // Line stroke (breaking cleanly across missing values)
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let penDown = false;
    for (let i = 0; i < pointsToDraw; i++) {
      if (!Number.isFinite(vals[i])) {
        penDown = false;
        continue;
      }
      const x = getX(i);
      const y = padding.top + chartH - ((vals[i] - scaleMin) / (scaleMax - scaleMin)) * chartH;
      if (!penDown) {
        ctx.moveTo(x, y);
        penDown = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Data points
    for (let i = 0; i < pointsToDraw; i++) {
      if (!Number.isFinite(vals[i])) continue;
      const x = getX(i);
      const y = padding.top + chartH - ((vals[i] - scaleMin) / (scaleMax - scaleMin)) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
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
    const x = getX(ci);
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const maxW = cats.length > 1 ? Math.max(32, pointSpacing - 4) : chartW;
    ctx.fillText(truncateText(ctx, String(cat), maxW), x, padding.top + chartH + 8);
  });

  if (data.xLabel) {
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(truncateText(ctx, data.xLabel, chartW), padding.left + chartW / 2, padding.top + chartH + 26);
  }

  // Axes
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(w - padding.right, padding.top + chartH);
  ctx.stroke();

  drawLegend(ctx, series, w, h - 22);
}

// ── Pie Chart ────────────────────────────────────────────────────────
function drawPieChart(ctx, data, w, h, animProgress) {
  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = TITLE_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(truncateText(ctx, data.title || 'Pie Chart', w - 32), w / 2, 26);

  const cats = data.categories || [];
  const series = data.series || [];
  if (cats.length === 0 || series.length === 0) return;

  const vals = (series[0]?.values || []).map(v => {
    const n = toNumericVal(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const total = vals.reduce((a, b) => a + b, 0);
  if (total <= 0) return;

  const cx = w / 2;
  const cy = (h - 40) / 2 + 34;
  const radius = Math.max(40, Math.min(cx - 75, cy - 48) * 0.85);
  const innerRadius = radius * 0.35; // donut

  let startAngle = -Math.PI / 2;
  const endAnimAngle = -Math.PI / 2 + Math.PI * 2 * animProgress;

  vals.forEach((val, i) => {
    if (val <= 0) return;
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
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label kept within canvas width
      if (animProgress > 0.9 && sliceAngle > 0.14) {
        const midAngle = startAngle + sliceAngle / 2;
        const labelR = radius + 16;
        const lx = cx + Math.cos(midAngle) * labelR;
        const ly = cy + Math.sin(midAngle) * labelR;
        const pct = ((val / total) * 100).toFixed(1) + '%';
        const isLeft = Math.cos(midAngle) < -0.05;
        const availW = isLeft ? Math.max(40, lx - 10) : Math.max(40, w - lx - 10);

        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = isLeft ? 'right' : Math.cos(midAngle) > 0.05 ? 'left' : 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(truncateText(ctx, `${cats[i] || ''} (${pct})`, availW), lx, ly);
      }
    }
    startAngle = endAngle;
  });

  // Center text
  if (animProgress > 0.9) {
    ctx.font = 'bold 15px Inter, system-ui, sans-serif';
    ctx.fillStyle = TITLE_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatNum(total), cx, cy - 6);
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText('Total', cx, cy + 12);
  }
}

// ── Radar Chart (Web DI) ───────────────────────────────────────────────
function drawRadarChart(ctx, chartData, w, h, progress) {
  const cats = chartData.categories || [];
  const series = chartData.series || [];
  if (cats.length === 0 || series.length === 0) return;

  const numAxes = cats.length;
  const padding = 70;
  const cx = w / 2;
  const cy = (h - 20) / 2 + 10;
  const radius = Math.min(cx, cy) - padding + 20;

  let maxVal = 0;
  series.forEach(s => {
    (s.values || []).forEach(v => {
      const num = toNumericVal(v);
      if (Number.isFinite(num) && num > maxVal) maxVal = num;
    });
  });
  if (maxVal === 0) maxVal = 10;
  const scale = getNiceScale(0, maxVal, 5);
  maxVal = scale.max;

  ctx.lineWidth = 1;
  ctx.strokeStyle = GRID_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const numRings = 4;
  for (let ring = 1; ring <= numRings; ring++) {
    const r = (radius / numRings) * ring;
    ctx.beginPath();
    for (let i = 0; i < numAxes; i++) {
      const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '9px Inter, system-ui, sans-serif';
    const val = (maxVal / numRings) * ring;
    ctx.fillText(formatNum(val), cx, cy - r - 6);
  }

  for (let i = 0; i < numAxes; i++) {
    const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = AXIS_COLOR;
    ctx.stroke();

    const labelR = radius + 15;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '11px Inter, system-ui, sans-serif';
    
    if (Math.cos(angle) > 0.1) ctx.textAlign = 'left';
    else if (Math.cos(angle) < -0.1) ctx.textAlign = 'right';
    else ctx.textAlign = 'center';
    
    ctx.fillText(cats[i], lx, ly);
  }

  series.forEach((s, si) => {
    const color = CHART_COLORS[si % CHART_COLORS.length];
    
    ctx.beginPath();
    let started = false;
    
    for (let i = 0; i < numAxes; i++) {
      const val = toNumericVal((s.values || [])[i]);
      if (!Number.isFinite(val)) continue;
      
      const r = (val / maxVal) * radius * progress;
      const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    if (started) {
      ctx.closePath();
      
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
      
      for (let i = 0; i < numAxes; i++) {
        const val = toNumericVal((s.values || [])[i]);
        if (!Number.isFinite(val)) continue;
        
        const r = (val / maxVal) * radius * progress;
        const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#1e1e1e';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  });

  if (chartData.title) {
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(chartData.title, w / 2, 20);
  }
  drawLegend(ctx, series, w, h - 16);
}

// ── Legend Drawing (shared) ──────────────────────────────────────────
function drawLegend(ctx, series, canvasWidth, y) {
  if (series.length <= 1) return;
  ctx.font = '11px Inter, system-ui, sans-serif';
  const items = series.map((s, i) => ({
    name: truncateText(ctx, s.name || `Series ${i + 1}`, Math.max(80, canvasWidth - 48)),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const itemWidths = items.map(item => ctx.measureText(item.name).width + 22);
  const gap = 14;
  const maxRowW = Math.max(120, canvasWidth - 24);
  const rows = [];
  let curRow = [];
  let curW = 0;
  items.forEach((item, i) => {
    const wNeeded = itemWidths[i] + (curRow.length > 0 ? gap : 0);
    if (curRow.length > 0 && curW + wNeeded > maxRowW) {
      rows.push({ items: curRow, totalW: curW });
      curRow = [{ item, width: itemWidths[i] }];
      curW = itemWidths[i];
    } else {
      curRow.push({ item, width: itemWidths[i] });
      curW += wNeeded;
    }
  });
  if (curRow.length > 0) rows.push({ items: curRow, totalW: curW });

  const startY = y - (rows.length - 1) * 14;
  rows.forEach((row, ri) => {
    let x = Math.max(12, (canvasWidth - row.totalW) / 2);
    const ry = startY + ri * 14;
    row.items.forEach(({ item, width }) => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.roundRect(x, ry - 5, 11, 11, 2);
      ctx.fill();
      ctx.fillStyle = TEXT_COLOR;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.name, x + 16, ry + 1);
      x += width + gap;
    });
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
                {series.map((s, si) => {
                  const val = (s.values || [])[ci] ?? '-';
                  const isMissing = val === '?' || val === '-';
                  return (
                    <td key={si} className={isMissing ? 'di-table-missing' : ''}>
                      {val}
                    </td>
                  );
                })}
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
      case 'radar':
        drawRadarChart(ctx, chartData, w, h, progress);
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

  if ((chartData.type || '').toLowerCase() === 'mixed' && Array.isArray(chartData.charts)) {
    return (
      <div className="di-mixed-container">
        {chartData.title && <div className="di-mixed-title">{chartData.title}</div>}
        {chartData.charts.map((subChart, i) => (
          <DIChartRenderer key={i} chartData={subChart} />
        ))}
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
