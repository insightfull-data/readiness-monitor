# AI Readiness Monitor

A monthly AI insight readiness platform for commercial transaction data, structured on Rumelt's good strategy framework. Tracks NIST AI RMF and ISO 42001 alignment internally. Publishes a plain-language readiness narrative externally.

---

## What it does

**Public dashboard** — shows the current readiness score, a Rumelt-structured narrative (diagnosis, guiding policy, coherent actions), permitted use ruling, score-by-area breakdown, monthly trend, and a governance improvement log.

**Admin area** — four tabs:
- **Strategy** — Rumelt's full three-part strategy document + internal NIST/ISO framework alignment tracking
- **Run assessment** — upload CSV → enter metadata → run five weighted readiness checks → publish to dashboard
- **Governance log** — log concrete governance actions; each entry advances framework alignment and appears on the public log
- **Reports** — manage published reports + immutable audit log

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL (Railway) |
| ORM | Prisma |
| Auth | Custom session (bcrypt + HTTP-only cookie) |
| Styling | Tailwind CSS — warm terracotta / sand palette |
| AI | Anthropic Claude (one call per publish, manually triggered) |
| Deployment | Railway |

---

## Setup — local development

### 1. Clone and install

```bash
git clone <your-repo>
cd readiness-monitor
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required variables:

```
DATABASE_URL=postgresql://...        # Local Postgres or Railway dev DB
NEXTAUTH_SECRET=<random 32 chars>    # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-ant-...         # Optional — only for AI summary generation
```

### 3. Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed with demo data (admin user + example April 2025 report)
npm run db:seed
```

Demo credentials after seed:
- Email: `admin@readiness.local`
- Password: `demo1234`

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to public dashboard.

Admin: [http://localhost:3000/admin](http://localhost:3000/admin) → sign in → redirects to Strategy tab.

---

## Deployment — Railway

### Step 1: Create Railway project

1. Go to [railway.app](https://railway.app) and create a new project
2. Add a **PostgreSQL** service — Railway provisions it automatically
3. Add a **Web** service — connect to your GitHub repo

### Step 2: Set environment variables in Railway

In the Web service settings → Variables:

```
DATABASE_URL          → (copy from Railway PostgreSQL service — use the internal URL)
NEXTAUTH_SECRET       → (generate: openssl rand -base64 32)
NEXTAUTH_URL          → https://your-app.railway.app
ANTHROPIC_API_KEY     → sk-ant-... (optional)
NEXT_PUBLIC_APP_NAME  → AI Readiness Monitor
```

### Step 3: Deploy

Railway auto-deploys on push to main. The `railway.toml` config runs:
```
npx prisma migrate deploy && npm start
```

### Step 4: Seed production database

After first deploy, run seed via Railway CLI:
```bash
railway run npm run db:seed
```

Or use **Prisma Studio** (Railway → PostgreSQL → Connect → Prisma Studio) to manually insert the first admin user.

---

## Password management

Passwords are hashed with bcrypt (12 rounds). To change the admin password:

```bash
# Open Prisma Studio
npm run db:studio

# Or update via a one-off script:
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('YourNewPassword123!', 12).then(h => console.log(h));
"
# Then update the passwordHash field in the users table
```

**Recommended password format:** 16+ characters, mixed case, numbers, symbol. Use a password manager (1Password, Bitwarden).

---

## Readiness checks

| Check | Weight | What it measures |
|---|---|---|
| Freshness | 20% | Days since data extraction vs 7-day threshold |
| Completeness | 25% | Null rate on customer_id and transaction_value |
| Business Rules | 20% | Return/cancellation code consistency across categories |
| Lineage | 20% | Source-to-output documentation status (full/partial/none) |
| Responsible Use | 15% | Human reviewer assigned + permitted use defined |

**Score bands:**
- 85–100: Ready
- 70–84: Usable with controls
- 50–69: Limited use
- Below 50: Not ready

---

## CSV format

Upload any CSV with these column names (case-insensitive, partial match):

| Column | Used for |
|---|---|
| `customer_id` | Completeness check — null rate |
| `transaction_value` or `amount` or `total` | Completeness check — null rate |
| `return_status` or `cancel` or `status` | Business rules check — code variance |
| `product_category` or `category` | Business rules check — category count |

Other columns are ignored. See `public/sample_transactions.csv` for a working example.

---

## Framework alignment

**NIST AI RMF and ISO 42001 are tracked internally only** — they do not appear on the public dashboard. Rumelt's view: compliance targets are constraints, not strategy. The public dashboard communicates the governance state in plain terms; the admin Strategy tab holds the internal accountability view.

Framework progress advances when governance actions are logged in the Governance log tab. Each action is attributed to a specific framework area (NIST Govern/Map/Measure/Manage or ISO Clause 4–10).

---

## Architecture

```
src/
  app/
    dashboard/        # Public dashboard (server component, no auth)
    admin/
      layout.tsx      # Auth gate — redirects to /login if no session
      strategy/       # Rumelt strategy + framework alignment (server)
      assess/         # CSV upload + scoring flow (client)
      govlog/         # Governance action log (client)
      reports/        # Report management + audit log (server)
    api/
      auth/           # Login + logout
      score-runs/     # Create run, AI summary, publish
      gov-actions/    # Log and retrieve governance actions
      reports/        # Toggle publish/unpublish
      health/         # Railway health check
    login/            # Standalone login page
  lib/
    prisma.ts         # Prisma client singleton
    auth.ts           # Session management + audit logging
    scoring.ts        # Five readiness checks + CSV parser
    rumelt.ts         # Diagnosis / guiding policy / coherent actions generator
  types/
    index.ts          # Shared types + band info + score utilities
  components/
    admin/            # AdminNav, ReportActions
prisma/
  schema.prisma       # Full database schema
  seed.ts             # Demo data seeder
```

---

## Cost estimate (Railway)

| Service | Cost |
|---|---|
| Web service (Hobby) | ~$5/month |
| PostgreSQL (Hobby) | ~$5/month |
| Anthropic API | ~$0.01–0.05 per publish (one Claude Sonnet call) |
| **Total** | **~$10/month + minimal AI cost** |

---

## Licence

MIT. Built for internal operational use — not intended as a compliance certification tool.
