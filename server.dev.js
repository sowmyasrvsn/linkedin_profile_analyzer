// Local dev server — handles /api/chat for react-scripts dev (proxy in package.json)
// Run with MOCK=true to skip Claude and return realistic fake responses for UI testing.
const fs = require('fs');
const http = require('http');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      if (key) process.env[key] = val;
    }
  });
}

const PORT = 3001;
const MOCK = process.env.MOCK === 'true';

// ── MOCK RESPONSES ──────────────────────────────────────────────────────────
function getMockBlocks(userMessage, profile) {
  const msg = (userMessage || '').toLowerCase();
  const currentTitle = profile?.positions?.[0]?.title || 'Director of Analytics';
  const currentCo   = profile?.positions?.[0]?.company || 'your company';
  const prevTitle   = profile?.positions?.[1]?.title || 'Senior Manager';
  const prevCo      = profile?.positions?.[1]?.company || 'previous company';
  const years       = profile?.stats?.totalYearsExperience || 10;
  const roles       = profile?.stats?.totalRoles || 4;
  const name        = profile?.name || 'you';

  const text = (content) => [{ type: 'text', content }];

  if (msg.includes('tell me about yourself') || msg.includes('introduce')) {
    return text(
`Your answer has one job: make the interviewer think "this is exactly who we need" in 60 seconds.

Use this structure for your opening:

"I'm a ${currentTitle} with ${Math.round(years)} years turning raw data into decisions that move revenue. At ${currentCo}, I [insert your single biggest quantified win here]. Before that at ${prevCo}, I [second proof point]. I'm looking for a role where I can [specific thing this company does that you want to own]."

**What to fix today:** Pull up your ${currentCo} role and write down one outcome with a number — cost saved, revenue influenced, time reduced. That's sentence two. Without it, you sound like every other candidate.`
    );
  }

  if (msg.includes('headline') || msg.includes('linkedin headline')) {
    return text(
`Your headline is almost certainly your job title. That's wrong — it's wasted real estate.

Strong Director-level headline formula:
**[What you do] → [What it produces] | [1 credibility signal]**

For your profile: "Turning Data Into Business Decisions | Analytics Leader at ${currentCo} | ${Math.round(years)}yr driving revenue with AI & BI"

That version: (1) says what you produce, not just what you are, (2) signals seniority, (3) includes keywords recruiters actually search ("analytics", "AI", "BI").

**Do this today:** Open LinkedIn, edit your headline, paste that formula in, swap in your real win. Takes 4 minutes.`
    );
  }

  if (msg.includes('strongest story') || msg.includes('lead every interview') || msg.includes('best story')) {
    return text(
`Your strongest story is the one where you can say a specific dollar or percentage number and explain exactly how you got it.

From your profile, your best candidate is your ${currentTitle} role at ${currentCo}. Structure it as:
- **Situation:** What was broken or missing when you arrived
- **Action:** The specific thing YOU did (not "we")
- **Result:** The number — revenue, cost, time, adoption rate

If you don't have a number for that role yet, that's your problem — not your story. Go find the number.

**Do this today:** Email or Slack one stakeholder from ${currentCo} and ask: "What was the measurable impact of [project]?" Their answer is your story.`
    );
  }

  if (msg.includes('cold') || msg.includes('outreach') || msg.includes('hiring manager') || msg.includes('databricks') || msg.includes('snowflake')) {
    return text(
`Cold outreach works when it's short, specific, and makes the reader feel seen. Here's a template built for your profile:

---
Subject: ${currentTitle} → [Their Company] — quick question

Hi [Name],

I've been following [their company]'s approach to [specific thing — e.g., "the data lakehouse model"] and it maps directly to work I've been doing at ${currentCo}.

I'm a ${currentTitle} with ${Math.round(years)} years in analytics and AI. Most recently [one-line win with a number].

Would you be open to a 20-minute call to explore if there's a fit?

[Your name]
---

Keep it under 100 words. No resume in the first message. No "I hope this finds you well."

**Do this today:** Find 3 hiring managers at your target company on LinkedIn, customize line 2 for each one, send all three before end of day.`
    );
  }

  if (msg.includes('negotiate') || msg.includes('compensation') || msg.includes('salary') || msg.includes('offer')) {
    return text(
`Never negotiate from your current salary. Negotiate from market data plus your specific value.

Three-step process:
1. **Anchor high first.** When they ask your number, give a range where the bottom is what you actually want. For a ${currentTitle} with ${Math.round(years)} years, research Levels.fyi + Glassdoor for your target company specifically.
2. **Justify with outcomes.** "Based on the impact I drove at ${currentCo} — [your number metric] — I'm targeting $X."
3. **Never accept on the call.** Say: "I'm very interested. Can I have 48 hours to review the full package?" Every time.

**Do this today:** Go to Levels.fyi, search your target company + title, screenshot the P50 and P75 numbers. That's your anchor range.`
    );
  }

  if (msg.includes('gap') || msg.includes('transition') || msg.includes('explain') || msg.includes('career change')) {
    return text(
`Never apologize for a gap or transition. Explain it as a deliberate move, then pivot immediately to what you built or learned.

Formula: "I [left / took time / transitioned] because [one honest sentence]. During that time I [specific thing you did or learned]. The result is [how it makes you stronger for this role]."

From your profile: your move from ${prevTitle} at ${prevCo} to ${currentTitle} at ${currentCo} is a strength, not a liability — it shows you can operate at multiple levels. Frame it as expanded scope, not a lateral move.

**Do this today:** Write out your two-sentence transition answer for the hardest move in your history. Practice it out loud once. If it takes more than 30 seconds, cut it.`
    );
  }

  // Default
  return text(
`From your profile: ${Math.round(years)} years of experience, ${roles} roles, most recently ${currentTitle} at ${currentCo}.

The single highest-leverage thing most profiles at your level are missing: **quantified outcomes in every role**. Not responsibilities — results. Hiring managers at Google, Stripe, and Databricks scan for numbers in the first 10 seconds. If they don't see them, they move on.

Go to your ${currentCo} role right now. If the bullets say what you did but not what changed because of it, rewrite them.

**Do this today:** Pick your most recent role. Add one metric to one bullet — revenue, cost, time, adoption rate, team size, anything with a number attached.

⚠️ *Mock mode — add your Anthropic API key for answers specific to your actual profile.*`
  );
}

