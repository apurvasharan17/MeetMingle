import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";

import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";

const app = express();
const server = createServer(app);

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.set("port", process.env.PORT || 8000);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = curl, health checks, mobile apps
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1/users", userRoutes);

// Central error handler — keeps stack traces off the wire
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: "Internal server error" });
});

const start = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("MONGO_URI is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  try {
    const connectionDb = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${connectionDb.connection.host}`);
  } catch (e) {
    console.error("Failed to connect to MongoDB:", e.message);
    process.exit(1);
  }

  connectToSocket(server, allowedOrigins);

  server.listen(app.get("port"), () => {
    console.log(`Listening on port ${app.get("port")}`);
  });
};

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));

start();