"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { keccak256, toBytes, isAddress, getAddress } from "viem";
import {
  ContractStateCard,
  AdminFunctionForm,
  AddressInput,
  TxStatus,
} from "@/components/admin/contracts";
import { useContractAddresses } from "@/hooks/useContractAddresses";
import toast from "react-hot-toast";

// ============================================================================
// AccessControl ABI — minimal, shared across all contracts
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
  {
    name: "renounceRole",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "callerConfirmation", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "getRoleAdmin",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "role", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
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
  addressKey: KnownAddressKey | null;
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
  {
    id: "custom",
    name: "Custom",
    addressKey: null,
    roles: ["DEFAULT_ADMIN_ROLE"],
  },
];

// ============================================================================
// Component
// ============================================================================

export default function AccessControlPage() {
  const { address: userAddress } = useAccount();
  const { contracts } = useContractAddresses();
  const publicClient = usePublicClient();

  const [selectedId, setSelectedId] = useState("terPoint");
  const [customAddress, setCustomAddress] = useState("");

  // Check role state
  const [checkAddress, setCheckAddress] = useState("");
  const [checkRole, setCheckRole] = useState("DEFAULT_ADMIN_ROLE");
  const [checkResult, setCheckResult] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Write form state
  const [grantRoleName, setGrantRoleName] = useState("DEFAULT_ADMIN_ROLE");
  const [grantAddress, setGrantAddress] = useState("");
  const [revokeRoleName, setRevokeRoleName] = useState("DEFAULT_ADMIN_ROLE");
  const [revokeAddress, setRevokeAddress] = useState("");
  const [renounceRoleName, setRenounceRoleName] = useState("DEFAULT_ADMIN_ROLE");

  const { data: hash, writeContract, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const getTxStatus = (): TxStatus => {
    if (isPending) return "pending";
    if (isConfirming) return "confirming";
    if (isSuccess) return "success";
    return "idle";
  };

  const selectedDef = useMemo(
    () => CONTRACTS.find((c) => c.id === selectedId) ?? CONTRACTS[0],
    [selectedId],
  );

  const contractAddress = useMemo((): `0x${string}` | undefined => {
    if (selectedDef.addressKey === null) {
      const t = customAddress.trim();
      return isAddress(t) ? (getAddress(t) as `0x${string}`) : undefined;
    }
    const addr = (contracts as Record<string, string> | undefined)?.[selectedDef.addressKey];
    return addr && isAddress(addr) ? (addr as `0x${string}`) : undefined;
  }, [contracts, customAddress, selectedDef]);

  const handleSelectContract = useCallback((id: string) => {
    setSelectedId(id);
    setCheckResult(null);
    const def = CONTRACTS.find((c) => c.id === id) ?? CONTRACTS[0];
    setCheckRole(def.roles[0]);
    setGrantRoleName(def.roles[0]);
    setRevokeRoleName(def.roles[0]);
    setRenounceRoleName(def.roles[0]);
  }, []);

  const handleCheckRole = useCallback(async () => {
    if (!contractAddress || !isAddress(checkAddress) || !publicClient) return;
    setCheckResult(null);
    setIsChecking(true);
    try {
      const result = await publicClient.readContract({
        address: contractAddress,
        abi: ACCESS_CONTROL_ABI,
        functionName: "hasRole",
        args: [
          ROLE_BYTES32[checkRole] ?? DEFAULT_ADMIN_ROLE,
          getAddress(checkAddress) as `0x${string}`,
        ],
      });
      setCheckResult(result as boolean);
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 200) : "Read failed");
    } finally {
      setIsChecking(false);
    }
  }, [contractAddress, checkAddress, checkRole, publicClient]);

  const handleGrant = useCallback(() => {
    if (!contractAddress || !isAddress(grantAddress)) return;
    writeContract({
      address: contractAddress,
      abi: ACCESS_CONTROL_ABI,
      functionName: "grantRole",
      args: [
        ROLE_BYTES32[grantRoleName] ?? DEFAULT_ADMIN_ROLE,
        getAddress(grantAddress) as `0x${string}`,
      ],
    });
    toast.success("grantRole submitted");
  }, [contractAddress, grantRoleName, grantAddress, writeContract]);

  const handleRevoke = useCallback(() => {
    if (!contractAddress || !isAddress(revokeAddress)) return;
    writeContract({
      address: contractAddress,
      abi: ACCESS_CONTROL_ABI,
      functionName: "revokeRole",
      args: [
        ROLE_BYTES32[revokeRoleName] ?? DEFAULT_ADMIN_ROLE,
        getAddress(revokeAddress) as `0x${string}`,
      ],
    });
    toast.success("revokeRole submitted");
  }, [contractAddress, revokeRoleName, revokeAddress, writeContract]);

  const handleRenounce = useCallback(() => {
    if (!contractAddress || !userAddress) return;
    writeContract({
      address: contractAddress,
      abi: ACCESS_CONTROL_ABI,
      functionName: "renounceRole",
      args: [ROLE_BYTES32[renounceRoleName] ?? DEFAULT_ADMIN_ROLE, userAddress],
    });
    toast.success("renounceRole submitted");
  }, [contractAddress, renounceRoleName, userAddress, writeContract]);

  const roles = selectedDef.roles;

  return (
    <div className="space-y-6">
      {/* Contract selector */}
      <div className="flex flex-wrap gap-2">
        {CONTRACTS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => handleSelectContract(c.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              selectedId === c.id
                ? "bg-ds-gray-1000 text-ds-background-100"
                : "bg-ds-gray-200 text-ds-gray-900 hover:bg-ds-gray-300"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Custom address input */}
      {selectedDef.addressKey === null && (
        <AddressInput
          label="Contract Address"
          value={customAddress}
          onChange={setCustomAddress}
          required
          helperText="Any contract implementing OpenZeppelin AccessControl"
        />
      )}

      {/* State card */}
      <ContractStateCard
        title={selectedDef.name}
        description={`AccessControl role management — ${selectedDef.roles.join(", ")}`}
        contractAddress={contractAddress}
        items={[
          { label: "Contract", value: contractAddress ?? "—", type: "address" },
          { label: "Connected wallet", value: userAddress ?? "—", type: "address" },
        ]}
        isLoading={false}
        onRefresh={() => setCheckResult(null)}
      />

      {/* Role bytes32 reference */}
      <div className="rounded-md border border-ds-gray-400 bg-ds-background-200 px-3 py-2 text-xs font-geist-mono space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-ds-gray-600 font-sans font-medium mb-2">
          Role bytes32 reference
        </p>
        {roles.map((roleName) => (
          <div key={roleName} className="flex gap-2 flex-wrap">
            <span className="text-ds-gray-900 font-medium w-48 shrink-0">{roleName}</span>
            <span className="text-ds-gray-600 break-all">{ROLE_BYTES32[roleName]}</span>
          </div>
        ))}
      </div>

      {/* Check Role */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Read</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminFunctionForm
          title="hasRole"
          description="Check whether an address holds a specific role"
          permission="voter"
          hasPermission={!!userAddress}
          onSubmit={() => void handleCheckRole()}
          submitLabel={isChecking ? "Checking…" : "Check"}
          isLoading={isChecking}
          txStatus="idle"
          txHash={undefined}
          onTxReset={() => {}}
        >
          <RoleSelect
            label="Role"
            value={checkRole}
            onChange={(v) => {
              setCheckRole(v);
              setCheckResult(null);
            }}
            options={roles}
          />
          <div className="mt-3">
            <AddressInput
              label="Address"
              value={checkAddress}
              onChange={(v) => {
                setCheckAddress(v);
                setCheckResult(null);
              }}
              required
            />
          </div>
          {checkResult !== null && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-sm font-medium ${
                checkResult
                  ? "bg-ds-green-100 text-ds-green-700"
                  : "bg-ds-red-100 text-ds-red-700"
              }`}
            >
              {checkResult ? "✓ Has role" : "✗ Does not have role"}
            </div>
          )}
        </AdminFunctionForm>
      </div>

      {/* Grant / Revoke */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Write — requires DEFAULT_ADMIN_ROLE</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminFunctionForm
          title="grantRole"
          description="Grant a role to an address"
          permission="owner"
          hasPermission={!!userAddress}
          onSubmit={handleGrant}
          submitLabel="Grant"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <RoleSelect
            label="Role"
            value={grantRoleName}
            onChange={setGrantRoleName}
            options={roles}
          />
          <div className="mt-3">
            <AddressInput label="Address" value={grantAddress} onChange={setGrantAddress} required />
          </div>
        </AdminFunctionForm>

        <AdminFunctionForm
          title="revokeRole"
          description="Revoke a role from an address"
          permission="owner"
          hasPermission={!!userAddress}
          onSubmit={handleRevoke}
          submitLabel="Revoke"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <RoleSelect
            label="Role"
            value={revokeRoleName}
            onChange={setRevokeRoleName}
            options={roles}
          />
          <div className="mt-3">
            <AddressInput
              label="Address"
              value={revokeAddress}
              onChange={setRevokeAddress}
              required
            />
          </div>
        </AdminFunctionForm>
      </div>

      {/* Renounce */}
      <h3 className="text-sm font-semibold text-ds-gray-1000">Write — self only</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminFunctionForm
          title="renounceRole"
          description="Remove your own role — irreversible without another admin"
          permission="voter"
          hasPermission={!!userAddress}
          onSubmit={handleRenounce}
          submitLabel="Renounce My Role"
          isLoading={isPending || isConfirming}
          txStatus={getTxStatus()}
          txHash={hash}
          onTxReset={reset}
        >
          <RoleSelect
            label="Role to renounce"
            value={renounceRoleName}
            onChange={setRenounceRoleName}
            options={roles}
          />
          <p className="text-xs text-ds-gray-700 mt-2">
            callerConfirmation:{" "}
            <code className="font-geist-mono text-ds-gray-900">{userAddress ?? "—"}</code>
          </p>
        </AdminFunctionForm>
      </div>
    </div>
  );
}

// ============================================================================
// RoleSelect
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
