import amqp, { ChannelWrapper } from "amqp-connection-manager";
import type { Channel } from "amqplib";

export type IndexerRabbitPublisherConfig = {
  url: string;
  indexerQueue: string;
  enabled: boolean;
};

let connection: ReturnType<typeof amqp.connect> | undefined;
let channel: ChannelWrapper | undefined;

function sanitizeAmqpUrl(url: string): string {
  // Avoid leaking credentials into logs (Railway logs are shared/team-visible).
  try {
    const u = new URL(url);
    if (u.username || u.password) {
      u.username = "****";
      u.password = "****";
    }
    return u.toString();
  } catch {
    // Fallback: do not attempt to print a potentially credential-bearing string.
    return "<invalid amqp url>";
  }
}

function getConfig(): IndexerRabbitPublisherConfig {
  return {
    url: process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
    indexerQueue: process.env.RABBITMQ_INDEXER_QUEUE ?? "amm-indexer.events",
    enabled: (process.env.RABBITMQ_ENABLED ?? "false").toLowerCase() === "true",
  };
}

function ensureConnected() {
  if (connection && channel) return;

  const cfg = getConfig();
  // Log once on init so ops can confirm what queue/exchange contract is expected.
  console.info(
    `[amm-indexer] RabbitMQ publisher ${
      cfg.enabled ? "ENABLED" : "DISABLED"
    } (queue=${cfg.indexerQueue}, url=${sanitizeAmqpUrl(cfg.url)})`,
  );

  connection = amqp.connect([cfg.url], { reconnectTimeInSeconds: 5 });
  connection.on("connect", () => {
    console.info(
      `[amm-indexer] RabbitMQ connected (${sanitizeAmqpUrl(cfg.url)})`,
    );
  });
  connection.on("disconnect", (err) => {
    console.warn(
      `[amm-indexer] RabbitMQ disconnected: ${err?.err?.message ?? String(err)}`,
    );
  });
  channel = connection.createChannel({
    json: false,
    setup: async (ch: Channel) => {
      await ch.assertQueue(cfg.indexerQueue, { durable: true });
    },
  });
}

const RABBIT_WAIT_CONNECT_MS = Number(
  process.env.RABBITMQ_PUBLISH_CONNECT_TIMEOUT_MS ?? "30000",
);

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} (${ms}ms)`)), ms),
    ),
  ]);
}

export async function publishIndexerEvent(payload: unknown): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg.enabled) return true; // no-op when disabled

  try {
    ensureConnected();
    await withTimeout(
      channel!.waitForConnect(),
      Number.isFinite(RABBIT_WAIT_CONNECT_MS) && RABBIT_WAIT_CONNECT_MS > 0
        ? RABBIT_WAIT_CONNECT_MS
        : 30000,
      "RabbitMQ waitForConnect",
    );

    const ok = channel!.sendToQueue(
      cfg.indexerQueue,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: "application/json" },
    );
    if (!ok) {
      console.warn(
        "[amm-indexer] RabbitMQ sendToQueue returned false (channel backpressure)",
      );
    }
    return ok;
  } catch (err) {
    console.error(
      `[amm-indexer] RabbitMQ publish failed: ${err instanceof Error ? err.message : err}`,
    );
    return false;
  }
}

