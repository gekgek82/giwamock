/**
 * Throw this from aggregation code when the write can be safely retried
 * because its prerequisites may not be applied yet (e.g. dependent edge
 * row not present due to out-of-order consumer execution).
 *
 * RabbitMQ consumer will requeue once when `msg.fields.redelivered` is false.
 */
export class RetryableAggregationError extends Error {
  public readonly retryable = true;

  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
  }
}

