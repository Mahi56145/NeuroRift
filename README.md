# NeuroRift — AI-Powered Dataset Intelligence Platform

A high-performance, dark-tech web app for uploading, analysing, comparing, and exploring datasets with AI enrichment via Groq.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + Framer Motion + Lucide Icons
- **Database & Auth:** Supabase (PostgreSQL)
- **AI Engine:** Groq SDK (LLaMA 3.3-70B)
- **Styling:** Vanilla CSS-in-JS

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

Create a `.env.local` file in the root with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_api_key
```

## Deployment

Deploy instantly on [Vercel](https://vercel.com) — connect your GitHub repo and add the environment variables in the Vercel dashboard.

```bash
npm run build   # production build
npm run start   # start production server
```