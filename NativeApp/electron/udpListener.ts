import { BackendInfo, UdpData } from "@rtc-database/shared";
import dgram from "dgram";
import { BrowserWindow } from "electron";

const UDP_PORT = 41234;
const MULTICAST_ADDR = "239.255.255.250"; // must match broadcaster

let socket: dgram.Socket | null = null;

export function startUdpListener(mainWindow: BrowserWindow) {
  if (socket) return;

  console.log("🚀 Starting UDP listener (multicast)...");

  // reuseAddr helps if multiple listeners exist on the same host
  socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("listening", () => {
    try {
      // Enable loopback for same-machine testing
      socket!.setMulticastLoopback(true);
      // Join multicast group on all interfaces
      socket!.addMembership(MULTICAST_ADDR);
      console.log(`✅ Joined multicast group ${MULTICAST_ADDR}`);
    } catch (err) {
      console.error("Failed to join multicast group:", err);
    }

    const addr = socket!.address();
    console.log(
      `📡 UDP multicast listening on ${addr.address}:${addr.port} (group ${MULTICAST_ADDR})`,
    );
  });

  socket.on("message", (msg, rinfo) => {
    try {
      const payload = UdpData.parse(JSON.parse(msg.toString()));

      const backend: BackendInfo = {
        url: `http://${rinfo.address}:${payload.port}`,
        ip: rinfo.address,
        port: payload.port,
        lastSeen: Date.now(),
      };

      // 🔁 Forward to renderer
      console.log(
        `📨 Received UDP from ${rinfo.address}:${payload.port} - forwarding to renderer`,
      );
      mainWindow.webContents.send("udp:backend", backend);
    } catch (err) {
      console.warn("Invalid UDP packet:", err);
    }
  });

  socket.on("error", (err) => {
    console.error("UDP socket error:", err);
    socket?.close();
    socket = null;
  });

  // Bind to 0.0.0.0 to receive multicast on all interfaces
  socket.bind(UDP_PORT, "0.0.0.0", () => {
    console.log(
      `📥 Bound UDP socket to 0.0.0.0:${UDP_PORT}, will join multicast group ${MULTICAST_ADDR}`,
    );
  });
}

export function stopUdpListener() {
  socket?.close();
  socket = null;
}
