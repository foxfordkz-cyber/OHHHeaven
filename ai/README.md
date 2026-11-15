# @ohh/ai

AI service for First Year (build/CONTRACT.md §8): NYC weather, city events, the advisor, niche matching and the end-of-season debrief. Journals: `agents/05.md`, `agents/r3-A4.md` (Gemini and Grok). Report: `research/reports/05-ai.md`.

| Export | What | Network |
|---|---|---|
| `forecast(seed, fromDay, days)` | Daily weather from Central Park 1991-2020 normals | never |
| `deckEvent(w, ctx)` | One event from the 40-card NYC deck, at most one per game week | never |
| `planEvents(input)` | 1-2 AI events from the theme whitelist, validated; `[]` means "use the deck" | provider chain if a key is set |
| `askAdvisor(input)` | Answer under 90 words from the player's numbers and rule cards | provider chain if a key is set |
| `interpretIdea(input)` | Idea text → niche, name, tier, kit, notes | provider chain if a key is set |
| `writeDebrief(input)` | Headline, what went well, next time; losses come from the engine | provider chain if a key is set |

The AI functions never throw and answer within 8 seconds; on any failure they return the rules answer (`origin: 'rules'`).
In the browser import `@ohh/ai/pure` (forecast and deckEvent only, no network code).

## Provider chain

Every AI call goes: **primary provider → second provider → rules**, all inside one 8-second budget.

- Providers: Google Gemini (`src/provider/gemini.ts`, REST `generateContent` with `responseJsonSchema`) and xAI Grok (`src/provider/grok.ts`, REST Responses API `/v1/responses` with a strict `json_schema`). Plain `fetch`, no SDK.
- A provider without a key is skipped. With one key the chain is that provider → rules; with no key everything runs on rules and nothing touches the network.
- With a second provider waiting, the primary gets at most 5 seconds, so the second always has at least 3.
- A fast failure (HTTP error, rate limit, refusal, cut-off answer) moves on at once. So does an answer that fails the schema or the plausibility checks (numbers not in the data, too long, a banned theme).
- Answers are checked with the same zod schemas as before. The call log (`aiLog()`, `AI_LOG=1`) has one line per attempt and never holds keys.
- The Anthropic adapter (`src/provider/anthropic.ts`) is off: it joins the chain only when `AI_PROVIDER` names it.

## Server environment (set by a person)

| Variable | What | Default |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key (Google AI Studio) | none: Gemini is skipped |
| `XAI_API_KEY` | xAI API key (console.x.ai) | none: Grok is skipped |
| `AI_PROVIDER` | Primary provider: `gemini`, `grok`, or `mock` (no network). A list sets the order: `grok,gemini` | unset: Gemini first, then Grok |
| `AI_MODEL` | Model id. Goes to the provider whose family it names (`gemini-…`, `grok-…`); an id with no known prefix goes to the primary | `gemini-3.5-flash`, `grok-4.20-non-reasoning` |
| `GEMINI_MODEL`, `XAI_MODEL` | Model of each provider when `AI_MODEL` does not set it | as above |
| `AI_TIMEOUT_MS` | Budget of the whole chain | 8000 (also the maximum) |
| `AI_PRIMARY_MS` | Longest wait for the primary when a second provider is set | 5000 |
| `AI_MAX_RPM` | Calls per minute | 20 |
| `AI_LOG` | `1` prints the call log to stderr | off |
| `GEMINI_THINKING` | Gemini thinking level (`minimal`, `low`, …) or a token budget number | lowest the model accepts |
| `GEMINI_BASE_URL`, `XAI_BASE_URL` | Other API address (a proxy) | official endpoints |

Keys live only in the server environment. Never put them in the client or in a pack.

```bash
npm test -w @ohh/ai               # no network: providers run on a scripted fetch and a local fake server
npx tsx ai/src/demo.ts            # a year of weather and events; prints the chain it uses
node ai/scripts/fetch-climate.mjs # refresh normals from NOAA NCEI (needs network)
```
