"use client";

import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/adminApi";
import { EventTable } from "@/components/admin/events/EventTable";
import type {
  BlockchainEventItem,
  EventCategory,
  EventTypeValue,
} from "@/types/admin";
import { Button, Card, CardContent } from "@/components/admin/ui";

// Category -> EventType mapping
const CATEGORY_EVENT_TYPES: Record<EventCategory, EventTypeValue[]> = {
  POOL: ["MINT", "BURN", "SWAP", "SYNC", "FEES", "CLAIM"],
  CL_POOL: [
    "INITIALIZE",
    "MINT",
    "BURN",
    "SWAP",
    "COLLECT",
    "FLASH",
    "SET_FEE_PROTOCOL",
    "COLLECT_PROTOCOL",
    "INCREASE_OBSERVATION_CARDINALITY",
  ],
  GAUGE: ["DEPOSIT", "WITHDRAW", "NOTIFY_REWARD", "CLAIM_REWARDS"],
  CL_GAUGE: ["DEPOSIT", "WITHDRAW", "CLAIM_FEES"],
  VE: [
    "DEPOSIT",
    "WITHDRAW",
    "SUPPLY",
    "MERGE",
    "SPLIT",
    "LOCK_PERMANENT",
    "UNLOCK_PERMANENT",
    "DELEGATE_CHANGED",
  ],
  VOTER: [
    "GAUGE_CREATED",
    "GAUGE_KILLED",
    "GAUGE_REVIVED",
    "VOTED",
    "ABSTAINED",
    "NOTIFY_REWARD",
    "DISTRIBUTE_REWARD",
    "WHITELIST_TOKEN",
    "WHITELIST_NFT",
  ],
  NFT_POSITION: ["INCREASE_LIQUIDITY", "DECREASE_LIQUIDITY", "NFT_COLLECT"],
  MINTER: ["MINTER_MINT", "NUDGE"],
  REWARD: ["DEPOSIT", "WITHDRAW", "NOTIFY_REWARD", "CLAIM_REWARDS"],
  REWARDS_DISTRIBUTOR: ["CHECKPOINT_TOKEN", "CLAIMED"],
  FACTORY: [
    "POOL_CREATED",
    "TICK_SPACING_ENABLED",
    "SWAP_FEE_MODULE_CHANGED",
    "UNSTAKED_FEE_MODULE_CHANGED",
    "DEFAULT_UNSTAKED_FEE_CHANGED",
  ],
};

const ALL_CATEGORIES: EventCategory[] = [
  "POOL",
  "CL_POOL",
  "GAUGE",
  "CL_GAUGE",
  "VE",
  "VOTER",
  "NFT_POSITION",
  "MINTER",
  "REWARD",
  "REWARDS_DISTRIBUTOR",
  "FACTORY",
];

const PAGE_SIZE = 50;

export default function EventsPage() {
  const [events, setEvents] = useState<BlockchainEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState<EventCategory | "">("");
  const [eventType, setEventType] = useState<EventTypeValue | "">("");

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await adminApi.getEvents({
        category: category || undefined,
        eventType: eventType || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setEvents(response.events);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, [category, eventType, offset]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset offset and eventType when category changes
  const handleCategoryChange = (newCategory: EventCategory | "") => {
    setCategory(newCategory);
    setEventType("");
    setOffset(0);
  };

  const handleEventTypeChange = (newType: EventTypeValue | "") => {
    setEventType(newType);
    setOffset(0);
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - PAGE_SIZE));
  };

  const handleNextPage = () => {
    if (offset + PAGE_SIZE < total) {
      setOffset(offset + PAGE_SIZE);
    }
  };

  // Get available event types for selected category
  const availableEventTypes: EventTypeValue[] = category
    ? CATEGORY_EVENT_TYPES[category] || []
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ds-gray-1000">Blockchain Events</h1>
          <p className="text-sm text-ds-gray-700 mt-1">
            Browse and filter indexed blockchain events
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={fetchEvents}
          loading={isLoading}
        >
          <svg
            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-ds-red-700/10 border border-ds-red-700/20 rounded-lg p-4 text-ds-red-400">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Total Matching</p>
            <p className="text-2xl font-semibold text-ds-gray-1000">
              {total.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Category Filter</p>
            <p className="text-2xl font-semibold text-ds-gray-1000">
              {category || "All"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">Type Filter</p>
            <p className="text-2xl font-semibold text-ds-gray-1000">
              {eventType || "All"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Category Filter */}
        <div>
          <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
            Category
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => handleCategoryChange("")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-100 ${
                category === ""
                  ? "bg-ds-gray-1000 text-ds-background-100"
                  : "bg-ds-gray-200 text-ds-gray-700 hover:text-ds-gray-1000 border border-ds-gray-400"
              }`}
            >
              All
            </button>
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-100 ${
                  category === cat
                    ? "bg-ds-gray-1000 text-ds-background-100"
                    : "bg-ds-gray-200 text-ds-gray-700 hover:text-ds-gray-1000 border border-ds-gray-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Event Type Filter (only when category is selected) */}
        {category && availableEventTypes.length > 0 && (
          <div>
            <label className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider">
              Event Type
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => handleEventTypeChange("")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-100 ${
                  eventType === ""
                    ? "bg-ds-gray-1000 text-ds-background-100"
                    : "bg-ds-gray-200 text-ds-gray-700 hover:text-ds-gray-1000 border border-ds-gray-400"
                }`}
              >
                All
              </button>
              {availableEventTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => handleEventTypeChange(type)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-100 ${
                    eventType === type
                      ? "bg-ds-gray-1000 text-ds-background-100"
                      : "bg-ds-gray-200 text-ds-gray-700 hover:text-ds-gray-1000 border border-ds-gray-400"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Event Table */}
      <EventTable events={events} isLoading={isLoading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ds-gray-700">
            Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of{" "}
            {total.toLocaleString()} events
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrevPage}
              disabled={offset === 0 || isLoading}
            >
              Previous
            </Button>
            <span className="text-sm text-ds-gray-700">
              Page {currentPage} of {totalPages.toLocaleString()}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleNextPage}
              disabled={offset + PAGE_SIZE >= total || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
