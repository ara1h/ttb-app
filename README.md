# Label Check — AI-Powered Alcohol Label Verification

A prototype for TTB compliance agents that verifies alcohol beverage label artwork
against the label application: upload a label image and the application details, and
the app reads the label with AI vision, checks every field, and verifies the
Government Health Warning Statement word for word — with results in a few seconds.

Built as a take-home project. The AI **extracts** what the label says; every
**pass/fail decision** is made by deterministic, unit-tested code — so compliance
rules stay auditable and adjustable without retraining or re-prompting a model.

## What it does

| Stakeholder ask | How it's addressed |
| --- | --- |
| "If we can't get results back in about 5 seconds, nobody's going to use it" (Sarah) | Fast vision model (Claude Haiku), client-side image downscaling before upload, per-label timing shown in the UI |
| "Something my mother could figure out" (Sarah) | Two big tabs, numbered steps, large type, plain-language results with ✓ / ! / ✕ verdicts and one-sentence explanations |
| Batch uploads of 200–300 labels (Sarah, Janet) | Batch tab: drop any number of images, optional CSV of application data matched by file name, progress bar, summary counts, CSV export of results |
| "STONE'S THROW vs Stone's Throw — obviously the same thing" (Dave) | Case/punctuation-only differences are accepted as a match with a note; similar-but-different names are flagged **Needs review** instead of auto-failed |
| Warning must be exact, "GOVERNMENT WARNING:" in all caps and bold (Jenny) | Word-for-word comparison against the 27 CFR Part 16 statement, hard fail on a non-caps prefix (title case is rejected), word-level diff of any deviation, best-effort bold check |
| Labels photographed at angles, bad lighting, glare (Jenny) | Vision LLM reads imperfect photos far better than classical OCR; the model reports image quality, and unreadable images get a clear "request a better photo" outcome instead of a wrong answer |
| Agents' judgment stays in the loop (Dave) | Three-way outcomes (pass / needs review / issues found) — the tool recommends, the agent decides |

## Quick start

```bash
npm install
cp .env.example .env.local   # then paste your Anthropic API key into .env.local
npm run dev                  # → http://localhost:3000
```

**No API key?** The app still runs in a clearly-labeled **demo mode**: the bundled
sample labels return canned results so the whole UI can be explored offline. Real
image analysis requires `ANTHROPIC_API_KEY` (create one at
[console.anthropic.com](https://console.anthropic.com) → API Keys; a few dollars of
credit is more than enough for evaluation).

### Try it in 10 seconds

On the **Check one label** tab, click any of the "Try an example" chips — each loads
a bundled sample image plus its application data and demonstrates one scenario:

- **Clean pass** — everything matches
- **ABV mismatch** — label says 43%, application says 45%
- **Warning not in caps** — "Government Warning:" in title case (a real rejection case)
- **Brand case differs** — STONE'S THROW vs Stone's Throw (accepted, with a note)
- **Missing warning** — no government warning on the label
- **Imperfect photo** — rotated, blurry photo that the AI still reads

For the **Check a batch** tab, use the images in [`public/samples/`](public/samples)
together with [`public/samples/sample-batch.csv`](public/samples/sample-batch.csv),
or download the CSV template from the UI.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | For real analysis | Server-side only; never sent to the browser. Without it the app runs in demo mode. |
| `CLAUDE_MODEL` | No | Vision model override. Default `claude-haiku-4-5` (fastest). `claude-sonnet-5` trades a little speed for accuracy headroom. |

## Deploying to Vercel

1. Push this repository to GitHub.
2. On [vercel.com](https://vercel.com), **Add New → Project**, import the repo
   (framework is auto-detected as Next.js — no settings to change).
3. Under **Environment Variables**, add `ANTHROPIC_API_KEY`.
4. Deploy. Done — the URL Vercel gives you is the deliverable.

## Tests

```bash
npm test        # unit tests for the comparison engine (vitest)
npm run lint
```

The comparison rules — brand fuzzy-matching, ABV/proof parsing and cross-checking,
net-contents unit conversion, and the government-warning exactness rules — are pure
functions with 22 unit tests, including Dave's STONE'S THROW case and Jenny's
title-case rejection case.

## Project structure

```
src/
  app/
    page.tsx               UI shell (header, demo-mode banner, tabs)
    api/verify/route.ts    POST: image + application data → verification result
  components/
    SingleCheck.tsx        one-label form, image dropzone, sample chips
    BatchCheck.tsx         multi-image upload, CSV in/out, progress, results table
    ResultPanel.tsx        per-field verdicts and overall banner
  lib/
    extract.ts             Claude vision extraction (structured tool output)
    compare.ts             deterministic field comparison engine
    warning.ts             27 CFR Part 16 government-warning check
    normalize.ts           text normalization, Levenshtein, word diff
    mock.ts                demo-mode fixtures (no API key needed)
    client.ts              browser helpers: image downscale, batching, CSV
scripts/generate-samples.mjs   regenerates the sample label images
public/samples/                test labels + batch CSV
```

## Approach, assumptions, and trade-offs

See [docs/APPROACH.md](docs/APPROACH.md) for the full write-up: architecture
decisions, how the ~5-second budget is met, the matching rules and thresholds,
security/privacy posture, the on-network deployment consideration raised by IT,
and known limitations.
