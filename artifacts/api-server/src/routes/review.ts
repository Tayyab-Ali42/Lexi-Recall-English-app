import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, reviewEventsTable, vocabularyTable } from "@workspace/db";
import {
  GetVocabularyResponse,
  SubmitReviewBody,
  SubmitReviewParams,
  SubmitReviewResponse,
} from "@workspace/api-zod";
import { calculateNextReview } from "../lib/spaced-repetition";

const router: IRouter = Router();

router.post("/review/:id", async (req, res): Promise<void> => {
  const params = SubmitReviewParams.safeParse(req.params);
  const body = SubmitReviewBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(vocabularyTable)
    .where(eq(vocabularyTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Vocabulary item not found" });
    return;
  }

  const next = calculateNextReview(existing, body.data.rating);
  const [updated] = await db
    .update(vocabularyTable)
    .set(next)
    .where(eq(vocabularyTable.id, existing.id))
    .returning();
  await db.insert(reviewEventsTable).values({
    id: randomUUID(),
    vocabularyId: existing.id,
    rating: body.data.rating,
  });

  res.json(SubmitReviewResponse.parse(updated));
});

export default router;