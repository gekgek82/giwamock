"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/admin/ui";

interface TableInfo {
  name: string;
  rowCount: number;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

export default function DatabasePage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [sql, setSql] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const data = await adminApi.getDatabaseTables();
      setTables(data);
    } catch (err) {
      console.error("Failed to load tables:", err);
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const FORBIDDEN_PATTERN = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|RENAME)\b/i;

  const executeQuery = async () => {
    if (!sql.trim()) return;
    if (FORBIDDEN_PATTERN.test(sql.trim())) {
      setQueryError(
        "Read-only mode: Only SELECT, WITH, and EXPLAIN queries are allowed. " +
        "INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE and other write operations are blocked."
      );
      setQueryResult(null);
      return;
    }
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const result = await adminApi.executeDatabaseQuery(sql);
      setQueryResult(result);
    } catch (err) {
      setQueryError(
        err instanceof Error ? err.message : "Query execution failed"
      );
    } finally {
      setQueryLoading(false);
    }
  };

  const handleTableClick = async (tableName: string) => {
    // Try created_at -> id -> updated_at as ORDER BY fallbacks
    const queries = [
      `SELECT * FROM "${tableName}" ORDER BY created_at DESC LIMIT 100`,
      `SELECT * FROM "${tableName}" ORDER BY id DESC LIMIT 100`,
      `SELECT * FROM "${tableName}" ORDER BY updated_at DESC LIMIT 100`,
    ];

    setSql(queries[0]);
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      for (let i = 0; i < queries.length; i++) {
        setSql(queries[i]);
        try {
          const result = await adminApi.executeDatabaseQuery(queries[i]);
          setQueryResult(result);
          return;
        } catch (err) {
          if (i === queries.length - 1) {
            setQueryError(
              err instanceof Error ? err.message : "Query execution failed"
            );
          }
        }
      }
    } finally {
      setQueryLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      executeQuery();
    }
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">Database</h1>
          <p className="text-sm text-ds-gray-700 mt-1">
            Browse tables and run SQL queries
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tables Panel */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tables</CardTitle>
              <button
                onClick={loadTables}
                className="text-xs text-ds-gray-700 hover:text-ds-gray-1000 transition-colors"
              >
                Refresh
              </button>
            </CardHeader>
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {tablesLoading ? (
                <div className="p-4 text-center text-ds-gray-700 text-sm">
                  Loading...
                </div>
              ) : (
                <ul className="divide-y divide-ds-gray-400">
                  {tables.map((table) => (
                    <li key={table.name}>
                      <button
                        onClick={() => handleTableClick(table.name)}
                        className="w-full text-left px-4 py-2.5 hover:bg-ds-gray-100 transition-colors duration-100 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ds-gray-900 group-hover:text-ds-gray-1000 font-geist-mono truncate">
                            {table.name}
                          </span>
                          <span className="text-xs text-ds-gray-600 ml-2 shrink-0 font-geist-mono">
                            {table.rowCount.toLocaleString()}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Query Panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* SQL Editor */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>SQL Query</CardTitle>
              <span className="text-xs text-ds-gray-600">
                Ctrl+Enter to execute
              </span>
            </CardHeader>
            <CardContent>
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="SELECT * FROM pools LIMIT 10"
                className="w-full h-32 bg-ds-gray-100 text-ds-gray-900 font-geist-mono text-sm p-3 rounded-md border border-ds-gray-400 focus:border-ds-gray-700 focus:outline-none focus:ring-2 focus:ring-ds-gray-1000/20 resize-y placeholder:text-ds-gray-600 transition-colors duration-150"
                spellCheck={false}
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-ds-gray-600">
                  Read-only: SELECT, WITH, EXPLAIN only
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={executeQuery}
                  disabled={queryLoading || !sql.trim()}
                  loading={queryLoading}
                >
                  {queryLoading ? "Running..." : "Execute"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          {queryError && (
            <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4">
              <p className="text-sm text-ds-red-400 font-geist-mono whitespace-pre-wrap">
                {queryError}
              </p>
            </div>
          )}

          {/* Results */}
          {queryResult && (
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Results</CardTitle>
                <span className="text-xs text-ds-gray-600 font-geist-mono">
                  {queryResult.rowCount} row{queryResult.rowCount !== 1 ? "s" : ""}{" "}
                  in {queryResult.executionTimeMs}ms
                </span>
              </CardHeader>
              {queryResult.rows.length === 0 ? (
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-ds-gray-700">No rows returned</p>
                </CardContent>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ds-gray-400 bg-ds-gray-100">
                        {queryResult.columns.map((col) => (
                          <th
                            key={col}
                            className="px-4 py-2.5 text-left text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ds-gray-400">
                      {queryResult.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-ds-gray-100 transition-colors duration-100"
                        >
                          {queryResult.columns.map((col) => (
                            <td
                              key={col}
                              className="px-4 py-2 text-ds-gray-900 font-geist-mono text-xs whitespace-nowrap max-w-xs truncate"
                              title={formatCellValue(row[col])}
                            >
                              {row[col] === null || row[col] === undefined ? (
                                <span className="text-ds-gray-600 italic">
                                  NULL
                                </span>
                              ) : (
                                formatCellValue(row[col])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
