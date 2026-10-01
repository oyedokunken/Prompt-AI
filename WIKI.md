# Prompt AI Wiki

The index for Prompt AI's documentation. Deeper guides live here or next to the code they describe.

## Start here

- [README.md](./README.md) what Prompt AI is, what it does, and how to run it
- [ARCHITECTURE.md](./ARCHITECTURE.md) how `app`, `api` and `data` relate, what each owns, and how a request flows, with diagrams
- [CONTRIBUTING.md](./CONTRIBUTING.md) how to submit changes
- [SECURITY.md](./SECURITY.md) how to report a vulnerability
- [CHANGELOG.md](./CHANGELOG.md) what changed and when
- [story.txt](./story.txt) why this project exists

- [data/COST_AUDIT.md](./data/COST_AUDIT.md) what a turn costs, what was done about it, and how to read the usage logs

## Service documentation

- [`app/README.md`](./app/README.md) the interface
- [`api/README.md`](./api/README.md) the backend
- [`data/README.md`](./data/README.md) the intelligence layer
- [`OAuth.md`](./OAuth.md) setting up Google and GitHub sign in

## Working on the prompt pipeline

- **Where things live.** The pipeline steps are in `data/core/pipeline`, the wording the model sees is in `data/core/prompts`, and the output format targeting is in `data/core/prompts/targets.py`.
- **Changing wording.** Templates are versioned in directories. Add a new version directory, move the active version in `loader.py`, then run the eval set before and after.
- **The eval set.** `data/evaluation/eval_set.json` holds requests with notes on what a good result looks like. `python evaluation/run_eval.py` checks decisions, required and forbidden content, formatting, filler and memory behavior. The default is a free mock mode, a real run needs `--live`, a scope and `--yes`, and it reports its spend. Add `--judge` to also score generated prompts with a reviewer model, and `--save-baseline` to record a run. Treat the judge as a signal, not a verdict, since a model grading a model has its own bias.
- **Adding a model provider.** Implement the interface in `data/core/providers/base.py` and select it in `data/core/providers/__init__.py`. Pipeline code never names a provider.

## Planned

These guides do not exist yet.

- A catalogue of the prompt patterns Prompt AI draws on, with examples
- A scoring reference explaining what the completeness score means
- A full API reference for `api`
- An FAQ, added as questions come up

## Where this lives long term

Once the project has enough contributors, this index may move to a proper GitHub Wiki instead of a root file. Until then, this file and the service READMEs are the source of truth.
