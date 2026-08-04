import { Router, type IRouter } from "express";
import healthRouter from "./health";
import portfolioRouter from "./portfolio";
import scraperRouter from "./scraper";
import verdictsRouter from "./verdicts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(portfolioRouter);
router.use(scraperRouter);
router.use(verdictsRouter);

export default router;
