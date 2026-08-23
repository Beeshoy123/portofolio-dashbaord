import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startGoldPriceScheduler } from "./lib/goldPriceCache";
import { startUsdEgpScheduler } from "./lib/usdEgpCache";
import { startEurEgpScheduler } from "./lib/eurEgpCache";
import { startGlobalGoldScheduler } from "./lib/globalGoldCache";
import { verifyGeminiModel } from "./advisor/generateRecommendation";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);

// Start background scrapers. Both run immediately on startup so the
// first /portfolio request already has live data in the in-memory cache.
startGoldPriceScheduler();    // goldbullioneg.com — every 5 min
startUsdEgpScheduler();       // open.er-api.com USD/EGP — every 30 min
startEurEgpScheduler();       // open.er-api.com EUR/EGP — every 30 min
startGlobalGoldScheduler();   // swissquote XAU/USD — every 5 min

// Verify Gemini model availability at startup (non-blocking warning if invalid)
verifyGeminiModel().catch((err) => {
  logger.warn({ err }, "[Smart Advisor] Model verification threw unexpectedly (proceeding anyway)");
});

export default app;
