// The layout.tsx file is used to define the layout for the home route.

import type { Metadata } from "next";

import HomeRouteLayout from "./_components/HomeRouteLayout";

export const metadata: Metadata = {
  title: "Home",
  description: "Home",
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HomeRouteLayout>{children}</HomeRouteLayout>;
}
