"use client";

import { useState } from "react";
import Image from "next/image";
import type { AdminTokenInfo } from "@/types/admin";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Toggle,
  Card,
  CardContent,
} from "@/components/admin/ui";

const EXPLORER_BASE_URL = "https://sepolia-explorer.giwa.io/address";

interface TokenTableProps {
  tokens: AdminTokenInfo[];
  isLoading: boolean;
  onEdit: (token: AdminTokenInfo) => void;
  onDelete: (address: string) => void;
  onUploadIcon: (token: AdminTokenInfo) => void;
  onUploadSticker: (token: AdminTokenInfo) => void;
  onTogglePopular: (address: string, isPopular: boolean) => Promise<void>;
  onToggleWhitelist: (address: string, isWhitelisted: boolean) => Promise<void>;
  onToggleVerified: (address: string, isVerified: boolean) => Promise<void>;
}

export function TokenTable({
  tokens,
  isLoading,
  onEdit,
  onDelete,
  onUploadIcon,
  onUploadSticker,
  onTogglePopular,
  onToggleWhitelist,
  onToggleVerified,
}: TokenTableProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [togglingPopular, setTogglingPopular] = useState<Set<string>>(new Set());
  const [togglingWhitelist, setTogglingWhitelist] = useState<Set<string>>(new Set());
  const [togglingVerified, setTogglingVerified] = useState<Set<string>>(new Set());

  const handleTogglePopular = async (token: AdminTokenInfo) => {
    setTogglingPopular((prev) => new Set(prev).add(token.address));
    try {
      await onTogglePopular(token.address, !token.isPopular);
    } finally {
      setTogglingPopular((prev) => {
        const next = new Set(prev);
        next.delete(token.address);
        return next;
      });
    }
  };

  const handleToggleWhitelist = async (token: AdminTokenInfo) => {
    setTogglingWhitelist((prev) => new Set(prev).add(token.address));
    try {
      await onToggleWhitelist(token.address, !token.isWhitelisted);
    } finally {
      setTogglingWhitelist((prev) => {
        const next = new Set(prev);
        next.delete(token.address);
        return next;
      });
    }
  };

  const handleToggleVerified = async (token: AdminTokenInfo) => {
    setTogglingVerified((prev) => new Set(prev).add(token.address));
    try {
      await onToggleVerified(token.address, !token.isVerified);
    } finally {
      setTogglingVerified((prev) => {
        const next = new Set(prev);
        next.delete(token.address);
        return next;
      });
    }
  };

  const handleCopyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatAddress = (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-ds-gray-300 rounded animate-pulse"
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (tokens.length === 0) {
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
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-ds-gray-1000 mb-2">
            No Tokens Registered
          </h3>
          <p className="text-sm text-ds-gray-700">Add your first token to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Token</TableHead>
          <TableHead>Address</TableHead>
          <TableHead className="text-center">Whitelist</TableHead>
          <TableHead className="text-center">Sticker</TableHead>
          <TableHead className="text-center">Popular</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tokens.map((token) => (
          <TableRow key={token.address}>
            {/* Token */}
            <TableCell>
              <div className="flex items-center gap-3">
                {token.iconUrl ? (
                  <Image
                    src={token.iconUrl}
                    alt={token.symbol}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-ds-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-xs font-semibold text-ds-gray-700">
                      {token.symbol.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-ds-gray-1000 text-sm">{token.symbol}</p>
                    {token.stickerUrl && (
                      <Image
                        src={token.stickerUrl}
                        alt="sticker"
                        width={18}
                        height={18}
                        className="object-contain"
                      />
                    )}
                  </div>
                  <p className="text-xs text-ds-gray-700">{token.name}</p>
                </div>
              </div>
            </TableCell>
            {/* Address */}
            <TableCell>
              <div className="flex items-center gap-1.5">
                <a
                  href={`${EXPLORER_BASE_URL}/${token.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-geist-mono text-sm text-ds-gray-700 hover:text-ds-blue-400 transition-colors"
                  title={token.address}
                >
                  {formatAddress(token.address)}
                </a>
                <button
                  onClick={() => handleCopyAddress(token.address)}
                  className="p-1 text-ds-gray-600 hover:text-ds-gray-900 rounded transition-colors"
                  title={copiedAddress === token.address ? "Copied!" : "Copy address"}
                >
                  {copiedAddress === token.address ? (
                    <svg className="w-3.5 h-3.5 text-ds-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </TableCell>
            {/* Whitelist Toggle */}
            <TableCell className="text-center">
              <div className="flex justify-center">
                <Toggle
                  checked={token.isWhitelisted}
                  onChange={() => handleToggleWhitelist(token)}
                  disabled={togglingWhitelist.has(token.address)}
                  size="sm"
                />
              </div>
            </TableCell>
            {/* Sticker Toggle */}
            <TableCell className="text-center">
              <div className="group relative flex justify-center">
                <Toggle
                  checked={token.isVerified}
                  onChange={() => handleToggleVerified(token)}
                  disabled={togglingVerified.has(token.address)}
                  size="sm"
                />
                <span className="invisible group-hover:visible absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-ds-gray-1000 bg-ds-gray-200 border border-ds-gray-400 rounded whitespace-nowrap z-10">
                  Verified Token
                </span>
              </div>
            </TableCell>
            {/* Popular Toggle */}
            <TableCell className="text-center">
              <div className="flex justify-center">
                <Toggle
                  checked={token.isPopular}
                  onChange={() => handleTogglePopular(token)}
                  disabled={togglingPopular.has(token.address)}
                  size="sm"
                />
              </div>
            </TableCell>
            {/* Actions */}
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                {/* Edit Button */}
                <button
                  onClick={() => onEdit(token)}
                  className="p-2 text-ds-gray-700 hover:text-ds-blue-400 hover:bg-ds-blue-700/10 rounded-md transition-colors"
                  title="Edit token"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                {/* Upload Icon Button */}
                <button
                  onClick={() => onUploadIcon(token)}
                  className="p-2 text-ds-gray-700 hover:text-ds-blue-400 hover:bg-ds-blue-700/10 rounded-md transition-colors"
                  title="Upload icon"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                {/* Upload Sticker Button */}
                <button
                  onClick={() => onUploadSticker(token)}
                  className="p-2 text-ds-gray-700 hover:text-ds-cyan-400 hover:bg-ds-cyan-700/10 rounded-md transition-colors"
                  title="Upload sticker"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </button>
                {/* Delete Token Button */}
                <button
                  onClick={() => onDelete(token.address)}
                  className="p-2 text-ds-gray-700 hover:text-ds-red-400 hover:bg-ds-red-700/10 rounded-md transition-colors"
                  title="Delete token"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
