# Prompt AI, Data Service (`/data`)

This is the machine learning and LLM layer of Prompt AI. It is strictly for model inference. It has no authentication, no email, no user accounts, and no direct exposure to end users. The only caller of this service is `/api`.

This service is deployed on Render, chosen because it suits long running Python processes and model inference better than a serverless platform.

## Responsibilities

- Intent classification: identifying what the user wants and which AI category the request belongs to
- Prompt construction: applying prompt engineering patterns to build a structured, complete prompt from user input
- Prompt scoring: grading a generated prompt against a clarity and specificity rubric
- Retrieval: pulling known effective prompt patterns and examples from a vector store to inform generation
- Abstraction over external LLM providers, so `/api` never needs to know which provider is being used

## What this service does NOT do

- No authentication or user session handling. Every request is authenticated at the `/api` layer before it reaches here, using a shared service level secret.
- No storage of user data beyond what is strictly needed for a single inference request.
- No email, no billing, no business logic unrelated to model inference.

## Tech Stack

- Python
- FastAPI, exposing internal endpoints consumed only by `/api`
- scikit-learn, for the intent classification and scoring models
- pgvector via Supabase, as the vector store for prompt pattern retrieval
- pandas and NumPy, for data preparation and feature engineering
- Jupyter, for experimentation only, never imported by production code

## Folder Structure (planned)

```
data/
├── main.py                 FastAPI entrypoint
├── providers/                Abstraction layer over LLM APIs
├── models/                    Trained model artifacts
├── pipelines/                  Training scripts
├── prompts/                     Versioned prompt templates
├── retrieval/                   Embedding and vector search logic
├── evaluation/                   Eval harness and test cases
├── schemas/                       Pydantic request and response models
├── tests/
├── notebooks/                      Experimentation, not used in production
├── requirements.txt
└── .env.example
```

## Environment Variables

This service expects a Supabase connection for the vector store, AI provider API keys, a shared secret used to authenticate requests coming from `/api`, and a model path or model registry location.

## Status

Scaffolding stage. No implementation yet.
