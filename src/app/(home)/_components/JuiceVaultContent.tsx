"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Music2, Sparkles, TrendingUp, Upload } from "lucide-react";
import { useSession } from "next-auth/react";

import { AnimatedTitle } from "~/features/shared/components/AnimatedTitle";
import { LoadingSpinner } from "~/features/shared/components/LoadingSpinner";
import { SearchBar } from "~/features/shared/components/SearchBar";
import { Button } from "~/features/shared/components/ui/button";
import { AdvancedSongUploadDialog } from "~/features/song/components/AdvancedSongUploadDialog";
import { SongGrid } from "~/features/song/components/SongGrid";
import { useTRPC } from "~/trpc/react";

export function JuiceVaultContent() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const trpc = useTRPC();

  const { data: songs, isLoading } = useQuery(trpc.song.list.queryOptions());

  const searchResults = useQuery({
    ...trpc.song.search.queryOptions({ query: searchQuery, type: "text" }), // Changed to text search only
    enabled: searchQuery.length > 2,
  });

  // Cast search results to match list format for type compatibility
  const displaySongs = searchQuery.length > 2 ? searchResults.data : songs;
  const isSearching =
    searchQuery.length > 2 ? searchResults.isLoading : isLoading;

  const handlePlay = (songId: string) => {
    setCurrentlyPlaying(currentlyPlaying === songId ? null : songId);
  };

  return (
    <div className="min-h-screen">
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center"
          >
            <AnimatedTitle className="mb-4 text-6xl font-bold">
              JuiceVault
            </AnimatedTitle>
            <p className="mb-8 text-xl text-zinc-400">
              The ultimate collection of unreleased Juice WRLD tracks
            </p>

            {/* Action Buttons */}
            <div className="mb-8 flex justify-center gap-4">
              <AdvancedSongUploadDialog />
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
              className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              <div className="rounded-xl border border-purple-800/30 bg-gradient-to-br from-purple-900/20 to-purple-900/10 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Total Tracks</p>
                    <p className="text-3xl font-bold">{songs.length}</p>
                  </div>
                  <Music2 className="h-8 w-8 text-purple-400" />
                </div>
              </div>

              <div className="rounded-xl border border-blue-800/30 bg-gradient-to-br from-blue-900/20 to-blue-900/10 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Unreleased</p>
                    <p className="text-3xl font-bold">
                      {songs.filter((s) => s.isUnreleased).length}
                    </p>
                  </div>
                  <Sparkles className="h-8 w-8 text-blue-400" />
                </div>
              </div>

              <div className="rounded-xl border border-pink-800/30 bg-gradient-to-br from-pink-900/20 to-pink-900/10 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Total Plays</p>
                    <p className="text-3xl font-bold">
                      {songs
                        .reduce((acc, s) => acc + s.playCount, 0)
                        .toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-pink-400" />
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
            <h2 className="mb-6 text-2xl font-bold">
              {searchQuery ? "Search Results" : "All Tracks"}
            </h2>

            {isSearching ? (
              <div className="flex h-64 items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : displaySongs && displaySongs.length > 0 ? (
              <SongGrid
                songs={displaySongs}
                onPlay={handlePlay}
                currentlyPlayingId={currentlyPlaying}
              />
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-4 text-zinc-400">
                <Music2 className="h-16 w-16" />
                <p className="text-xl">
                  {searchQuery
                    ? "No songs found"
                    : "No songs yet. Be the first to upload!"}
                </p>
                {!searchQuery && session && <AdvancedSongUploadDialog />}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
