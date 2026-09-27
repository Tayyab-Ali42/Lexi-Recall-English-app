/**
 * One-time utility: reset a user's password directly in the database.
 * Use this when there's no password-reset email flow set up yet.
 *
 * Usage (run where DATABASE_URL points at the target database):
 *   pnpm --filter @workspace/scripts run reset-password -- your@email.com NewPassword123
 */
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, pool, usersTable } from "@workspace/db";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error("Usage: pnpm --filter @workspace/scripts run reset-password -- your@email.com NewPassword123");
    process.exitCode = 1;
    return;
  }
  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));

  console.log(`Password updated for ${email}. Log in with the new password now.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
