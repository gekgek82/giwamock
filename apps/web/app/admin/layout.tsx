import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AdminLayoutClient } from "./AdminLayoutClient";

export const metadata: Metadata = {
  title: "Admin",
  description:
    "GiwaTer Admin Dashboard — manage seasons, points, and contracts.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} font-geist`}>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </div>
  );
}
