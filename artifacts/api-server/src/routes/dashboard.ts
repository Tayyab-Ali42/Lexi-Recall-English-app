import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, reviewEventsTable, vocabularyTable } from "@workspace/db";
import { GetDashboardResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function startOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function calculateStreak(dates: Date[]) {
  const reviewedDays = new Set(
    dates.map((date) => startOfDay(date).toISOString().slice(0, 10)),
  );
  const cursor = startOfDay();
  if (
    !reviewedDays.has(cursor.toISOString().slice(0, 10)) &&
    reviewedDays.size > 0
  ) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (reviewedDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [items, events] = await Promise.all([
    db.select().from(vocabularyTable),
    db
      .select({ reviewedAt: reviewEventsTable.reviewedAt })
      .from(reviewEventsTable)
      .orderBy(desc(reviewEventsTable.reviewedAt)),
  ]);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const typeCounts: Record<string, number> = {};
  for (const item of items) {
    typeCounts[item.type] = (typeCounts[item.type] ?? 0) + 1;
  }

  const response = {
    total: items.length,
    dueToday: items.filter((item) => item.dueAt <= todayEnd).length,
    mastered: items.filter(
      (item) => item.repetitions >= 3 || item.intervalDays >= 21,
    ).length,
    learning: items.filter(
      (item) => item.repetitions < 3 && item.intervalDays < 21,
    ).length,
    streak: calculateStreak(events.map((event) => event.reviewedAt)),
    reviewedToday: events.filter((event) => event.reviewedAt >= todayStart).length,
    typeCounts,
  };

  res.json(GetDashboardResponse.parse(response));
});

export default router;