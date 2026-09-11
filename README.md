🇬🇧 English · [🇷🇺 Русский](README.ru.md)

# ZhK-Radar (ЖК-Радар)

Map of new residential developments in Kazakhstan with a transparent, source-linked buyer-protection index for each project.

## What / Why

Listing portals show what is for sale. ZhK-Radar tries to answer whether it is safe to buy: every development (ЖК) gets a **buyer-protection index** (0–100) computed only from open, verifiable data — the state equity-guarantee registry (KFGZhS, khc.kz), the developer's delivery track record, declared seismic resistance and price relative to the market. Every indicator cites its source and is tagged as either a primary source (government registry) or an aggregator. Missing data is shown as grey, never as zero.

The project is an aggregator of open data, not investment advice. Each development page has a "Dispute the data" button.

## Live

https://zhk-radar.vercel.app

## Features

- Interactive MapLibre map of new developments, colour-coded by protection band (green / amber / red / grey).
- Five cities: Almaty, Astana, Shymkent, Taldykorgan, Kapchagay (`lib/cities.ts`).
- Two map modes: developments and individual apartment listings; listings in the visible map area are shown as a list, with a daily "sold / new" diff.
- Development page (`/zhk/...`) with photo gallery and floor plans, indicator breakdown with source links, and a dispute button.
- Developer page (`/developer/[slug]`) with portfolio statistics.
- Public methodology page (`/methodology`).
- Map overlays: Almaty district boundaries, city landmarks, and a seismic-fault layer (shown only where a city-level fault map exists — currently Almaty).
- Favourites stored in `localStorage`; optional Google sign-in via Supabase syncs favourites across devices (table protected by Row Level Security, see `supabase/migrations/0001_favorites.sql` and `SETUP-AUTH.md`). Without Supabase env variables the site works fully and the sign-in button is hidden.
- Mobile layout with a bottom sheet on phones.

## Scoring

Four indicators (`lib/score.ts`), each on its own 0–100 scale:

| Indicator | Weight | Source |
|---|---|---|
| Equity-money protection | 35 | KFGZhS guarantee registry (khc.kz) — primary source |
| Developer reliability | 30 | Developer portfolio on korter.kz — aggregator |
| Seismic safety | 20 | Project declaration via korter.kz — aggregator |
| Price vs market | 15 | Catalogue median by class — aggregator |

The headline index is the weighted mean of the indicators that have data. If the available indicators cover less than 25 % of the total weight, no verdict is shown ("not enough data").

## Stack

- Next.js 15 (App Router, static generation) + React 19 + TypeScript
- SCSS Modules
- MapLibre GL JS
- Supabase JS (optional: Google auth + favourites sync, RLS)
- Data collectors: Node 22 scripts (`scripts/*.mjs`), `pdfjs-dist` for PDF registries, `puppeteer-core` for screenshots
- Hosting: Vercel; daily data refresh via GitHub Actions
- Package manager: pnpm

## Data sources & pipeline

Data-as-code: JSON/GeoJSON files in `data/` are the source of truth; everything derived (scores, developer statistics) is computed in `lib/` at build time. Static datasets consumed by the browser are copied to `public/`.

Collectors (`scripts/`):

| Script | What it does |
|---|---|
| `collect-korter.mjs` | Paginates the korter.kz new-buildings catalogue, extracts `window.INITIAL_STATE`, writes `data/zhk-raw*.json` |
| `enrich-korter.mjs` | Enriches each development from its korter detail page: class, parking, floors, materials, completion, seismic resistance |
| `enrich-korter-stages.mjs` | Construction stages and completion quarter |
| `enrich-gallery.mjs` | Full photo gallery and floor-plan layouts |
| `collect-krisha.mjs`, `enrich-krisha-detail.mjs` | Secondary catalogue from krisha.kz for map coverage only (not used in the score) |
| `collect-listings.mjs` | All apartment listings for a city from the krisha.kz map API via recursive bbox splitting; diffs against the previous snapshot to produce sold/new (`data/listings*.json`, `listings-sold*.json`, `listings-meta*.json`) |
| `collect-kzhk.mjs` | Downloads the KFGZhS guarantee registry PDFs from khc.kz, parses them with `pdfjs-dist`, writes `data/guarantees.json` |
| `fetch-districts.mjs`, `assign-districts.mjs`, `verify-districts.mjs` | Almaty district boundaries from Nominatim (OSM), point-in-polygon assignment, cross-check |
| `fetch-landmarks.mjs`, `enrich-landmarks-2gis.mjs` | City landmarks (malls, parks, stations) from Nominatim, enriched from 2GIS |
| `collect-2gis-photos.mjs` | Resident photos from 2GIS (user-shot only, hotlinked with attribution) |
| `analyze-completeness.mjs` | Data-completeness report |
| `shot*.mjs` | Screenshots with `puppeteer-core` |

Collectors are throttled and were designed to run from a local Kazakhstan IP, since some `.kz` sites block cloud IPs. Notes on the terms of service of each source are in the script headers and in `DATA-SOURCES.md`.

**Daily refresh** — `.github/workflows/update-daily.yml` runs every day at 19:00 UTC (00:00 Almaty) or on manual dispatch: for each of the five cities it downloads the previous listings snapshot from production, runs `collect-listings.mjs`, copies the results to `public/`, and deploys to Vercel with the Vercel CLI. Listing files are deliberately not committed (they are in `.gitignore`); `.vercelignore` lets them be uploaded from the runner. `scripts/update-daily.ps1` is the older Windows Task Scheduler variant of the same pipeline.

## Architecture

```
app/                    Next.js App Router pages
  page.tsx              home: map + panel
  zhk/[...slug]/        development page
  developer/[slug]/     developer page
  methodology/          scoring methodology
components/             HomeClient, MapView, MiniMap, Gallery, Layouts, AptCard, DisputeButton, Icon
lib/
  cities.ts             city registry (centre, bbox, source slugs, available layers)
  data.ts               loads data/*.json, merges catalogues, computes developer stats and scores
  score.ts              the four indicators and the buyer-protection index
  supabase.ts           optional Supabase client (disabled without env)
  useFavorites.ts       localStorage favourites + cloud merge on sign-in
  types.ts
data/                   source-of-truth JSON / GeoJSON
public/                 static datasets served to the browser (listings, districts, landmarks, faults)
scripts/                collectors and enrichment scripts
supabase/migrations/    favorites table + RLS policies
.github/workflows/      daily listings refresh + deploy
```

## Run locally

Requires Node 22 and pnpm.

```bash
pnpm install
pnpm dev              # http://localhost:3300
pnpm build            # production build
pnpm start            # serve the build on :3300
pnpm lint
```

Data collection (optional — the repository already contains the catalogue data):

```bash
pnpm collect          # korter catalogue + detail enrichment
pnpm collect:kzhk     # KFGZhS guarantee registry (PDF -> data/guarantees.json)
node scripts/collect-listings.mjs   # apartment listings for Almaty (default arguments)
```

Optional Google sign-in / favourites sync: copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; see `SETUP-AUTH.md`.

## License

MIT — see [LICENSE](LICENSE).
