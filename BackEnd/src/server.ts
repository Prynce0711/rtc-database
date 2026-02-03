import dotenv from "dotenv";
import app from "./app";
import { startUdpBroadcast, stopUdpBroadcast } from "./lib/udpBroadcast";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  startUdpBroadcast();
});

process.on("SIGINT", stopUdpBroadcast);
process.on("SIGTERM", stopUdpBroadcast);
process.on("exit", stopUdpBroadcast);
