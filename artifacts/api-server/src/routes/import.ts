import { Router, type IRouter } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db, vocabularyTable } from "@workspace/db";
import { STOPWORDS } from "../lib/stopwords";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const router: IRouter = Router();

async function extractText(file: Express.Multer.File): Promise<string> {
  const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
  if (!isPdf) return file.buffer.toString("utf-8");
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(file.buffer);
  return parsed.text;
}

router.post("/import/extract", upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }

  let text: string;
  try {
    text = await extractText(file);
  } catch {
    res.status(400).json({ error: "Could not read that file. Try a PDF or a plain .txt file." });
    return;
  }

  const rawWords = text
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, "").trim())
    .filter((word) => word.length >= 4 && word.length <= 24 && !STOPWORDS.has(word) && !word.includes("--"));

  const counts = new Map<string, number>();
  for (const word of rawWords) counts.set(word, (counts.get(word) ?? 0) + 1);

  const existing = await db
    .select({ term: vocabularyTable.term })
    .from(vocabularyTable)
    .where(eq(vocabularyTable.userId, req.userId!));
  const existingSet = new Set(existing.map((item) => item.term.toLowerCase()));

  const candidates = [...counts.entries()]
    .filter(([word]) => !existingSet.has(word))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 150)
    .map(([word]) => word);

  res.json({ candidates });
});

export default router;
