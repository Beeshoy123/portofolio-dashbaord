import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startGoldPriceScheduler } from "./lib/goldPriceCache";
import { startUsdEgpScheduler } from "./lib/usdEgpCache";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Start background scrapers. Both run immediately on startup so the
// first /portfolio request already has live data in the in-memory cache.
startGoldPriceScheduler();   // goldbullioneg.com — every 5 min
startUsdEgpScheduler();      // open.er-api.com   — every 30 min

export default app;
