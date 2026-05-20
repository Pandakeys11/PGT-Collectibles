# GitHub — PGT Collectibles repo

## One-time: sign in to GitHub CLI

```powershell
gh auth login
```

Choose: **GitHub.com** → **HTTPS** → authenticate via **browser**.

## Repository (live)

**https://github.com/Pandakeys11/PGT-Collectibles**

Default branch: `main` · App root for Vercel: `Alpha1/`

## Create another clone / machine

```powershell
git clone https://github.com/Pandakeys11/PGT-Collectibles.git
cd PGT-Collectibles/Alpha1
npm install
cp .env.example .env.local
```

## Vercel

Import `PGT-Collectibles`, set **Root Directory** to `Alpha1`, add env from `.env.production` (Production).
