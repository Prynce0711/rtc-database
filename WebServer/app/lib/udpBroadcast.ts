import dgram from "dgram";

const UDP_PORT = Number(process.env.UDP_PORT) || 41234;
const MULTICAST_ADDR = "239.255.255.250"; // must match listener
const INTERVAL_MS = 5000;

let socket: dgram.Socket | null = null;
let interval: NodeJS.Timeout | null = null;

export function startUdpBroadcast() {
  if (socket) return; // prevent double-start

  socket = dgram.createSocket("udp4");

  socket.bind(() => {
    socket!.setBroadcast(false);
    socket!.setMulticastTTL(128);
    socket!.setMulticastLoopback(true); // Allow same-machine testing

    // Add multicast interface (optional but helps with routing)
    try {
      socket!.setMulticastInterface("0.0.0.0");
    } catch (err) {
      console.warn("Could not set multicast interface:", err);
    }

    interval = setInterval(() => {
      const payload = {
        service: "rtc-backend",
        port: Number(process.env.PORT) || 3000,
        timestamp: Date.now(),
      };

      const message = Buffer.from(JSON.stringify(payload));

      socket!.send(message, UDP_PORT, MULTICAST_ADDR, (err) => {
        if (err) console.error("UDP multicast error:", err);
      });
    }, INTERVAL_MS);

    console.log("✅ UDP multicast started (every 5 seconds)");
  });
}

export function stopUdpBroadcast() {
  if (interval) clearInterval(interval);
  interval = null;

  if (socket) socket.close();
  socket = null;

  console.log("🛑 UDP multicast stopped");
}
