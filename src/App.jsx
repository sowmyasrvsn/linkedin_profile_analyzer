import React, { useState, useEffect, useRef, useCallback } from 'react';
import { parseLinkedInZip, buildProfileFromPaste } from './utils/linkedinParser';
import { KPICards, PieChartBlock, BarChartBlock, AIJobsBlock, TimelineBlock, DataTable } from './components/Visualizations';
import './App.css';

// ── SHARED DASHBOARD SUBCOMPONENTS ───────────────────────────────────────────

const SEVERITY_COLORS = {
  critical: '#cf222e',
  moderate: '#bf8700',
  minor:    '#1a7f37',
};

// Finds all known label positions in the string and extracts content between them.
// Works with both pipe-separated and period-separated formats.
function parseGapItem(text) {
  if (!text.includes('GAP:')) return null;
  const LABELS = ['GAP', 'WHY IT MATTERS', 'SEVERITY', 'HOW TO CLOSE IT'];
  const positions = [];
  for (const label of LABELS) {
    const re = new RegExp(`\\|?\\s*${label}:\\s*`, 'i');
    const m = re.exec(text);
    if (m) positions.push({ label, contentStart: m.index + m[0].length });
  }
  if (!positions.length) return null;
  positions.sort((a, b) => a.contentStart - b.contentStart);
  const result = {};
  for (let i = 0; i < positions.length; i++) {
    const { label, contentStart } = positions[i];
    const nextStart = positions[i + 1]?.contentStart
      ? text.lastIndexOf(positions[i + 1].label + ':', positions[i + 1].contentStart)
      : text.length;
    result[label] = text.slice(contentStart, nextStart).replace(/[\s|.]+$/, '').trim();
  }
  return {
    gap:      result['GAP'] || '',
    why:      result['WHY IT MATTERS'] || '',
    severity: result['SEVERITY'] || '',
    action:   result['HOW TO CLOSE IT'] || '',
  };
}

function GapCard({ text }) {
  const p = parseGapItem(text);
  if (!p) return <li className="coaching-plain">{text}</li>;
  const severityKey = (p.severity || '').toLowerCase().split(/[\s.,]/)[0];
  const color = SEVERITY_COLORS[severityKey] || 'var(--text3)';
  return (
    <div className="gap-card">
      <div className="gap-name">
        <span className="gap-bullet" style={{ color }}>●</span>
        <span>{p.gap}</span>
      </div>
      {p.why && <div className="gap-why">{p.why}</div>}
      {p.severity && (
        <div className="gap-meta-line">
          <span className="gap-meta-label">Severity</span>
          <span className="gap-severity-value" style={{ color }}>{p.severity}</span>
        </div>
      )}
      {p.action && (
        <div className="gap-meta-line">
          <span className="gap-meta-label">How to close it</span>
          <span className="gap-action-value">{p.action}</span>
        </div>
      )}
    </div>
  );
}

function InsightPanel({ insights, coaching, feedback }) {
  const hasGapFormat = coaching && coaching.some(c => c.includes('GAP:'));

  return (
    <div className="insight-panel">
      {insights && (
        <div className="dash-card dash-insights">
          <div className="dash-card-label">📊 Insights</div>
          <p>{insights}</p>
        </div>
      )}
      {coaching && coaching.length > 0 && (
        <div className="dash-card dash-coaching">
          <div className="dash-card-label">💡 Coaching</div>
          {hasGapFormat ? (
            <div className="gap-list">
              {coaching.map((c, i) => <GapCard key={i} text={c} />)}
            </div>
          ) : (
            <ol>{coaching.map((c, i) => <li key={i}>{c}</li>)}</ol>
          )}
        </div>
      )}
      {feedback && (
        <div className="dash-card dash-feedback">
          <div className="dash-card-label">🎯 Direct Feedback</div>
          <p>{feedback.replace(/^PRIORITY ACTION\s*\([^)]*\)\s*:\s*/i, '').trim()}</p>
        </div>
      )}
    </div>
  );
}

function CareerTab({ data }) {
  if (!data) return null;
  return (
    <div className="dash-tab-content">
      {data.kpis && <KPICards cards={data.kpis} />}
      <InsightPanel insights={data.insights} coaching={data.coaching} feedback={data.feedback} />
    </div>
  );
}

