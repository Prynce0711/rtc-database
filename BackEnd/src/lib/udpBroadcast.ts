import dgram from "dgram";

const UDP_PORT = Number(process.env.UDP_PORT) || 41234;
const BROADCAST_ADDR = "255.255.255.255";
const INTERVAL_MS = 5000;

let socket: dgram.Socket | null = null;
let interval: NodeJS.Timeout | null = null;

export function startUdpBroadcast() {
  if (socket) return; // prevent double-start

  socket = dgram.createSocket("udp4");

  socket.bind(() => {
    socket!.setBroadcast(true);

    interval = setInterval(() => {
      const payload = {
        service: "rtc-backend",
        port: Number(process.env.PORT) || 3000,
        timestamp: Date.now(),
      };

      const message = Buffer.from(JSON.stringify(payload));

      socket!.send(message, UDP_PORT, BROADCAST_ADDR, (err) => {
        if (err) console.error("UDP broadcast error:", err);
      });
    }, INTERVAL_MS);

    console.log("✅ UDP broadcast started (every 5 seconds)");
  });
}

export function stopUdpBroadcast() {
  if (interval) clearInterval(interval);
  interval = null;

  if (socket) socket.close();
  socket = null;

  console.log("🛑 UDP broadcast stopped");
}
