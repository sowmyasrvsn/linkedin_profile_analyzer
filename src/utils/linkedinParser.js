import JSZip from 'jszip';
import Papa from 'papaparse';

// ─────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────

function calcTenure(startStr, endStr) {
  if (!startStr) return null;
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  if (isNaN(start)) return null;
  const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30));
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}mo`;
  if (rem === 0) return `${years}yr`;
  return `${years}yr ${rem}mo`;
}

function detectGaps(positions) {
  if (!positions || positions.length < 2) return [];
  const sorted = [...positions].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const gaps = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentStart = new Date(sorted[i].startDate);
    const prevEnd = sorted[i + 1].endDate ? new Date(sorted[i + 1].endDate) : null;
    if (prevEnd) {
      const gapMonths = Math.round((currentStart - prevEnd) / (1000 * 60 * 60 * 24 * 30));
      if (gapMonths >= 3) {
        gaps.push({
          afterRole: sorted[i + 1].title,
          beforeRole: sorted[i].title,
          months: gapMonths,
          year: prevEnd.getFullYear().toString()
        });
      }
    }
  }
  return gaps;
}

function computeStats(positions, skills) {
  const totalYears = positions.reduce((s, p) => {
    const start = new Date(p.startDate);
    const end = p.endDate ? new Date(p.endDate) : new Date();
    if (isNaN(start)) return s;
    return s + (end - start) / (1000 * 60 * 60 * 24 * 365);
  }, 0);

  const uniqueCompanies = [...new Set(positions.map(p => p.company).filter(Boolean))];
  const avgTenureMonths = positions.length > 0
    ? Math.round(positions.reduce((s, p) => {
        const start = new Date(p.startDate);
        const end = p.endDate ? new Date(p.endDate) : new Date();
        if (isNaN(start)) return s;
        return s + (end - start) / (1000 * 60 * 60 * 24 * 30);
      }, 0) / positions.length)
    : 0;

  return {
    totalYearsExperience: Math.round(totalYears * 10) / 10,
    totalRoles: positions.length,
    uniqueCompanies: uniqueCompanies.length,
    avgTenureMonths,
    avgTenureLabel: calcTenure(
      new Date(Date.now() - avgTenureMonths * 30 * 24 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString()
    ),
    careerGaps: detectGaps(positions),
    currentRole: positions[0] || null,
    skillCount: skills.length
  };
}

// ─────────────────────────────────────────
// PASTE PARSER — date-centric approach
//
// LinkedIn paste formats vary widely. Instead of guessing company headers
// upfront, we find every date-range line and reconstruct title + company
// from the surrounding context for each one.
// ─────────────────────────────────────────

const MONTHS_STR = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
const DATE_PAT = `(?:${MONTHS_STR})\\s+\\d{4}`;
const DATE_RANGE_RE = new RegExp(
  `(${DATE_PAT})\\s*[-–]\\s*(Present|${DATE_PAT})(?:\\s*[··]\\s*([\\d\\w\\s]+))?`,
  'i'
);

const TENURE_RE = /^\d+\s+(?:yrs?|mos?)(?:\s+\d+\s+mos?)?$/i;

const EMPLOYMENT_TYPES = new Set([
  'full-time','part-time','contract','freelance','hybrid','remote',
  'on-site','on site','self-employed','internship','seasonal','volunteer'
]);

const DESC_STARTERS_RE = /^(Developed|Led|Directed|Built|Managed|Created|Designed|Spearheaded|Implemented|Partnered|Optimized|Assessed|Delivered|Defined?|Enabled?|Re-engineer|Maintain|Interfac|Provided?|Identified?|Forecasted?|Prepared?|Assisted?|Analyzed?|Performed?|Responsible|Conceptualized|Evaluated|Resolved|Presented|Increased|Collaborated|Leveraged|Improved|Tracked?|Produced?|Proposed?|Submitted|Subject|Internally|Acts?|Writes?|Uses?|Works?|Coordinates?|Supports?|Ensures?|Reviews?|Documents?|Monitors?|Generates?|Established|Launched|Drove|Transformed|Oversaw|Facilitated|Communicated|Reported|Executed)/i;

// Matches "City, State" or "City, Country" patterns but not job titles
const LOCATION_RE = /^[A-Za-z][a-zA-Z\s.'-]+,\s+[A-Z][a-zA-Z\s.'-]*$/;
const TITLE_WORDS_RE = /\b(Manager|Analyst|Engineer|Director|Developer|Designer|Lead|Senior|Staff|Principal|Associate|Consultant|Architect|Specialist|Officer|President|VP|Head|Intern|Assistant|Technologist|Scientist|Administrator|Coordinator|Strategist|Executive|Partner|Founder|Owner|CTO|CEO|CFO|COO|CIO|CISO|SVP|EVP|AVP|MD|PhD)\b/i;

function isDateLine(line) {
  return DATE_RANGE_RE.test(line);
}

function matchDateLine(line) {
  return DATE_RANGE_RE.exec(line);
}

function isLocation(line) {
  if (!LOCATION_RE.test(line)) return false;
  if (line.length > 60) return false;
  if (TITLE_WORDS_RE.test(line)) return false;
  return true;
}

function isNoiseLine(line) {
  const lower = line.toLowerCase();
  if (EMPLOYMENT_TYPES.has(lower)) return true;
  if (TENURE_RE.test(line)) return true;
  if (isLocation(line)) return true;
  if (DESC_STARTERS_RE.test(line)) return true;
  if (/^[•\-\*·]/.test(line)) return true;
  if (/^Skills:|^AI Value:|^Accomplishment:|^Show more|^Show less/i.test(line)) return true;
  if (/^\d+\s+connections?/i.test(line)) return true;
  if (line.length < 2) return true;
  return false;
}

export function parseLinkedInPaste(rawText) {
  // Normalize line endings and split
  const raw = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // --- Pass 1: identify group-level company headers ---
  // LinkedIn shows a company name followed immediately by a total-tenure line
  // for multi-role positions. Track these so we can assign them to child roles.
  // e.g.: "Acme Corp\n4 yrs 2 mos\n  Role A\n  Acme Corp\n  Jan 2022..."
  const groupCompany = new Map(); // lineIdx -> companyName
  for (let i = 0; i < lines.length - 1; i++) {
    if (!isNoiseLine(lines[i]) && TENURE_RE.test(lines[i + 1])) {
      groupCompany.set(i, lines[i]);
    }
  }

  // --- Pass 2: find all date lines and build positions ---
  const positions = [];
  // Track the last group company seen as we scan forward
  let lastGroupCompany = null;

  for (let i = 0; i < lines.length; i++) {
    // Update group company context
    if (groupCompany.has(i)) {
      lastGroupCompany = groupCompany.get(i);
    }

    if (!isDateLine(lines[i])) continue;

    const m = matchDateLine(lines[i]);
    if (!m) continue;

    const start = m[1];
    const rawEnd = m[2] || 'Present';
    const duration = (m[3] || '').trim();

    // --- Look back from the date line to find title and company ---
    // Collect non-noise, non-date lines in reverse order (closest first)
    const prevCandidates = [];
    for (let j = i - 1; j >= Math.max(i - 10, 0); j--) {
      if (isDateLine(lines[j])) break;
      if (isNoiseLine(lines[j])) continue;
      prevCandidates.push(lines[j]);
    }

    // Helper: does this string appear anywhere else in the full lines array?
    const appearsElsewhere = (str) => lines.some((l, idx) => idx !== i && l === str);

    // Key insight: LinkedIn often repeats the company name immediately before the
    // date line (e.g. Role Title → Company Name → Date). So prevCandidates[0]
    // may be the COMPANY (a repeat), not the title.
    // Detect this by checking if prevCandidates[0] matches the group company header
    // or appears elsewhere in the document (i.e. it's a repeated company name).
    let title = null;
    let company = lastGroupCompany || null;

    if (prevCandidates.length === 0) {
      // nothing useful found
    } else if (prevCandidates.length === 1) {
      // Only one candidate — if it's the group company it's a company-only line,
      // use lastGroupCompany as company and this as title only if different
      if (prevCandidates[0] === lastGroupCompany) {
        company = lastGroupCompany; // title stays null — skip this date line
      } else {
        title = prevCandidates[0];
        // company stays as lastGroupCompany
      }
    } else {
      const first = prevCandidates[0];  // closest to date
      const second = prevCandidates[1]; // one further back

      const firstIsCompanyRepeat = first === lastGroupCompany || appearsElsewhere(first);

      if (firstIsCompanyRepeat) {
        // first = company name (repeated), second = actual title
        company = first;
        title = second;
      } else {
        // first = title, second = company
        title = first;
        const secondIsRepeat = second === lastGroupCompany || appearsElsewhere(second);
        if (secondIsRepeat || !TITLE_WORDS_RE.test(second)) {
          company = second;
        }
      }
    }

    // --- Look forward for description lines ---
    const descLines = [];
    let j = i + 1;
    while (j < lines.length && descLines.length < 3) {
      if (isDateLine(lines[j])) break;
      if (!isNoiseLine(lines[j]) && lines[j] !== title && lines[j] !== company) {
        descLines.push(lines[j]);
      }
      j++;
    }

    if (title) {
      // Parse start date — LinkedIn paste uses "Mon YYYY"
      const parseMonthYear = (s) => {
        if (!s) return '';
        const parts = s.trim().split(/\s+/);
        if (parts.length === 2) return `${parts[0]} 1, ${parts[1]}`;
        return s;
      };

      positions.push({
        title,
        company: company || '',
        startDate: parseMonthYear(start),
        endDate: rawEnd.toLowerCase() === 'present' ? '' : parseMonthYear(rawEnd),
        isCurrent: rawEnd.toLowerCase() === 'present',
        tenure: duration || calcTenure(parseMonthYear(start), rawEnd.toLowerCase() === 'present' ? null : parseMonthYear(rawEnd)),
        description: descLines.join(' ')
      });
    }
  }

  return positions;
}

export function buildProfileFromPaste(rawText) {
  const positions = parseLinkedInPaste(rawText);
  const stats = computeStats(positions, []);

  return {
    name: '',
    headline: '',
    summary: '',
    location: '',
    industry: '',
    positions,
    education: [],
    skills: [],
    languages: [],
    recommendations: [],
    network: { connectionCount: 0, topIndustries: [] },
    stats,
    inputMethod: 'paste'
  };
}

// ─────────────────────────────────────────
// ZIP PARSER
// ─────────────────────────────────────────

function parseCSV(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return result.data || [];
}

export async function parseLinkedInZip(file) {
  try {
    const zip = await JSZip.loadAsync(file);

    const readFile = async (name) => {
      const key = Object.keys(zip.files).find(
        k => k.toLowerCase().includes(name.toLowerCase()) && !zip.files[k].dir
      );
      if (!key) return null;
      return await zip.files[key].async('string');
    };

    const profile = {};

    const profileText = await readFile('Profile.csv');
    if (profileText) {
      const rows = parseCSV(profileText);
      if (rows[0]) {
        const r = rows[0];
        profile.name = [r['First Name'], r['Last Name']].filter(Boolean).join(' ') || 'Unknown';
        profile.headline = r['Headline'] || '';
        profile.summary = r['Summary'] || '';
        profile.location = r['Geo Location'] || r['Location'] || '';
        profile.industry = r['Industry'] || '';
      }
    }

    const posText = await readFile('Positions.csv');
    const positions = [];
    if (posText) {
      const rows = parseCSV(posText);
      rows.forEach(r => {
        const startDate = r['Started On'] || r['Start Date'] || '';
        const endDate = r['Finished On'] || r['End Date'] || '';
        positions.push({
          title: r['Title'] || r['Position'] || '',
          company: r['Company Name'] || r['Company'] || '',
          location: r['Location'] || '',
          description: r['Description'] || '',
          startDate,
          endDate,
          isCurrent: !endDate || endDate.toLowerCase() === 'present',
          tenure: calcTenure(startDate, endDate || null)
        });
      });
      positions.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    }
    profile.positions = positions;

    const eduText = await readFile('Education.csv');
    const education = [];
    if (eduText) {
      parseCSV(eduText).forEach(r => {
        education.push({
          school: r['School Name'] || r['School'] || '',
          degree: r['Degree Name'] || r['Degree'] || '',
          field: r['Field Of Study'] || r['Field'] || '',
          startDate: r['Start Date'] || '',
          endDate: r['End Date'] || '',
        });
      });
    }
    profile.education = education;

    const skillsText = await readFile('Skills.csv');
    const skills = [];
    if (skillsText) {
      parseCSV(skillsText).forEach(r => {
        const skill = r['Name'] || r['Skill'] || r[Object.keys(r)[0]] || '';
        if (skill.trim()) skills.push(skill.trim());
      });
    }
    profile.skills = skills;

    const langText = await readFile('Languages.csv');
    const languages = [];
    if (langText) {
      parseCSV(langText).forEach(r => {
        const lang = r['Name'] || r['Language'] || '';
        if (lang) languages.push({ language: lang, proficiency: r['Proficiency'] || '' });
      });
    }
    profile.languages = languages;

    const recText = await readFile('Recommendations_Received.csv');
    const recommendations = [];
    if (recText) {
      parseCSV(recText).forEach(r => {
        recommendations.push({
          from: r['First Name'] ? `${r['First Name']} ${r['Last Name']}`.trim() : '',
          relationship: r['Job Title'] || r['Relationship'] || r['Title'] || '',
          company: r['Company'] || '',
          text: r['Text'] || r['Recommendation'] || ''
        });
      });
    }
    profile.recommendations = recommendations;

    const connText = await readFile('Connections.csv');
    let connectionCount = 0;
    const connIndustries = {};
    if (connText) {
      const rows = parseCSV(connText);
      connectionCount = rows.length;
      rows.forEach(r => {
        const pos = (r['Position'] || r['Title'] || '').toLowerCase();
        const bucket =
          pos.includes('engineer') || pos.includes('developer') ? 'Engineering' :
          pos.includes('market') ? 'Marketing' :
          pos.includes('product') ? 'Product' :
          pos.includes('sales') || pos.includes('account') ? 'Sales' :
          pos.includes('data') || pos.includes('analyst') ? 'Data/Analytics' :
          pos.includes('design') ? 'Design' : 'Other';
        connIndustries[bucket] = (connIndustries[bucket] || 0) + 1;
      });
    }
    profile.network = {
      connectionCount,
      topIndustries: Object.entries(connIndustries)
        .sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([name, count]) => ({ name, count }))
    };

    const articlesText = await readFile('Articles.csv');
    const articles = [];
    if (articlesText) {
      parseCSV(articlesText).forEach(r => {
        const title = r['Title'] || r['Article Title'] || r[Object.keys(r)[0]] || '';
        if (title.trim()) {
          articles.push({
            title: title.trim(),
            publishedAt: r['Published At'] || r['Published Date'] || '',
            summary: (r['Summary'] || r['Content'] || '').slice(0, 300)
          });
        }
      });
    }
    profile.articles = articles;

    profile.stats = computeStats(profile.positions, profile.skills);
    profile.inputMethod = 'zip';

    return { success: true, profile };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
