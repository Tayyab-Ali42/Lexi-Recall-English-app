import type { ReviewRating } from "@workspace/api-zod";

type ReviewState = {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
};

export function calculateNextReview(
  state: ReviewState,
  rating: ReviewRating,
  now = new Date(),
) {
  let { intervalDays, easeFactor, repetitions } = state;

  if (rating === "again") {
    intervalDays = 10 / (24 * 60);
    repetitions = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (rating === "hard") {
    intervalDays = Math.max(1, intervalDays * 1.2 || 1);
    repetitions += 1;
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else if (rating === "good") {
    intervalDays =
      repetitions === 0
        ? 1
        : repetitions === 1
          ? 6
          : Math.max(1, intervalDays * easeFactor);
    repetitions += 1;
  } else {
    intervalDays =
      repetitions === 0
        ? 4
        : Math.max(1, intervalDays * easeFactor * 1.3);
    repetitions += 1;
    easeFactor += 0.15;
  }

  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return { intervalDays, easeFactor, repetitions, dueAt, lastReviewedAt: now };
}