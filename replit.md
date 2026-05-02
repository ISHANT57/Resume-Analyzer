# AI Resume Analyzer

## Overview

Full-stack AI-powered resume analysis platform. Upload a PDF/DOCX resume, get an ATS score, section analysis, issue detection, AI-powered bullet improvements via Gemini, and job description matching. Built as a pnpm monorepo.

## Architecture

- **Frontend**: React + Vite (`artifacts/resume-analyzer`) — served at `/`
- **API Server**: Express 5 (`artifacts/api-server`) — served at `/api`
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **AI**: Gemini via `@workspace/integrations-gemini-ai`
- **API Layer**: OpenAPI spec → Orval codegen → typed React Query hooks

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (`lib/db/src/schema/resume.ts`)
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (OpenAPI → React Query hooks)
- **Build**: esbuild (`artifacts/api-server/build.mjs`)
- **UI**: Tailwind CSS v4, Framer Motion, Recharts, shadcn/ui components
- **Routing**: Wouter

## Key Routes (Frontend)

| Path | Page |
|------|------|
| `/` | Home — file upload + job description |
| `/analyze` | Analysis results — scores, issues, suggestions, job match |
| `/improve` | AI improvements — Gemini rewrites weak bullets |
| `/history` | History dashboard — past analyses + score trend chart |

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/resume/upload` | Upload PDF/DOCX (multipart, field: `file`) |
| POST | `/api/resume/analyze` | Run ATS analysis |
| POST | `/api/resume/match-job` | Match against job description |
| POST | `/api/resume/improve` | Gemini AI improvements |
| GET | `/api/resume/history` | Past analyses |
| GET | `/api/resume/history/stats` | Trend + aggregate stats |

## Database Schema

- `resumes` — uploaded resume metadata + `file_content` (base64-encoded file stored in DB, no disk needed)
- `analysis_results` — scores, issues, suggestions, parsed data (JSONB)

## File Storage

Files are stored as base64 text in the `resumes.file_content` column (Neon PostgreSQL). No filesystem needed, so Render free tier works fine. Upload uses `multer.memoryStorage()`.

## Deployment (Render)

`render.yaml` at project root configures two Render services:
- **resume-ai-api** — Node.js web service, runs Express API
- **resume-ai-frontend** — Static site, serves built React app

**Environment variables to set on Render:**
- `DATABASE_URL` — Neon connection string
- `GEMINI_API_KEY` — Google AI Studio API key (get from aistudio.google.com)
- `ALLOWED_ORIGINS` — Frontend URL (e.g. `https://resume-ai-frontend.onrender.com`)
- `VITE_API_URL` (frontend) — API URL (e.g. `https://resume-ai-api.onrender.com`)

**Before first deploy:** Run `DATABASE_URL=<neon_url> pnpm --filter @workspace/db run push` to apply schema.

## Key Commands

- `pnpm --filter @workspace/resume-analyzer run dev` — start frontend
- `pnpm --filter @workspace/api-server run dev` — start API server
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to Replit DB
- `DATABASE_URL=<neon_url> pnpm --filter @workspace/db run push` — push schema to Neon

## Important Notes

- `@google/genai` must NOT be in `external` array in `artifacts/api-server/build.mjs` (it needs to be bundled)
- PDF parsing uses `createRequire` CJS trick in `artifacts/api-server/src/routes/resume/parser.ts`
- Upload endpoint expects `multipart/form-data` with field name `file`
- API client hooks take `{ data: ... }` format for mutations (Orval convention)
- Gemini client supports both `AI_INTEGRATIONS_GEMINI_API_KEY` (Replit) and `GEMINI_API_KEY` (direct/Render)
- `BASE_PATH` env var now optional in vite.config.ts (defaults to `/` for static builds)
