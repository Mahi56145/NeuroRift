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

## Seed 500-600 Kaggle Datasets

1. Install Kaggle API client:

```bash
pip install kaggle
```

2. Configure Kaggle credentials (either environment variables or `~/.kaggle/kaggle.json`):

```env
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_api_key
```

3. Fetch top datasets into the seed file (example: 600):

```bash
python scripts/fetch_kaggle_datasets.py --target 600 --sort-by votes --output app/api/seed/datasets.json --merge
```

4. Run the seed endpoint to insert into Supabase:

```bash
curl http://localhost:3000/api/seed
```

Notes:
- The seed route de-duplicates by `slug` and inserts in batches for large payloads.
- Existing rows in your database are preserved; only unseen slugs are added.