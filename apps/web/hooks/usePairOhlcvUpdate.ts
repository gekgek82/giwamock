"use client";

import { useEffect, useState } from "react";
import { type PairOhlcvUpdateDto, PAIR_OHLCV_EVENT } from "@giwater/shared";
import { gatewayEventBus$ } from "@/lib/gatewayEventBus";
import { useGatewaySocket } from "@/context/GatewaySocketProvider";

export function usePairOhlcvUpdate(
  pool: string | null | undefined,
): PairOhlcvUpdateDto | null {
  const { subscribePairChannel, unsubscribePairChannel } = useGatewaySocket();
  const [update, setUpdate] = useState<PairOhlcvUpdateDto | null>(null);

  useEffect(() => {
    if (!pool) return;
    subscribePairChannel(pool);

    const sub = gatewayEventBus$.subscribe((ev) => {
      if (ev.event !== PAIR_OHLCV_EVENT) return;
      const dto = ev.data as PairOhlcvUpdateDto;
      if (dto.pool !== pool) return;
      setUpdate(dto);
    });

    return () => {
      sub.unsubscribe();
      unsubscribePairChannel(pool);
    };
  }, [pool, subscribePairChannel, unsubscribePairChannel]);

  return update;
}
