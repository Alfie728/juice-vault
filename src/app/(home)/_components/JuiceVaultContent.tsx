"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Grid3X3,
  List,
  Music2,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

import { AnimatedTitle } from "~/features/shared/components/AnimatedTitle";
import { LoadingSpinner } from "~/features/shared/components/LoadingSpinner";
import { SearchBar } from "~/features/shared/components/SearchBar";
import { Button } from "~/features/shared/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "~/features/shared/components/ui/toggle-group";
import { SongGrid } from "~/features/song/components/SongGrid";
import { SongList } from "~/features/song/components/SongList";
import { SongUploadDialog } from "~/features/song/components/SongUploadDialog";
import { useTRPC } from "~/trpc/react";

export function JuiceVaultContent() {
  const { data: session, status } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const trpc = useTRPC();

  const { data: songs, isLoading } = useQuery(trpc.song.list.queryOptions());

  const searchResults = useQuery({
    ...trpc.song.search.queryOptions({ query: searchQuery, type: "text" }), // Changed to text search only
    enabled: searchQuery.length > 2,
  });

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (status === "unauthenticated") {
    redirect("/login");
  }

  // Cast search results to match list format for type compatibility
  const displaySongs = searchQuery.length > 2 ? searchResults.data : songs;
  const isSearching =
    searchQuery.length > 2 ? searchResults.isLoading : isLoading;

  return (
    <div className="min-h-screen w-full">
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center sm:mb-12"
          >
            <AnimatedTitle className="mb-2 text-4xl font-bold sm:mb-4 sm:text-5xl lg:text-6xl">
              JuiceVault
            </AnimatedTitle>
            <p className="mb-6 px-4 text-base text-zinc-400 sm:mb-8 sm:px-0 sm:text-lg lg:text-xl">
              The ultimate collection of unreleased Juice WRLD tracks
            </p>

            {/* Action Buttons */}
            <div className="mb-8 flex justify-center gap-4">
              <SongUploadDialog />
              <Button
                variant="outline"
                className="gap-2 border-zinc-700 text-black hover:border-purple-600"
              >
                <Sparkles className="h-4 w-4" />
                Discover
              </Button>
            </div>

            {/* Search */}
            <div className="mx-auto max-w-2xl">
              <SearchBar
                onSearch={setSearchQuery}
                placeholder="Search for songs, lyrics, or albums..."
              />
            </div>
          </motion.div>

          {/* Quick Stats */}
          {songs && songs.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8 grid grid-cols-3 gap-2 sm:mb-12 sm:gap-4"
            >
              <div className="rounded-lg border border-purple-800/30 bg-gradient-to-br from-purple-900/20 to-purple-900/10 p-3 backdrop-blur-sm sm:rounded-xl sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-zinc-400 sm:text-sm">
                      Total Tracks
                    </p>
                    <p className="text-xl font-bold sm:text-3xl">
                      {songs.length}
                    </p>
                  </div>
                  <Music2 className="hidden h-8 w-8 text-purple-400 sm:block" />
                </div>
              </div>

              <div className="rounded-lg border border-blue-800/30 bg-gradient-to-br from-blue-900/20 to-blue-900/10 p-3 backdrop-blur-sm sm:rounded-xl sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-zinc-400 sm:text-sm">
                      Unreleased
                    </p>
                    <p className="text-xl font-bold sm:text-3xl">
                      {songs.filter((s) => s.isUnreleased).length}
                    </p>
                  </div>
                  <Sparkles className="hidden h-8 w-8 text-blue-400 sm:block" />
                </div>
              </div>

              <div className="rounded-lg border border-pink-800/30 bg-gradient-to-br from-pink-900/20 to-pink-900/10 p-3 backdrop-blur-sm sm:rounded-xl sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-zinc-400 sm:text-sm">
                      Total Plays
                    </p>
                    <p className="text-xl font-bold sm:text-3xl">
                      {songs
                        .reduce((acc, s) => acc + s.playCount, 0)
                        .toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="hidden h-8 w-8 text-pink-400 sm:block" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Songs Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {searchQuery ? "Search Results" : "All Tracks"}
              </h2>

              {/* View Mode Toggle */}
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) =>
                  value && setViewMode(value as "grid" | "list")
                }
                className="rounded-lg bg-zinc-900/50 p-1"
              >
                <ToggleGroupItem
                  value="grid"
                  aria-label="Grid view"
                  className="data-[state=on]:bg-purple-600"
                >
                  <Grid3X3 className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="list"
                  aria-label="List view"
                  className="data-[state=on]:bg-purple-600"
                >
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {isSearching ? (
              <div className="flex h-64 items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : displaySongs && displaySongs.length > 0 ? (
              viewMode === "grid" ? (
                <SongGrid songs={displaySongs} />
              ) : (
                <SongList songs={displaySongs} />
              )
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-4 text-zinc-400">
                <Music2 className="h-16 w-16" />
                <p className="text-xl">
                  {searchQuery
                    ? "No songs found"
                    : "No songs yet. Be the first to upload!"}
                </p>
                {!searchQuery && session && <SongUploadDialog />}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
