import express from "express";
import { prisma } from "./lib/prisma";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/cases", async (_req, res) => {
  const data = await prisma.case.findMany();
  console.log("Fetched cases:", data);

  res.json(data);
});

export default app;
