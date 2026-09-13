import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vocabularyRouter from "./vocabulary";
import reviewRouter from "./review";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vocabularyRouter);
router.use(reviewRouter);
router.use(dashboardRouter);
router.use(aiRouter);

export default router;
