"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatUnits, isAddress, parseUnits } from "viem";
import {
  ContractStateCard,
  AdminFunctionForm,
  AddressInput,
  NumberInput,
  TxStatus,
} from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import type { Abi } from "viem";
import { ABIs, MultiTokenFaucetAbi } from "@giwater/shared/abis";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/admin/ui/Card";
import { Button } from "@/components/admin/ui/Button";
import toast from "react-hot-toast";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const FAUCET_OVERRIDE_LS = "giwater.admin.multiTokenFaucetAddress";

const faucetAbi = MultiTokenFaucetAbi as Abi;

export default function MultiTokenFaucetAdminPage() {
  const { contracts } = useContractAddresses();
  const { address: userAddress } = useAccount();

  const [draftOverride, setDraftOverride] = useState("");
  useEffect(() => {
    try {
      const v = localStorage.getItem(FAUCET_OVERRIDE_LS);
      if (v) setDraftOverride(v);
    } catch {
      /* ignore */
    }
  }, []);

  const fromConfig = contracts?.multiTokenFaucet;
  const faucetAddr = useMemo(() => {
    const t = draftOverride.trim();
    if (t && isAddress(t as `0x${string}`)) return t as `0x${string}`;
    if (
      fromConfig &&
      typeof fromConfig === "string" &&
      fromConfig.toLowerCase() !== ZERO.toLowerCase()
    )
      return fromConfig as `0x${string}`;
    return undefined;
  }, [draftOverride, fromConfig]);

  const faucet = faucetAddr;
  const faucetReady = !!faucet && isAddress(faucet);

  const persistOverride = () => {
    const t = draftOverride.trim();
    try {
      if (t && !isAddress(t as `0x${string}`)) {
        toast.error("Invalid address");
        return;
      }
      if (t) localStorage.setItem(FAUCET_OVERRIDE_LS, t);
      else localStorage.removeItem(FAUCET_OVERRIDE_LS);
      toast.success("Saved");
    } catch {
      toast.error("Could not save");
    }
  };

  const clearOverride = () => {
    setDraftOverride("");
    try {
      localStorage.removeItem(FAUCET_OVERRIDE_LS);
    } catch {
      /* ignore */
    }
    toast.success("Cleared override");
  };

  const { data: owner, refetch: refetchOwner } = useReadContract({
    address: faucet,
    abi: faucetAbi,
    functionName: "owner",
    query: { enabled: faucetReady },
  });

  const { data: assetsLengthBn, refetch: refetchLen } = useReadContract({
    address: faucet,
    abi: faucetAbi,
    functionName: "assetsLength",
    query: { enabled: faucetReady },
  });

  const len = assetsLengthBn != null ? Number(assetsLengthBn) : 0;

  const assetAtContracts = useMemo(() => {
    if (!faucetReady || !faucet || len <= 0) return [];
    return Array.from({ length: len }, (_, i) => ({
      address: faucet,
      abi: faucetAbi,
      functionName: "assetAt" as const,
      args: [BigInt(i)] as const,
    }));
  }, [faucet, faucetReady, len]);

  const { data: assetAtData, refetch: refetchAssetAt } = useReadContracts({
    contracts: assetAtContracts,
    query: { enabled: faucetReady && len > 0 },
  });

  const tokenAddresses = useMemo(() => {
    const out: `0x${string}`[] = [];
    for (const row of assetAtData ?? []) {
      const a = row.result;
      if (typeof a === "string" && isAddress(a)) out.push(a as `0x${string}`);
    }
    return out;
  }, [assetAtData]);

  const assetsConfigContracts = useMemo(() => {
    if (!faucetReady || !faucet || !tokenAddresses.length) return [];
    return tokenAddresses.map((t) => ({
      address: faucet,
      abi: faucetAbi,
      functionName: "assets" as const,
      args: [t] as const,
    }));
  }, [faucet, faucetReady, tokenAddresses]);

  const { data: assetsCfgData, refetch: refetchAssetsCfg } = useReadContracts({
    contracts: assetsConfigContracts,
    query: { enabled: faucetReady && tokenAddresses.length > 0 },
  });

  const erc20Abi = ABIs.ERC20 as Abi;

  const erc20MetaContracts = useMemo(() => {
    return tokenAddresses.flatMap((t) => [
      {
        address: t,
        abi: erc20Abi,
        functionName: "symbol" as const,
      },
      {
        address: t,
        abi: erc20Abi,
        functionName: "decimals" as const,
      },
    ]);
  }, [tokenAddresses, erc20Abi]);

  const { data: erc20Data, refetch: refetchErc20 } = useReadContracts({
    contracts: erc20MetaContracts,
    query: { enabled: tokenAddresses.length > 0 },
  });

  const rows = useMemo(() => {
    return tokenAddresses.map((addr, i) => {
      const cfg = assetsCfgData?.[i]?.result as
        | readonly [boolean, bigint, bigint]
        | undefined;
      const sym = erc20Data?.[i * 2]?.result as string | undefined;
      const dec = erc20Data?.[i * 2 + 1]?.result as number | undefined;
      return {
        token: addr,
        symbol: sym ?? "—",
        decimals: dec ?? 18,
        enabled: cfg?.[0] ?? false,
        mintAmount: cfg?.[1] ?? 0n,
        cooldownSeconds: cfg?.[2] ?? 0n,
      };
    });
  }, [tokenAddresses, assetsCfgData, erc20Data]);

  const refetchAll = useCallback(() => {
    void refetchOwner();
    void refetchLen();
    void refetchAssetAt();
    void refetchAssetsCfg();
    void refetchErc20();
  }, [
    refetchOwner,
    refetchLen,
    refetchAssetAt,
    refetchAssetsCfg,
    refetchErc20,
  ]);

  const { data: hash, writeContract, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isSuccess) {
      refetchAll();
      reset();
    }
  }, [isSuccess, refetchAll, reset]);

  const getTxStatus = (): TxStatus => {
    if (isPending) return "pending";
    if (isConfirming) return "confirming";
    if (isSuccess) return "success";
    return "idle";
  };

  const isOwner =
    !!userAddress &&
    !!owner &&
    (owner as string).toLowerCase() === userAddress.toLowerCase();

  const [newToken, setNewToken] = useState("");
  const [rowMint, setRowMint] = useState<Record<string, string>>({});
  const [rowCooldown, setRowCooldown] = useState<Record<string, string>>({});

  const handleAddAsset = () => {
    if (!faucet || !newToken || !isAddress(newToken as `0x${string}`)) {
      toast.error("Enter a valid token address");
      return;
    }
    writeContract({
      address: faucet,
      abi: faucetAbi,
      functionName: "addAsset",
      args: [newToken as `0x${string}`],
    });
    toast.success("Transaction submitted");
  };

  const handleSetMint = (token: `0x${string}`, decimals: number) => {
    const raw = rowMint[token.toLowerCase()]?.trim();
    if (!faucet || !raw) return;
    try {
      const amount = parseUnits(raw, decimals);
      writeContract({
        address: faucet,
        abi: faucetAbi,
        functionName: "setMintAmount",
        args: [token, amount],
      });
      toast.success("Transaction submitted");
    } catch {
      toast.error("Invalid mint amount");
    }
  };

  const handleSetCooldown = (token: `0x${string}`) => {
    const raw = rowCooldown[token.toLowerCase()]?.trim();
    if (!faucet || !raw) return;
    const sec = BigInt(Math.floor(Number.parseFloat(raw) * 3600));
    if (sec <= 0n) {
      toast.error("Cooldown must be positive (hours)");
      return;
    }
    writeContract({
      address: faucet,
      abi: faucetAbi,
      functionName: "setCooldownSeconds",
      args: [token, sec],
    });
    toast.success("Transaction submitted");
  };

  const handleToggleEnabled = (token: `0x${string}`, enabled: boolean) => {
    if (!faucet) return;
    writeContract({
      address: faucet,
      abi: faucetAbi,
      functionName: "setAssetEnabled",
      args: [token, !enabled],
    });
    toast.success("Transaction submitted");
  };

  const handleRemove = (token: `0x${string}`) => {
    if (!faucet) return;
    writeContract({
      address: faucet,
      abi: faucetAbi,
      functionName: "removeAsset",
      args: [token],
    });
    toast.success("Transaction submitted");
  };

  const stateItems = [
    {
      label: "Owner",
      value: (owner as string | undefined) ?? "—",
      type: "address" as const,
    },
    {
      label: "Assets registered",
      value: len.toString(),
      type: "number" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ds-gray-1000">
            Faucet contract address
          </h3>
          <p className="text-sm text-ds-gray-700 mt-1">
            Uses <code className="text-xs">contracts.multiTokenFaucet</code>{" "}
            from the gateway when non-zero. Override below for local testing;
            each token must call <code className="text-xs">setMinter(faucet)</code>{" "}
            on chain.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <AddressInput
            label="Override address (optional)"
            value={draftOverride}
            onChange={setDraftOverride}
            placeholder={ZERO}
          />
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="primary" onClick={persistOverride}>
              Save override
            </Button>
            <Button type="button" variant="secondary" onClick={clearOverride}>
              Clear override
            </Button>
          </div>
          <p className="text-xs text-ds-gray-600">
            Effective:{" "}
            {faucetReady ? (
              <span className="font-mono">{faucet}</span>
            ) : (
              <span className="text-ds-gray-500">
                None — set{" "}
                <code className="text-xs">MULTI_TOKEN_FAUCET_ADDRESS</code> in
                shared constants or save a valid override.
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {faucetReady && (
        <ContractStateCard
          title="MultiTokenFaucet"
          description="Per-asset drip and cooldown (ABI from Giwater-Contracts extract-abi.sh)"
          contractAddress={faucet}
          items={stateItems}
          isLoading={false}
          onRefresh={() => refetchAll()}
        />
      )}

      {faucetReady && (
        <AdminFunctionForm
          title="Add asset"
          description="Registers a token on the faucet (100 tokens + 1 day cooldown default)."
          permission="owner"
          hasPermission={isOwner}
          onSubmit={handleAddAsset}
          submitLabel="addAsset(token)"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <AddressInput
            label="Token address"
            value={newToken}
            onChange={setNewToken}
            required
          />
        </AdminFunctionForm>
      )}

      {faucetReady && rows.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-ds-gray-1000">
            Registered assets
          </h3>
          <div className="overflow-x-auto border border-ds-gray-400 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-ds-gray-200 text-ds-gray-800">
                <tr>
                  <th className="p-2 font-medium">Token</th>
                  <th className="p-2 font-medium">Symbol</th>
                  <th className="p-2 font-medium">Drip / cooldown</th>
                  <th className="p-2 font-medium">Adjust</th>
                  <th className="p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const key = r.token.toLowerCase();
                  const drip =
                    r.mintAmount > 0n
                      ? formatUnits(r.mintAmount, r.decimals)
                      : "0";
                  const cdH = Number(r.cooldownSeconds) / 3600;
                  return (
                    <tr
                      key={r.token}
                      className="border-t border-ds-gray-300 align-top"
                    >
                      <td className="p-2 font-mono text-xs break-all max-w-[140px]">
                        {r.token}
                      </td>
                      <td className="p-2">{r.symbol}</td>
                      <td className="p-2 whitespace-nowrap">
                        {drip} / claim
                        <br />
                        <span className="text-ds-gray-600">
                          {cdH}h cooldown
                        </span>
                        <br />
                        <span className="text-ds-gray-500">
                          {r.enabled ? "enabled" : "disabled"}
                        </span>
                      </td>
                      <td className="p-2 space-y-2 min-w-[200px]">
                        <NumberInput
                          label="New drip (whole tokens)"
                          value={rowMint[key] ?? ""}
                          onChange={(v) =>
                            setRowMint((m) => ({ ...m, [key]: v }))
                          }
                          helperText={`Current raw: ${r.mintAmount.toString()}`}
                        />
                        <NumberInput
                          label="New cooldown (hours)"
                          value={rowCooldown[key] ?? ""}
                          onChange={(v) =>
                            setRowCooldown((m) => ({ ...m, [key]: v }))
                          }
                          helperText={`Current: ${r.cooldownSeconds.toString()}s`}
                        />
                      </td>
                      <td className="p-2 space-y-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={!isOwner}
                          onClick={() =>
                            handleSetMint(r.token as `0x${string}`, r.decimals)
                          }
                        >
                          setMintAmount
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={!isOwner}
                          onClick={() =>
                            handleSetCooldown(r.token as `0x${string}`)
                          }
                        >
                          setCooldownSeconds
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={!isOwner}
                          onClick={() =>
                            handleToggleEnabled(
                              r.token as `0x${string}`,
                              r.enabled,
                            )
                          }
                        >
                          {r.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={!isOwner}
                          onClick={() =>
                            handleRemove(r.token as `0x${string}`)
                          }
                        >
                          removeAsset
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!faucetReady && (
        <p className="text-sm text-ds-gray-600">
          Deploy <code className="text-xs">MultiTokenFaucet</code> from
          Giwater-Contracts, run{" "}
          <code className="text-xs">bash script/extract-abi.sh -c</code>, set{" "}
          <code className="text-xs">MULTI_TOKEN_FAUCET_ADDRESS</code> in{" "}
          <code className="text-xs">packages/shared/src/constants/contracts.ts</code>
          , then reload the app.
        </p>
      )}
    </div>
  );
}
