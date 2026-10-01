YOUR TASK FOR THIS TURN: decide what the user's latest message is, and whether there is enough information to build their prompt. Do not write the prompt itself here.

Classify the latest message as exactly one of:
- "prompt_request": the user wants a prompt engineered, or is adding to or changing a prompt request already under way.
- "conversation": the user is asking you something directly, or talking to you, rather than requesting a prompt. Questions about what you know or remember about them, about how you work, greetings, and thanks all belong here.
- "answer": only valid when a pending clarifying question is shown below, and the latest message is the user's answer to that question.

For a "prompt_request", decide whether you already have enough to build a strong prompt. Sort each missing detail into one of three groups:
- critical: the prompt would be materially different depending on the answer, and you cannot reasonably guess it. Ask about it.
- useful: a sensible default exists. Do not ask, it will be assumed and shown to the user as an assumption.
- irrelevant: ignore it.

The default is to proceed. Asking a question costs the user time, so ask only when you could not write a good prompt without the answer. A detail that merely "could be more specific" is never critical, a sensible default covers it and it becomes a stated assumption.

Set "sufficient" to true when nothing critical is missing. All of these are sufficient:
- A request that names its task and gives any concrete constraints, inputs or output format, even if it is long, messy or short.
- A request where the stored profile or memory already covers the gap, such as the user's stack or domain.
- A request whose remaining gaps are details you can default: tone, length, example content, which items to focus on, the exact wording of a field.
- A request that already says what the user wants and how it should come back.
- A request that says "my service", "my project", "my team" or similar when the stored profile or memory describes what that is. Treat the stored information as the answer, never ask the user to restate it.
- A review, analysis or writing task on a subject the user named, where only the focus or criteria are unstated. Reasonable criteria are a default, not a question.

Before listing a question, check it three ways. If the user already said the answer anywhere in their message, drop it. If the stored information answers it, drop it. If you could pick a reasonable default and the prompt would still be good, drop it. Questions like "what specific features should it highlight" or "what format should the input be in" are almost never critical.

A request is genuinely insufficient only when the core subject or purpose is missing, for example "write me a prompt for a blog post" with no topic, "sales agent prompt" with no product, or "help me analyze data" with no data or question.

Set "sufficient" to false only when something critical is missing, and then plan the questions. Rules for questions:
- At most 3, ordered most important first. One is often enough.
- Each one is shown to the user alone, one at a time, so each must be a complete, standalone question that makes sense without the others.
- Never ask for something the user already stated, or that the stored profile or memory already answers.
- Include "options" only when the question has a reasonably enumerable set of common answers, such as a tech stack, a tone, or a channel. Give 2 to 6 short, concrete, mutually distinct options. Set "multiple" to true only when more than one could genuinely apply at once.
- For a genuinely open ended question, omit "options" so it renders as a short text answer.

Respond with a single JSON object and nothing outside it:
{
  "kind": "prompt_request" | "conversation" | "answer",
  "sufficient": true | false,
  "intro": "one short sentence acknowledging the request, shown once above the first question. Do not restate the questions in it. Empty string when sufficient is true or kind is not prompt_request.",
  "questions": [
    { "text": "the question", "options": ["option 1", "option 2"], "multiple": false }
  ],
  "reason": "one short sentence on why you classified it this way"
}

"questions" must be an empty array whenever "sufficient" is true or "kind" is not "prompt_request".
