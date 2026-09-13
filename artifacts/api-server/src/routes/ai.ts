import { Router, type IRouter } from "express";
import {
  EnrichVocabularyBody,
  EnrichVocabularyResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/ai/enrich", async (req, res): Promise<void> => {
  const parsed = EnrichVocabularyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res
      .status(503)
      .json({ error: "AI meaning lookup is not configured yet." });
    return;
  }

  const { term, type, context } = parsed.data;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert English teacher. Return only valid JSON with keys: term, type, meaning, partOfSpeech, pronunciation, example, translation, tags, memoryHook. Make the explanation useful to a language learner, concise, natural, and specific. pronunciation should use a simple IPA-style spelling when relevant. tags should be 2-4 lowercase study labels. memoryHook can be null.",
        },
        {
          role: "user",
          content: JSON.stringify({
            term,
            type,
            context: context ?? null,
            instruction:
              "Explain this vocabulary item for an English learner. Preserve the requested type and give one natural example sentence.",
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    res.status(502).json({ error: "The AI meaning service returned an error." });
    return;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    res.status(502).json({ error: "The AI meaning service returned no content." });
    return;
  }

  try {
    const enrichment = EnrichVocabularyResponse.parse(JSON.parse(content));
    res.json(enrichment);
  } catch {
    res.status(502).json({ error: "The AI returned an unusable explanation." });
  }
});

export default router;