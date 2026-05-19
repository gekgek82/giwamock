import { io, type Socket } from "socket.io-client";
import { PAIR_OHLCV_EVENT } from "@giwater/shared";
import { gatewayEventBus$ } from "@/lib/gatewayEventBus";

let socket: Socket | null = null;
const subscribedChannels = new Set<string>();

export async function initGatewaySocket(): Promise<void> {
  if (socket !== null || typeof window === "undefined") return;

  const res = await fetch("/api/config");
  const { gatewaySocketUrl } = (await res.json()) as { gatewaySocketUrl: string };
  if (!gatewaySocketUrl) return;

  socket = io(gatewaySocketUrl, {
    transports: ["polling", "websocket"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    if (subscribedChannels.size > 0) {
      socket!.emit("channels.subscribe", { channels: [...subscribedChannels] });
    }
  });

  socket.on(PAIR_OHLCV_EVENT, (data: unknown) => {
    gatewayEventBus$.next({ channel: "pair", event: PAIR_OHLCV_EVENT, data });
  });
}

export function subscribeChannel(channel: string): void {
  if (subscribedChannels.has(channel)) return;
  subscribedChannels.add(channel);
  if (socket?.connected) {
    socket.emit("channels.subscribe", { channels: [channel] });
  }
}

export function unsubscribeChannel(channel: string): void {
  if (!subscribedChannels.has(channel)) return;
  subscribedChannels.delete(channel);
  if (socket?.connected) {
    socket.emit("channels.unsubscribe", { channels: [channel] });
  }
}
