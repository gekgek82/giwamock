"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import type {
  BasePointConfig,
  UpdateBasePointConfigRequest,
} from "@/types/admin";
import { EditBaseConfigModal } from "./EditBaseConfigModal";
import toast from "react-hot-toast";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from "@/components/admin/ui";

const DAILY_BASE_CAP = 700_000;

export function BaseLayerSection() {
  const [currentConfig, setCurrentConfig] = useState<BasePointConfig | null>(null);
  const [history, setHistory] = useState<BasePointConfig[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 10, offset: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = useCallback(async (offset = 0) => {
    setIsLoading(true);
    try {
      const [config, hist] = await Promise.all([
        adminApi.getBasePointConfigCurrent().catch(() => null),
        adminApi.getBasePointConfigHistory(10, offset),
      ]);
      setCurrentConfig(config);
      setHistory(hist.items);
      setPagination({ total: hist.total, limit: 10, offset });
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async (data: UpdateBasePointConfigRequest) => {
    await adminApi.updateBasePointConfig(data);
    toast.success("Base config updated successfully");
    fetchData(pagination.offset);
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <Card>
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-sm bg-ds-blue-700" />
          <div>
            <CardTitle>Base Layer</CardTitle>
            <CardDescription>
              Default LP/SWAP ratio — rarely changed
            </CardDescription>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowEditModal(true)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
          Edit
        </Button>
      </CardHeader>

      {/* Current Config */}
      <CardContent>
        {isLoading ? (
          <div className="h-20 bg-ds-gray-300 rounded animate-pulse" />
        ) : currentConfig ? (
          <div className="flex items-center gap-6">
            {/* Ratio Cards */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="bg-ds-blue-700/10 border border-ds-blue-700/20 rounded-lg p-4">
                <p className="text-xs text-ds-blue-400 mb-1">LP (Liquidity)</p>
                <p className="text-2xl font-semibold text-ds-gray-1000 font-geist-mono">
                  {(parseFloat(currentConfig.lpWeight) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-ds-gray-700 mt-1 font-geist-mono">
                  {Math.round(DAILY_BASE_CAP * parseFloat(currentConfig.lpWeight)).toLocaleString()} P/day
                </p>
              </div>
              <div className="bg-ds-yellow-700/10 border border-ds-yellow-700/20 rounded-lg p-4">
                <p className="text-xs text-ds-yellow-400 mb-1">SWAP (Trading)</p>
                <p className="text-2xl font-semibold text-ds-gray-1000 font-geist-mono">
                  {(parseFloat(currentConfig.tradeWeight) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-ds-gray-700 mt-1 font-geist-mono">
                  {Math.round(DAILY_BASE_CAP * parseFloat(currentConfig.tradeWeight)).toLocaleString()} P/day
                </p>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="flex-1">
              <div className="flex h-3 rounded-full overflow-hidden mb-2">
                <div
                  className="bg-ds-blue-700 transition-all duration-300"
                  style={{ width: `${parseFloat(currentConfig.lpWeight) * 100}%` }}
                />
                <div
                  className="bg-ds-yellow-400 transition-all duration-300"
                  style={{ width: `${parseFloat(currentConfig.tradeWeight) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-ds-gray-600">
                <div>
                  <span>Since: </span>
                  <span className="text-ds-gray-900">
                    {new Date(currentConfig.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span>Daily Cap: </span>
                  <span className="text-ds-gray-900 font-geist-mono">{DAILY_BASE_CAP.toLocaleString()} P</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-ds-gray-700">
            <p>No active base point config</p>
            <p className="text-sm text-ds-gray-600 mt-1">
              Click Edit to create one
            </p>
          </div>
        )}
      </CardContent>

      {/* History Toggle */}
      {history.length > 0 && (
        <>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-6 py-3 border-t border-ds-gray-400 text-sm text-ds-gray-700 hover:text-ds-gray-900 hover:bg-ds-gray-100 transition-colors duration-100"
          >
            <span>Change History ({pagination.total})</span>
            <svg
              className={`w-4 h-4 transition-transform ${showHistory ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showHistory && (
            <div className="border-t border-ds-gray-400">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ds-gray-100">
                    <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Changed At</th>
                    <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">LP</th>
                    <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">SWAP</th>
                    <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Changed By</th>
                    <th className="h-10 px-4 text-left text-xs font-medium text-ds-gray-700 uppercase tracking-wider">Memo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-gray-400">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-ds-gray-100 transition-colors duration-100">
                      <td className="px-4 py-3 text-sm text-ds-gray-1000">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-ds-blue-400 font-geist-mono">
                        {(parseFloat(item.lpWeight) * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-ds-yellow-400 font-geist-mono">
                        {(parseFloat(item.tradeWeight) * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-xs text-ds-gray-700">
                        {item.createdBy || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-ds-gray-700 max-w-[200px] truncate">
                        {item.memo || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <CardFooter className="justify-between">
                  <p className="text-sm text-ds-gray-700">Page {currentPage} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => fetchData(Math.max(0, pagination.offset - pagination.limit))}
                      disabled={pagination.offset === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => fetchData(pagination.offset + pagination.limit)}
                      disabled={pagination.offset + pagination.limit >= pagination.total}
                    >
                      Next
                    </Button>
                  </div>
                </CardFooter>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      <EditBaseConfigModal
        isOpen={showEditModal}
        currentConfig={currentConfig}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdate}
      />
    </Card>
  );
}
