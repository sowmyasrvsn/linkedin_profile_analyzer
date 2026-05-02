import React from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#00D4FF', '#7B61FF', '#00FF94', '#FFD700', '#FF6B6B', '#FF8C42', '#A78BFA'];

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
        <p style={{ color: '#8B949E', marginBottom: 4 }}>{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color, margin: '2px 0' }}>
            {entry.name}: <strong>{entry.value}{unit ? ` ${unit}` : ''}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function BarChartBlock({ title, data, xKey, yKeys, colors, unit }) {
  const chartColors = colors || COLORS;
  return (
    <div className="viz-block">
      <p className="viz-title">{title}</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262D" />
          <XAxis dataKey={xKey} tick={{ fill: '#8B949E', fontSize: 11 }} />
          <YAxis tick={{ fill: '#8B949E', fontSize: 11 }} />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          {yKeys.length > 1 && <Legend />}
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={chartColors[i % chartColors.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PieChartBlock({ title, data, colors }) {
  const chartColors = colors || COLORS;
  return (
    <div className="viz-block">
      <p className="viz-title">{title}</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={85} innerRadius={40}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => v} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KPICards({ cards }) {
  const trendColor = (t) => t === 'up' ? '#00FF94' : t === 'down' ? '#FF6B6B' : '#8B949E';
  const trendIcon = (t) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
  return (
    <div className="kpi-grid">
      {cards.map((card, i) => (
        <div key={i} className="kpi-card">
          <span className="kpi-label">{card.label}</span>
          <span className="kpi-value">{card.value}</span>
          {card.sub && <span className="kpi-sub">{card.sub}</span>}
          {card.trend && (
            <span className="kpi-trend" style={{ color: trendColor(card.trend) }}>
              {trendIcon(card.trend)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function AIJobsBlock({ seniority, roles }) {
  return (
    <div className="ai-jobs-block">
      <div className="ai-jobs-header">
        <span className="ai-jobs-icon">🤖</span>
        <span className="ai-jobs-title">AI World Job Matches</span>
        <span className="seniority-badge">{seniority}</span>
      </div>
      <div className="ai-jobs-list">
        {(roles || []).map((role, i) => (
          <div key={i} className="ai-job-card">
            <div className="ai-job-top">
              <span className="ai-job-title">{role.title}</span>
              <span className="ai-job-score" style={{
                color: role.fit_score >= 75 ? '#00FF94' : role.fit_score >= 50 ? '#FFD700' : '#FF6B6B'
              }}>{role.fit_score}% fit</span>
            </div>
            <div className="fit-bar">
              <div className="fit-bar-fill" style={{
                width: `${role.fit_score}%`,
                background: role.fit_score >= 75 ? '#00FF94' : role.fit_score >= 50 ? '#FFD700' : '#FF6B6B'
              }} />
            </div>
            <p className="ai-job-why">{role.why}</p>
            <div className="skills-row">
              <div className="skills-col">
                <span className="skills-col-label match">✓ You have</span>
                <div className="skill-tags">
                  {role.skills_match.slice(0, 5).map((s, j) => (
                    <span key={j} className="skill-tag match">{s}</span>
                  ))}
                </div>
              </div>
              {role.skills_gap.length > 0 && (
                <div className="skills-col">
                  <span className="skills-col-label gap">✗ Gaps</span>
                  <div className="skill-tags">
                    {role.skills_gap.slice(0, 4).map((s, j) => (
                      <span key={j} className="skill-tag gap">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelineBlock({ events }) {
  const typeColor = { job: '#00D4FF', education: '#7B61FF', gap: '#FF6B6B' };
  const typeIcon = { job: '💼', education: '🎓', gap: '⏸' };
  return (
    <div className="timeline-block">
      <p className="viz-title">Career Timeline</p>
      <div className="timeline">
        {events.map((ev, i) => (
          <div key={i} className="tl-item">
            <div className="tl-left">
              <div className="tl-dot" style={{ background: typeColor[ev.type] || '#00D4FF' }} />
              {i < events.length - 1 && <div className="tl-line" />}
            </div>
            <div className="tl-content">
              <span className="tl-year">{ev.year}</span>
              <span className="tl-icon">{typeIcon[ev.type]}</span>
              <span className="tl-title">{ev.title}</span>
              {ev.company && <span className="tl-company"> @ {ev.company}</span>}
              {ev.duration && <span className="tl-duration"> · {ev.duration}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataTable({ title, columns, rows }) {
  return (
    <div className="viz-block">
      {title && <p className="viz-title">{title}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
