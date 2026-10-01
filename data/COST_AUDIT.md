# Cost audit and controls

What one chat turn costs, where the money goes, what was changed, and how to keep it visible. Prices are list prices in US dollars per million tokens: gpt-4o $2.50 input, $1.25 cached input, $10 output; gpt-4o-mini $0.15, $0.075, $0.60; embeddings $0.02. A web search call adds a flat fee of about $0.025. These are estimates, check them against the current price page.

## Calls per turn

| Step | Own call | Model | Runs |
|---|---|---|---|
| Memory selection | Embeddings | text-embedding-3-small | Every turn, vectors cached in process |
| Intent | Yes | gpt-4o | Every turn, except when a question card is answered |
| Web search | Yes, at most one | gpt-4o with the search tool | Only when intent plans one |
| Attachment reading | One vision call per image | gpt-4o | Only with images. PDF and Word use no model |
| Construction | Yes | gpt-4o | Prompt requests |
| Conversational reply | Yes | gpt-4o | Casual messages and messages about the user |
| Scoring | No call, computed in code | none | Always free |
| Title (in `api`) | Yes | gpt-4o-mini | First turn and first finished prompt |

## What was found, and what changed

| Finding | Change |
|---|---|
| The per-user memory block sat in the middle of the system prompt, so the identical static part before it was too short to qualify for provider caching | Static content (identity, honesty rules, the step's template) now comes first and everything per user or per request comes last. The static prefix is about 90% of each prompt, over the 1,024 token minimum, and a test locks the order in |
| History was capped by message count, not size, and was sent in full to both calls | A window of the 6 most recent messages, each clipped, with the latest prompt kept longer so it can still be edited. Older turns are condensed to a one line digest, capped. Intent sees only the last 4 messages. A 40 message chat costs the same as a 25 message one |
| A separate model call only rephrased the user's sentence into a search query | Removed. The query is taken from the message |
| Up to two searches per turn, each with a flat fee | One search per turn, with the tool's low context setting |
| Construction allowed 6,000 output tokens, a prompt needs a few hundred | Capped at 2,500. Other output caps tightened too |
| Several large attachments could each claim their full text | One shared budget of 16,000 characters of reference text across all sources |
| `data` accepted unlimited message length, history entries and file sizes | Hard limits enforced in `data` and `api`, and checked in the interface before sending (see below) |
| The full eval suite was run repeatedly against the live API | Free mock mode is now the default, a live run needs `--live`, a scope, and `--yes`, and it prints the real spend |
| No record of what calls actually cost | Every call logs its tokens and estimated cost, every request logs a total |

## Before and after, same scenarios

Measured by running the real pipeline code with a recording provider. Raw input tokens:

| Scenario | Before | After |
|---|---|---|
| Prompt request, short chat | 6,253 | 6,306 |
| Same request, long chat | 10,122 | 7,237 |
| Casual message, long chat | 8,991 | 6,107 |
| Underspecified request | 2,680 | 2,710 |
| Search request | 5,744 (5 calls) | 5,696 (4 calls) |

Raw tokens do not show caching, which discounts the static prefix by half. With a warm cache the estimated cost of a prompt request in a short chat falls from about $0.024 to $0.019, a long chat from $0.036 to $0.023, and a casual message in a long chat from $0.025 to $0.014. A search turn is dominated by the search fee. Measured on real runs, 53% to 73% of prompt tokens were served from cache.

Measured live: 15 cases cost $0.212 in total, about $0.014 per case. The full 41 case suite with the judge cost $0.48 against an estimate of $0.66. The earlier unmeasured estimate for the same suite was roughly $1.00 to $1.20, so treat the before figure as an estimate.

## Model choice per step, tested

Every step was checked against the cheaper model with a real run, not assumed.

| Step | Result | Decision |
|---|---|---|
| Intent | On the small model the eval fell to 17 of 27, with needless questions | Keep gpt-4o |
| Construction | The small model costs 95% less ($0.004 against $0.077 over 8 prompts), but judge specificity and fit each fell from 3.88 to 3.50 | Keep gpt-4o, the prompt is the product |
| Conversational reply | The small model costs 96% less, about $0.003 saved per casual turn, but it broke the rule against asking permission to save memory | Keep gpt-4o |
| Image reading | Equally accurate, but the small model bills about 14,400 prompt tokens per image against 666, so the cost was nearly the same ($0.0022 against $0.0029) | Keep gpt-4o |
| Title | Already the small model | Unchanged |

The defaults did not change, and any step can be moved by configuration alone if the trade-off changes: `OPENAI_INTENT_MODEL`, `OPENAI_CONSTRUCT_MODEL`, `OPENAI_ANSWER_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_SEARCH_MODEL`. Re-run the live eval before changing one.

## Limits on the path to the model

| Limit | Value | Enforced in |
|---|---|---|
| Message length | 12,000 characters | `app` before sending, `api`, and `data` |
| Attachments per message | 3 | `app`, `api`, `data` |
| History entries sent to `data` | 40 entries, 20,000 characters each | `data`, and `api` sends at most 20 |
| Inline image or Word file | about 4MB, the request body cap, and 5.5 million characters | `api`, `data` |
| PDF size | 10MB | storage bucket and `api` |
| PDF pages and text read | 60 pages, 8,000 characters per file, 16,000 across all files | `data` |
| Memory items sent to `data` | 200, key 120 and value 600 characters | `data` |
| Memory in a prompt | at most 6 relevant items, or 25 when the message is about the user | `data` |
| Search | one query per turn | `data` |
| Audio | 15MB, and 4MB through the request body | `data`, `api` |

## Pattern retrieval

Retrieving patterns adds one small embedding call and about 400 to 600 tokens to a construction prompt. On the same 15 prompt-building cases it raised the judge's specificity, fit and value by roughly 0.3 each, at about 6 percent more spend per case. The patterns sit in the per-request part of the prompt, after the cacheable prefix, so they do not disturb caching.

## Reading the logs

Every model call logs one line, and every request logs a total:

```
usage step=intent model=gpt-4o prompt_tokens=2681 cached_tokens=2048 completion_tokens=140 est_cost_usd=0.004541
turn_usage calls=3 prompt_tokens=5581 cached_tokens=4096 completion_tokens=1040 est_cost_usd=0.019
```

Search the `data` service logs for `usage step=` to trace spend by step, or `turn_usage` for a total per turn. The eval runner prints the same breakdown for a run.

## Running the eval cheaply

```
python evaluation/run_eval.py                                      free mock mode, for routine iteration
python evaluation/run_eval.py --live --only conv-roast --yes       a few real cases
python evaluation/run_eval.py --live --full --yes --judge          a deliberate checkpoint, about $0.50
```