function SkillsTab({ data }) {
  if (!data) return null;
  return (
    <div className="dash-tab-content">
      {data.chartData && <PieChartBlock title="Skill Category Breakdown" data={data.chartData} />}
      <div className="skill-split">
        <div className="skill-half">
          <div className="skill-half-label">✅ Strengths</div>
          <div className="skill-tags-wrap">
            {data.strengths?.map((s, i) => <span key={i} className="dash-skill-tag ok">{s}</span>)}
          </div>
        </div>
        <div className="skill-half">
          <div className="skill-half-label">⚠️ Gaps to Close</div>
          <div className="skill-tags-wrap">
            {data.gaps?.map((g, i) => <span key={i} className="dash-skill-tag warn">{g}</span>)}
          </div>
        </div>
      </div>
      <InsightPanel insights={data.insights} coaching={data.coaching} feedback={data.feedback} />
    </div>
  );
}

function RecsTab({ data }) {
  if (!data) return null;
  return (
    <div className="dash-tab-content">
      {data.themes && data.themes.length > 0 && (
        <div className="theme-list">
          {data.themes.map((t, i) => (
            <div key={i} className="theme-card">
              <div className="theme-name">{t.theme}</div>
              <div className="theme-desc">{t.description}</div>
              {t.quote && <div className="theme-quote">{t.quote}</div>}
            </div>
          ))}
        </div>
      )}
      <InsightPanel insights={data.insights} coaching={data.coaching} feedback={data.feedback} />
    </div>
  );
}

function AIJobsTab({ data }) {
  if (!data) return null;
  return (
    <div className="dash-tab-content">
      {data.seniority && <div className="dash-level-pill">Level: {data.seniority}</div>}
      {data.roles?.map((role, i) => {
        const score = role.fit_score || 0;
        const scoreColor = score >= 80 ? 'var(--green)' : score >= 70 ? 'var(--accent3)' : 'var(--red)';
        return (
          <div key={i} className="job-card">
            <div className="job-top">
              <div className="job-title">{role.title}</div>
              <div className="job-score" style={{ color: scoreColor }}>{score}%</div>
            </div>
            <div className="fit-bar">
              <div className="fit-bar-fill" style={{ width: `${score}%`, background: scoreColor }} />
            </div>
            <p className="job-why">{role.why}</p>
            <div className="job-skills-section">
              <div className="job-skills-group">
                <span className="job-skills-lbl" style={{ color: 'var(--green)' }}>Matches:</span>
                {role.skills_match?.map((s, j) => <span key={j} className="skill-tag match">{s}</span>)}
              </div>
              <div className="job-skills-group">
                <span className="job-skills-lbl" style={{ color: 'var(--red)' }}>Gaps:</span>
                {role.skills_gap?.map((g, j) => <span key={j} className="skill-tag gap">{g}</span>)}
              </div>
            </div>
          </div>
        );
      })}
      <InsightPanel insights={data.insights} coaching={data.coaching} feedback={data.feedback} />
    </div>
  );
}

function UpskillingTab({ data }) {
  if (!data) return null;
  return (
    <div className="dash-tab-content">
      {data.courses?.map((c, i) => (
        <div key={i} className="course-card">
          <div className="course-top">
            <div className="course-name">{c.name}</div>
            <span className={`level-badge lvl-${(c.level || 'beginner').toLowerCase()}`}>{c.level}</span>
          </div>
          <div className="course-meta">{c.provider} · {c.duration}</div>
          <div className="course-why">{c.why}</div>
        </div>
      ))}
      <InsightPanel insights={data.insights} coaching={data.coaching} />
    </div>
  );
}

