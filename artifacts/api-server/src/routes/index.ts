import { Router, type IRouter } from "express";
import healthRouter from "./health";
import portfolioRouter from "./portfolio";
import scraperRouter from "./scraper";
import verdictsRouter from "./verdicts";
import advisorRouter from "./advisor";
import alertsRouter from "./alerts";
import aiBotRouter from "./aiBot";
import technicalRouter from "./technical";
import { requireAuth } from "../lib/supabaseAuth";

// The AI bot is one coordinated pipeline across these route groups:
// scraper -> comparison judge -> advisor, with alerts consuming the same
// verdict and portfolio history. Keep shared auth, data contracts, and run
// state consistent so the engines interact instead of acting independently.
const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(portfolioRouter);
router.use(scraperRouter);
router.use(verdictsRouter);
router.use("/advisor", advisorRouter);
router.use("/alerts", alertsRouter);
router.use(aiBotRouter);
router.use(technicalRouter);

export default router;
