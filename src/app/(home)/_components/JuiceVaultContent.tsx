"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Music2, Search } from "lucide-react";
import { useSession } from "next-auth/react";

import { LoadingSpinner } from "~/features/shared/components/LoadingSpinner";
import { Button } from "~/features/shared/components/ui/button";
import { Input } from "~/features/shared/components/ui/input";
import { SongCard } from "~/features/song/components/SongCard";
import { SongUploadDialog } from "~/features/song/components/SongUploadDialog";
import { useTRPC } from "~/trpc/react";

export function JuiceVaultContent() {
  // const { data: session } = useSession();
  // const [searchQuery, setSearchQuery] = useState("");
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const trpc = useTRPC();

  const { data: songs, isLoading } = useQuery(trpc.song.list.queryOptions());

  // const searchResults = trpc.song.search.useQuery(
  //   { query: searchQuery, type: "hybrid" },
  //   { enabled: searchQuery.length > 0 }
  // );

  // const displaySongs = searchQuery ? searchResults.data : songs;
  // const isSearching = searchQuery ? searchResults.isLoading : isLoading;

  const handlePlay = (songId: string) => {
    setCurrentlyPlaying(songId);
    // TODO: Integrate with actual audio player
  };

  const handlePause = () => {
    setCurrentlyPlaying(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">JuiceVault</h1>
          <p className="text-muted-foreground mt-1">
            The ultimate collection of unreleased Juice WRLD tracks
          </p>
        </div>
        <SongUploadDialog />
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          {/*<Input
            placeholder="Search songs, lyrics..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />*/}
        </div>
      </div>

      {/* Songs Grid */}
      <div className="space-y-2">
        {/*{isSearching ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : displaySongs && displaySongs.length > 0 ? (
          displaySongs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              isPlaying={currentlyPlaying === song.id}
              onPlay={() => handlePlay(song.id)}
              onPause={handlePause}
              onLike={() => {
                // TODO: Implement like functionality
              }}
              onAddToPlaylist={() => {
                // TODO: Implement playlist functionality
              }}
              onViewLyrics={() => {
                // TODO: Implement lyrics view
              }}
            />
          ))
        ) : (
          <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-4">
            <Music2 className="h-12 w-12" />
            <p>No songs found. Be the first to upload!</p>
            {session && <SongUploadDialog />}
          </div>
        )}*/}
      </div>

      {/* Stats */}
      {songs && songs.length > 0 && (
        <div className="text-muted-foreground mt-8 flex justify-center gap-8 border-t pt-8 text-sm">
          <div className="text-center">
            <div className="text-foreground text-2xl font-bold">
              {songs.length}
            </div>
            <div>Total Songs</div>
          </div>
          <div className="text-center">
            <div className="text-foreground text-2xl font-bold">
              {songs.filter((s) => s.isUnreleased).length}
            </div>
            <div>Unreleased</div>
          </div>
          <div className="text-center">
            <div className="text-foreground text-2xl font-bold">
              {songs.reduce((acc, s) => acc + s.playCount, 0)}
            </div>
            <div>Total Plays</div>
          </div>
        </div>
      )}
    </div>
  );
}
