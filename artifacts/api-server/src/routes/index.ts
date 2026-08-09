import { Router, type IRouter } from "express";
import healthRouter from "./health";
import portfolioRouter from "./portfolio";
import scraperRouter from "./scraper";
import verdictsRouter from "./verdicts";
import { requireAuth } from "../lib/supabaseAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(portfolioRouter);
router.use(scraperRouter);
router.use(verdictsRouter);

export default router;
