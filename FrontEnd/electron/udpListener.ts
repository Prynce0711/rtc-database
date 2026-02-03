import { UdpData } from "@rtc-database/shared/src";
import { BackendInfo } from "@rtc-database/shared/src/UdpData.js";
import dgram from "dgram";
import { BrowserWindow } from "electron";

const UDP_PORT = 41234;

let socket: dgram.Socket | null = null;

export function startUdpListener(mainWindow: BrowserWindow) {
  if (socket) return;

  console.log("🚀 Starting UDP listener...");

  socket = dgram.createSocket("udp4");

  socket.on("listening", () => {
    const addr = socket!.address();
    console.log(`📡 UDP listening on ${addr.address}:${addr.port}`);
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

  socket.bind(UDP_PORT, () => {
    socket!.setBroadcast(true);
  });
}

export function stopUdpListener() {
  socket?.close();
  socket = null;
}
