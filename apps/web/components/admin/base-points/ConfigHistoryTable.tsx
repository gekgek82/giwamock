"use client";

import type { BasePointConfig } from "@/types/admin";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from "@/components/admin/ui";

interface ConfigHistoryTableProps {
  items: BasePointConfig[];
  isLoading: boolean;
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  onPageChange: (offset: number) => void;
}

export function ConfigHistoryTable({
  items,
  isLoading,
  pagination,
  onPageChange,
}: ConfigHistoryTableProps) {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 bg-ds-gray-300 rounded animate-pulse"
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-ds-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="text-sm font-semibold text-ds-gray-1000 mb-2">
            No Change History
          </h3>
          <p className="text-sm text-ds-gray-700">
            Config changes will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change History</CardTitle>
        <CardDescription>
          {pagination.total} total records
        </CardDescription>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ds-gray-100">
              <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">
                Changed At
              </th>
              <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">
                LP Weight
              </th>
              <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">
                SWAP Weight
              </th>
              <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">
                Changed By
              </th>
              <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">
                Memo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-gray-400">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-ds-gray-100 transition-colors duration-100"
              >
                <td className="px-4 py-3">
                  <span className="text-sm text-ds-gray-1000">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-ds-blue-400 font-geist-mono">
                    {(parseFloat(item.lpWeight) * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-ds-yellow-400 font-geist-mono">
                    {(parseFloat(item.tradeWeight) * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-ds-gray-700">
                    {item.createdBy || "-"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-ds-gray-700 max-w-[200px] truncate block">
                    {item.memo || "-"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <CardFooter className="justify-between">
          <p className="text-sm text-ds-gray-700">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onPageChange(Math.max(0, pagination.offset - pagination.limit))
              }
              disabled={pagination.offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onPageChange(pagination.offset + pagination.limit)
              }
              disabled={pagination.offset + pagination.limit >= pagination.total}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
