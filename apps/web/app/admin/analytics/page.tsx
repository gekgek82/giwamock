import {
  Card,
  CardContent,
} from "@/components/admin/ui";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-ds-gray-1000">Analytics</h1>
        <p className="text-sm text-ds-gray-700 mt-1">
          Platform analytics and metrics overview
        </p>
      </div>

      {/* Temporary Notice */}
      <div className="bg-ds-yellow-700/10 border border-ds-yellow-700/20 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-ds-yellow-400 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h2 className="text-sm font-semibold text-ds-yellow-400">
              Under Construction
            </h2>
            <p className="text-sm text-ds-gray-700 mt-1">
              This page is currently being developed. Analytics dashboards and
              charts will be available here soon.
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {["Total Users", "Total TVL", "24h Volume", "Total Transactions"].map(
          (title) => (
            <Card key={title}>
              <CardContent className="py-4">
                <p className="text-[11px] font-medium text-ds-gray-600 uppercase tracking-wider mb-1">{title}</p>
                <p className="text-2xl font-semibold text-ds-gray-600 font-geist-mono">&mdash;</p>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
