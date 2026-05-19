"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { keccak256, toBytes, isAddress, getAddress } from "viem";
import {
  AddressInput,
  AdminFunctionForm,
  TransactionStatus,
  type TxStatus,
} from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import { GIWASCAN_URL } from "@/lib/config";
import toast from "react-hot-toast";

// ============================================================================
// AccessControl ABI — minimal subset
// ============================================================================

const ACCESS_CONTROL_ABI = [
  {
    name: "hasRole",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "grantRole",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "revokeRole",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
] as const;

// ============================================================================
// Role bytes32 values
// ============================================================================

const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

const ROLE_BYTES32: Record<string, `0x${string}`> = {
  DEFAULT_ADMIN_ROLE,
  KEEPER_ROLE: keccak256(toBytes("KEEPER_ROLE")),
  REGISTRAR_ROLE: keccak256(toBytes("REGISTRAR_ROLE")),
};

// ============================================================================
// Contract definitions
// ============================================================================

type KnownAddressKey =
  | "terPoint"
  | "pointExchanger"
  | "poolRewardRegistry"
  | "nftPositionManager"
  | "multiTokenFaucet";

interface ContractDef {
  id: string;
  name: string;
  addressKey: KnownAddressKey;
  roles: string[];
}

const CONTRACTS: ContractDef[] = [
  {
    id: "terPoint",
    name: "TerPoint",
    addressKey: "terPoint",
    roles: ["DEFAULT_ADMIN_ROLE"],
  },
  {
    id: "pointExchanger",
    name: "PointExchanger",
    addressKey: "pointExchanger",
    roles: ["DEFAULT_ADMIN_ROLE"],
  },
  {
    id: "poolRewardRegistry",
    name: "PoolRewardRegistry",
    addressKey: "poolRewardRegistry",
    roles: ["DEFAULT_ADMIN_ROLE", "KEEPER_ROLE", "REGISTRAR_ROLE"],
  },
  {
    id: "nftPositionManager",
    name: "NonfungiblePositionManager",
    addressKey: "nftPositionManager",
    roles: ["DEFAULT_ADMIN_ROLE"],
  },
  {
    id: "multiTokenFaucet",
    name: "MultiTokenFaucet",
    addressKey: "multiTokenFaucet",
    roles: ["DEFAULT_ADMIN_ROLE"],
  },
];

// ============================================================================
// Types — fetched role maps
// ============================================================================

// roleMap[contractId][roleName] -> true/false/null (null = N/A: zero address or no AccessControl)
type RoleMap = Record<string, Record<string, boolean | null>>;

interface BulkResult {
  name: string;
  status: "waiting" | "pending" | "success" | "error";
  hash?: string;
  error?: string;
}

const ROLE_DOT_COLORS: Record<string, string> = {
  DEFAULT_ADMIN_ROLE: "bg-ds-amber-500",
  KEEPER_ROLE: "bg-ds-blue-500",
  REGISTRAR_ROLE: "bg-ds-purple-500",
};

// ============================================================================
// Helpers
// ============================================================================

function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address ?? "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ============================================================================
// Component
// ============================================================================

export default function RoleMembersPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();
  const publicClient = usePublicClient();

  // -------------------- My Roles --------------------
  const [myRoles, setMyRoles] = useState<RoleMap>({});
  const [myRolesLoading, setMyRolesLoading] = useState(false);

  const fetchRolesFor = useCallback(
    async (address: `0x${string}`): Promise<RoleMap> => {
      if (!publicClient) return {};
      const result: RoleMap = {};
      await Promise.all(
        CONTRACTS.map(async (def) => {
          const addr = (contracts as Record<string, string> | undefined)?.[
            def.addressKey
          ];
          const isZero = addr === "0x0000000000000000000000000000000000000000";
          if (!addr || !isAddress(addr) || isZero) {
            result[def.id] = Object.fromEntries(def.roles.map((r) => [r, null]));
            return;
          }
          const roleEntries = await Promise.all(
            def.roles.map(async (roleName) => {
              try {
                const has = await publicClient.readContract({
                  address: addr as `0x${string}`,
                  abi: ACCESS_CONTROL_ABI,
                  functionName: "hasRole",
                  args: [ROLE_BYTES32[roleName] ?? DEFAULT_ADMIN_ROLE, address],
                });
                return [roleName, has as boolean] as const;
              } catch {
                return [roleName, null] as const;
              }
            }),
          );
          result[def.id] = Object.fromEntries(roleEntries);
        }),
      );
      return result;
    },
    [contracts, publicClient],
  );

  const refreshMyRoles = useCallback(async () => {
    if (!userAddress) return;
    setMyRolesLoading(true);
    try {
      const map = await fetchRolesFor(userAddress);
      setMyRoles(map);
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 200) : "Read failed");
    } finally {
      setMyRolesLoading(false);
    }
  }, [userAddress, fetchRolesFor]);

  useEffect(() => {
    void refreshMyRoles();
  }, [refreshMyRoles]);

  // -------------------- Watch Wallets --------------------
  const [watchedAddresses, setWatchedAddresses] = useState<string[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [watchedRoles, setWatchedRoles] = useState<Record<string, RoleMap>>({});
  const [newWatchAddress, setNewWatchAddress] = useState("");

  const fetchWatchedWallets = useCallback(async () => {
    setWalletsLoading(true);
    try {
      const res = await fetch('/api/config-admin/admin/watched-wallets');
      if (res.ok) {
        const data = (await res.json()) as { wallets: { address: string }[] };
        setWatchedAddresses(data.wallets.map((w) => w.address));
      }
    } catch {
      /* ignore */
    } finally {
      setWalletsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWatchedWallets();
  }, [fetchWatchedWallets]);

  const refreshWatched = useCallback(
    async (addresses: string[]) => {
      const next: Record<string, RoleMap> = {};
      await Promise.all(
        addresses.map(async (addr) => {
          if (!isAddress(addr)) return;
          const checksummed = getAddress(addr);
          try {
            next[checksummed] = await fetchRolesFor(checksummed as `0x${string}`);
          } catch {
            next[checksummed] = {};
          }
        }),
      );
      setWatchedRoles(next);
    },
    [fetchRolesFor],
  );

  useEffect(() => {
    if (watchedAddresses.length === 0) {
      setWatchedRoles({});
      return;
    }
    void refreshWatched(watchedAddresses);
  }, [watchedAddresses, refreshWatched]);

  const handleAddWatch = useCallback(async () => {
    const trimmed = newWatchAddress.trim();
    if (!isAddress(trimmed)) {
      toast.error("Invalid address");
      return;
    }
    const checksummed = getAddress(trimmed);
    try {
      const res = await fetch('/api/config-admin/admin/watched-wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: checksummed }),
      });
      if (!res.ok) throw new Error('Failed');
      await fetchWatchedWallets();
      setNewWatchAddress("");
    } catch {
      toast.error("Failed to add wallet");
    }
  }, [newWatchAddress, fetchWatchedWallets]);

  const handleRemoveWatch = useCallback(async (address: string) => {
    try {
      await fetch(`/api/config-admin/admin/watched-wallets/${encodeURIComponent(address)}`, { method: 'DELETE' });
      await fetchWatchedWallets();
      setManageAddress((prev) => (prev === address ? null : prev));
      setBulkTargetAddress((prev) => (prev === address ? null : prev));
    } catch {
      toast.error("Failed to remove wallet");
    }
  }, [fetchWatchedWallets]);

  // -------------------- Manage Panel --------------------
  const [manageAddress, setManageAddress] = useState<string | null>(null);
  const [manageContractId, setManageContractId] = useState<string>(
    CONTRACTS[0].id,
  );
  const [manageGrantRole, setManageGrantRole] = useState<string>(
    "DEFAULT_ADMIN_ROLE",
  );
  const [manageRevokeRole, setManageRevokeRole] = useState<string>(
    "DEFAULT_ADMIN_ROLE",
  );

  const {
    data: manageTxHash,
    writeContract,
    isPending: managePending,
    reset: manageReset,
  } = useWriteContract();
  const { isLoading: manageConfirming, isSuccess: manageSuccess } =
    useWaitForTransactionReceipt({ hash: manageTxHash });

  const manageTxStatus: TxStatus = managePending
    ? "pending"
    : manageConfirming
      ? "confirming"
      : manageSuccess
        ? "success"
        : "idle";

  // Refetch the watched address roles after a successful manage tx
  useEffect(() => {
    if (manageSuccess && manageAddress) {
      void refreshWatched(watchedAddresses);
      if (userAddress && manageAddress.toLowerCase() === userAddress.toLowerCase()) {
        void refreshMyRoles();
      }
    }
  }, [
    manageSuccess,
    manageAddress,
    refreshWatched,
    watchedAddresses,
    refreshMyRoles,
    userAddress,
  ]);

  const manageContractDef = useMemo(
    () => CONTRACTS.find((c) => c.id === manageContractId) ?? CONTRACTS[0],
    [manageContractId],
  );

  const manageContractAddress = useMemo((): `0x${string}` | undefined => {
    const addr = (contracts as Record<string, string> | undefined)?.[
      manageContractDef.addressKey
    ];
    return addr && isAddress(addr) ? (addr as `0x${string}`) : undefined;
  }, [contracts, manageContractDef]);

  const handleOpenManage = useCallback((address: string) => {
    setManageAddress(address);
    setBulkTargetAddress(null);
    setManageContractId(CONTRACTS[0].id);
    setManageGrantRole(CONTRACTS[0].roles[0]);
    setManageRevokeRole(CONTRACTS[0].roles[0]);
    manageReset();
  }, [manageReset]);

  const handleCloseManage = useCallback(() => {
    setManageAddress(null);
    manageReset();
  }, [manageReset]);

  const handleManageContractSelect = useCallback((id: string) => {
    setManageContractId(id);
    const def = CONTRACTS.find((c) => c.id === id) ?? CONTRACTS[0];
    setManageGrantRole(def.roles[0]);
    setManageRevokeRole(def.roles[0]);
  }, []);

  const handleGrant = useCallback(() => {
    if (!manageContractAddress || !manageAddress || !isAddress(manageAddress)) return;
    writeContract({
      address: manageContractAddress,
      abi: ACCESS_CONTROL_ABI,
      functionName: "grantRole",
      args: [
        ROLE_BYTES32[manageGrantRole] ?? DEFAULT_ADMIN_ROLE,
        getAddress(manageAddress) as `0x${string}`,
      ],
    });
    toast.success("grantRole submitted");
  }, [manageContractAddress, manageAddress, manageGrantRole, writeContract]);

  const handleRevoke = useCallback(() => {
    if (!manageContractAddress || !manageAddress || !isAddress(manageAddress)) return;
    writeContract({
      address: manageContractAddress,
      abi: ACCESS_CONTROL_ABI,
      functionName: "revokeRole",
      args: [
        ROLE_BYTES32[manageRevokeRole] ?? DEFAULT_ADMIN_ROLE,
        getAddress(manageAddress) as `0x${string}`,
      ],
    });
    toast.success("revokeRole submitted");
  }, [manageContractAddress, manageAddress, manageRevokeRole, writeContract]);

  // -------------------- Grant Full Admin Panel --------------------
  const [bulkTargetAddress, setBulkTargetAddress] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);

  const { writeContractAsync } = useWriteContract();

  const handleOpenBulk = useCallback((address: string) => {
    setBulkTargetAddress(address);
    setManageAddress(null);
    setBulkResults(
      CONTRACTS.map((def) => ({ name: def.name, status: "waiting" })),
    );
  }, []);

  const handleCloseBulk = useCallback(() => {
    setBulkTargetAddress(null);
    setBulkResults([]);
    setBulkRunning(false);
  }, []);

  const handleStartBulk = useCallback(async () => {
    if (!bulkTargetAddress || !isAddress(bulkTargetAddress)) return;
    setBulkRunning(true);
    setBulkResults(
      CONTRACTS.map((def) => ({ name: def.name, status: "waiting" })),
    );

    for (let i = 0; i < CONTRACTS.length; i++) {
      const def = CONTRACTS[i];
      setBulkResults((prev) =>
        prev.map((row, idx) =>
          idx === i ? { ...row, status: "pending" } : row,
        ),
      );

      const addr = (contracts as Record<string, string> | undefined)?.[
        def.addressKey
      ];
      if (!addr || !isAddress(addr)) {
        setBulkResults((prev) =>
          prev.map((row, idx) =>
            idx === i
              ? { ...row, status: "error", error: "Address not configured" }
              : row,
          ),
        );
        continue;
      }

      try {
        const txHash = await writeContractAsync({
          address: addr as `0x${string}`,
          abi: ACCESS_CONTROL_ABI,
          functionName: "grantRole",
          args: [
            DEFAULT_ADMIN_ROLE,
            getAddress(bulkTargetAddress) as `0x${string}`,
          ],
        });
        setBulkResults((prev) =>
          prev.map((row, idx) =>
            idx === i ? { ...row, status: "success", hash: txHash } : row,
          ),
        );
      } catch (e) {
        setBulkResults((prev) =>
          prev.map((row, idx) =>
            idx === i
              ? {
                  ...row,
                  status: "error",
                  error:
                    e instanceof Error ? e.message.slice(0, 120) : "Failed",
                }
              : row,
          ),
        );
      }
    }

    setBulkRunning(false);
    // Refresh roles after bulk run
    if (bulkTargetAddress) {
      void refreshWatched(watchedAddresses);
      if (
        userAddress &&
        bulkTargetAddress.toLowerCase() === userAddress.toLowerCase()
      ) {
        void refreshMyRoles();
      }
    }
  }, [
    bulkTargetAddress,
    contracts,
    writeContractAsync,
    refreshWatched,
    watchedAddresses,
    refreshMyRoles,
    userAddress,
  ]);

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* My Roles                                                      */}
      {/* ============================================================ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ds-gray-1000">My Roles</h2>
          <button
            type="button"
            onClick={() => void refreshMyRoles()}
            disabled={!userAddress || myRolesLoading}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-ds-gray-200 text-ds-gray-900 hover:bg-ds-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {myRolesLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {!userAddress ? (
          <div className="rounded-md border border-ds-gray-400 bg-ds-background-200 px-3 py-4 text-xs text-ds-gray-700">
            Connect a wallet to see your roles.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CONTRACTS.map((def) => {
              const map = myRoles[def.id] ?? {};
              return (
                <div
                  key={def.id}
                  className="rounded-md border border-ds-gray-400 bg-ds-background-200 px-3 py-3"
                >
                  <div className="text-sm font-medium text-ds-gray-1000 mb-2">
                    {def.name}
                  </div>
                  <ul className="space-y-1">
                    {def.roles.map((roleName) => {
                      const val = map[roleName];
                      return (
                        <li
                          key={roleName}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="font-geist-mono text-ds-gray-700">
                            {roleName}
                          </span>
                          <span
                            className={
                              val === true
                                ? "text-ds-green-400 font-semibold"
                                : val === null
                                  ? "text-ds-gray-400"
                                  : "text-ds-gray-600"
                            }
                          >
                            {val === true ? "✓" : val === null ? "—" : "✗"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/* Watch Wallets                                                 */}
      {/* ============================================================ */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ds-gray-1000">
            Watch Wallets
          </h2>
          {walletsLoading && (
            <span className="text-xs text-ds-gray-600 inline-flex items-center gap-1.5">
              <svg
                className="w-3 h-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading...
            </span>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <AddressInput
              label="Add Wallet"
              value={newWatchAddress}
              onChange={setNewWatchAddress}
              placeholder="0x..."
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAddWatch()}
            disabled={!isAddress(newWatchAddress.trim())}
            className="h-9 px-4 rounded-md text-sm font-medium bg-ds-gray-1000 text-ds-background-100 hover:bg-ds-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>

        {watchedAddresses.length === 0 ? (
          <div className="rounded-md border border-ds-gray-400 bg-ds-background-200 px-3 py-4 text-xs text-ds-gray-700">
            No watched wallets yet. Add one above to start.
          </div>
        ) : (
          <div className="rounded-md border border-ds-gray-400 bg-ds-background-200 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-ds-gray-400 text-left text-[10px] uppercase tracking-wider text-ds-gray-600">
                  <th className="px-3 py-2 font-medium">Address</th>
                  {CONTRACTS.map((c) => (
                    <th key={c.id} className="px-3 py-2 font-medium">
                      {c.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {watchedAddresses.map((addr) => {
                  const rolesForAddr = watchedRoles[addr] ?? {};
                  return (
                    <tr
                      key={addr}
                      className="border-b border-ds-gray-400 last:border-0 hover:bg-ds-background-100/40"
                    >
                      <td className="px-3 py-2 font-geist-mono text-ds-gray-900">
                        {truncateAddress(addr)}
                      </td>
                      {CONTRACTS.map((c) => {
                        const map = rolesForAddr[c.id] ?? {};
                        const allNull = c.roles.every((r) => map[r] === null);
                        return (
                          <td key={c.id} className="px-3 py-2">
                            {allNull ? (
                              <span className="text-ds-gray-500 text-[11px]">—</span>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {c.roles.map((roleName) => {
                                  const val = map[roleName];
                                  if (val === null) return (
                                    <span key={roleName} title={`${roleName}: N/A`} className="inline-block w-2.5 h-2.5 rounded-full bg-ds-gray-300 opacity-40" />
                                  );
                                  return (
                                    <span
                                      key={roleName}
                                      title={`${roleName}: ${val ? "Yes" : "No"}`}
                                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                                        val
                                          ? ROLE_DOT_COLORS[roleName] ??
                                            "bg-ds-green-500"
                                          : "bg-ds-gray-400"
                                      }`}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenManage(addr)}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-ds-gray-200 text-ds-gray-900 hover:bg-ds-gray-300 transition-colors"
                          >
                            Manage
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenBulk(addr)}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-ds-amber-500/15 text-ds-amber-600 hover:bg-ds-amber-500/25 transition-colors"
                          >
                            Grant Full Admin
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveWatch(addr)}
                            className="px-2 py-1 rounded text-[11px] font-medium text-ds-red-400 hover:bg-ds-red-700/10 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Role legend */}
        <div className="rounded-md border border-ds-gray-400 bg-ds-background-200 px-3 py-2 text-xs">
          <p className="text-[10px] uppercase tracking-wider text-ds-gray-600 font-medium mb-2">
            Legend
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            {Object.entries(ROLE_DOT_COLORS).map(([roleName, cls]) => (
              <span key={roleName} className="inline-flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />
                <span className="text-ds-gray-700 font-geist-mono">
                  {roleName}
                </span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-ds-gray-400" />
              <span className="text-ds-gray-700">Not held</span>
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Manage Panel                                                  */}
      {/* ============================================================ */}
      {manageAddress && (
        <section className="rounded-md border border-ds-gray-400 bg-ds-background-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ds-gray-1000">
              Manage —{" "}
              <span className="font-geist-mono text-ds-gray-700">
                {truncateAddress(manageAddress)}
              </span>
            </h2>
            <button
              type="button"
              onClick={handleCloseManage}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-ds-gray-200 text-ds-gray-900 hover:bg-ds-gray-300 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Contract selector */}
          <div className="flex flex-wrap gap-2">
            {CONTRACTS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleManageContractSelect(c.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  manageContractId === c.id
                    ? "bg-ds-gray-1000 text-ds-background-100"
                    : "bg-ds-gray-200 text-ds-gray-900 hover:bg-ds-gray-300"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Current roles for the wallet on the selected contract */}
          <div className="rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-ds-gray-600 font-medium mb-2">
              Current roles on {manageContractDef.name}
            </p>
            <ul className="space-y-1">
              {manageContractDef.roles.map((roleName) => {
                const has =
                  watchedRoles[manageAddress]?.[manageContractDef.id]?.[
                    roleName
                  ] === true;
                return (
                  <li
                    key={roleName}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-geist-mono text-ds-gray-700">
                      {roleName}
                    </span>
                    <span
                      className={
                        has
                          ? "text-ds-green-400 font-semibold"
                          : "text-ds-gray-600"
                      }
                    >
                      {has ? "✓" : "✗"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Grant / Revoke forms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AdminFunctionForm
              title="grantRole"
              description={`Grant a role on ${manageContractDef.name}`}
              permission="owner"
              hasPermission={!!userAddress}
              onSubmit={handleGrant}
              submitLabel="Grant"
              isLoading={managePending || manageConfirming}
              txStatus={manageTxStatus}
              txHash={manageTxHash}
              onTxReset={manageReset}
            >
              <RoleSelect
                label="Role"
                value={manageGrantRole}
                onChange={setManageGrantRole}
                options={manageContractDef.roles}
              />
            </AdminFunctionForm>

            <AdminFunctionForm
              title="revokeRole"
              description={`Revoke a role on ${manageContractDef.name}`}
              permission="owner"
              hasPermission={!!userAddress}
              onSubmit={handleRevoke}
              submitLabel="Revoke"
              isLoading={managePending || manageConfirming}
              txStatus={manageTxStatus}
              txHash={manageTxHash}
              onTxReset={manageReset}
            >
              <RoleSelect
                label="Role"
                value={manageRevokeRole}
                onChange={setManageRevokeRole}
                options={manageContractDef.roles}
              />
            </AdminFunctionForm>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* Grant Full Admin Panel                                        */}
      {/* ============================================================ */}
      {bulkTargetAddress && (
        <section className="rounded-md border border-ds-gray-400 bg-ds-background-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ds-gray-1000">
              Grant Full Admin —{" "}
              <span className="font-geist-mono text-ds-gray-700">
                {truncateAddress(bulkTargetAddress)}
              </span>
            </h2>
            <button
              type="button"
              onClick={handleCloseBulk}
              disabled={bulkRunning}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-ds-gray-200 text-ds-gray-900 hover:bg-ds-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {bulkRunning ? "Running…" : "Close"}
            </button>
          </div>

          <p className="text-xs text-ds-gray-700">
            Grants DEFAULT_ADMIN_ROLE on all contracts sequentially. One wallet
            confirmation is required per contract.
          </p>

          <div className="rounded-md border border-ds-gray-400 bg-ds-background-100 p-3">
            <ul className="space-y-2">
              {bulkResults.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-ds-gray-1000 w-56 shrink-0">
                    {row.name}
                  </span>
                  <span className="flex-1 text-right">
                    <BulkStatusCell result={row} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleStartBulk()}
              disabled={bulkRunning}
              className="px-4 py-2 rounded-md text-sm font-medium bg-ds-gray-1000 text-ds-background-100 hover:bg-ds-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {bulkRunning ? "Running…" : "Start"}
            </button>
            {!bulkRunning && bulkResults.some((r) => r.status === "success") && (
              <button
                type="button"
                onClick={handleCloseBulk}
                className="px-4 py-2 rounded-md text-sm font-medium bg-ds-gray-200 text-ds-gray-900 hover:bg-ds-gray-300 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </section>
      )}

      {/* Confirmation status floats below when tx active outside manage panel */}
      {!manageAddress && manageTxStatus !== "idle" && (
        <TransactionStatus
          status={manageTxStatus}
          txHash={manageTxHash}
          onReset={manageReset}
        />
      )}
    </div>
  );
}

// ============================================================================
// RoleSelect — local subcomponent
// ============================================================================

function RoleSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-ds-gray-900">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-ds-gray-400 bg-ds-background-100 px-3 py-2 text-sm text-ds-gray-1000 focus:outline-none focus:ring-2 focus:ring-ds-blue-700"
      >
        {options.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// BulkStatusCell — local subcomponent
// ============================================================================

function BulkStatusCell({ result }: { result: BulkResult }) {
  if (result.status === "waiting") {
    return <span className="text-ds-gray-600">waiting</span>;
  }
  if (result.status === "pending") {
    return (
      <span className="text-ds-blue-400 inline-flex items-center gap-1.5">
        <svg
          className="w-3.5 h-3.5 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        pending…
      </span>
    );
  }
  if (result.status === "success" && result.hash) {
    return (
      <a
        href={`${GIWASCAN_URL}/tx/${result.hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ds-green-400 hover:underline inline-flex items-center gap-1 font-geist-mono"
      >
        ✓ {result.hash.slice(0, 8)}…{result.hash.slice(-6)}
      </a>
    );
  }
  if (result.status === "error") {
    return (
      <span className="text-ds-red-400" title={result.error}>
        ✗ {result.error ? result.error.slice(0, 60) : "Error"}
      </span>
    );
  }
  return null;
}
