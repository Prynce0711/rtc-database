import { createServer } from "http";
import next from "next";
import { startUdpBroadcast } from "./app/lib/udpBroadcast";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  startUdpBroadcast();

  createServer((req, res) => {
    handle(req, res);
  }).listen(port);
});

console.log(
  `> Server listening at http://localhost:${port} as ${
    dev ? "development" : process.env.NODE_ENV
  }`,
);
