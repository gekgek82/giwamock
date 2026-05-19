"use client";

import { ContractTabs } from "@/components/admin/contracts";

export default function ContractsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Contract Management</h1>
        <p className="text-neutral-500">
          Manage GiwaTer protocol smart contracts
        </p>
      </div>

      {/* Tab Navigation */}
      <ContractTabs />

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}
