import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";

import { AudioPlayerProvider } from "~/features/player/hooks/use-audio-player";
import { MusicPlayer } from "~/features/player/components/MusicPlayer";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "JuiceVault - Unreleased Juice WRLD Tracks",
  description: "The ultimate collection of unreleased Juice WRLD tracks with AI-powered lyrics",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>
          <AudioPlayerProvider>
            {children}
            <MusicPlayer />
          </AudioPlayerProvider>
        </TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
