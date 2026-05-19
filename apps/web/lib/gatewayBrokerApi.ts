import type {
  ActiveBanner,
  ReferralCodeResponse,
  ReferralClaimRequest,
  ReferralClaimResponse,
} from "@giwater/shared";
import type {
  ContractAddresses,
  CreateSpotGroupDto,
  AddTokenToSpotGroupDto,
  AddPairToSpotGroupDto,
  SpotGroupTokenMembersPageDto,
  SpotGroupPairMemberDto,
  SpotGroupPairMembersPageDto,
  SpotPairRecordDto,
  SpotPairLeaderboardPageDto,
  SpotTokenRecordDto,
  SpotTokenLeaderboardPageDto,
  SpotTokensBySymbolResponseDto,
  TokenInfo,
  TokenSearchResponse,
  GetProtocolContractsResponseDto,
  SwapRouteResponseDto,
} from "@giwater/shared";
import { apiFetch, buildQuery, type ApiClientConfig } from "@/lib/apiClient";
import {
  BROKER_ADMIN_PROXY_BASE,
  GATEWAY_HTTP_URL,
  isGatewayConfigured,
} from "@/lib/config";

export class GatewayBrokerApiError extends Error {
  public statusCode?: number;
  public errorCode?: string;
  public endpoint?: string;

  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    endpoint?: string,
  ) {
    super(message);
    this.name = "GatewayBrokerApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.endpoint = endpoint;
  }
}

const config: ApiClientConfig = {
  baseUrl: GATEWAY_HTTP_URL,
  createError: (message, statusCode, errorCode, endpoint) =>
    new GatewayBrokerApiError(message, statusCode, errorCode, endpoint),
  isOwnError: (e) => e instanceof GatewayBrokerApiError,
  networkErrorLabel: "gateway",
};

const adminBrokerConfig: ApiClientConfig = {
  baseUrl: BROKER_ADMIN_PROXY_BASE,
  createError: (message, statusCode, errorCode, endpoint) =>
    new GatewayBrokerApiError(message, statusCode, errorCode, endpoint),
  isOwnError: (e) => e instanceof GatewayBrokerApiError,
  networkErrorLabel: "admin broker",
};

function tokenRowToTokenInfo(row: SpotTokenRecordDto): TokenInfo {
  return {
    address: row.id,
    symbol: row.symbol,
    name: row.name,
    decimals: row.decimals,
    iconUrl: row.logoURI || null,
    isWhitelisted: row.listed,
  };
}

function looksLikeAddress(q: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(q);
}

async function fetchJson<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(config, endpoint);
}

