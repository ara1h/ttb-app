# Approach & Design Notes

## The core design decision: AI extracts, code decides

The single most important architectural choice in this prototype is the split between
**extraction** and **judgment**:

1. **Extraction (AI):** a vision model (Claude) transcribes the label — brand name,
   class/type, alcohol content, net contents, bottler, country of origin, and the
   government warning statement *verbatim*, preserving capitalization and
   punctuation. The model is instructed never to correct or normalize what it reads,
   and returns structured JSON via a forced tool call (no free-text parsing).

2. **Judgment (deterministic code):** every pass/fail/review decision is made by
   pure TypeScript functions in `src/lib/compare.ts` and `src/lib/warning.ts`,
   covered by unit tests.

Why this matters for a compliance tool:

- **Auditability.** "Why was this label rejected?" has an exact, reproducible
  answer in reviewable code — not a model's opinion. For a federal compliance
  workflow this is the difference between a tool agents can trust and one they
  route around.
- **Tunability.** When the rules change (or a threshold is wrong), you edit a
  function and its test — no prompt engineering, no regression risk in unrelated
  fields.
- **Testability.** The judgment layer has 22 unit tests including the exact edge
  cases stakeholders described in interviews.

## Meeting the ~5-second budget

Sarah was unambiguous: the last vendor's 30–40 second turnaround killed adoption.
Budget breakdown per label:

- **Client-side image downscaling** (`src/lib/client.ts`): images are resized to
  ≤1568 px and recompressed as JPEG *in the browser* before upload. A 12 MB phone
  photo becomes a ~300 KB upload — this cuts both upload time and model
  processing time, and keeps requests under Vercel's body limit.
- **Model choice:** `claude-haiku-4-5` — the fastest vision-capable Claude model —
  typically returns extraction in 2–4 seconds. A single model call per label; the
  comparison logic adds ~1 ms.
- **Honest feedback:** every result shows its actual elapsed time, so slow results
  are visible rather than mysterious.
- **Batch throughput:** the batch tab runs 4 labels concurrently, so 300 labels
  complete in roughly 4–6 minutes of unattended processing (vs. ~25–50 hours of
  agent time at 5–10 minutes each) with a progress bar and a CSV report at the end.

## Field-matching rules

| Field | Rule |
| --- | --- |
| Brand name / class-type | Exact match → **match**. Same characters ignoring case/punctuation (STONE'S THROW ≡ Stone's Throw, curly vs straight apostrophes) → **match with a note**, per Dave's "you need judgment" example. Levenshtein similarity ≥ 0.8 → **needs review** (human decides). Below that → **mismatch**. |
| Alcohol content | Parsed numerically, so "45", "45%", and "45% Alc./Vol. (90 Proof)" all agree. Bonus check: if the label states both ABV and proof, they are cross-checked (proof = 2 × ABV); an internally inconsistent label is flagged for review even when the ABV matches the application. |
| Net contents | Parsed to milliliters with unit conversion (mL, cL, L, fl oz), so "750 mL" matches "75 cl". Mismatched volumes fail with both values shown. |
| Government warning | See below. |
| Anything unparseable | Never silently passed — always **needs review** with an explanation. |

Fields left blank in the application are skipped (reported as "not checked"), which
also makes the tool usable as a pure compliance scan when no application data is at
hand — except the government warning, which is always checked.

## The government warning check (27 CFR Part 16)

Jenny's interview drove this design: the warning must be *exact*, and applicants get
creative. The check:

1. **Presence** — missing warning is an automatic fail.
2. **Prefix case** — the statement must begin with `GOVERNMENT WARNING:` in capital
   letters. `Government Warning:` in title case fails (her real rejection example).
