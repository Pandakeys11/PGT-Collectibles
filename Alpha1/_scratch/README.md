# Local scratch (gitignored)

Ad-hoc probe output, dev logs, and one-off HTML/JSON captures. **Not committed.**

| Subfolder | Use |
|-----------|-----|
| `probes/` | PSA pop HTML, eBay HTML, sign-in probes, manual test JSON |
| `logs/` | Dev server redirect logs (`tmp-liquid-scan-dev-*.log`) |

**Resumable job checkpoints** (price backfill, PSA10 sync) live in `.tmp/` — do not delete those while a job is running.

Safe to delete everything here when tidying up.
