/**
 * One-time utility: bulk-insert a curated set of vocabulary words for a
 * given account by email. Used for importing structured vocabulary sheets
 * (term + Urdu meaning + definition + part of speech + recall questions)
 * that are already fully curated, where the generic PDF-extraction import
 * (which guesses at word frequency in raw text) would lose information.
 *
 * Usage (run where DATABASE_URL points at the target database):
 *   pnpm --filter @workspace/scripts run seed-vocabulary -- your@email.com
 *
 * Existing words with the same term (case-insensitive) for that account
 * are skipped, so this is safe to re-run.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, vocabularyTable } from "@workspace/db";

type SeedWord = {
  term: string;
  type: "word" | "phrase" | "idiom" | "phrasal_verb";
  meaning: string;
  urduMeaning: string;
  partOfSpeech: string;
  example: string;
  retrievalQuestions: string[];
  tags: string[];
};

const WORDS: SeedWord[] = [
  { term: "Rocking with", type: "phrasal_verb", meaning: "Being with or strongly supporting someone or something.", urduMeaning: "کسی کے ساتھ بہت اچھا وقت گزارنا / کسی چیز کے ساتھ", partOfSpeech: "Phrasal/verb phrase", example: "I've been rocking with this new album all week.", retrievalQuestions: ["You really like a new song. What casual phrase could you use?", "Your friend suggests an idea and you strongly support it. What could you say?", "You're enjoying yourself with your friends. What phrase might describe this?"], tags: ["scenario-review"] },
  { term: "Stalling", type: "word", meaning: "Delaying something, often because you don't want to do it or aren't ready.", urduMeaning: "ٹال مٹول کرنا / جان بوجھ کر تاخیر کرنا", partOfSpeech: "Verb", example: "Stop stalling and just send the email already.", retrievalQuestions: ["Someone keeps making excuses instead of answering. What are they doing?", "You keep saying, \"I'll start tomorrow,\" instead of starting today. What are you doing?", "Someone deliberately delays a decision. What word describes this?"], tags: ["scenario-review"] },
  { term: "Done for you", type: "phrase", meaning: "Something has been completed on your behalf.", urduMeaning: "تمہارے لیے کام کیا جا چکا ہے / پہلے ہی کیا جا چکا ہے", partOfSpeech: "Phrase", example: "Don't worry about the paperwork, it's already done for you.", retrievalQuestions: ["You don't have to do the work because someone already completed it. What could you say?", "A service does everything for you. How would you describe it?", "Your friend says, \"I already finished it.\" What phrase fits?"], tags: ["scenario-review"] },
  { term: "Acquisition", type: "word", meaning: "The act of obtaining something; in business, buying another company.", urduMeaning: "حصول / کسی کمپنی کو خرید کر اپنے قبضے میں لینا", partOfSpeech: "Noun", example: "The tech giant announced the acquisition of a small AI startup.", retrievalQuestions: ["One company buys another and takes control. What is this called?", "You obtain something you wanted. What noun describes the process?", "A large company purchases a smaller company. What business term fits?"], tags: ["scenario-review"] },
  { term: "Funnel", type: "word", meaning: "A process that gradually reduces many potential customers into fewer actual customers.", urduMeaning: "قیف؛ مرحلہ وار نظام جس میں بہت سے لوگوں میں سے کچھ آخر تک پہنچتے ہیں", partOfSpeech: "Noun", example: "Our marketing funnel converts about two percent of visitors into paying customers.", retrievalQuestions: ["10,000 people see an ad but only 10 buy. What do marketers call this process?", "A business tracks customers from first seeing an ad to purchase. What is this system?", "Many potential customers enter, but only a few become buyers. What concept is this?"], tags: ["scenario-review"] },
  { term: "Resource", type: "word", meaning: "Something useful that can be used to achieve a goal.", urduMeaning: "وسیلہ / ذریعہ / وسائل", partOfSpeech: "Noun", example: "Time is often our most limited resource.", retrievalQuestions: ["You need money, time, people, or tools for a project. What can you call these?", "A website gives you useful learning material. What could you call it?", "A company needs people and money to grow. What general word describes these?"], tags: ["scenario-review"] },
  { term: "Human psychology", type: "phrase", meaning: "The study or understanding of how people think, feel, behave, and make decisions.", urduMeaning: "انسانی نفسیات", partOfSpeech: "Noun phrase", example: "Understanding human psychology helps marketers craft better ads.", retrievalQuestions: ["You want to understand why people behave in certain ways. What are you studying?", "A marketer studies why people buy things. What are they studying?", "Someone wants to understand thoughts, emotions, and behavior. What phrase fits?"], tags: ["scenario-review"] },
  { term: "Intuition", type: "word", meaning: "A feeling or understanding that something is true without consciously reasoning it out.", urduMeaning: "وجدان / دل کی آواز / اندرونی احساس", partOfSpeech: "Noun", example: "Her intuition told her something was wrong before she saw the numbers.", retrievalQuestions: ["Something inside tells you not to trust someone, without evidence. What is that feeling?", "You suddenly know an answer without knowing how. What is that?", "Your gut tells you a decision is wrong. What word describes this?"], tags: ["scenario-review"] },
  { term: "Hype", type: "word", meaning: "A lot of excitement or publicity created around something.", urduMeaning: "حد سے زیادہ تشہیر / جوش و خروش", partOfSpeech: "Noun / Verb", example: "There's so much hype around the new phone launch this year.", retrievalQuestions: ["Everyone is talking about a new product because of huge publicity. What is this excitement?", "A company creates enormous excitement before launch. What word describes it?", "Something is promoted everywhere, making people excited. What is happening?"], tags: ["scenario-review"] },
  { term: "Fragmentation", type: "word", meaning: "The process of something becoming divided into many smaller parts or groups.", urduMeaning: "ٹکڑے ٹکڑے ہونا / تقسیم ہو جانا", partOfSpeech: "Noun", example: "The fragmentation of the market made it harder to reach a single audience.", retrievalQuestions: ["One large market becomes many smaller markets. What is this process?", "A group splits into several smaller groups. What word describes this?", "People spread across many platforms instead of one. What could you call this?"], tags: ["scenario-review"] },
  { term: "On the flip side", type: "idiom", meaning: "Looking at the opposite or contrasting side of a situation.", urduMeaning: "دوسری طرف / اس کے برعکس", partOfSpeech: "Idiomatic phrase", example: "The job pays well; on the flip side, the hours are brutal.", retrievalQuestions: ["You mention an advantage and now want to discuss the disadvantage. What phrase can you use?", "A job pays well but requires long hours. How can you introduce the negative side?", "You've explained one side and want to discuss the other. What phrase fits?"], tags: ["scenario-review"] },
  { term: "Alluding", type: "word", meaning: "Referring to something indirectly without clearly mentioning it.", urduMeaning: "اشارہ کرنا / بالواسطہ ذکر کرنا", partOfSpeech: "Verb", example: "He kept alluding to a secret project without giving any details.", retrievalQuestions: ["You don't directly mention someone's mistake but subtly refer to it. What are you doing?", "Someone talks about \"what happened last year\" without explaining. What could they be doing?", "You indirectly refer to something without naming it. What verb describes this?"], tags: ["scenario-review"] },
  { term: "Scenario", type: "word", meaning: "A possible or imagined situation or sequence of events.", urduMeaning: "صورتحال / منظرنامہ", partOfSpeech: "Noun", example: "Let's walk through a scenario where sales drop by twenty percent.", retrievalQuestions: ["You imagine what might happen if you start a business. What do you call this?", "Someone asks what you'd do if you lost your job. What kind of situation is this?", "A teacher gives you an imaginary situation to discuss. What is it called?"], tags: ["scenario-review"] },
  { term: "Coming out", type: "phrasal_verb", meaning: "Becoming publicly known, being released, or emerging from somewhere, depending on context.", urduMeaning: "سامنے آنا / ظاہر ہونا / باہر آنا", partOfSpeech: "Phrasal verb / gerund phrase", example: "A new documentary about the band is coming out next month.", retrievalQuestions: ["A new movie will be released next month. What phrase can you use?", "New information becomes publicly known. What can you say?", "Someone leaves a building and comes outside. What phrase could describe this?"], tags: ["scenario-review"] },
  { term: "Buzz saw", type: "word", meaning: "A power saw with a rotating circular blade used for cutting materials.", urduMeaning: "گول تیز دھار آری", partOfSpeech: "Noun", example: "He cut the plank quickly with a buzz saw.", retrievalQuestions: ["A machine has a rapidly rotating circular blade for cutting wood. What is it?", "You hear a loud saw with a spinning circular blade. What tool is it?", "What type of saw uses a circular rotating blade?"], tags: ["scenario-review"] },
  { term: "Catch up", type: "phrasal_verb", meaning: "To reach the same level as someone or something, or learn what you missed.", urduMeaning: "برابر پہنچنا / پیچھے رہ جانے کے بعد برابر آنا / معلومات حاصل کرنا", partOfSpeech: "Phrasal verb", example: "I need to catch up on the lectures I missed last week.", retrievalQuestions: ["Your classmates are ahead because you missed a week. What do you need to do?", "You haven't talked to a friend for six months and want to hear everything. What do you want to do?", "You missed several lessons and need to study them. What phrase fits?"], tags: ["scenario-review"] },
  { term: "Battles of the titans", type: "idiom", meaning: "A major competition or conflict between two extremely powerful opponents.", urduMeaning: "دو بہت بڑی طاقتوں کا مقابلہ", partOfSpeech: "Idiomatic noun phrase", example: "The championship final was a true battle of the titans.", retrievalQuestions: ["Two huge companies compete directly. How could you describe this?", "Two world-class athletes face each other in a major competition. What phrase fits?", "Two extremely powerful competitors go head-to-head. What expression fits?"], tags: ["scenario-review"] },
  { term: "Scoops", type: "word", meaning: "Exclusive news or information obtained and reported before others.", urduMeaning: "خصوصی خبر / سب سے پہلے حاصل کی گئی خبر", partOfSpeech: "Noun", example: "The local reporter landed one of the biggest scoops of the year.", retrievalQuestions: ["A journalist gets important information before everyone else. What might they have?", "A reporter publishes a major story first. What can you call that story?", "A news organization gets exclusive information first. What word describes it?"], tags: ["scenario-review"] },
  { term: "Long tail", type: "phrase", meaning: "A business concept where many less-popular products collectively create significant sales or value.", urduMeaning: "لمبی دم؛ بہت سے کم مقبول چیزوں کی مجموعی مارکیٹ", partOfSpeech: "Noun phrase", example: "The bookstore's profit comes mostly from the long tail of rare titles.", retrievalQuestions: ["A website sells thousands of niche products that together make significant revenue. What concept is this?", "A company makes money from many niche products rather than only popular ones. What is this called?", "Many small markets collectively become valuable. What concept fits?"], tags: ["scenario-review"] },
  { term: "Capitalism", type: "word", meaning: "An economic system involving substantial private ownership and markets, with profit playing a major role.", urduMeaning: "سرمایہ داری", partOfSpeech: "Noun", example: "Capitalism relies on competition to drive innovation.", retrievalQuestions: ["Businesses are privately owned and compete for profit. What economic system is this?", "A person starts a private company and owns its profits. What system is commonly associated with this?", "An economy relies heavily on private ownership and market competition. What is this called?"], tags: ["scenario-review"] },
  { term: "Socialism", type: "word", meaning: "A broad family of ideas emphasizing social or collective ownership/control of resources and greater economic equality.", urduMeaning: "اشتراکیت / سوشلزم", partOfSpeech: "Noun", example: "The debate over socialism versus free markets dominated the election.", retrievalQuestions: ["An economic system emphasizes collective or social control of important resources. What broad concept might this describe?", "Someone argues essential resources should be controlled for broader social benefit. What tradition might they mean?", "An economic system emphasizes greater equality and collective ownership. What word comes to mind?"], tags: ["scenario-review"] },
  { term: "Subsidize", type: "word", meaning: "To financially support something, often so its cost can be reduced or its activity can continue.", urduMeaning: "مالی امداد دینا / قیمت کم رکھنے کے لیے مالی مدد کرنا", partOfSpeech: "Verb", example: "The government decided to subsidize electric vehicles to lower their price.", retrievalQuestions: ["A government gives farmers financial support. What is the government doing?", "A service would be too expensive without financial support. What verb fits?", "A government financially supports a product or service. What do we call this?"], tags: ["scenario-review"] },
  { term: "Deplete", type: "word", meaning: "To use up most or all of something, especially a resource.", urduMeaning: "ختم کر دینا / بہت کم کر دینا", partOfSpeech: "Verb", example: "Years of overfishing began to deplete the local fish population.", retrievalQuestions: ["You spend your savings until almost nothing is left. What have you done to them?", "A country uses so much water that its supply becomes very low. What verb describes this?", "You use up most of a limited resource. What word would you use?"], tags: ["scenario-review"] },
];

async function main() {
  const email = process.argv.slice(2).filter((arg) => arg !== "--")[0]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm --filter @workspace/scripts run seed-vocabulary -- your@email.com");
    process.exitCode = 1;
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    console.error(`No account found for ${email}. Sign up with that email first, then re-run this script.`);
    process.exitCode = 1;
    return;
  }

  const existing = await db.select({ term: vocabularyTable.term }).from(vocabularyTable).where(eq(vocabularyTable.userId, user.id));
  const existingTerms = new Set(existing.map((item) => item.term.toLowerCase()));

  let added = 0;
  let skipped = 0;
  for (const word of WORDS) {
    if (existingTerms.has(word.term.toLowerCase())) {
      skipped += 1;
      continue;
    }
    await db.insert(vocabularyTable).values({
      id: randomUUID(),
      userId: user.id,
      term: word.term,
      type: word.type,
      meaning: word.meaning,
      urduMeaning: word.urduMeaning,
      partOfSpeech: word.partOfSpeech,
      example: word.example,
      tags: word.tags,
      retrievalQuestions: word.retrievalQuestions,
      source: "manual",
    });
    added += 1;
  }

  console.log(`Added ${added} word(s) to ${email}. Skipped ${skipped} already-saved word(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
