import { toNodeHandler } from "better-auth/node";
import express from "express";
import { auth } from "./lib/auth";
import { prisma } from "./lib/prisma";

const app = express();

app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/cases", async (_req, res) => {
  const data = await prisma.case.findMany();

  res.json(data);
});

app.post("/cases", async (req, res) => {});

export default app;
