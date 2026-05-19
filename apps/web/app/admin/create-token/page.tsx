"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { parseUnits, isAddress } from "viem";
import type { Abi } from "viem";
import { UserMintableTokenAbi, TokenFaucetAbi } from "@giwater/shared/abis";
import {
  USER_MINTABLE_TOKEN_BYTECODE,
  TOKEN_FAUCET_BYTECODE,
} from "@giwater/shared/constants";
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
import { AddTokenToWalletButton } from "@/components/wallet/AddTokenToWalletButton";

const SET_MINTER_ABI = [
  {
    type: "function",
    name: "setMinter",
    inputs: [{ name: "newMinter", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const satisfies Abi;

function parseSupplyBaseUnits(
  raw: string,
  decimals: number,
): { ok: true; value: bigint } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "Total supply is required (use 0 for none)." };
  }
  try {
    const value = parseUnits(trimmed, decimals);
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      message:
        "Total supply must be a valid non-negative number with at most the token's decimal places.",
    };
  }
}

export default function AdminCreateTokenPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { openChainModal } = useChainModal();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const wrongChain = isConnected && chainId !== GIWA_SEPOLIA_CHAIN_ID;

  // Token deployment state
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimalsStr, setDecimalsStr] = useState("18");
  const [totalSupplyTokens, setTotalSupplyTokens] = useState("1000000");
  const [isDeploying, setIsDeploying] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<`0x${string}` | null>(null);

  // Faucet deployment state
  const [faucetCooldown, setFaucetCooldown] = useState("86400");
  const [faucetDripTokens, setFaucetDripTokens] = useState("100");
  const [isDeployingFaucet, setIsDeployingFaucet] = useState(false);
  const [deployedFaucetAddress, setDeployedFaucetAddress] = useState<`0x${string}` | null>(null);
  const [faucetTxHash, setFaucetTxHash] = useState<`0x${string}` | null>(null);
  const [setMinterTxHash, setSetMinterTxHash] = useState<`0x${string}` | null>(null);

  const tokenAbi = UserMintableTokenAbi as Abi;
  const faucetAbi = TokenFaucetAbi as Abi;

  const decimalsParsed = useMemo(() => {
    const n = Number.parseInt(decimalsStr.trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 255) return null;
    return n;
  }, [decimalsStr]);

  const supplyPreview = useMemo(() => {
    if (decimalsParsed === null) return null;
    return parseSupplyBaseUnits(totalSupplyTokens, decimalsParsed);
  }, [totalSupplyTokens, decimalsParsed]);

  const handleDeploy = useCallback(async () => {
    setLastTxHash(null);
    setDeployedAddress(null);
    setDeployedFaucetAddress(null);
    setFaucetTxHash(null);
    setSetMinterTxHash(null);

    const tokenName = name.trim();
    const tokenSymbol = symbol.trim();
    if (!tokenName || !tokenSymbol) {
      toast.error("Name and symbol are required.");
      return;
    }
    if (decimalsParsed === null) {
      toast.error("Decimals must be an integer between 0 and 255.");
      return;
    }
    if (!supplyPreview || !supplyPreview.ok) {
      toast.error(supplyPreview?.message ?? "Invalid total supply.");
      return;
    }
    if (!walletClient || !publicClient) {
      toast.error("Wallet or RPC client not available.");
      return;
    }

    setIsDeploying(true);
    try {
      const hash = await walletClient.deployContract({
        abi: tokenAbi,
        bytecode: USER_MINTABLE_TOKEN_BYTECODE,
        args: [tokenName, tokenSymbol, decimalsParsed, supplyPreview.value],
      });
      setLastTxHash(hash);
      toast.success("Transaction submitted; waiting for confirmation…");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      const addr = receipt.contractAddress;
      if (!addr) {
        toast.error("Receipt did not include a contract address.");
        return;
      }
      setDeployedAddress(addr);
      toast.success("Token deployed. Full supply minted to your wallet.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deployment failed.";
      if (/user rejected|denied|cancel/i.test(msg)) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(msg.slice(0, 200));
      }
    } finally {
      setIsDeploying(false);
    }
  }, [
    tokenAbi,
    decimalsParsed,
    name,
    publicClient,
    supplyPreview,
    symbol,
    walletClient,
  ]);

  const handleDeployFaucet = useCallback(async () => {
    if (!deployedAddress || !walletClient || !publicClient || decimalsParsed === null) return;

    const cooldownSecs = parseInt(faucetCooldown.trim(), 10);
    if (!Number.isFinite(cooldownSecs) || cooldownSecs <= 0) {
      toast.error("Cooldown must be a positive integer (seconds).");
      return;
    }

    let dripAmount: bigint;
    try {
      dripAmount = parseUnits(faucetDripTokens.trim(), decimalsParsed);
      if (dripAmount === 0n) throw new Error("Drip amount must be > 0");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid drip amount.");
      return;
    }

    setIsDeployingFaucet(true);
    setDeployedFaucetAddress(null);
    setFaucetTxHash(null);
    setSetMinterTxHash(null);

    try {
      // Step 1: deploy TokenFaucet
      const faucetHash = await walletClient.deployContract({
        abi: faucetAbi,
        bytecode: TOKEN_FAUCET_BYTECODE,
        args: [deployedAddress, BigInt(cooldownSecs)],
      });
      setFaucetTxHash(faucetHash);
      toast.success("Faucet deploy submitted; waiting for confirmation…");

      const faucetReceipt = await publicClient.waitForTransactionReceipt({
        hash: faucetHash,
        confirmations: 1,
      });
      const faucetAddr = faucetReceipt.contractAddress;
      if (!faucetAddr) {
        toast.error("Faucet receipt did not include a contract address.");
        return;
      }

      // Step 2: set initial mintAmount if different from contract default (100 tokens)
      // The contract constructor sets mintAmount = 100 * 10^decimals, so if user entered
      // something different, call setMintAmount after deployment.
      const defaultDrip = parseUnits("100", decimalsParsed);
      if (dripAmount !== defaultDrip) {
        const setAmtHash = await walletClient.writeContract({
          address: faucetAddr,
          abi: faucetAbi,
          functionName: "setMintAmount",
          args: [dripAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: setAmtHash, confirmations: 1 });
      }

      // Step 3: grant faucet minting rights on the token
      const setMinterHash = await walletClient.writeContract({
        address: deployedAddress,
        abi: SET_MINTER_ABI,
        functionName: "setMinter",
        args: [faucetAddr],
      });
      setSetMinterTxHash(setMinterHash);
      toast.success("setMinter submitted; waiting for confirmation…");
      await publicClient.waitForTransactionReceipt({ hash: setMinterHash, confirmations: 1 });

      setDeployedFaucetAddress(faucetAddr);
      toast.success("Faucet deployed and connected to token.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Faucet deployment failed.";
      if (/user rejected|denied|cancel/i.test(msg)) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(msg.slice(0, 200));
      }
    } finally {
      setIsDeployingFaucet(false);
    }
  }, [
    deployedAddress,
    walletClient,
    publicClient,
    decimalsParsed,
    faucetCooldown,
    faucetDripTokens,
    faucetAbi,
  ]);

  const canSubmit =
    isConnected &&
    !wrongChain &&
    walletClient &&
    decimalsParsed !== null &&
    supplyPreview !== null &&
    supplyPreview.ok === true;

  const canDeployFaucet =
    isConnected &&
    !wrongChain &&
    walletClient &&
    !!deployedAddress &&
    !isDeployingFaucet &&
    decimalsParsed !== null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-ds-gray-1000">
          Create test token
        </h1>
        <p className="text-sm text-ds-gray-700 mt-1">
          Deploys{" "}
          <code className="text-xs bg-ds-gray-200 px-1 rounded">
            UserMintableToken
          </code>{" "}
          on the connected wallet&apos;s network. The full supply is minted once to
          the deployer. Optionally deploy a{" "}
          <code className="text-xs bg-ds-gray-200 px-1 rounded">TokenFaucet</code>{" "}
          and wire it up in the same flow.
        </p>
      </div>

      {/* Deployment form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Deploy token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <div className="space-y-3">
              <p className="text-sm text-ds-gray-700">
                Connect a wallet to sign the deployment.
              </p>
              <Button type="button" onClick={() => openConnectModal?.()}>
                Connect wallet
              </Button>
            </div>
          ) : wrongChain ? (
            <div className="space-y-3">
              <p className="text-sm text-ds-yellow-700 bg-ds-yellow-700/10 border border-ds-yellow-700/25 rounded-md px-3 py-2">
                This page deploys on <strong>GIWA Sepolia</strong> (chain{" "}
                {GIWA_SEPOLIA_CHAIN_ID}). Your wallet is on chain {chainId}. Switch
                network, then try again.
              </p>
              <Button
                type="button"
                onClick={() => openChainModal?.()}
                variant="secondary"
              >
                Switch network in wallet
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ds-gray-700 font-geist-mono">
              Deployer: {address}
            </p>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              Token name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Test Token"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              Symbol
            </label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="MTK"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Decimals
              </label>
              <Input
                value={decimalsStr}
                onChange={(e) => setDecimalsStr(e.target.value)}
                placeholder="18"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                Total supply (token units)
              </label>
              <Input
                value={totalSupplyTokens}
                onChange={(e) => setTotalSupplyTokens(e.target.value)}
                placeholder="1000000"
              />
            </div>
          </div>

          {supplyPreview && !supplyPreview.ok && (
            <p className="text-sm text-ds-red-400">{supplyPreview.message}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void handleDeploy()}
              disabled={!canSubmit || isDeploying}
            >
              {isDeploying ? "Deploying…" : "Deploy token"}
            </Button>
            <span className="text-xs text-ds-gray-600">Chain ID: {chainId}</span>
          </div>
        </CardContent>
      </Card>

      {/* Token result */}
      {(deployedAddress || lastTxHash) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Token deployed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {lastTxHash && (
              <div>
                <span className="text-ds-gray-600">Transaction: </span>
                <a
                  href={`${GIWASCAN_URL}/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ds-blue-400 font-geist-mono break-all underline"
                >
                  {lastTxHash}
                </a>
              </div>
            )}
            {deployedAddress && decimalsParsed !== null && (
              <>
                <div>
                  <span className="text-ds-gray-600">Contract: </span>
                  <span className="font-geist-mono break-all text-ds-gray-1000">
                    {deployedAddress}
                  </span>
                </div>
                <div className="pt-1">
                  <AddTokenToWalletButton
                    tokenAddress={deployedAddress}
                    symbol={symbol.trim() || "TKN"}
                    decimals={decimalsParsed}
                    className="px-2 py-1 rounded bg-ds-gray-200 hover:bg-ds-gray-300 text-ds-gray-1000 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Deploy faucet (only shown after token is deployed) */}
      {deployedAddress && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 2 — Deploy faucet (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ds-gray-700">
              Deploys a{" "}
              <code className="text-xs bg-ds-gray-200 px-1 rounded">TokenFaucet</code>{" "}
              for the token above, then calls{" "}
              <code className="text-xs bg-ds-gray-200 px-1 rounded">setMinter</code>{" "}
              to grant it minting rights. Requires your wallet to hold{" "}
              <code className="text-xs bg-ds-gray-200 px-1 rounded">DEFAULT_ADMIN_ROLE</code>{" "}
              on the token.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  Drip per claim ({symbol.trim() || "tokens"})
                </label>
                <Input
                  value={faucetDripTokens}
                  onChange={(e) => setFaucetDripTokens(e.target.value)}
                  placeholder="100"
                  disabled={isDeployingFaucet}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
                  Cooldown (seconds)
                </label>
                <Input
                  value={faucetCooldown}
                  onChange={(e) => setFaucetCooldown(e.target.value)}
                  placeholder="86400 = 1 day"
                  inputMode="numeric"
                  disabled={isDeployingFaucet}
                />
                <p className="text-xs text-ds-gray-600">86400 = 1 day · 3600 = 1 hour</p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => void handleDeployFaucet()}
              disabled={!canDeployFaucet}
            >
              {isDeployingFaucet ? "Deploying faucet…" : "Deploy faucet & connect"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Faucet result */}
      {(faucetTxHash || deployedFaucetAddress) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faucet deployed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {faucetTxHash && (
              <div>
                <span className="text-ds-gray-600">Faucet deploy tx: </span>
                <a
                  href={`${GIWASCAN_URL}/tx/${faucetTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ds-blue-400 font-geist-mono break-all underline"
                >
                  {faucetTxHash}
                </a>
              </div>
            )}
            {setMinterTxHash && (
              <div>
                <span className="text-ds-gray-600">setMinter tx: </span>
                <a
                  href={`${GIWASCAN_URL}/tx/${setMinterTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ds-blue-400 font-geist-mono break-all underline"
                >
                  {setMinterTxHash}
                </a>
              </div>
            )}
            {deployedFaucetAddress && (
              <div>
                <span className="text-ds-gray-600">Faucet contract: </span>
                <span className="font-geist-mono break-all text-ds-gray-1000">
                  {deployedFaucetAddress}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
