"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { gatewayBrokerApi } from "@/lib/gatewayBrokerApi";
import toast from "react-hot-toast";
import { Button } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/admin/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui";
import type { SpotTokenRecordDto } from "@giwater/shared";
import { AddTokenToWalletButton } from "@/components/wallet/AddTokenToWalletButton";
import { saveCustomToken, saveCustomTokenInfo } from "@/lib/customTokenStorage";
import { fetchErc20TokenInfo } from "@/lib/fetchErc20TokenInfo";

const POPULAR_GROUP_ID = "giwater_popular";

export default function TokensPage() {
  const [listedTokens, setListedTokens] = useState<SpotTokenRecordDto[]>([]);
  const [unlistedTokens, setUnlistedTokens] = useState<SpotTokenRecordDto[]>([]);
  const [popularSet, setPopularSet] = useState<Set<string>>(new Set());
  const [listedQuery, setListedQuery] = useState("");
  const [unlistedQuery, setUnlistedQuery] = useState("");
  const [registerAddress, setRegisterAddress] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerResult, setRegisterResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [listed, unlisted, popularMembers] = await Promise.all([
        gatewayBrokerApi.listSpotTokensRecentlyCreatedAdmin({
          offset: 0,
          limit: 200,
          listed: true,
        }),
        gatewayBrokerApi.listSpotTokensRecentlyCreatedAdmin({
          offset: 0,
          limit: 200,
          listed: false,
        }),
        gatewayBrokerApi
          .listGroupTokens({ groupId: POPULAR_GROUP_ID, offset: 0, limit: 500 })
          .catch(() => ({ items: [] } as any)),
      ]);

      setListedTokens(listed.items ?? []);
      setUnlistedTokens(unlisted.items ?? []);
      setPopularSet(
        new Set(
          (popularMembers.items ?? []).map((m: any) =>
            String(m.tokenId).toLowerCase(),
          ),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load broker token data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRegisterByAddress = useCallback(async () => {
    const addr = registerAddress.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setRegisterResult({ ok: false, message: "Invalid address format" });
      return;
    }
    setRegisterLoading(true);
    setRegisterResult(null);
    try {
      // Try listing an already-indexed token first
      try {
        const row = await gatewayBrokerApi.setSpotTokenListing({ tokenAddress: addr, listed: true });
        saveCustomToken(row);
        setRegisterResult({ ok: true, message: `Listed: ${row.symbol ?? addr}` });
        setRegisterAddress("");
        await loadAll();
        return;
      } catch {
        // Not in broker yet — fetch ERC20 metadata from chain and create
      }

      const token = await fetchErc20TokenInfo(addr);
      if (!token) {
        setRegisterResult({ ok: false, message: "Address is not a valid ERC20 token on this chain" });
        return;
      }

      const row = await gatewayBrokerApi.createSpotToken({
        address: addr,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
      });
      saveCustomToken(row);
      setRegisterResult({ ok: true, message: `Registered & listed: ${row.symbol}` });
      setRegisterAddress("");
      await loadAll();
    } catch (e) {
      setRegisterResult({ ok: false, message: e instanceof Error ? e.message : "Registration failed" });
    } finally {
      setRegisterLoading(false);
    }
  }, [registerAddress, loadAll]);

  const popularCount = useMemo(() => popularSet.size, [popularSet]);

  const filteredListedTokens = useMemo(() => {
    const q = listedQuery.trim().toLowerCase();
    if (!q) return listedTokens;
    return listedTokens.filter((t) => {
      const id = (t.id ?? "").toLowerCase();
      const sym = (t.symbol ?? "").toLowerCase();
      const name = (t.name ?? "").toLowerCase();
      return id.includes(q) || sym.includes(q) || name.includes(q);
    });
  }, [listedTokens, listedQuery]);

  const filteredUnlistedTokens = useMemo(() => {
    const q = unlistedQuery.trim().toLowerCase();
    if (!q) return unlistedTokens;
    return unlistedTokens.filter((t) => {
      const id = (t.id ?? "").toLowerCase();
      const sym = (t.symbol ?? "").toLowerCase();
      const name = (t.name ?? "").toLowerCase();
      return id.includes(q) || sym.includes(q) || name.includes(q);
    });
  }, [unlistedTokens, unlistedQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">Token Management</h1>
          <p className="text-sm text-ds-gray-700 mt-1">
            Broker token curation (listed/unlisted + popular group)
          </p>
        </div>
        <Button variant="secondary" onClick={loadAll} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 text-ds-red-400">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Listed (recent)</p>
            <p className="text-2xl font-semibold text-ds-gray-1000">{listedTokens.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Unlisted (recent)</p>
            <p className="text-2xl font-semibold text-ds-blue-400">{unlistedTokens.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Popular</p>
            <p className="text-2xl font-semibold text-ds-purple-400">{popularCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Register token by address */}
      <Card>
        <CardContent>
          <div className="mb-4">
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              Broker
            </p>
            <h2 className="text-sm font-semibold text-ds-gray-1000">
              Register token by address
            </h2>
            <p className="text-xs text-ds-gray-700 mt-0.5">
              Lists a token that is already indexed by amm-indexer but not yet visible.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={registerAddress}
              onChange={(e) => { setRegisterAddress(e.target.value); setRegisterResult(null); }}
              placeholder="0x..."
              className="flex-1 px-3 py-2 text-sm font-mono bg-ds-gray-100 border border-ds-gray-300 rounded-md outline-none focus:ring-2 focus:ring-ds-blue-400/40"
            />
            <Button
              variant="primary"
              onClick={handleRegisterByAddress}
              disabled={registerLoading || !registerAddress.trim()}
            >
              {registerLoading ? "Listing..." : "Register & List"}
            </Button>
          </div>
          {registerResult && (
            <p className={`text-xs mt-2 ${registerResult.ok ? "text-ds-green-400" : "text-ds-red-400"}`}>
              {registerResult.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Broker: Recently created (listed) */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Broker
              </p>
              <h2 className="text-sm font-semibold text-ds-gray-1000">
                Recently created (listed)
              </h2>
            </div>
          </div>
          <div className="mb-3">
            <input
              value={listedQuery}
              onChange={(e) => setListedQuery(e.target.value)}
              placeholder="Search by symbol / name / address…"
              className="w-full px-3 py-2 text-sm bg-ds-gray-100 border border-ds-gray-300 rounded-md outline-none focus:ring-2 focus:ring-ds-blue-400/40"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-ds-gray-300 rounded animate-pulse"
                />
              ))}
            </div>
          ) : filteredListedTokens.length === 0 ? (
            <div className="text-sm text-ds-gray-700">
              No listed tokens match your search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Listing date (sec)</TableHead>
                  <TableHead className="text-center">Popular</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredListedTokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.symbol || "-"}</TableCell>
                    <TableCell>{t.name || "-"}</TableCell>
                    <TableCell className="font-geist-mono text-sm text-ds-gray-700">
                      {t.id}
                    </TableCell>
                    <TableCell className="text-right">
                      {Math.floor(t.listingDate ?? 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        className="px-2 py-1 rounded bg-ds-gray-200 hover:bg-ds-gray-300 text-xs"
                        onClick={async () => {
                          const addr = t.id.toLowerCase();
                          const next = !popularSet.has(addr);
                          try {
                            if (next) {
                              try {
                                await gatewayBrokerApi.addTokenToGroup(
                                  POPULAR_GROUP_ID,
                                  { tokenAddress: t.id },
                                );
                              } catch {
                                await gatewayBrokerApi.createSpotTokenGroup({
                                  id: POPULAR_GROUP_ID,
                                  name: "Popular",
                                  description: "Admin-curated popular token list",
                                });
                                await gatewayBrokerApi.addTokenToGroup(
                                  POPULAR_GROUP_ID,
                                  { tokenAddress: t.id },
                                );
                              }
                              setPopularSet((prev) => new Set(prev).add(addr));
                              toast.success("Added to popular");
                            } else {
                              await gatewayBrokerApi.removeTokenFromGroup({
                                groupId: POPULAR_GROUP_ID,
                                tokenAddress: t.id,
                              });
                              setPopularSet((prev) => {
                                const n = new Set(prev);
                                n.delete(addr);
                                return n;
                              });
                              toast.success("Removed from popular");
                            }
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Failed to toggle popular",
                            );
                          }
                        }}
                      >
                        {popularSet.has(t.id.toLowerCase()) ? "On" : "Off"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <AddTokenToWalletButton
                          tokenAddress={t.id}
                          symbol={t.symbol ?? ""}
                          decimals={t.decimals ?? 18}
                          iconUrl={t.logoURI}
                          className="px-2 py-1 rounded bg-ds-gray-200 hover:bg-ds-gray-300 text-ds-gray-1000 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                          className="px-2 py-1 rounded bg-ds-red-700/10 hover:bg-ds-red-700/15 text-ds-red-400 text-xs"
                          onClick={async () => {
                            try {
                              await gatewayBrokerApi.setSpotTokenListing({
                                tokenAddress: t.id,
                                listed: false,
                              });
                              toast.success("Delisted");
                              await loadAll();
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Failed to delist",
                              );
                            }
                          }}
                        >
                          Delist
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Broker: Recently created (unlisted) */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Broker
              </p>
              <h2 className="text-sm font-semibold text-ds-gray-1000">
                Recently created (unlisted)
              </h2>
            </div>
          </div>
          <div className="mb-3">
            <input
              value={unlistedQuery}
              onChange={(e) => setUnlistedQuery(e.target.value)}
              placeholder="Search by symbol / name / address…"
              className="w-full px-3 py-2 text-sm bg-ds-gray-100 border border-ds-gray-300 rounded-md outline-none focus:ring-2 focus:ring-ds-blue-400/40"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-ds-gray-300 rounded animate-pulse"
                />
              ))}
            </div>
          ) : filteredUnlistedTokens.length === 0 ? (
            <div className="text-sm text-ds-gray-700">
              No unlisted tokens match your search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Listing date (sec)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnlistedTokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.symbol || "-"}</TableCell>
                    <TableCell>{t.name || "-"}</TableCell>
                    <TableCell className="font-geist-mono text-sm text-ds-gray-700">
                      {t.id}
                    </TableCell>
                    <TableCell className="text-right">
                      {Math.floor(t.listingDate ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <AddTokenToWalletButton
                          tokenAddress={t.id}
                          symbol={t.symbol ?? ""}
                          decimals={t.decimals ?? 18}
                          iconUrl={t.logoURI}
                          className="px-2 py-1 rounded bg-ds-gray-200 hover:bg-ds-gray-300 text-ds-gray-1000 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                          className="px-2 py-1 rounded bg-ds-green-700/10 hover:bg-ds-green-700/15 text-ds-green-400 text-xs"
                          onClick={async () => {
                            try {
                              await gatewayBrokerApi.setSpotTokenListing({
                                tokenAddress: t.id,
                                listed: true,
                              });
                              toast.success("Listed");
                              await loadAll();
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Failed to list",
                              );
                            }
                          }}
                        >
                          List
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
