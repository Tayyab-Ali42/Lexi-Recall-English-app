import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import vocabularyRouter from "./vocabulary";
import reviewRouter from "./review";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import importRouter from "./import";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth);
router.use(vocabularyRouter);
router.use(reviewRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(importRouter);

export default router;