// ── REAL CLAUDE TOOLS SCHEMA ────────────────────────────────────────────────
const TOOLS = [
  { name: "render_bar_chart", description: "Render a bar chart visualization", input_schema: { type: "object", properties: { title: { type: "string" }, data: { type: "array", items: { type: "object", properties: { name: { type: "string" }, value: { type: "number" }, value2: { type: "number" } }, required: ["name", "value"] } }, xKey: { type: "string" }, yKeys: { type: "array", items: { type: "string" } }, colors: { type: "array", items: { type: "string" } }, unit: { type: "string" } }, required: ["title", "data", "xKey", "yKeys"] } },
  { name: "render_pie_chart", description: "Render a pie/donut chart", input_schema: { type: "object", properties: { title: { type: "string" }, data: { type: "array", items: { type: "object", properties: { name: { type: "string" }, value: { type: "number" } }, required: ["name", "value"] } }, colors: { type: "array", items: { type: "string" } } }, required: ["title", "data"] } },
  { name: "render_kpi_cards", description: "Render KPI summary cards", input_schema: { type: "object", properties: { cards: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" }, sub: { type: "string" }, trend: { type: "string", enum: ["up", "down", "neutral"] } }, required: ["label", "value"] } } }, required: ["cards"] } },
  { name: "render_ai_jobs", description: "Render AI world job recommendations", input_schema: { type: "object", properties: { seniority: { type: "string" }, roles: { type: "array", items: { type: "object", properties: { title: { type: "string" }, fit_score: { type: "number" }, why: { type: "string" }, skills_match: { type: "array", items: { type: "string" } }, skills_gap: { type: "array", items: { type: "string" } } }, required: ["title", "fit_score", "why", "skills_match", "skills_gap"] } } }, required: ["seniority", "roles"] } },
  { name: "render_timeline", description: "Render a career timeline", input_schema: { type: "object", properties: { events: { type: "array", items: { type: "object", properties: { year: { type: "string" }, title: { type: "string" }, company: { type: "string" }, duration: { type: "string" }, type: { type: "string", enum: ["job", "education", "gap"] } }, required: ["year", "title", "type"] } } }, required: ["events"] } },
  { name: "render_data_table", description: "Render a data table", input_schema: { type: "object", properties: { title: { type: "string" }, columns: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array" } } }, required: ["title", "columns", "rows"] } }
];

const SYSTEM_PROMPT_PREFIX = `You are a former FAANG hiring manager with 15 years of experience reviewing 10,000+ resumes for senior analytics, data science, and AI leadership roles. You now advise senior professionals on getting hired at top-tier companies.

You have zero tolerance for:
- Vague advice like "tailor your resume to the job"
- Encouragement that isn't backed by specific action
- Softening feedback to protect feelings
- Generic best practices everyone already knows

You have high standards because you know what actually gets people hired at companies like Google, Meta, Stripe, Databricks, Snowflake, and ServiceNow.

Here is the parsed LinkedIn profile you are advising:
`;

// ── MOCK SKILLS & AI JOBS (profile-aware) ───────────────────────────────────
function mockSkills(title, level, years, skillsArr) {
  const t = (title || '').toLowerCase();
  const knownSkills = skillsArr.slice(0, 5);

  const isEngineering = /engineer|developer|architect|backend|frontend|fullstack|devops|sre/i.test(t);
  const isDataScience  = /data scientist|machine learning|ml |ai |nlp|deep learning/i.test(t);
  const isProduct      = /product manager|product lead|pm |head of product/i.test(t);
  const isLeadership   = /vp|vice president|chief|cto|cdo|ciso|svp|evp|director|head of/i.test(t);
  const isAnalytics    = /analyst|analytics|bi |business intelligence|insight|reporting/i.test(t);

  let strengths, gaps, chartData, feedback;

  if (isEngineering) {
    strengths = knownSkills.length ? knownSkills : ['System Design', 'Software Engineering', 'APIs & Integration', 'CI/CD', 'Code Review'];
    gaps      = ['ML / AI fundamentals', 'Stakeholder communication', 'Product sense', 'Executive storytelling'];
    chartData = [{ name: 'Technical', value: 50 }, { name: 'Engineering', value: 25 }, { name: 'Communication', value: 15 }, { name: 'Leadership', value: 10 }];
    feedback  = `Strong technical depth — this is the floor, not the ceiling. The gap holding back ${level}-level engineers is translating code impact into business outcomes. That skill is what gets you to Staff or Principal.`;
  } else if (isDataScience) {
    strengths = knownSkills.length ? knownSkills : ['Machine Learning', 'Statistical Modeling', 'Python / R', 'Experimentation', 'Data Analysis'];
    gaps      = ['ML Ops & productionization', 'Executive communication', 'Business strategy', 'Cross-functional influence'];
    chartData = [{ name: 'ML / AI', value: 45 }, { name: 'Analytical', value: 30 }, { name: 'Communication', value: 15 }, { name: 'Leadership', value: 10 }];
    feedback  = `Technically strong. The ceiling for most data scientists is not the models — it's the ability to get models into production and tie results to revenue. That's where to invest.`;
  } else if (isProduct) {
    strengths = knownSkills.length ? knownSkills : ['Product Strategy', 'Roadmap Planning', 'User Research', 'Stakeholder Alignment', 'Prioritization'];
    gaps      = ['Data engineering basics', 'SQL / Python fundamentals', 'AI/ML product fluency', 'Quantitative analysis'];
    chartData = [{ name: 'Product', value: 40 }, { name: 'Communication', value: 30 }, { name: 'Analytical', value: 20 }, { name: 'Technical', value: 10 }];
    feedback  = `Solid product instincts. The gap is quantitative credibility — PMs who can pull their own data and speak ML fluently get 30–40% more senior roles and move faster in interviews.`;
  } else if (isLeadership) {
    strengths = knownSkills.length ? knownSkills : ['Executive Leadership', 'Org Design', 'Strategic Planning', 'P&L Management', 'Board Communication'];
    gaps      = ['AI fluency', 'Modern data stack', 'Hands-on technical credibility', 'Digital transformation execution'];
    chartData = [{ name: 'Leadership', value: 45 }, { name: 'Strategy', value: 30 }, { name: 'Communication', value: 15 }, { name: 'Technical', value: 10 }];
    feedback  = `Leadership credentials are strong. The risk at ${level} level in 2026 is being perceived as pre-AI — one visible AI initiative or certification closes that gap fast.`;
  } else {
    // analytics / default
    strengths = knownSkills.length ? knownSkills : ['Data Analysis', 'BI Tools', 'SQL', 'Stakeholder Communication', 'Reporting'];
    gaps      = ['Machine Learning / AI', 'Cloud Platforms (AWS/GCP)', 'Python or R', 'Predictive Modeling'];
    chartData = [{ name: 'Analytical', value: 40 }, { name: 'Communication', value: 25 }, { name: 'Leadership', value: 20 }, { name: 'Technical', value: 15 }];
    feedback  = `Strong analytical and communication foundation. The technical gap (ML, Python, cloud) is the primary blocker for senior analytics leadership roles at top-tier companies.`;
  }

  return {
    strengths,
    gaps,
    chartData,
    insights: `Based on the title "${title}" and ${Math.round(years)} years of experience, the skill profile is weighted toward ${chartData[0].name.toLowerCase()} capabilities at the ${level} level. ${gaps[0]} is the most critical gap for the next role up.`,
    coaching: [
      `Close the "${gaps[0]}" gap first — it appears on 80%+ of ${level}-level job descriptions at your target companies`,
      `Document your top 3 wins from the last 12 months with specific numbers — this is what turns interviews into offers`,
      `Your existing ${strengths[0]} strength is undersold — add a concrete outcome to prove it on your profile`
    ],
    feedback
  };
}

function mockAiJobs(title, level, years, company) {
  const t = (title || '').toLowerCase();
  const isEngineering = /engineer|developer|architect/i.test(t);
  const isDataScience  = /data scientist|machine learning|ml |ai /i.test(t);
  const isProduct      = /product/i.test(t);
  const isLeadership   = /vp|director|head|chief/i.test(t);

  const base = Math.min(95, 70 + Math.round(years / 2));

  let roles;
  if (isEngineering) {
    roles = [
      { title: 'AI/ML Engineer', fit_score: base, why: `Engineering background at ${company} maps directly to building and deploying AI systems at scale.`, skills_match: ['Software engineering', 'System design', 'APIs'], skills_gap: ['ML fundamentals', 'Model training', 'LLM fine-tuning'] },
      { title: 'Staff AI Platform Engineer', fit_score: base - 6, why: `${years} years of engineering experience positions you for platform ownership roles that sit at the intersection of infra and AI.`, skills_match: ['Infrastructure', 'Scalable systems', 'CI/CD'], skills_gap: ['ML Ops', 'Vector databases', 'Model serving'] },
      { title: 'AI Solutions Architect', fit_score: base - 12, why: `Technical depth plus client-facing context from ${company} maps well to solutions architecture for enterprise AI.`, skills_match: ['Technical breadth', 'Architecture design', 'Integration'], skills_gap: ['Pre-sales experience', 'AI product demos', 'Customer discovery'] },
    ];
  } else if (isDataScience) {
    roles = [
      { title: 'Head of AI / ML', fit_score: base, why: `${years} years in data science at ${company} demonstrates the depth needed to lead an AI function, not just contribute to one.`, skills_match: ['ML modeling', 'Statistical analysis', 'Experimentation'], skills_gap: ['Team leadership', 'Executive communication', 'ML Ops'] },
      { title: 'Applied AI Research Lead', fit_score: base - 5, why: `Research and modeling experience translates directly to applied AI roles where rigor and production both matter.`, skills_match: ['Model development', 'Research methodology', 'Python'], skills_gap: ['Production ML', 'Business context', 'Stakeholder alignment'] },
      { title: 'AI Product Manager', fit_score: base - 14, why: `Domain expertise from ${company} gives you the technical credibility most PMs lack — the gap is product process, not knowledge.`, skills_match: ['ML understanding', 'Data-driven decisions', 'Technical depth'], skills_gap: ['Product roadmapping', 'Customer research', 'Go-to-market'] },
    ];
  } else if (isProduct) {
    roles = [
      { title: 'AI Product Lead', fit_score: base, why: `Product management background at ${company} is exactly what AI teams need — someone who can translate model capabilities into user value.`, skills_match: ['Roadmapping', 'User research', 'Stakeholder alignment'], skills_gap: ['ML fundamentals', 'Prompt engineering', 'AI evaluation'] },
      { title: 'Head of AI Product', fit_score: base - 7, why: `${years} years of product experience means you can own the full AI product lifecycle — the gap is technical AI depth.`, skills_match: ['Strategy', 'Cross-functional leadership', 'Prioritization'], skills_gap: ['LLM APIs', 'AI metrics & evals', 'Model selection'] },
      { title: 'AI Strategy Consultant', fit_score: base - 13, why: `Product instincts from ${company} map well to advising enterprises on AI adoption — business translation is the core skill.`, skills_match: ['Business analysis', 'Communication', 'Problem framing'], skills_gap: ['AI implementation patterns', 'Vendor landscape', 'ROI modeling'] },
    ];
  } else {
    // analytics / leadership / default
    roles = [
      { title: 'VP of Data & AI', fit_score: base, why: `${years} years progressing to ${title} at ${company} signals readiness to own an AI-enabled data function end-to-end.`, skills_match: ['Analytics leadership', 'Stakeholder management', 'Data strategy'], skills_gap: ['ML Ops familiarity', 'AI governance', 'Cloud data stack'] },
      { title: 'AI Strategy & Operations Lead', fit_score: base - 6, why: `Business-facing experience at ${company} maps directly to the translation layer AI transformation roles demand.`, skills_match: ['Strategic analysis', 'Cross-team influence', 'Business context'], skills_gap: ['LLM fundamentals', 'AI product lifecycle', 'Prompt engineering'] },
      { title: 'Chief Data Officer', fit_score: base - 11, why: `Tenure depth and progression to ${title} build the credibility needed for a CDO role — the gap is board-level AI narrative.`, skills_match: ['Data strategy', 'Executive communication', 'Org leadership'], skills_gap: ['AI P&L ownership', 'Board reporting', 'AI risk frameworks'] },
    ];
  }

  return {
    seniority: level,
    roles,
    insights: `At ${Math.round(years)} years with a ${level}-level profile, the best AI-era positioning is on the ${isEngineering || isDataScience ? 'technical' : 'strategic'} side of AI. These roles pay $180K–$350K+ at top companies and play directly to your existing strengths.`,
    coaching: [
      `Complete one AI certification relevant to your track — it eliminates the "not technical enough" objection in ${Math.round(100 - base + 10)}% of rejections at your level`,
      `Add any AI-adjacent project to your LinkedIn — even a proof-of-concept shows initiative that titles alone don't`,
      `Target companies in AI transformation phases, not just AI-native ones — your background is more valuable there`
    ],
    feedback: `Well-positioned for the ${isEngineering || isDataScience ? 'technical' : 'business'} layer of AI roles. Close the "${roles[0].skills_gap[0]}" gap with one visible action and your fit score jumps 10–15 points.`
  };
}

// ── MOCK DASHBOARD ───────────────────────────────────────────────────────────
function getMockDashboard(profile) {
  const name = profile?.name || 'the candidate';
  const roles = profile?.stats?.totalRoles || 2;
  const years = profile?.stats?.totalYearsExperience || 5;
  const companies = profile?.stats?.uniqueCompanies || 1;
  const positions = profile?.positions || [];
  const currentTitle = positions[0]?.title || 'your current role';
  const currentCo = positions[0]?.company || 'Current Company';
  const currentTenure = positions[0]?.tenure || '—';

  // Avg time to promote = avg years between role transitions
  const avgPromoteMos = roles > 1 ? Math.round((years * 12) / (roles - 1)) : Math.round(years * 12);
  const apYrs = Math.floor(avgPromoteMos / 12);
  const apMos = avgPromoteMos % 12;
  const avgPromoteLabel = apYrs > 0 && apMos > 0 ? `${apYrs}yr ${apMos}mo` : apYrs > 0 ? `${apYrs}yr` : `${apMos}mo`;

  const avgTenure = (years / Math.max(roles, 1)).toFixed(1);
  const level = years >= 10 ? 'Executive' : years >= 7 ? 'Senior' : years >= 4 ? 'Mid' : 'Entry';

  // Peer benchmarks — tech industry (BLS / LinkedIn Talent Insights)
  const INDUSTRY_TENURE_YRS = 2.1;   // avg tenure per role in tech
  const INDUSTRY_PROMOTE_MOS = 21;   // avg months to promotion in tech (Director+)
  const tenureDiff = parseFloat(avgTenure) - INDUSTRY_TENURE_YRS;
  const tenureSub = tenureDiff > 0.3
    ? `${tenureDiff.toFixed(1)}yr above ${INDUSTRY_TENURE_YRS}yr tech avg`
    : tenureDiff < -0.3
    ? `${Math.abs(tenureDiff).toFixed(1)}yr below ${INDUSTRY_TENURE_YRS}yr tech avg`
    : `on par with ${INDUSTRY_TENURE_YRS}yr tech avg`;
  const promoteSub = avgPromoteMos < INDUSTRY_PROMOTE_MOS - 3
    ? `faster than ${INDUSTRY_PROMOTE_MOS}mo tech median`
    : avgPromoteMos > INDUSTRY_PROMOTE_MOS + 6
    ? `slower than ${INDUSTRY_PROMOTE_MOS}mo tech median`
    : `on par with ${INDUSTRY_PROMOTE_MOS}mo tech median`;

  return {
    career: {
      kpis: [
        { label: 'Total Experience', value: `${years}yr`, sub: 'years in industry', trend: 'up' },
        { label: 'Roles Held', value: String(roles), sub: `across ${companies} ${companies === 1 ? 'company' : 'companies'}`, trend: 'neutral' },
        { label: 'Avg Tenure', value: `${avgTenure}yr`, sub: tenureSub, trend: tenureDiff >= 0 ? 'up' : 'down' },
        { label: 'Avg Time to Promote', value: avgPromoteLabel, sub: promoteSub, trend: avgPromoteMos <= INDUSTRY_PROMOTE_MOS ? 'up' : 'neutral' },
        { label: 'Time in Current Role', value: currentTenure, sub: currentCo, trend: 'neutral' }
      ],
      insights: `${name} has ${years} years of total experience across ${roles} role${roles !== 1 ? 's' : ''} at ${companies} ${companies === 1 ? 'company' : 'companies'}. Average tenure is ${avgTenure} years per role. Average time between promotions is ${avgPromoteLabel}${avgPromoteMos <= 24 ? ' — fast track by industry standards' : ' — at or above the typical 18–24 month benchmark'}. ${companies === 1 ? 'Single-company depth signals domain expertise and organizational trust, but raises portability questions.' : 'Cross-company exposure signals adaptability.'}`,
      coaching: [
        `GAP: No quantified impact in role descriptions. WHY IT MATTERS: Executives hire for outcomes, not activities. SEVERITY: Critical. HOW TO CLOSE IT: Rewrite every bullet with this format — action verb → what you changed → measurable result (revenue, %, time). Do it this week.`,
        `GAP: ${companies < 3 ? 'Limited company diversity.' : 'Progression visibility.'} WHY IT MATTERS: ${companies < 3 ? 'Single-company tenure reads as risk-averse to external hiring managers above Director level.' : 'Title progression is not self-evident from the profile — it requires decoding.'} SEVERITY: ${companies < 3 ? 'Moderate' : 'Minor'}. HOW TO CLOSE IT: ${companies < 3 ? 'Take on a board advisory role or fractional engagement externally to demonstrate cross-market credibility.' : 'Add a one-line promotion note (e.g., "Promoted from X to Y in 18 months") under each role.'}`,
        `GAP: Missing executive presence signals on LinkedIn. WHY IT MATTERS: At ${level}-level and above, recruiters are not just screening for skills — they're vetting for thought leadership and network influence. SEVERITY: ${years >= 7 ? 'Critical' : 'Moderate'}. HOW TO CLOSE IT: Post one insight or industry observation per week for 90 days. This is the fastest way to surface in recruiter searches for ${years >= 7 ? 'VP/C-suite' : 'Director/Senior'} roles.`
      ],
      feedback: `PRIORITY ACTION (next 90 days): Rewrite your LinkedIn profile summary and every role description with quantified impact — then activate your network with weekly posts. This single shift moves you from "qualified candidate" to "sought-after executive." Everything else on this list is secondary. The profile has the raw material; the packaging is what's failing you right now.`
    },
    skills: mockSkills(currentTitle, level, years, profile?.skills || []),
    recommendations: {
      themes: [
        { theme: 'Strategic Thinking', description: 'Recommenders highlight the ability to see the big picture and connect data to business outcomes', quote: '"Always frames analysis in terms of business impact, not just numbers"' },
        { theme: 'Reliability & Execution', description: 'Consistent pattern of delivering results under pressure and meeting commitments', quote: '"You can count on them to get it done, no matter what"' },
        { theme: 'Cross-team Influence', description: 'Recognized for working effectively across departments and building bridges', quote: '"Makes everyone around them better"' }
      ],
      insights: profile?.inputMethod === 'paste'
        ? 'Recommendations were not detected in the pasted text. Use the LinkedIn ZIP export for full recommendation analysis — the ZIP includes a structured recommendations CSV.'
        : `${profile?.recommendations?.length || 0} recommendations found. Themes cluster around strategic thinking and reliable execution.`,
      coaching: [
        'Request at least 3–5 recommendations — one from each: a direct manager, a peer, a cross-functional stakeholder, and a report (if applicable)',
        'Brief each recommender with 2–3 specific projects and outcomes you want them to highlight — vague requests get vague recommendations',
        'Prioritize recommenders who can speak to business impact, not just personality traits'
      ],
      feedback: `Recommendation themes are strong where visible. Quantity matters — fewer than 3 recommendations is a yellow flag for recruiters at senior levels.`
    },
    aiJobs: mockAiJobs(currentTitle, level, years, currentCo),
    upskilling: {
      courses: [
        { name: 'AI for Everyone', provider: 'Coursera (DeepLearning.AI)', duration: '6 hours', level: 'Beginner', why: 'Builds the AI literacy needed to participate in AI strategy conversations and interview for AI-adjacent roles' },
        { name: 'SQL for Data Analysis', provider: 'Mode Analytics (free)', duration: '10 hours', level: 'Beginner', why: 'Closes the most frequently cited technical gap for analytics professionals moving into senior roles' },
        { name: 'Data Strategy for Business Leaders', provider: 'LinkedIn Learning', duration: '4 hours', level: 'Intermediate', why: 'Formalizes the strategic data thinking you already practice — gives you the vocabulary for VP-level conversations' },
        { name: 'Prompt Engineering for Business', provider: 'Vanderbilt / Coursera', duration: '5 hours', level: 'Beginner', why: 'Directly applicable to AI Strategy roles — shows hands-on AI tooling capability without requiring engineering background' }
      ],
      insights: `The upskilling priority is AI literacy first, then technical depth second. The goal is not to become an engineer — it's to eliminate the "not technical enough" objection in interviews for $180K+ roles.`,
      coaching: [
        'Block 2 hours per week for learning — treat it as a meeting on your calendar, not optional time',
        'Post a LinkedIn update after completing each course — even a one-sentence takeaway signals continuous learning to recruiters who are watching your activity'
      ]
    },
    recruiterTips: {
      tips: [
        { category: 'Headline', tip: 'Rewrite headline to name your target role', detail: `Change from job title to value statement: e.g., "Turning Data Into Business Decisions | Analytics Leader | ${currentCo}" — LinkedIn's algorithm weights the headline heavily in search.`, priority: 'high' },
        { category: 'Summary', tip: 'Add a 3-paragraph summary with a clear narrative', detail: 'Paragraph 1: who you are and what you do. Paragraph 2: 2–3 quantified accomplishments. Paragraph 3: what you\'re looking for next. Recruiters read summaries before they read experience.', priority: 'high' },
        { category: 'Experience', tip: 'Add 3–5 bullet points per role with metrics', detail: 'Each bullet should follow: Action verb → what you did → measurable result. Example: "Redesigned reporting pipeline, reducing exec dashboard generation time from 4 hours to 15 minutes."', priority: 'high' },
        { category: 'Keywords', tip: 'Mirror the exact language in your target job postings', detail: 'Copy 5 target job descriptions into a doc, find the most frequent non-generic phrases, and work them into your profile. ATS systems scan for exact keyword matches.', priority: 'medium' },
        { category: 'Activity', tip: 'Post or comment 2× per week', detail: "LinkedIn's algorithm surfaces active profiles 5× more in recruiter searches. Short posts about industry observations or lessons learned are sufficient — no need for long articles.", priority: 'medium' },
        { category: 'Network', tip: 'Connect with 5 recruiters at target companies', detail: 'Search "[Company] Talent Acquisition" and send a personalized connection note. Being a 1st connection makes you appear in their searches. This single action can generate inbound recruiter outreach.', priority: 'low' }
      ],
      insights: `The profile has the experience to attract senior roles but the presentation likely undersells the impact. Fixing the headline and adding metrics to experience bullets will have the highest ROI — these are the two things recruiters look at in the first 10 seconds.`
    }
  };
}

// ── MOCK ARTICLE ANALYSIS ────────────────────────────────────────────────────
function getMockArticleAnalysis(articleData, profile) {
  const name = profile?.name || 'the author';
  const currentTitle = profile?.positions?.[0]?.title || 'Director';
  const years = profile?.stats?.totalYearsExperience || 10;

  const withRates = articleData.map(a => ({
    ...a,
    engagement: (a.likes || 0) + (a.comments || 0) + (a.shares || 0),
    rate: a.views > 0 ? (((a.likes || 0) + (a.comments || 0) + (a.shares || 0)) / a.views * 100).toFixed(1) : '0.0'
  }));
  const avgRate = withRates.length ? (withRates.reduce((s, a) => s + parseFloat(a.rate), 0) / withRates.length).toFixed(1) : '0.0';
  const topViews = [...withRates].sort((a, b) => b.views - a.views)[0];
  const topEngage = [...withRates].sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate))[0];
  const dropOffs = withRates.filter(a => a.views > 300 && parseFloat(a.rate) < 2);

  return {
    performance: {
      keyInsight: `Across ${articleData.length} article${articleData.length !== 1 ? 's' : ''}, average engagement rate is ${avgRate}% — the LinkedIn benchmark for thought leadership content is 3–5%. ${topViews ? `"${topViews.title}" led on views (${(topViews.views || 0).toLocaleString()})` : 'Top article by views'} while ${topEngage && topEngage.title !== topViews?.title ? `"${topEngage.title}" led on engagement at ${topEngage.rate}%` : 'the same article also led on engagement'} — a sign that resonance and reach are aligned.${dropOffs.length > 0 ? ` Warning: ${dropOffs.length} article${dropOffs.length > 1 ? 's have' : ' has'} strong view counts but sub-2% engagement — the headline worked but the content didn't deliver on the promise.` : ''}`,
      bestThemes: ['AI Implementation', 'Data Leadership', 'Analytics ROI', 'Team Building'],
      dropOff: dropOffs.map(a => a.title)
    },
    gaps: [
      {
        topic: 'The Real Cost of Bad Data Decisions — with Actual Numbers',
        whyAudience: 'CFOs and VPs respond to dollar figures. "Bad data costs enterprises $12.9M per year" opens budget conversations that generic data quality content never will.',
        whyQualified: `A ${currentTitle} who has built ROI frameworks and led analytics transformations at scale has the real numbers — this isn't theory, it's lived experience.`,
        potential: 'High',
        potentialReason: 'Financial framing in analytics content drives 2–3x shares vs. strategy content — finance and ops leaders share aggressively'
      },
      {
        topic: 'Why 70% of AI Projects Fail Before They Hit Production',
        whyAudience: 'Every analytics leader is under pressure to show AI ROI — the failure rate is the anxiety they don\'t say out loud in all-hands.',
        whyQualified: `${name} has direct experience running AI/ML implementations at scale, including the ones that didn't make it — that failure experience is the credential.`,
        potential: 'High',
        potentialReason: 'Contrarian, fear-adjacent headlines in AI content drive 4x shares vs. positive prediction pieces — this is the format that goes viral'
      },
      {
        topic: 'How to Build a BI Team That Doesn\'t Need Constant Direction',
        whyAudience: 'Every Director wants to move up — the only way is to build a team that runs without them. This is the trap no one explains clearly.',
        whyQualified: `${years}+ years leading analytics teams across growth and scaling phases gives ${name} a longitudinal view on team design that junior leaders can\'t replicate.`,
        potential: 'Medium',
        potentialReason: 'Leadership/team content requires consistent posting to gain momentum — strong long-term compound value'
      }
    ],
    nextArticles: [
      {
        rank: 1,
        title: `I Ran ${Math.floor(Math.random() * 30) + 20} AI Models. Only 3 Made It to Production. Here's Why.`,
        hook: "The dirty secret about AI in analytics teams is that most of it never ships — and the reason has nothing to do with the data or the model.",
        whyNow: "In 2026, AI pilot fatigue is the defining anxiety for analytics leaders. Every exec is asking for AI ROI on investments that are stalling in staging. This headline lands directly in that wound.",
        uniqueAngle: "Most AI content talks about what to build. This talks about why it fails after you build it — the organizational, political, and prioritization reasons that no vendor will tell you.",
        proofPoint: `${name}'s direct experience leading AI/ML deployment cycles — including the models that didn't make production — is the source material. This can only be written with authority by someone who has been in those rooms.`,
        timeToWrite: '3 hours'
      },
      {
        rank: 2,
        title: 'Your BI Environment Has 200 Reports. Your CEO Uses 3. Here\'s How to Fix It.',
        hook: "I audited our BI environment and discovered that 91% of our reports had zero views in 90 days.",
        whyNow: "Every company is drowning in dashboards and starving for decisions in 2026. The rationalization conversation is happening inside every analytics org — this gives leaders the language and framework to lead it.",
        uniqueAngle: "Led with a real audit number, not a stat from a vendor whitepaper. The framing flips the typical BI conversation — from 'build more' to 'eliminate what isn't driving decisions.'",
        proofPoint: `Direct experience migrating BI environments, rationalizing report libraries, and driving executive adoption — this is operational experience, not strategic advice.`,
        timeToWrite: '2 hours'
      },
      {
        rank: 3,
        title: 'The Analytics Leaders Surviving AI Are Not the Most Technical Ones',
        hook: "I've hired hundreds of analytics professionals. The ones thriving in the AI era share one trait — and it isn't Python.",
        whyNow: "AI anxiety among analytics professionals is at peak intensity in 2026. Senior leaders want to know which skills to build and which to deprioritize — this answers it with a contrarian take.",
        uniqueAngle: "Directly challenges the 'learn to code or get left behind' narrative. Argues that business translation, stakeholder trust, and decision framing are the durable skills — and backs it with hiring experience.",
        proofPoint: `${years} years of building and leading analytics teams across market cycles gives ${name} the longitudinal view to make this argument with receipts — not hypothesis.`,
        timeToWrite: '4 hours'
      }
    ],
    overallInsight: `The content foundation is working — reach is solid. The gap is content that provokes a reaction, not just a read. Average engagement below 3% means the audience is consuming but not sharing, which limits algorithmic reach. The three article ideas above are structured to stop the scroll and trigger shares specifically in the Director/VP analytics audience. Write #1 first — it has the highest share potential and positions you as someone with real AI implementation experience, not a commentator.`
  };
}

// ── ARTICLES PROMPT BUILDER ──────────────────────────────────────────────────
function buildArticlesPrompt(articleData, profile) {
  return `You are a LinkedIn content strategist specializing in B2B thought leadership for senior analytics and AI leaders.

You are analyzing the LinkedIn article performance for ${profile?.positions?.[0]?.title || 'a senior leader'} with ${profile?.stats?.totalYearsExperience || 10} years of experience.

Article performance data:
${JSON.stringify(articleData, null, 2)}

Career profile context:
${JSON.stringify(profile, null, 2)}

Analyze using these 3 layers, then return ONLY valid JSON — no markdown, no explanation.

LAYER 1 — PERFORMANCE: Which articles got most views vs engagement. Calculate engagement rate per article (likes+comments+shares/views). Which topics drove most shares. Drop-off patterns (high views, low engagement = headline worked but content didn't). Best performing themes.

LAYER 2 — CONTENT GAPS: What topics have they NOT written about that their audience would highly value. For each gap tie it back to their specific career experience and cross-reference against current 2026 AI/analytics trends.

LAYER 3 — NEXT 3 ARTICLE IDEAS: Ranked by impact. At least one contrarian (challenges a common belief). At least one data-driven (leads with a specific number). Titles must be specific — never generic.

Return ONLY this JSON:
{
  "performance": {
    "keyInsight": "3-4 sentences covering engagement rates, top articles, drop-off patterns, and best themes — cite specific numbers",
    "bestThemes": ["theme1", "theme2", "theme3"],
    "dropOff": ["titles of articles with high views but <2% engagement"]
  },
  "gaps": [
    {
      "topic": "specific topic title",
      "whyAudience": "one sentence on why this audience wants it",
      "whyQualified": "one sentence tying to their specific career experience",
      "potential": "High or Medium or Low",
      "potentialReason": "one sentence on why that potential level"
    }
  ],
  "nextArticles": [
    {
      "rank": 1,
      "title": "specific compelling headline — not generic",
      "hook": "first sentence that stops the scroll",
      "whyNow": "why this topic matters specifically in 2026",
      "uniqueAngle": "what makes their version different from every other analytics article",
      "proofPoint": "specific achievement from their career that makes them credible to write this",
      "timeToWrite": "X hours"
    },
    {"rank": 2, "title": "...", "hook": "...", "whyNow": "...", "uniqueAngle": "...", "proofPoint": "...", "timeToWrite": "..."},
    {"rank": 3, "title": "...", "hook": "...", "whyNow": "...", "uniqueAngle": "...", "proofPoint": "...", "timeToWrite": "..."}
  ],
  "overallInsight": "2-3 sentences: bottom line on content strategy, what to do first and why"
}`;
}

// ── SERVER ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const validRoutes = ['/api/chat', '/api/dashboard', '/api/articles'];
  if (req.method !== 'POST' || !validRoutes.includes(req.url)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const parsed = JSON.parse(body);

      // ── /api/dashboard ──────────────────────────────────────────────────────
      if (req.url === '/api/dashboard') {
        const { profileContext, userApiKey } = parsed;
        if (!profileContext) return send(400, { error: 'Missing profileContext' });

        if (MOCK) {
          await new Promise(r => setTimeout(r, 1200));
          return send(200, { dashboard: getMockDashboard(profileContext) });
        }

        const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return send(500, { error: 'No API key configured' });

        const dashPrompt = `You are a brutally honest senior executive coach with 20 years experience advising Directors, VPs and C-suite leaders at Fortune 500 tech companies.

Analyze this LinkedIn profile and return a complete career dashboard as valid JSON only — no markdown fences, no explanation, just the raw JSON object.

Profile:
${JSON.stringify(profileContext, null, 2)}

For the career section, use this 3-layer framework:
LAYER 1 — THE FACTS (insights field): State only what the data shows. Total years, roles, companies, seniority progression, avg tenure vs peers, avg time to promote, time in current role.
LAYER 2 — THE GAPS (coaching array): Compare against what a strong candidate for the NEXT level up looks like. For each gap use this exact format: "GAP: [name] | WHY IT MATTERS: [one sentence] | SEVERITY: Critical/Moderate/Minor | HOW TO CLOSE IT: [one specific action]". Say "you need to" not "consider". Do not soften.
LAYER 3 — THE PRIORITY ACTION (feedback field): The single most impactful thing they can do in 90 days. Name the exact action, the exact outcome, and why it beats every other option. Be specific to their actual profile.

Return ONLY this JSON structure:
{
  "career": {
    "kpis": [
      {"label": "Total Experience", "value": "Xyr", "sub": "years in industry", "trend": "up"},
      {"label": "Roles Held", "value": "X", "sub": "across X companies", "trend": "neutral"},
      {"label": "Avg Tenure", "value": "Xyr Xmo", "sub": "Xyr above/below 2.1yr tech industry avg — compare against Director/VP peers specifically", "trend": "up or down or neutral"},
      {"label": "Avg Time to Promote", "value": "Xyr Xmo", "sub": "faster/slower than 21mo tech median for their peer group (Director/VP/IC level)", "trend": "up or neutral"},
      {"label": "Time in Current Role", "value": "Xyr Xmo", "sub": "current company name", "trend": "neutral"}
    ],
    "insights": "LAYER 1 — facts only, 3-4 sentences with specific numbers from the profile",
    "coaching": ["LAYER 2 gap 1 in the GAP format above", "gap 2", "gap 3"],
    "feedback": "LAYER 3 — the single priority action, specific to this profile, 3-4 sentences"
  },
  "skills": {
    "strengths": ["skill1", "skill2", "skill3", "skill4", "skill5"],
    "gaps": ["gap1", "gap2", "gap3", "gap4"],
    "chartData": [{"name": "Category", "value": 35}, {"name": "Category2", "value": 25}, {"name": "Category3", "value": 20}, {"name": "Category4", "value": 20}],
    "insights": "2-3 sentences about the skill profile inferred from titles and descriptions.",
    "coaching": ["specific skill action 1", "action 2", "action 3"],
    "feedback": "Direct, blunt assessment — what is strong and what is the single most critical skill gap."
  },
  "recommendations": {
    "themes": [{"theme": "Theme Name", "description": "what this theme reveals about the person", "quote": "example phrase or empty string"}],
    "insights": "Analysis of recommendation patterns, or note that paste input lacks recommendations and ZIP export is needed.",
    "coaching": ["how to get better recommendations", "what to ask recommenders to highlight", "how many to target"],
    "feedback": "Direct take on the recommendation profile."
  },
  "aiJobs": {
    "seniority": "Entry/Mid/Senior/Staff/Executive",
    "roles": [
      {"title": "AI Role Title", "fit_score": 85, "why": "1-2 sentences tied to actual background", "skills_match": ["s1", "s2", "s3"], "skills_gap": ["g1", "g2"]},
      {"title": "AI Role Title 2", "fit_score": 78, "why": "...", "skills_match": ["s1", "s2"], "skills_gap": ["g1", "g2"]},
      {"title": "AI Role Title 3", "fit_score": 70, "why": "...", "skills_match": ["s1", "s2"], "skills_gap": ["g1", "g2"]}
    ],
    "insights": "Overview of AI-era positioning based on actual background.",
    "coaching": ["specific AI transition step 1", "step 2", "step 3"],
    "feedback": "Direct take on AI readiness and biggest opportunity."
  },
  "recruiterTips": {
    "tips": [
      {"category": "Headline", "tip": "specific tip for their situation", "detail": "why this matters and exactly how to do it", "priority": "high"},
      {"category": "Summary", "tip": "...", "detail": "...", "priority": "high"},
      {"category": "Experience", "tip": "...", "detail": "...", "priority": "high"},
      {"category": "Keywords", "tip": "...", "detail": "...", "priority": "medium"},
      {"category": "Activity", "tip": "...", "detail": "...", "priority": "medium"},
      {"category": "Network", "tip": "...", "detail": "...", "priority": "low"}
    ],
    "insights": "Overall assessment of profile discoverability and recruiter appeal."
  }
}`;

        const claudeDash = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4096, messages: [{ role: 'user', content: dashPrompt }] })
        });

        if (!claudeDash.ok) {
          const errText = await claudeDash.text();
          if (claudeDash.status === 401) return send(401, { error: 'INVALID_API_KEY' });
          return send(500, { error: 'Claude API error', details: errText });
        }

        const dashData = await claudeDash.json();
        const dashText = dashData.content[0]?.text || '';
        const jsonMatch = dashText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return send(500, { error: 'No JSON in response' });
        const dashboard = JSON.parse(jsonMatch[0]);
        return send(200, { dashboard });
      }

      // ── /api/articles ────────────────────────────────────────────────────────
      if (req.url === '/api/articles') {
        const { articleData, profileContext, userApiKey } = parsed;
        if (!articleData || !profileContext) return send(400, { error: 'Missing articleData or profileContext' });

        if (MOCK) {
          await new Promise(r => setTimeout(r, 1000));
          return send(200, { analysis: getMockArticleAnalysis(articleData, profileContext) });
        }

        const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return send(500, { error: 'No API key configured' });

        const articlesPrompt = buildArticlesPrompt(articleData, profileContext);
        const claudeArt = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4096, messages: [{ role: 'user', content: articlesPrompt }] })
        });

        if (!claudeArt.ok) {
          const errText = await claudeArt.text();
          if (claudeArt.status === 401) return send(401, { error: 'INVALID_API_KEY' });
          return send(500, { error: 'Claude API error', details: errText });
        }

        const artData = await claudeArt.json();
        const artText = artData.content[0]?.text || '';
        const artMatch = artText.match(/\{[\s\S]*\}/);
        if (!artMatch) return send(500, { error: 'No JSON in response' });
        return send(200, { analysis: JSON.parse(artMatch[0]) });
      }

      // ── /api/chat ──────────────────────────────────────────────────────────
      const { messages, profileContext, userApiKey } = parsed;
      if (!messages || !profileContext) return send(400, { error: 'Missing messages or profileContext' });

      // ── MOCK MODE ──
      if (MOCK) {
        const lastUser = messages.filter(m => m.role === 'user').pop();
        const blocks = getMockBlocks(lastUser?.content || '', profileContext);
        await new Promise(r => setTimeout(r, 800));
        return send(200, { blocks, stopReason: 'end_turn' });
      }

      // ── REAL CLAUDE ──
      const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return send(500, { error: 'No API key configured' });

      const systemPrompt = SYSTEM_PROMPT_PREFIX + JSON.stringify(profileContext, null, 2) + `

RULES FOR EVERY RESPONSE:
1. LEAD WITH THE ANSWER — State it in sentence 1. Never build up to your point.
2. BE SPECIFIC TO THIS PERSON — Every recommendation must reference a real role, real date, or real achievement from their actual profile.
3. PRIORITIZE RUTHLESSLY — If they ask what to fix, give ONE thing first. The single highest-leverage fix.
4. NAME THE EXACT ACTION — Say "do this", "change this to", "delete this". Never say "consider" or "think about".
5. CITE THE BENCHMARK — When something is weak, say what strong looks like. Give the standard to aim for.
6. SHORT ANSWERS ONLY — Maximum 150 words unless they ask for a full rewrite. Brevity signals confidence.
7. END WITH ONE NEXT STEP — One specific action they can take today.`;

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, system: systemPrompt, messages })
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        if (claudeRes.status === 401) return send(401, { error: 'INVALID_API_KEY' });
        if (errText.includes('credit balance') || errText.includes('too low') || errText.includes('quota')) {
          return send(402, { error: 'NO_CREDITS' });
        }
        return send(500, { error: 'Claude API error', details: errText });
      }

      const data = await claudeRes.json();
      const text = data.content.find(b => b.type === 'text')?.text || '';
      return send(200, { blocks: [{ type: 'text', content: text }] });
    } catch (err) {
      return send(500, { error: err.message });
    }
  });
});

server.listen(PORT, () => {
  console.log(`[API] Local dev server running on http://localhost:${PORT} ${MOCK ? '(MOCK MODE)' : ''}`);
});
