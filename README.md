# IRIS by BCI

Insurance Risk & Intelligence System — an internal CRM for insurance brokerage operations. Manage clients, track deals through the sales pipeline, generate policy documents, and handle aftersales work (claims, endorsements) in one place.

## Features

- **Pipeline** — drag-and-drop kanban board for tracking deals from Leads through Bind
- **Clients** — master company database with SME / Large Enterprise classification
- **Policies** — bound policies with cover note generation
- **Aftersales** — claims and endorsements per policy
- **Dashboard** — overview of premiums, deals, and key metrics

## Tech stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Recharts (dashboard charts)
- jsPDF (document generation)
- dnd-kit (drag-and-drop)
- Data persisted in browser localStorage

## Run locally

**Prerequisites:** Node.js 18 or higher

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Build for production

```bash
npm run build
```

Output is written to the `dist/` folder.