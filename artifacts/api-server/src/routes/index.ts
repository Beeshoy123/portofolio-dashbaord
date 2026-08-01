import { Router, type IRouter } from "express";
import healthRouter from "./health";
import portfolioRouter from "./portfolio";
import scraperRouter from "./scraper";

const router: IRouter = Router();

router.use(healthRouter);
router.use(portfolioRouter);
router.use(scraperRouter);

export default router;
