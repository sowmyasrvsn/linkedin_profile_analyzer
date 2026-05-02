# LinkedIn Profile Analyzer

A career intelligence bot that analyzes your LinkedIn data export and answers questions about your career — with charts, AI job recommendations, and direct feedback.

**Live Demo:** [your-app.vercel.app](https://your-app.vercel.app)

---

## What It Does

Upload your LinkedIn data export ZIP and ask questions like:
- *"Give me a full career intelligence dashboard"*
- *"What AI world jobs am I best suited for?"*
- *"Show my career timeline and progression"*
- *"What are my skill gaps?"*
- *"Analyze my tenure patterns"*

### Response format — 3 layers every time:
1. **📊 Data** — facts from your profile with exact numbers
2. **💡 Coaching** — actionable recommendations
3. **🎯 Direct Feedback** — blunt, honest observations

### Visualizations
- KPI summary cards
- Career timeline
- Skills bar charts
- Industry pie charts
- AI job match cards with fit scores, skills match & gaps

---

## Tech Stack

- **Frontend:** React 18, Recharts, JSZip, PapaParse
- **Backend:** Vercel Serverless Function (Node.js)
- **AI:** Claude claude-sonnet-4 via Anthropic API with tool calling
- **Hosting:** Vercel (free tier)

---

## Local Setup

### 1. Clone and install
```bash
git clone https://github.com/yourusername/linkedin-analyzer
cd linkedin-analyzer
npm install
```

### 2. Add your API key
Create a `.env.local` file:
```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```
Get a key at [console.anthropic.com](https://console.anthropic.com)

### 3. Run locally
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/linkedin-analyzer.git
git push -u origin main
```
> ⚠️ Make sure `.env.local` is in `.gitignore` — never commit your API key

### 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and sign up
2. Click **Add New Project** → import your GitHub repo
3. Go to **Settings → Environment Variables**
4. Add: `ANTHROPIC_API_KEY` = your key
5. Click **Deploy**

Your app is live at `your-project.vercel.app`

### 3. Set spend limits (important)
- **Anthropic:** [console.anthropic.com](https://console.anthropic.com) → Billing → set monthly limit
- **Vercel:** Settings → Spending Limits → set a cap

---

## Getting Your LinkedIn Export

1. Go to LinkedIn → click your profile photo → **Settings & Privacy**
2. **Data Privacy** → **Get a copy of your data**
3. Select **"Want something in particular?"** → choose the basic export
4. Click **Request archive** — you'll get an email in minutes
5. Download the ZIP and upload it to the app

The app reads: `Profile.csv`, `Positions.csv`, `Education.csv`, `Skills.csv`, `Languages.csv`, `Recommendations_Received.csv`, `Connections.csv`

---

## Privacy

- All ZIP parsing happens in your browser — the raw file never leaves your device
- Only structured summaries (job titles, companies, dates, skills) are sent to Claude
- No data is stored — session cleared on tab close
- Visitors can use 5 free messages, then provide their own Anthropic API key

---

## Project Structure

```
linkedin-analyzer/
├── api/
│   └── chat.js              # Vercel serverless — Claude API + rate limiting
├── src/
│   ├── App.jsx              # Main app, upload flow, chat UI, BYOK modal
│   ├── App.css              # Dark theme styling
│   ├── components/
│   │   └── Visualizations.jsx  # Charts, KPI cards, AI jobs, timeline
│   └── utils/
│       └── linkedinParser.js   # ZIP unzip + CSV parsing + stats computation
├── public/
│   └── index.html
├── vercel.json
└── package.json
```
