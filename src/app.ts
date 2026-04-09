import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { readFileSync } from "fs";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

const docsPath = path.join(__dirname, "../docs/openapi.yaml");
const swaggerDocument = YAML.parse(readFileSync(docsPath, "utf-8"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api/v1", routes);

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

app.use(errorHandler);

export default app;
