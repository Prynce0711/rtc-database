import { validateSession } from "@/app/lib/authActions";
import ClientSocketServer from "@/app/lib/socket/ClientSocketServer";
import { WebSocket, WebSocketServer } from "ws";

export function GET() {
  const headers = new Headers();
  headers.set("Connection", "Upgrade");
  headers.set("Upgrade", "websocket");
  return new Response("Upgrade Required", { status: 426, headers });
}

export async function UPGRADE(client: WebSocket, server: WebSocketServer) {
  console.log("Socket count:", server.clients.size);

  const sessionResult = await validateSession();
  if (!sessionResult.success) {
    return client.close(1008, "Unauthorized");
  }

  new ClientSocketServer(client, server, sessionResult.result);
}
