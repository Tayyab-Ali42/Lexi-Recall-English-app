/**
 * One-time utility: assign every vocabulary word and review event in the
 * database to a single account, identified by email. Useful for
 * consolidating legacy or accidentally-scattered data onto one account.
 *
 * Usage (run where DATABASE_URL points at the target database):
 *   pnpm --filter @workspace/scripts run claim-vocabulary -- your@email.com
 */
import { eq } from "drizzle-orm";
import { db, pool, reviewEventsTable, usersTable, vocabularyTable } from "@workspace/db";

async function main() {
  const email = process.argv.slice(2).filter((arg) => arg !== "--")[0]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm --filter @workspace/scripts run claim-vocabulary -- your@email.com");
    process.exitCode = 1;
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    console.error(`No account found for ${email}. Sign up with that email first, then re-run this script.`);
    process.exitCode = 1;
    return;
  }

  const vocabResult = await db.update(vocabularyTable).set({ userId: user.id }).returning({ id: vocabularyTable.id });
  const reviewResult = await db.update(reviewEventsTable).set({ userId: user.id }).returning({ id: reviewEventsTable.id });

  console.log(`Assigned ${vocabResult.length} vocabulary word(s) and ${reviewResult.length} review event(s) to ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
