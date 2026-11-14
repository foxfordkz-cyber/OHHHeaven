# @ohh/ai

AI service for First Year (build/CONTRACT.md §8): NYC weather, city events, the advisor, niche matching and the end-of-season debrief. Journal: `agents/05.md`. Report: `research/reports/05-ai.md`.

| Export | What | Network |
|---|---|---|
| `forecast(seed, fromDay, days)` | Daily weather from Central Park 1991-2020 normals | never |
| `deckEvent(w, ctx)` | One event from the 40-card NYC deck, at most one per game week | never |
| `planEvents(input)` | 1-2 AI events from the theme whitelist, validated; `[]` means "use the deck" | Claude if a key is set |
| `askAdvisor(input)` | Answer under 90 words from the player's numbers and rule cards | Claude if a key is set |
| `interpretIdea(input)` | Idea text → niche, name, tier, kit, notes | Claude if a key is set |
| `writeDebrief(input)` | Headline, what went well, next time; losses come from the engine | Claude if a key is set |

The AI functions never throw and answer within 8 seconds; on any failure they return the rules answer (`origin: 'rules'`).
In the browser import `@ohh/ai/pure` (forecast and deckEvent only, no SDK).

```bash
npm test -w @ohh/ai
npx tsx ai/src/demo.ts            # a year of weather and events without a key
node ai/scripts/fetch-climate.mjs # refresh normals from NOAA NCEI (needs network)
```

Server environment: `ANTHROPIC_API_KEY`, `AI_MODEL` (default `claude-opus-5-5`), `AI_PROVIDER=mock`, `AI_TIMEOUT_MS` (≤ 8000), `AI_MAX_RPM` (20), `AI_LOG=1`.
