import "./loadEnv.js";
import http from "node:http";
import path from "path";
import { pathToFileURL } from "url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { initDb } from "./db.js";
import routes from "./Routes/index.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { attachLiveSocket } from "./liveSocket.js";

export async function createApp() {
  await initDb();
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", routes);
  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const app = await createApp();
  const port = Number(process.env.PORT || 4000);
  const server = http.createServer(app);
  attachLiveSocket(server);
  server.listen(port, () => {
    console.log(`Mesob API listening on ${port}`);
  });
}



