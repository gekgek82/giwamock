"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { parseUnits, formatUnits, isAddress } from "viem";
import type { Abi } from "viem";
import { TokenFaucetAbi, ERC20Abi } from "@giwater/shared/abis";
import { TOKEN_FAUCET_BYTECODE } from "@giwater/shared/constants";
import toast from "react-hot-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/Card";
import { Input } from "@/components/admin/ui/Input";
import { Button } from "@/components/admin/ui";
import { useConnectModal, useChainModal } from "@rainbow-me/rainbowkit";
import { GIWASCAN_URL, GIWA_SEPOLIA_CHAIN_ID } from "@/lib/config";
import { adminApi } from "@/lib/adminApi";

const FAUCET_ABI = TokenFaucetAbi as Abi;
const ERC20_ABI = ERC20Abi as Abi;

const SET_MINTER_ABI = [
  {
    type: "function",
    name: "setMinter",
    inputs: [{ name: "newMinter", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const satisfies Abi;

interface FaucetInfo {
  faucetAddress: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  mintAmount: bigint;
  cooldownSeconds: bigint;
}

interface FaucetEntry {
  info: FaucetInfo | null;
  loading: boolean;
  error: string | null;
  editMintTokens: string;
  editCooldownSeconds: string;
  saving: "mint" | "cooldown" | null;
  inRegistry: boolean;
  savingToRegistry: boolean;
}

function formatCooldown(seconds: bigint): string {
  const s = Number(seconds);
  if (s >= 86400 && s % 86400 === 0) return `${s / 86400}d`;
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600}h`;
  if (s >= 60 && s % 60 === 0) return `${s / 60}m`;
  return `${s}s`;
}

export default function FaucetsAdminPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { openChainModal } = useChainModal();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const wrongChain = isConnected && chainId !== GIWA_SEPOLIA_CHAIN_ID;

  const [deployTokenAddress, setDeployTokenAddress] = useState("");
  const [deployCooldown, setDeployCooldown] = useState("86400");
  const [isDeployingNew, setIsDeployingNew] = useState(false);

  const [addressInput, setAddressInput] = useState("");
  const [faucets, setFaucets] = useState<Record<string, FaucetEntry>>({});

  const updateEntry = useCallback(
    (addr: string, patch: Partial<FaucetEntry>) => {
      setFaucets((prev) => ({
        ...prev,
        [addr]: { ...prev[addr], ...patch },
      }));
    },
    [],
  );

  const loadFaucet = useCallback(
    async (addr: string, inRegistry = false) => {
      if (!publicClient) {
        toast.error("RPC client not available.");
        return;
      }
      updateEntry(addr, { loading: true, error: null });
      try {
        const [tokenAddr, mintAmt, cooldown] = await Promise.all([
          publicClient.readContract({
            address: addr as `0x${string}`,
            abi: FAUCET_ABI,
            functionName: "token",
          }) as Promise<`0x${string}`>,
          publicClient.readContract({
            address: addr as `0x${string}`,
            abi: FAUCET_ABI,
            functionName: "mintAmount",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: addr as `0x${string}`,
            abi: FAUCET_ABI,
            functionName: "cooldownSeconds",
          }) as Promise<bigint>,
        ]);

        const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
          publicClient.readContract({
            address: tokenAddr,
            abi: ERC20_ABI,
            functionName: "name",
          }) as Promise<string>,
          publicClient.readContract({
            address: tokenAddr,
            abi: ERC20_ABI,
            functionName: "symbol",
          }) as Promise<string>,
          publicClient.readContract({
            address: tokenAddr,
            abi: ERC20_ABI,
            functionName: "decimals",
          }) as Promise<number>,
        ]);

        const info: FaucetInfo = {
          faucetAddress: addr,
          tokenAddress: tokenAddr,
          tokenName,
          tokenSymbol,
          tokenDecimals,
          mintAmount: mintAmt,
          cooldownSeconds: cooldown,
        };

        updateEntry(addr, {
          info,
          loading: false,
          inRegistry,
          editMintTokens: formatUnits(mintAmt, tokenDecimals),
          editCooldownSeconds: cooldown.toString(),
        });
      } catch (e) {
        updateEntry(addr, {
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load faucet",
        });
      }
    },
    [publicClient, updateEntry],
  );

  const addToList = useCallback(
    (addr: string, inRegistry = false) => {
      const normalized = addr.toLowerCase();
      setFaucets((prev) => {
        if (prev[normalized]) return prev;
        return {
          ...prev,
          [normalized]: {
            info: null,
            loading: false,
            error: null,
            editMintTokens: "",
            editCooldownSeconds: "",
            saving: null,
            inRegistry,
            savingToRegistry: false,
          },
        };
      });
      void loadFaucet(normalized, inRegistry);
    },
    [loadFaucet],
  );

  // Auto-load registered faucets on mount
  useEffect(() => {
    adminApi.getFaucets().then((res) => {
      for (const f of res.faucets) {
        addToList(f.faucetAddress, true);
      }
    }).catch(() => {
      toast.error("Failed to load faucet registry.");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveToRegistry = useCallback(
    async (addr: string) => {
      const entry = faucets[addr];
      if (!entry?.info) return;
      updateEntry(addr, { savingToRegistry: true });
      try {
        await adminApi.registerFaucet({
          faucetAddress: entry.info.faucetAddress,
          tokenAddress: entry.info.tokenAddress,
          tokenName: entry.info.tokenName,
          tokenSymbol: entry.info.tokenSymbol,
          tokenDecimals: entry.info.tokenDecimals,
        });
        updateEntry(addr, { inRegistry: true, savingToRegistry: false });
        toast.success("Saved to registry.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to save.";
        if (msg.includes("already registered")) {
          updateEntry(addr, { inRegistry: true, savingToRegistry: false });
        } else {
          toast.error(msg.slice(0, 200));
          updateEntry(addr, { savingToRegistry: false });
        }
      }
    },
    [faucets, updateEntry],
  );

  const handleRemoveFromRegistry = useCallback(
    async (addr: string) => {
      try {
        await adminApi.deleteFaucet(addr);
        updateEntry(addr, { inRegistry: false });
        toast.success("Removed from registry.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove.");
      }
    },
    [updateEntry],
  );

  const handleDeployNew = useCallback(async () => {
    if (!walletClient || !publicClient) {
      toast.error("Wallet or RPC client not available.");
      return;
    }
    const tokenAddr = deployTokenAddress.trim();
    if (!isAddress(tokenAddr)) {
      toast.error("Invalid token address.");
      return;
    }
    const cooldownSecs = parseInt(deployCooldown.trim(), 10);
    if (!Number.isFinite(cooldownSecs) || cooldownSecs <= 0) {
      toast.error("Cooldown must be a positive integer (seconds).");
      return;
    }

    setIsDeployingNew(true);
    try {
      const faucetHash = await walletClient.deployContract({
        abi: FAUCET_ABI,
        bytecode: TOKEN_FAUCET_BYTECODE,
        args: [tokenAddr, BigInt(cooldownSecs)],
      });
      toast.success("Faucet deploy submitted; waiting for confirmation…");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: faucetHash,
        confirmations: 1,
      });
      const faucetAddr = receipt.contractAddress;
      if (!faucetAddr) {
        toast.error("Receipt did not include a faucet address.");
        return;
      }

      toast.success("Faucet deployed. Calling setMinter on token…");

      const setMinterHash = await walletClient.writeContract({
        address: tokenAddr as `0x${string}`,
        abi: SET_MINTER_ABI,
        functionName: "setMinter",
        args: [faucetAddr],
      });
      await publicClient.waitForTransactionReceipt({ hash: setMinterHash, confirmations: 1 });

      toast.success(
        <span>
          Faucet deployed and connected.{" "}
          <a
            href={`${GIWASCAN_URL}/address/${faucetAddr}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {faucetAddr.slice(0, 10)}…
          </a>
        </span>,
      );

      setDeployTokenAddress("");
      addToList(faucetAddr, false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deployment failed.";
      if (/rejected|denied|cancel/i.test(msg)) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(msg.slice(0, 200));
      }
    } finally {
      setIsDeployingNew(false);
    }
  }, [
    walletClient,
    publicClient,
    deployTokenAddress,
    deployCooldown,
    addToList,
  ]);

  const handleAdd = useCallback(() => {
    const addr = addressInput.trim();
    if (!isAddress(addr)) {
      toast.error("Invalid contract address.");
      return;
    }
    setAddressInput("");
    addToList(addr, false);
  }, [addressInput, addToList]);

  const handleSetMintAmount = useCallback(
    async (addr: string) => {
      const entry = faucets[addr];
      if (!entry?.info || !walletClient || !publicClient) return;
      const { tokenDecimals } = entry.info;

      let newAmount: bigint;
      try {
        newAmount = parseUnits(entry.editMintTokens.trim(), tokenDecimals);
        if (newAmount === 0n) throw new Error("Amount must be > 0");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Invalid amount.");
        return;
      }

      updateEntry(addr, { saving: "mint" });
      try {
        const hash = await walletClient.writeContract({
          address: addr as `0x${string}`,
          abi: FAUCET_ABI,
          functionName: "setMintAmount",
          args: [newAmount],
        });
        toast.success("Transaction submitted…");
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        toast.success(
          <span>
            Mint amount updated.{" "}
            <a
              href={`${GIWASCAN_URL}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View tx
            </a>
          </span>,
        );
        await loadFaucet(addr, entry.inRegistry);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Transaction failed.";
        if (/rejected|denied|cancel/i.test(msg)) {
          toast.error("Transaction rejected.");
        } else {
          toast.error(msg.slice(0, 200));
        }
      } finally {
        updateEntry(addr, { saving: null });
      }
    },
    [faucets, walletClient, publicClient, updateEntry, loadFaucet],
  );

  const handleSetCooldown = useCallback(
    async (addr: string) => {
      const entry = faucets[addr];
      if (!entry?.info || !walletClient || !publicClient) return;

      const parsed = parseInt(entry.editCooldownSeconds.trim(), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Cooldown must be a positive integer (seconds).");
        return;
      }

      updateEntry(addr, { saving: "cooldown" });
      try {
        const hash = await walletClient.writeContract({
          address: addr as `0x${string}`,
          abi: FAUCET_ABI,
          functionName: "setCooldownSeconds",
          args: [BigInt(parsed)],
        });
        toast.success("Transaction submitted…");
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        toast.success(
          <span>
            Cooldown updated.{" "}
            <a
              href={`${GIWASCAN_URL}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View tx
            </a>
          </span>,
        );
        await loadFaucet(addr, entry.inRegistry);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Transaction failed.";
        if (/rejected|denied|cancel/i.test(msg)) {
          toast.error("Transaction rejected.");
        } else {
          toast.error(msg.slice(0, 200));
        }
      } finally {
        updateEntry(addr, { saving: null });
      }
    },
    [faucets, walletClient, publicClient, updateEntry, loadFaucet],
  );

  const faucetAddresses = Object.keys(faucets);

  const walletBanner = !isConnected ? (
    <Card>
      <CardContent className="space-y-3 py-4">
        <p className="text-sm text-ds-gray-700">
          Connect a wallet with admin role to sign transactions.
        </p>
        <Button type="button" onClick={() => openConnectModal?.()}>
          Connect wallet
        </Button>
      </CardContent>
    </Card>
  ) : wrongChain ? (
    <Card>
      <CardContent className="py-4 space-y-3">
        <p className="text-sm text-ds-yellow-700 bg-ds-yellow-700/10 border border-ds-yellow-700/25 rounded-md px-3 py-2">
          Switch to <strong>GIWA Sepolia</strong> (chain {GIWA_SEPOLIA_CHAIN_ID}).
          Currently on chain {chainId}.
        </p>
        <Button type="button" variant="secondary" onClick={() => openChainModal?.()}>
          Switch network
        </Button>
      </CardContent>
    </Card>
  ) : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-ds-gray-1000">
          Faucet Management
        </h1>
        <p className="text-sm text-ds-gray-700 mt-1">
          Deploy new{" "}
          <code className="text-xs bg-ds-gray-200 px-1 rounded">TokenFaucet</code>{" "}
          contracts or manage existing ones — update drip amount and cooldown.
          Your wallet must hold{" "}
          <code className="text-xs bg-ds-gray-200 px-1 rounded">DEFAULT_ADMIN_ROLE</code>{" "}
          on each faucet.
        </p>
      </div>

      {walletBanner}

      {/* Deploy new faucet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deploy new faucet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ds-gray-700">
            Deploys a{" "}
            <code className="text-xs bg-ds-gray-200 px-1 rounded">TokenFaucet</code>{" "}
            for any existing{" "}
            <code className="text-xs bg-ds-gray-200 px-1 rounded">UserMintableToken</code>,
            then calls{" "}
            <code className="text-xs bg-ds-gray-200 px-1 rounded">setMinter</code>{" "}
            to connect them. Requires admin role on the token.
          </p>
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              Token address
            </label>
            <Input
              value={deployTokenAddress}
              onChange={(e) => setDeployTokenAddress(e.target.value)}
              placeholder="0x… UserMintableToken address"
              className="font-geist-mono text-sm"
              disabled={isDeployingNew}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              Cooldown (seconds between claims)
            </label>
            <Input
              value={deployCooldown}
              onChange={(e) => setDeployCooldown(e.target.value)}
              placeholder="86400 = 1 day"
              inputMode="numeric"
              disabled={isDeployingNew}
            />
            <p className="text-xs text-ds-gray-600">
              86400 = 1 day · 3600 = 1 hour · Drip amount defaults to 100 tokens
              (adjustable after deploy below)
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void handleDeployNew()}
            disabled={
              !isConnected ||
              wrongChain ||
              !walletClient ||
              isDeployingNew ||
              !deployTokenAddress.trim()
            }
          >
            {isDeployingNew ? "Deploying…" : "Deploy & connect"}
          </Button>
        </CardContent>
      </Card>

      {/* Load existing faucet manually */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Load faucet by address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="0x… TokenFaucet contract address"
              className="font-geist-mono text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <Button
              type="button"
              onClick={handleAdd}
              disabled={!addressInput.trim()}
            >
              Load
            </Button>
          </div>
          <p className="text-xs text-ds-gray-600">
            Enter a deployed faucet address to read and update its settings.
          </p>
        </CardContent>
      </Card>

      {/* Faucet cards */}
      {faucetAddresses.map((addr) => {
        const entry = faucets[addr];
        const { info, loading, error, editMintTokens, editCooldownSeconds, saving, inRegistry, savingToRegistry } =
          entry;

        return (
          <Card key={addr}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm font-geist-mono break-all">
                  {addr}
                </CardTitle>
                {info && !loading && (
                  <div className="flex items-center gap-2 shrink-0">
                    {inRegistry ? (
                      <button
                        className="text-xs text-ds-gray-600 hover:text-ds-red-500"
                        onClick={() => void handleRemoveFromRegistry(addr)}
                      >
                        Remove from registry
                      </button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void handleSaveToRegistry(addr)}
                        disabled={savingToRegistry}
                      >
                        {savingToRegistry ? "Saving…" : "Save to registry"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-ds-gray-300 rounded animate-pulse" />
                  ))}
                </div>
              )}

              {error && (
                <p className="text-sm text-ds-red-400 bg-ds-red-700/10 border border-ds-red-700/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              {info && !loading && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-0.5">
                        Token
                      </p>
                      <p className="text-ds-gray-1000 font-medium">
                        {info.tokenName}{" "}
                        <span className="text-ds-gray-700">({info.tokenSymbol})</span>
                      </p>
                      <p className="font-geist-mono text-xs text-ds-gray-600 break-all mt-0.5">
                        {info.tokenAddress}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-0.5">
                        Current settings
                      </p>
                      <p className="text-ds-gray-1000">
                        Drip:{" "}
                        <span className="font-medium">
                          {formatUnits(info.mintAmount, info.tokenDecimals)}{" "}
                          {info.tokenSymbol}
                        </span>
                      </p>
                      <p className="text-ds-gray-1000">
                        Cooldown:{" "}
                        <span className="font-medium">
                          {formatCooldown(info.cooldownSeconds)}{" "}
                          <span className="text-ds-gray-600 text-xs">
                            ({info.cooldownSeconds.toString()}s)
                          </span>
                        </span>
                      </p>
                    </div>
                  </div>

                  <hr className="border-ds-gray-300" />

                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                      New drip amount ({info.tokenSymbol} per claim)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={editMintTokens}
                        onChange={(e) =>
                          updateEntry(addr, { editMintTokens: e.target.value })
                        }
                        placeholder="100"
                        className="flex-1"
                        disabled={saving === "mint"}
                      />
                      <Button
                        type="button"
                        onClick={() => void handleSetMintAmount(addr)}
                        disabled={
                          !isConnected || wrongChain || !walletClient || saving !== null
                        }
                      >
                        {saving === "mint" ? "Saving…" : "Update"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                      New cooldown (seconds between claims)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={editCooldownSeconds}
                        onChange={(e) =>
                          updateEntry(addr, { editCooldownSeconds: e.target.value })
                        }
                        placeholder="86400 = 1 day"
                        inputMode="numeric"
                        className="flex-1"
                        disabled={saving === "cooldown"}
                      />
                      <Button
                        type="button"
                        onClick={() => void handleSetCooldown(addr)}
                        disabled={
                          !isConnected || wrongChain || !walletClient || saving !== null
                        }
                      >
                        {saving === "cooldown" ? "Saving…" : "Update"}
                      </Button>
                    </div>
                    {editCooldownSeconds && parseInt(editCooldownSeconds, 10) > 0 && (
                      <p className="text-xs text-ds-gray-600">
                        = {formatCooldown(BigInt(parseInt(editCooldownSeconds, 10)))}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      className="text-xs text-ds-gray-600 hover:text-ds-gray-900"
                      onClick={() => void loadFaucet(addr, inRegistry)}
                    >
                      Refresh
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {faucetAddresses.length === 0 && (
        <p className="text-sm text-ds-gray-600">
          No faucets loaded yet. Deploy a new one above or enter an existing address.
        </p>
      )}
    </div>
  );
}