async function postJson<T>(endpoint: string, body: unknown): Promise<T> {
  return apiFetch<T>(config, endpoint, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function adminFetchJson<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(adminBrokerConfig, endpoint);
}

async function adminPostJson<T>(endpoint: string, body: unknown): Promise<T> {
  return apiFetch<T>(adminBrokerConfig, endpoint, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export const gatewayBrokerApi = {
  isConfigured(): boolean {
    return isGatewayConfigured();
  },

  /**
   * Contract addresses + token catalog for the app, fetched via the gateway.
   * This replaces the direct Indexer `/contracts` call in `useContractAddresses`.
   */
  async getContractAddresses(): Promise<ContractAddresses> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }

    // Gateway parity routes are mounted at the origin root (not under `/api/v1/broker/*`).
    const contractsDto =
      await fetchJson<GetProtocolContractsResponseDto>("/contracts");

    // The swap UI needs a token catalog. Today, we source it from the broker's
    // materialized `spot_tokens` read model via gateway parity routes.
    //
    // Note: `listed=true` means curated/visible catalog; unlisted tokens are still
    // present in broker DB but intentionally not shown in the public token picker.
    const tokensPage = await this.listSpotTokensRecentlyCreated({
      offset: 0,
      limit: 500,
      listed: true,
    });
    const tokens = (tokensPage.items ?? []).map(tokenRowToTokenInfo);

    const nowIso = new Date().toISOString();
    const out: ContractAddresses = {
      // Broker/contracts does not expose chainId; callers that need it should
      // source from another config. For now, default to 0 to satisfy the type.
      chainId: 0,
      contracts: contractsDto.contracts as ContractAddresses["contracts"],
      tokens,
      // Simple default: first few curated tokens (UI can override).
      popularTokens: tokens.slice(0, 10),
      updatedAt: nowIso,
    };
    return out;
  },

  async getSwapRoute(args: {
    from: string;
    to: string;
    amountInWei?: string;
  }): Promise<SwapRouteResponseDto> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }
    return fetchJson<SwapRouteResponseDto>(
      `/swap-routes${buildQuery({
        from: args.from,
        to: args.to,
        amountIn: args.amountInWei,
      })}`,
    );
  },

  async getSwapRouteTx(args: {
    from: string;
    to: string;
    amountInWei: string;
    amountOutMinWei: string;
    recipient: string;
    deadline: string;
    fromIsNative?: boolean;
    toIsNative?: boolean;
  }): Promise<SwapRouteResponseDto> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }
    return fetchJson<SwapRouteResponseDto>(
      `/swap-routes${buildQuery({
        from: args.from,
        to: args.to,
        amountIn: args.amountInWei,
        buildCalldata: true,
        amountOutMin: args.amountOutMinWei,
        recipient: args.recipient,
        deadline: args.deadline,
        fromIsNative: args.fromIsNative ? "true" : undefined,
        toIsNative: args.toIsNative ? "true" : undefined,
      })}`,
    );
  },

  async listSpotTokensRecentlyCreated(args?: {
    offset?: number;
    limit?: number;
    listed?: boolean;
  }): Promise<SpotTokenLeaderboardPageDto> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }
    const offset = args?.offset ?? 0;
    const limit = args?.limit ?? 200;
    const listed = args?.listed ?? true;
    return fetchJson<SpotTokenLeaderboardPageDto>(
      `/spot-tokens/recently-created${buildQuery({
        offset,
        limit,
        listed,
      })}`,
    );
  },

  /**
   * Listed pools from broker materialized `spot_pairs` via gateway parity (`GET /spot-pairs/recently-created`).
   */
  async listSpotPairsRecentlyCreated(args?: {
    offset?: number;
    limit?: number;
    listed?: boolean;
  }): Promise<SpotPairLeaderboardPageDto> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }
    const offset = args?.offset ?? 0;
    const limit = args?.limit ?? 200;
    const listed = args?.listed ?? true;
    return fetchJson<SpotPairLeaderboardPageDto>(
      `/spot-pairs/recently-created${buildQuery({
        offset,
        limit,
        listed,
      })}`,
    );
  },

  /**
   * Same as `listSpotTokensRecentlyCreated`, but fetched from the admin broker origin
   * via the same-origin proxy (`/api/broker-admin/*`) so admin UI reflects mutations immediately.
   */
  async listSpotTokensRecentlyCreatedAdmin(args?: {
    offset?: number;
    limit?: number;
    listed?: boolean;
  }): Promise<SpotTokenLeaderboardPageDto> {
    const offset = args?.offset ?? 0;
    const limit = args?.limit ?? 200;
    const listed = args?.listed ?? true;
    return adminFetchJson<SpotTokenLeaderboardPageDto>(
      `/spot-tokens/recently-created${buildQuery({
        offset,
        limit,
        listed,
      })}`,
    );
  },

  async listSpotPairsRecentlyCreatedAdmin(args?: {
    offset?: number;
    limit?: number;
    listed?: boolean;
  }): Promise<SpotPairLeaderboardPageDto> {
    const offset = args?.offset ?? 0;
    const limit = args?.limit ?? 200;
    const listed = args?.listed ?? true;
    return adminFetchJson<SpotPairLeaderboardPageDto>(
      `/spot-pairs/recently-created${buildQuery({
        offset,
        limit,
        listed,
      })}`,
    );
  },

  async createSpotTokenGroup(body: CreateSpotGroupDto): Promise<unknown> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }
    return adminPostJson<unknown>("/spot-token-groups", body);
  },

  async addTokenToGroup(
    groupId: string,
    body: AddTokenToSpotGroupDto,
  ): Promise<unknown> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }
    return adminPostJson<unknown>(
      `/spot-token-groups/${encodeURIComponent(groupId)}/tokens`,
      body,
    );
  },

  async listGroupTokens(args: {
    groupId: string;
    offset?: number;
    limit?: number;
  }): Promise<SpotGroupTokenMembersPageDto> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }
    return adminFetchJson<SpotGroupTokenMembersPageDto>(
      `/spot-token-groups/${encodeURIComponent(args.groupId)}/tokens${buildQuery({
        offset: args.offset ?? 0,
        limit: args.limit ?? 500,
      })}`,
    );
  },

  async removeTokenFromGroup(args: {
    groupId: string;
    tokenAddress: string;
  }): Promise<void> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }
    await apiFetch<void>(
      adminBrokerConfig,
      `/spot-token-groups/${encodeURIComponent(args.groupId)}/tokens/${args.tokenAddress}`,
      { method: "DELETE" },
    );
  },

  async createSpotPairGroup(body: CreateSpotGroupDto): Promise<unknown> {
    return adminPostJson<unknown>("/spot-pair-groups", body);
  },

  async addPairToGroup(
    groupId: string,
    body: AddPairToSpotGroupDto,
  ): Promise<SpotGroupPairMemberDto> {
    return adminPostJson<SpotGroupPairMemberDto>(
      `/spot-pair-groups/${encodeURIComponent(groupId)}/pairs`,
      body,
    );
  },

  async removePairFromGroup(args: {
    groupId: string;
    pairAddress: string;
  }): Promise<void> {
    await apiFetch<void>(
      adminBrokerConfig,
      `/spot-pair-groups/${encodeURIComponent(args.groupId)}/pairs/${args.pairAddress}`,
      { method: "DELETE" },
    );
  },

  async listGroupPairs(args: {
    groupId: string;
    offset?: number;
    limit?: number;
  }): Promise<SpotGroupPairMembersPageDto> {
    return adminFetchJson<SpotGroupPairMembersPageDto>(
      `/spot-pair-groups/${encodeURIComponent(args.groupId)}/pairs${buildQuery({
        offset: args.offset ?? 0,
        limit: args.limit ?? 500,
      })}`,
    );
  },

  async createSpotToken(args: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  }): Promise<SpotTokenRecordDto> {
    return adminPostJson<SpotTokenRecordDto>('/spot-tokens/create', args);
  },

  async setSpotTokenListing(args: {
    tokenAddress: string;
    listed: boolean;
  }): Promise<SpotTokenRecordDto> {
    return adminPostJson<SpotTokenRecordDto>(
      `/spot-tokens/by-address/${args.tokenAddress}/listing`,
      { listed: args.listed },
    );
  },

  async getSpotPairByAddress(address: string): Promise<SpotPairRecordDto> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }
    return fetchJson<SpotPairRecordDto>(`/spot-pairs/by-address/${address}`);
  },

  async setSpotPairListing(args: {
    pairAddress: string;
    listed: boolean;
  }): Promise<SpotPairRecordDto> {
    return adminPostJson<SpotPairRecordDto>(
      `/spot-pairs/by-address/${args.pairAddress}/listing`,
      { listed: args.listed },
    );
  },

  /**
   * Broker `spot_tokens` rows for a symbol (via same-origin gateway proxy).
   * Used to merge USD prices with indexer data when catalog prices exist on the broker.
   */
  async getSpotTokensBySymbol(
    symbol: string,
    options?: { listed?: boolean },
  ): Promise<SpotTokensBySymbolResponseDto> {
    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }
    const listed = options?.listed ?? true;
    return fetchJson<SpotTokensBySymbolResponseDto>(
      `/spot-tokens/by-symbol/${encodeURIComponent(symbol.trim())}${buildQuery({ listed })}`,
    );
  },

  /**
   * Token search backed by the Gateway's broker parity routes.
   *
   * - If `query` is a full 0x-address: `GET /spot-tokens/by-address/:address`
   * - Otherwise: `GET /spot-tokens/by-symbol/:symbol` (exact/contains depends on broker implementation)
   *
   * This intentionally replaces the Indexer API `/tokens/search?q=...` for the token-select modal.
   */
  async searchTokens(query: string): Promise<TokenSearchResponse> {
    const q = query.trim();
    if (!q) return { tokens: [], total: 0 };

    if (!isGatewayConfigured()) {
      throw new GatewayBrokerApiError(
        "Gateway is not configured (NEXT_PUBLIC_GATEWAY_URL missing)",
      );
    }

    if (looksLikeAddress(q)) {
      try {
        const row = await fetchJson<SpotTokenRecordDto>(
          `/spot-tokens/by-address/${q}${buildQuery({ listed: true })}`,
        );
        const tok = tokenRowToTokenInfo(row);
        return { tokens: [tok], total: 1 };
      } catch (e) {
        if (e instanceof GatewayBrokerApiError && e.statusCode === 404) {
          return { tokens: [], total: 0 };
        }
        throw e;
      }
    }

    const resp = await fetchJson<SpotTokensBySymbolResponseDto>(
      `/spot-tokens/by-symbol/${encodeURIComponent(q)}${buildQuery({ listed: true })}`,
    );
    const tokens = (resp.items ?? []).map(tokenRowToTokenInfo);
    return { tokens, total: tokens.length };
  },
};

export const referralApi = {
  getCode: (address: string): Promise<ReferralCodeResponse> =>
    apiFetch<ReferralCodeResponse>(config, `/referral/code/${encodeURIComponent(address)}`),

  claim: (body: ReferralClaimRequest): Promise<ReferralClaimResponse> =>
    apiFetch<ReferralClaimResponse>(config, '/referral/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
};

export const bannerApi = {
  getActiveBanners: (page: string): Promise<ActiveBanner[]> =>
    apiFetch<ActiveBanner[]>(config, `/banners/${encodeURIComponent(page)}`),

  recordImpression: (id: number): Promise<void> =>
    apiFetch<void>(config, `/banners/${id}/impression`, { method: 'POST' }),

  recordClick: (id: number): Promise<void> =>
    apiFetch<void>(config, `/banners/${id}/click`, { method: 'POST' }),
};

