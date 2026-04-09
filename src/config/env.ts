import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.union([z.string(), z.number()]).default("1d"),
  RATE_LIMIT_MAX_PER_DAY: z.coerce.number().default(10000)
});

const env = envSchema.parse(process.env);

export default env;
