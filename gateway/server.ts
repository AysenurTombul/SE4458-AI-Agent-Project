import { config } from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";
import { RateLimiterMemory } from "rate-limiter-flexible";

config();

const app = express();
const target = process.env.TARGET_URL || "http://localhost:4000"; 
const port = Number(process.env.PORT || process.env.GATEWAY_PORT || 8080); 
const queryLimit = Number(process.env.GATEWAY_RATE_LIMIT || 999999);

const limiter = new RateLimiterMemory({
  points: queryLimit,
  duration: 24 * 60 * 60
});

const enforceRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  if (req.path !== "/api/v1/guest/listings") {
    return next();
  }

  try {
    // ÇÖZÜM 1: req.ip tanımsız gelirse diye B planı eklendi
    await limiter.consume(req.ip || "unknown_ip");
    next();
  } catch (error) {
    res.status(429).json({ message: "Daily query limit reached" });
  }
};

app.use(morgan("dev"));
app.use(enforceRateLimit);

app.use(
  "/",
  createProxyMiddleware({
    target,
    changeOrigin: true
    // ÇÖZÜM 2: logLevel satırı silindi
  })
);

app.listen(port, () => {
  console.log(`Gateway listening on port ${port} and proxying to ${target}`);
});