3. **Word-for-word body** — compared token-by-token against the statutory text.
   Any wording deviation fails, and the result includes a word-level diff ("required
   wording not found: … / unexpected wording on label: …") so the agent sees exactly
   what was changed. Whitespace and curly-quote variants are tolerated.
   *Punctuation-only* deviations (e.g. "defects;" vs "defects.") go to **needs
   review** instead of failing: on an imperfect photo they are as likely to be
   transcription noise as a real label defect, and repeated runs on a blurry image
   should never flip between pass and fail. Errors are always pushed toward human
   review, never toward a silent pass.
4. **Bold prefix** — best-effort: the vision model judges whether the prefix appears
   bolder than the body. Because typographic weight from a photo is inherently
   uncertain, "appears not bold" produces **needs review** rather than a hard fail,
   and "can't tell" is noted. This is a deliberate trade-off documented for the
   agent in the result text.

Font-size ratios and formatting rules (type size relative to container size, maximum
characters per inch) are out of scope for this prototype — noted under limitations.

## UX decisions

The benchmark was "Sarah's 73-year-old mother," with half the team over 50:

- Two verbs total: *Check one label* or *Check a batch*. Numbered steps inside each.
- No jargon: results say "Label shows 43% ABV but the application says 45%," not
  error codes. Verdicts use icon + color + words (never color alone).
- Failure states are actionable: an unreadable image says "request a clearer photo
  from the applicant" — mirroring the team's existing workflow.
- Sample chips let anyone try the tool with zero setup — also a training aid.
- The human stays in charge: the header says "You always make the final call," and
  ambiguous results are explicitly routed to review rather than auto-decided —
  directly addressing Dave's (justified) skepticism of pattern-matching.

## Security & privacy posture (prototype-appropriate)

- Images are processed in memory and never written to disk or a database; nothing
  is retained after the response is sent.
- The API key lives server-side only (Vercel env var); the browser never sees it.
- Uploads validated for type and size; API errors return friendly, non-technical
  messages and never expose internals.
- No auth, by design for a public prototype — noted as a production requirement.

## Marcus's firewall concern (and the production path)

TTB's network blocks many outbound domains, which broke the previous vendor's cloud
ML endpoints. This prototype does call a cloud API (Anthropic) — the right choice
for a standalone proof-of-concept — but the design keeps the exit cheap:

- All model interaction is isolated behind one function (`extractLabel`) with a
  plain-TypeScript interface. Swapping to a FedRAMP-authorized endpoint — e.g.
  Claude via **AWS Bedrock (FedRAMP High)** or an Azure-hosted model to match TTB's
  existing Azure footprint — is a one-file change; the comparison engine, API, and
  UI are provider-agnostic.
- The single required egress domain (`api.anthropic.com`) is easy to allowlist for
  a pilot, in contrast to the scanning vendor's sprawling endpoints.
- The mock mode doubles as proof that the app degrades gracefully with no
  connectivity at all.

## Assumptions

- Application data arrives by manual entry (single) or CSV keyed on image file name
  (batch) — COLA integration is explicitly out of scope per Marcus.
- One image per application (the front/brand label). Multi-image applications
  (front + back label) are a straightforward extension.
- Distilled-spirits-style labels are the primary target (per the provided example);
  the checks apply to wine and beer labels too, but beverage-type-specific rules
  (e.g. ABV statement exemptions for certain wine/beer) are not modeled.
- English-language labels.

## Known limitations & what I'd do next

- **Bold detection is best-effort** (see above) — a production version could pair
  the LLM with local glyph-weight analysis on the warning region.
- **Type-size rules not checked** (minimum type size relative to container volume
  per 27 CFR 16.22) — needs physical-dimension calibration that a photo alone
  can't provide.
- **No persistence or audit log.** Production would need a review-history store,
  and with it the PII/retention controls Marcus flagged.
- **No authentication.** Required before anything beyond a demo.
- **Extraction accuracy is not formally evaluated.** Next step: a labeled golden
  set of a few hundred real COLA labels and a measured extraction accuracy /
  false-pass / false-fail dashboard — false passes are the metric that matters
  most for a compliance tool, so thresholds should be tuned to push errors toward
  "needs review," never toward silent passes.
- **Serverless cold starts** can add ~1s to the first request after idle on the
  free tier — visible in the timing badge, acceptable for a prototype.