function RecruiterTab({ data }) {
  if (!data) return null;
  const priorityOrder = ['high', 'medium', 'low'];
  const sorted = [...(data.tips || [])].sort(
    (a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
  );
  return (
    <div className="dash-tab-content">
      {sorted.map((tip, i) => (
        <div key={i} className={`tip-card pri-${tip.priority}`}>
          <div className="tip-top">
            <span className="tip-category">{tip.category}</span>
            <span className={`pri-badge pri-${tip.priority}`}>{tip.priority}</span>
          </div>
          <div className="tip-title">{tip.tip}</div>
          <div className="tip-detail">{tip.detail}</div>
        </div>
      ))}
      <InsightPanel insights={data.insights} />
    </div>
  );
}

// ── CHAT TAB ─────────────────────────────────────────────────────────────────

const CHAT_SUGGESTIONS = [
  "How should I answer 'Tell me about yourself' for a Director-level interview?",
  "Write me a LinkedIn headline that would stop a recruiter from scrolling",
  "What's the single strongest story from my career I should lead every interview with?",
  "Draft a cold outreach message I can send to a hiring manager at Databricks or Snowflake",
  "How do I negotiate compensation for a senior role without leaving money on the table?",
  "How do I explain a career transition or gap when an interviewer asks?",
];

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function renderText(text) {
  if (!text) return null;
  return text.split(/\n\n+/).map((para, i) => {
    const lines = para.split('\n');
    return (
      <p key={i}>
        {lines.map((line, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(line)}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

function ChatBlock({ block }) {
  if (block.type === 'text') {
    return <div className="msg-text">{renderText(block.content)}</div>;
  }
  if (block.type === 'tool') {
    switch (block.name) {
      case 'render_bar_chart': return <BarChartBlock {...block.data} />;
      case 'render_pie_chart': return <PieChartBlock title={block.data.title} data={block.data.data} colors={block.data.colors} />;
      case 'render_kpi_cards': return <KPICards cards={block.data.cards} />;
      case 'render_ai_jobs': return <AIJobsBlock seniority={block.data.seniority} roles={block.data.roles} />;
      case 'render_timeline': return <TimelineBlock events={block.data.events} />;
      case 'render_data_table': return <DataTable title={block.data.title} columns={block.data.columns} rows={block.data.rows} />;
      default: return null;
    }
  }
  return null;
}

function ChatTab({ profile, userApiKey, onShowKeyModal }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [limitMsg, setLimitMsg] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const send = async (text) => {
    const userText = (text || input).trim();
    if (!userText || thinking) return;
    setInput('');
    setLimitMsg('');

    const userMsg = { role: 'user', blocks: [{ type: 'text', content: userText }] };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setThinking(true);

    const apiMessages = nextMessages.map(m => ({
      role: m.role,
      content: m.blocks.filter(b => b.type === 'text').map(b => b.content).join('\n')
    }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, profileContext: profile, userApiKey: userApiKey || undefined })
      });
      const data = await res.json();
      if (res.status === 429) { setLimitMsg(data.message || 'Free message limit reached.'); return; }
      if (data.error === 'INVALID_API_KEY') { setLimitMsg('Invalid API key — please check your key.'); onShowKeyModal(); return; }
      if (data.error === 'NO_CREDITS') { setLimitMsg('The server API key has no credits. Add your own Anthropic API key to use the coach.'); onShowKeyModal(); return; }
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', blocks: data.blocks }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', blocks: [{ type: 'text', content: `Error: ${err.message}` }] }]);
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-suggestions-bar">
        <span className="chat-suggestions-label">Try asking:</span>
        <div className="chat-suggestions-scroll">
          {CHAT_SUGGESTIONS.map((s, i) => (
            <button key={i} className="suggestion-chip" onClick={() => send(s)} disabled={thinking}>{s}</button>
          ))}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="chat-welcome-avatar">👔</div>
            <div className="chat-welcome-title">Your Career Coach</div>
            <p className="chat-welcome-desc">
              Former FAANG hiring manager, 10,000+ resumes reviewed. Ask me about interview prep, how to pitch your story, salary negotiation, or cold outreach — things the other tabs don't cover.
            </p>
          </div>
        )}

        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={`msg-row ${msg.role}`}>
              <div className="avatar">{msg.role === 'user' ? '👤' : '👔'}</div>
              <div className="bubble">
                <div className="msg-blocks">
                  {msg.blocks.map((block, j) => <ChatBlock key={j} block={block} />)}
                </div>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="msg-row assistant">
              <div className="avatar">👔</div>
              <div className="bubble thinking"><span /><span /><span /></div>
            </div>
          )}
        </div>

        {limitMsg && (
          <div className="chat-limit-msg">
            <span>{limitMsg}</span>
            <button className="link-btn" onClick={onShowKeyModal}>Add your API key →</button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div className="input-row">
          <div className="input-wrap">
            <input
              ref={inputRef}
              className="chat-input"
              placeholder="Ask anything about your profile..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={thinking}
            />
            <button className="send-btn" onClick={() => send()} disabled={thinking || !input.trim()}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8L14 2L10 8L14 14L2 8Z" fill="white" />
              </svg>
            </button>
          </div>
        </div>
        {!userApiKey && (
          <div className="input-hint">
            5 free messages · <button className="link-btn" onClick={onShowKeyModal}>Add your API key</button> for unlimited
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

// Bump this whenever the dashboard schema or KPI labels change — clears stale caches.
const DASHBOARD_VERSION = '3';

const DASH_TABS = [
  { id: 'career', label: '📊 Career' },
  { id: 'skills', label: '🎯 Skills & Gaps' },
  { id: 'recommendations', label: '💬 Recommendations' },
  { id: 'aiJobs', label: '🤖 AI Jobs' },
  { id: 'recruiter', label: '🔍 Recruiter Tips' },
  { id: 'chat', label: '💬 Ask the Coach' },
];

function Logo({ id }) {
  return (
    <div className="logo">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="8" fill={`url(#${id})`} />
        <circle cx="14" cy="10" r="4" fill="white" opacity="0.9" />
        <path d="M6 22c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="28" y2="28">
            <stop offset="0%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#7B61FF" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState('upload'); // upload | loading | generating | dashboard
  const [uploadTab, setUploadTab] = useState('paste');
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [profile, setProfile] = useState(null);
  const [parseError, setParseError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [dashTab, setDashTab] = useState('career');
  const [dashError, setDashError] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [zipProfile, setZipProfile] = useState(null); // parsed ZIP profile waiting for user to confirm
  const fileInputRef = useRef(null);
  const pasteAreaRef = useRef(null);

  // Restore session from localStorage — clear cache if schema version changed
  useEffect(() => {
    try {
      const savedVersion = localStorage.getItem('li_dashboard_version');
      if (savedVersion !== DASHBOARD_VERSION) {
        // Stale cache — wipe it so the user regenerates with the new schema
        localStorage.removeItem('li_profile');
        localStorage.removeItem('li_dashboard');
        localStorage.removeItem('li_dashboard_version');
        return;
      }
      const savedProfile = localStorage.getItem('li_profile');
      const savedDashboard = localStorage.getItem('li_dashboard');
      const savedKey = sessionStorage.getItem('li_user_key');
      if (savedProfile && savedDashboard) {
        setProfile(JSON.parse(savedProfile));
        setDashboard(JSON.parse(savedDashboard));
        if (savedKey) setUserApiKey(savedKey);
        setPhase('dashboard');
      }
    } catch (e) {}
  }, []);

  const saveToStorage = (prof, dash) => {
    try {
      localStorage.setItem('li_profile', JSON.stringify(prof));
      localStorage.setItem('li_dashboard', JSON.stringify(dash));
      localStorage.setItem('li_dashboard_version', DASHBOARD_VERSION);
    } catch (e) {}
  };

  const generateDashboard = async (prof, overrideKey) => {
    const apiKey = overrideKey || userApiKey || '';
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileContext: prof, userApiKey: apiKey || undefined })
      });
      const data = await res.json();
      if (res.status === 401) {
        setDashError('API key invalid — enter a valid Anthropic API key to generate the dashboard.');
        setPhase('upload');
        setShowKeyModal(true);
        return;
      }
      if (data.error) throw new Error(data.error);
      setDashboard(data.dashboard);
      saveToStorage(prof, data.dashboard);
      setPhase('dashboard');
    } catch (err) {
      setDashError(err.message);
      setPhase('upload');
    }
  };

  const finishLoading = (prof) => {
    setProfile(prof);
    setDashboard(null);
    setDashTab('career');
    setDashError('');
    setPhase('generating');
    generateDashboard(prof);
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      setParseError('Please upload a .zip file — the LinkedIn data export.');
      return;
    }
    setPhase('loading');
    setParseError('');
    setZipProfile(null);
    const result = await parseLinkedInZip(file);
    if (!result.success) {
      setParseError(`Could not parse the ZIP: ${result.error}.`);
      setPhase('upload');
      return;
    }
    // Show preview step — user must click the generate button
    setZipProfile(result.profile);
    setPhase('upload');
  };

  const handlePaste = () => {
    setPasteError('');
    const text = pasteText.trim();
    if (text.length < 100) {
      setPasteError('Please paste your full LinkedIn experience section — it looks too short.');
      return;
    }
    const hasDate = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i.test(text);
    if (!hasDate) {
      setPasteError('No dates detected. Make sure you copy the Experience section from your LinkedIn profile.');
      return;
    }
    setPhase('loading');
    setTimeout(() => {
      try {
        const prof = buildProfileFromPaste(text);
        if (!prof.positions || prof.positions.length === 0) {
          setPasteError('Could not extract any roles. Try copying more of your profile — include company names and dates.');
          setPhase('upload');
          return;
        }
        finishLoading(prof);
      } catch (e) {
        setPasteError(`Parsing error: ${e.message}`);
        setPhase('upload');
      }
    }, 100);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const submitKey = () => {
    if (!keyInput.trim().startsWith('sk-ant-')) {
      setKeyError('Anthropic API keys start with sk-ant-. Please check your key.');
      return;
    }
    const key = keyInput.trim();
    setUserApiKey(key);
    sessionStorage.setItem('li_user_key', key);
    setShowKeyModal(false);
    setKeyError('');
    // If we have a profile but no dashboard yet, regenerate with the new key
    if (profile && !dashboard) {
      setPhase('generating');
      generateDashboard(profile, key);
    }
  };

  const clearSession = () => {
    localStorage.removeItem('li_profile');
    localStorage.removeItem('li_dashboard');
    localStorage.removeItem('li_dashboard_version');
    sessionStorage.removeItem('li_user_key');
    setDashboard(null);
    setProfile(null);
    setDashTab('career');
    setUserApiKey('');
    setPasteText('');
    setDashError('');
    setZipProfile(null);
    setPhase('upload');
  };

  // ── BYOK MODAL ────────────────────────────────────────────────────────────
  const KeyModal = () => (
    <div className="modal-overlay" onClick={() => setShowKeyModal(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Use Your Own Anthropic API Key</h3>
          <button className="modal-close" onClick={() => setShowKeyModal(false)}>✕</button>
        </div>
        <p className="modal-desc">
          Add your key to generate the dashboard with the real Claude AI. Your key is never stored server-side.
        </p>
        <div className="modal-input-wrap">
          <input
            className="modal-input"
            type="password"
            placeholder="sk-ant-api03-..."
            value={keyInput}
            onChange={e => { setKeyInput(e.target.value); setKeyError(''); }}
            onKeyDown={e => e.key === 'Enter' && submitKey()}
            autoFocus
          />
        </div>
        {keyError && <p className="key-error">{keyError}</p>}
        <div className="modal-actions">
          <button className="btn-primary" onClick={submitKey}>Use This Key</button>
          <button className="btn-ghost" onClick={() => setShowKeyModal(false)}>Cancel</button>
        </div>
        <p className="modal-note">
          🔒 Stored in sessionStorage only — cleared when you close the tab. Get a key at{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a>
        </p>
      </div>
    </div>
  );

  // ── UPLOAD / LOADING / GENERATING ────────────────────────────────────────
  if (phase === 'upload' || phase === 'loading' || phase === 'generating') {
    return (
      <div className="app">
        <header className="header">
          <div className="header-left">
            <Logo id="lg" />
            <div>
              <h1 className="header-title">LinkedIn Profile Analyzer</h1>
              <p className="header-sub">Career Intelligence · Powered by Claude AI</p>
            </div>
          </div>
        </header>

        <div className="upload-screen">
          <div className="upload-hero">
            <h2 className="upload-heading">Understand Your Career<br />Through Data</h2>
            <p className="upload-desc">
              Upload your LinkedIn data export or paste your experience — get an instant career dashboard
              with AI job matches, skill gaps, and recruiter tips.
            </p>
          </div>

          {phase === 'loading' && (
            <div className="parsing-state">
              <div className="parse-orb" />
              <p className="parse-text">Analyzing your profile...</p>
              <p className="parse-sub">Extracting roles, companies, dates</p>
            </div>
          )}

          {phase === 'generating' && (
            <div className="parsing-state">
              <div className="parse-orb" />
              <p className="parse-text">Building your career dashboard...</p>
              <p className="parse-sub">Analyzing positions, skills, and career trajectory</p>
              {profile && profile.stats?.totalRoles > 0 && (
                <p className="parse-sub" style={{ marginTop: 4 }}>
                  {profile.stats.totalRoles} roles · {profile.stats.uniqueCompanies} {profile.stats.uniqueCompanies === 1 ? 'company' : 'companies'} · {profile.stats.totalYearsExperience}yr exp
                </p>
              )}
            </div>
          )}

          {phase === 'upload' && (
            <>
              {dashError && (
                <div className="parse-error" style={{ maxWidth: 520, textAlign: 'center' }}>
                  ⚠️ {dashError}
                  {!userApiKey && (
                    <> — <button className="link-btn" onClick={() => setShowKeyModal(true)}>Add your API key</button></>
                  )}
                </div>
              )}

              <div className="upload-tabs">
                <button
                  className={`upload-tab ${uploadTab === 'paste' ? 'active' : ''}`}
                  onClick={() => {
                    setUploadTab('paste');
                    setParseError('');
                    setPasteError('');
                    setTimeout(() => pasteAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                  }}
                >
                  📋 Paste Profile
                </button>
                <button
                  className={`upload-tab ${uploadTab === 'zip' ? 'active' : ''}`}
                  onClick={() => { setUploadTab('zip'); setParseError(''); setPasteError(''); setZipProfile(null); }}
                >
                  📁 Upload ZIP
                </button>
              </div>

              {uploadTab === 'paste' && (
                <div className="paste-section" ref={pasteAreaRef}>
                  <p className="paste-instructions">
                    Go to your LinkedIn profile → scroll to <strong>Experience</strong> → select all text in that section → copy → paste below.
                  </p>
                  <textarea
                    className="paste-input"
                    placeholder="Paste your LinkedIn Experience section here...

Example of what to copy:
ServiceNow
13 yrs 7 mos
Director of Analytics
Full-time
Aug 2025 - Present · 9 mos
..."
                    value={pasteText}
                    onChange={e => { setPasteText(e.target.value); setPasteError(''); }}
                    rows={8}
                  />
                  {pasteError && <p className="parse-error">⚠️ {pasteError}</p>}
                  <button className="paste-submit-btn" onClick={handlePaste}>
                    Generate My Career Dashboard →
                  </button>
                  <p className="paste-note">
                    💡 For skills, education, and recommendations — also paste those sections or use the ZIP export for richer analysis.
                  </p>
                </div>
              )}

              {uploadTab === 'zip' && (
                <>
                  {!zipProfile ? (
                    <>
                      <div className="how-to-card">
                        <p className="how-to-card-title">📋 How to get your LinkedIn export</p>
                        <div className="how-steps">
                          <div className="how-step">
                            <span className="how-num">1</span>
                            <span>Go to LinkedIn → click your profile photo → <strong>Settings &amp; Privacy</strong></span>
                          </div>
                          <div className="how-step">
                            <span className="how-num">2</span>
                            <span>Click <strong>Data Privacy</strong> → <strong>"Download your data"</strong> → <strong>"Download archive"</strong> or <strong>"Request new archive"</strong> (email arrives within 24h)</span>
                          </div>
                          <div className="how-step">
                            <span className="how-num">3</span>
                            <span>Download the ZIP from the email and upload below. File: <code>Basic_LinkedInDataExport_XX-XX-XXXX.zip</code></span>
                          </div>
                        </div>
                        <div className="how-to-card-divider" />
                        <p className="how-to-card-note">
                          💡 If positions are missing from your export, use the <strong>Paste Profile</strong> tab instead.
                        </p>
                      </div>
                      <div
                        className={`dropzone ${isDragging ? 'dragging' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input ref={fileInputRef} type="file" accept=".zip" style={{ display: 'none' }}
                          onChange={e => handleFile(e.target.files[0])} />
                        <div className="dropzone-icon">📁</div>
                        <p className="dropzone-main">Drop your LinkedIn export ZIP here</p>
                        <p className="dropzone-sub">or click to browse</p>
                        <p className="dropzone-hint">File: <code>Basic_LinkedInDataExport_XX-XX-XXXX.zip</code></p>
                      </div>
                      {parseError && <p className="parse-error">⚠️ {parseError}</p>}
                    </>
                  ) : (
                    <div className="zip-success-card">
                      <div className="zip-success-icon">✅</div>
                      <div className="zip-success-info">
                        <p className="zip-success-title">ZIP uploaded successfully</p>
                        <div className="zip-success-stats">
                          {zipProfile.name && <span className="zip-stat">{zipProfile.name}</span>}
                          {zipProfile.stats?.totalRoles > 0 && <span className="zip-stat">{zipProfile.stats.totalRoles} roles</span>}
                          {zipProfile.stats?.uniqueCompanies > 0 && <span className="zip-stat">{zipProfile.stats.uniqueCompanies} {zipProfile.stats.uniqueCompanies === 1 ? 'company' : 'companies'}</span>}
                          {zipProfile.stats?.totalYearsExperience > 0 && <span className="zip-stat">{zipProfile.stats.totalYearsExperience}yr exp</span>}
                          {zipProfile.skills?.length > 0 && <span className="zip-stat">{zipProfile.skills.length} skills</span>}
                          {zipProfile.recommendations?.length > 0 && <span className="zip-stat">{zipProfile.recommendations.length} recommendations</span>}
                        </div>
                      </div>
                      <button className="zip-reupload-btn" onClick={() => { setZipProfile(null); setParseError(''); }}>
                        Upload different file
                      </button>
                      <button className="paste-submit-btn" onClick={() => finishLoading(zipProfile)}>
                        Generate My Career Dashboard →
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="privacy-note">
                🔒 Your data never leaves your browser — only structured summaries are sent to Claude
              </div>
            </>
          )}
        </div>

        {showKeyModal && <KeyModal />}
      </div>
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <button className="btn-back" onClick={clearSession} title="Back to upload">← Back</button>
          <Logo id="lg2" />
          <div>
            <h1 className="header-title">LinkedIn Profile Analyzer</h1>
            <p className="header-sub">Career Dashboard{profile?.name ? ` · ${profile.name}` : ''}</p>
          </div>
        </div>
        <div className="header-right">
          {userApiKey && <span className="own-key-badge">🔑 Your key</span>}
          <button className="btn-ghost" onClick={() => setShowKeyModal(true)}>Use own key</button>
        </div>
      </header>

      <div className="dash-stats-bar">
        {profile?.stats?.totalRoles > 0 && <span>{profile.stats.totalRoles} roles</span>}
        {profile?.stats?.uniqueCompanies > 0 && (
          <><span className="dash-sep">·</span><span>{profile.stats.uniqueCompanies} {profile.stats.uniqueCompanies === 1 ? 'company' : 'companies'}</span></>
        )}
        {profile?.stats?.totalYearsExperience > 0 && (
          <><span className="dash-sep">·</span><span>{profile.stats.totalYearsExperience}yr experience</span></>
        )}
        {profile?.skills?.length > 0 && (
          <><span className="dash-sep">·</span><span>{profile.skills.length} skills</span></>
        )}
        {profile?.recommendations?.length > 0 && (
          <><span className="dash-sep">·</span><span>{profile.recommendations.length} recommendations</span></>
        )}
      </div>

      <div className="dash-tab-bar">
        {DASH_TABS.map(t => (
          <button
            key={t.id}
            className={`dash-tab ${dashTab === t.id ? 'active' : ''}`}
            onClick={() => setDashTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {dashTab === 'chat' ? (
        <ChatTab profile={profile} userApiKey={userApiKey} onShowKeyModal={() => setShowKeyModal(true)} />
      ) : (
        <div className="dash-content">
          {dashTab === 'career' && <CareerTab data={dashboard?.career} />}
          {dashTab === 'skills' && <SkillsTab data={dashboard?.skills} />}
          {dashTab === 'recommendations' && <RecsTab data={dashboard?.recommendations} />}
          {dashTab === 'aiJobs' && <AIJobsTab data={dashboard?.aiJobs} />}
          {dashTab === 'recruiter' && <RecruiterTab data={dashboard?.recruiterTips} />}
        </div>
      )}

      {showKeyModal && <KeyModal />}
    </div>
  );
}
