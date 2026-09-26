import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, lte, or } from "drizzle-orm";
import { db, vocabularyTable } from "@workspace/db";
import {
  CreateVocabularyBody,
  CreateVocabularyResponse,
  DeleteVocabularyParams,
  GetVocabularyParams,
  GetVocabularyResponse,
  ListVocabularyQueryParams,
  ListVocabularyResponse,
  UpdateVocabularyBody,
  UpdateVocabularyParams,
  UpdateVocabularyResponse,
} from "@workspace/api-zod";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

function parseId(req: Parameters<Parameters<IRouter["get"]>[1]>[0]) {
  return GetVocabularyParams.safeParse(req.params);
}

router.get("/vocabulary", async (req, res): Promise<void> => {
  const parsed = ListVocabularyQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filters = [eq(vocabularyTable.userId, req.userId!)];
  if (parsed.data.type) filters.push(eq(vocabularyTable.type, parsed.data.type));
  if (parsed.data.search) {
    const search = `%${parsed.data.search}%`;
    filters.push(
      or(
        ilike(vocabularyTable.term, search),
        ilike(vocabularyTable.meaning, search),
        ilike(vocabularyTable.urduMeaning, search),
        ilike(vocabularyTable.example, search),
      )!,
    );
  }

  const items = await db
    .select()
    .from(vocabularyTable)
    .where(and(...filters))
    .orderBy(desc(vocabularyTable.createdAt));
  res.json(ListVocabularyResponse.parse(items));
});

router.post("/vocabulary", async (req, res): Promise<void> => {
  const parsed = CreateVocabularyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db
    .insert(vocabularyTable)
    .values({
      id: randomUUID(),
      ...parsed.data,
      userId: req.userId!,
      tags: parsed.data.tags ?? [],
      retrievalQuestions: parsed.data.retrievalQuestions ?? [],
    })
    .returning();
  res.status(201).json(CreateVocabularyResponse.parse(item));
});

router.get("/vocabulary/:id", async (req, res): Promise<void> => {
  const parsed = parseId(req);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db
    .select()
    .from(vocabularyTable)
    .where(and(eq(vocabularyTable.id, parsed.data.id), eq(vocabularyTable.userId, req.userId!)));
  if (!item) {
    res.status(404).json({ error: "Vocabulary item not found" });
    return;
  }
  res.json(GetVocabularyResponse.parse(item));
});

router.patch("/vocabulary/:id", async (req, res): Promise<void> => {
  const params = UpdateVocabularyParams.safeParse(req.params);
  const body = UpdateVocabularyBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [item] = await db
    .update(vocabularyTable)
    .set(body.data)
    .where(and(eq(vocabularyTable.id, params.data.id), eq(vocabularyTable.userId, req.userId!)))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Vocabulary item not found" });
    return;
  }
  res.json(UpdateVocabularyResponse.parse(item));
});

router.delete("/vocabulary/:id", async (req, res): Promise<void> => {
  const params = DeleteVocabularyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .delete(vocabularyTable)
    .where(and(eq(vocabularyTable.id, params.data.id), eq(vocabularyTable.userId, req.userId!)))
    .returning({ id: vocabularyTable.id });
  if (!item) {
    res.status(404).json({ error: "Vocabulary item not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/review/next", async (req, res): Promise<void> => {
  const [item] = await db
    .select()
    .from(vocabularyTable)
    .where(and(lte(vocabularyTable.dueAt, new Date()), eq(vocabularyTable.userId, req.userId!)))
    .orderBy(asc(vocabularyTable.dueAt))
    .limit(1);
  res.json(item ? GetVocabularyResponse.parse(item) : null);
});

export default router;