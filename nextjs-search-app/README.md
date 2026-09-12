# 🔍 Smart Voter Search & Volunteer Field Platform (`nextjs-search-app`)

The core search engine and field operations web app for the **Voter Scrap** ecosystem. Built with Next.js App Router to give election day volunteers, polling booth workers, and citizens instant access to electoral rolls.

---

## ⚡ Deployment Roles & Redundancy

This application is built to run in two deployment modes across two Git branches:

### 1. Primary Production: GCP Compute Engine (`main` branch)
* **Domain:** `https://34-46-101-158.nip.io/`
* **Infrastructure:** Google Compute Engine `e2-micro` Linux VM with 2GB Swap Memory.
* **Process Manager:** Daemonized with **PM2** (`pm2 start npm --name "voter-app" -- start`) for automated reboot recovery.
* **Database Engine:** Local SQLite3 with `PRAGMA journal_mode = WAL` (Write-Ahead Logging) for extreme concurrency during morning voting rushes.
* **Security & Auth:** Full NextAuth session management, Google OAuth, role-based ward restrictions, and search rate-limiting.

### 2. Hot-Standby Failover: Vercel Cloud (`vercel-backup` branch)
* **Purpose:** **Disaster Recovery Backup**. If the GCP VM experiences network downtime, maintenance, or connectivity issues on election day, volunteers immediately switch to the Vercel deployment URL.
* **Configuration:** Serverless execution without server-dependent auth daemons, direct public voter verification card UI, and bundled voting databases.

---

## 👥 Volunteer Field Operations & Features

Designed directly from ground feedback at polling stations:

* **Instant Multi-Parameter Search**: Search across 1,500+ ward voters by:
  * EPIC / Voter ID (e.g. `SSB1234567`)
  * Hindi Name with integrated transliteration (English to Hindi phonetic typing)
  * Relative / Father / Husband Name
  * House Number
* **Live Voting Calculator (`/voting`)**:
  * Slip-by-slip tally calculator allowing volunteers to mark voters as they cast ballots.
  * Real-time calculation of polling percentage against registered voters.
  * Instant filter for "Unvoted Voters" to coordinate neighborhood turnout reminders.
* **Gali & Block Filter (`/house`)**:
  * Groups voters into physical street batches (Gali 1, 2, 3...) for door-to-door booth mobilization.

---

## 📈 Real-Time Production Field Analytics

Integrated with Google Analytics (`NEXT_PUBLIC_GA_ID=G-PWQQS0JTP2`) to measure live field engagement:

| Metric | Field Value (Ward 5 Polling) |
| :--- | :--- |
| **Total Page Views** | **212+ Views** |
| **Active Field Volunteers** | **35+ Users** |
| **User Interactions & Queries** | **495+ Events** |
| **Peak 30-Min Concurrency** | **23 Concurrent Users** |
| **Organic Field Adoption** | **100%** (Word-of-mouth among booth workers) |
| **Average Query Latency** | **< 200 ms** (via indexed SQLite WAL) |

---

## 🛠️ Local Development & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env.local`:
```env
NEXT_PUBLIC_GA_ID=G-PWQQS0JTP2
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app.

### 4. Production Build & Start
```bash
npm run build
npm start
```
