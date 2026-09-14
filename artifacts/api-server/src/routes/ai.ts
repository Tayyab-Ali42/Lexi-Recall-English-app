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
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
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
              "You are an expert English teacher. Return only valid JSON with keys: term, type, meaning, partOfSpeech, pronunciation, example, translation, urduMeaning, tags, memoryHook. Make the explanation useful to a language learner, concise, natural, and specific. pronunciation should use a simple IPA-style spelling when relevant. translation can be null. urduMeaning should be a natural Urdu meaning written in Urdu script, or null when unavailable. tags should be 2-4 lowercase study labels. memoryHook can be null.",
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
  } catch (error) {
    console.error("OpenAI enrichment request failed", error);
    res.status(502).json({ error: "The AI meaning service could not be reached." });
    return;
  }

  if (!response.ok) {
    const upstreamBody = await response.text();
    let upstreamMessage = "unknown upstream error";
    try {
      const parsedBody = JSON.parse(upstreamBody) as {
        error?: { message?: string };
      };
      upstreamMessage = parsedBody.error?.message ?? upstreamMessage;
    } catch {
      if (upstreamBody) upstreamMessage = upstreamBody.slice(0, 200);
    }
    console.error(
      `OpenAI enrichment rejected the request (${response.status}): ${upstreamMessage}`,
    );
    if (response.status === 401 || response.status === 403) {
      res.status(502).json({ error: "The configured OpenAI API key was rejected." });
      return;
    }
    if (response.status === 429) {
      res.status(503).json({
        error:
          "OpenAI AI credits are unavailable for this key. Add credits to the OpenAI account or wait for the rate limit to reset.",
      });
      return;
    }
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