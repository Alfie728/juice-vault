"use client";

import { useState } from "react";
import { Clock, Heart, Music, Pause, Play, Mic2 } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";

import { useAudioPlayer } from "~/features/player/hooks/use-audio-player";
import { LyricsDialog } from "~/features/lyrics/components/LyricsDialog";
import { Button } from "~/features/shared/components/ui/button";
import { Card } from "~/features/shared/components/ui/card";
import { type RouterOutputs } from "~/trpc/react";

type Song = RouterOutputs["song"]["list"][number];

interface SongGridProps {
  songs: Song[];
}

export function SongGrid({ songs }: SongGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lyricsDialogOpen, setLyricsDialogOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const { play, pause, currentSong, isPlaying, addToQueue, currentTime } = useAudioPlayer();

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
        {songs.map((song, index) => (
        <motion.div
          key={song.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card
            className="group relative overflow-hidden border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 backdrop-blur-sm transition-all duration-300 hover:border-purple-600/50 hover:shadow-lg hover:shadow-purple-600/20"
            onMouseEnter={() => setHoveredId(song.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="relative aspect-square overflow-hidden rounded-t-lg bg-gradient-to-br from-purple-900/20 to-blue-900/20">
              {song.coverArtUrl ? (
                <Image
                  src={song.coverArtUrl}
                  alt={song.title}
                  width={300}
                  height={300}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music className="h-12 w-12 text-zinc-600 sm:h-16 sm:w-16 lg:h-20 lg:w-20" />
                </div>
              )}

              {/* Play button overlay */}
              <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
                  hoveredId === song.id ||
                  (currentSong?.id === song.id && isPlaying)
                    ? "opacity-100"
                    : "opacity-0"
                }`}
              >
                <div className="flex h-full items-center justify-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-12 w-12 rounded-full bg-purple-600 transition-all hover:scale-110 hover:bg-purple-700 sm:h-14 sm:w-14 lg:h-16 lg:w-16"
                    onClick={() => {
                      if (currentSong?.id === song.id && isPlaying) {
                        pause();
                      } else {
                        play(song);
                      }
                    }}
                  >
                    {currentSong?.id === song.id && isPlaying ? (
                      <Pause className="h-5 w-5 fill-white text-white sm:h-6 sm:w-6 lg:h-8 lg:w-8" />
                    ) : (
                      <Play className="ml-0.5 h-5 w-5 fill-white text-white sm:ml-1 sm:h-6 sm:w-6 lg:h-8 lg:w-8" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Unreleased badge */}
              {song.isUnreleased && (
                <div className="absolute top-1 right-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-1.5 py-0.5 sm:top-2 sm:right-2 sm:px-2 sm:py-1">
                  <span className="text-[10px] font-bold text-white sm:text-xs">
                    UNRELEASED
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4">
              <h3 className="mb-0.5 truncate text-sm font-bold text-white sm:text-base">
                {song.title}
              </h3>
              <p className="mb-2 truncate text-xs text-zinc-400 sm:text-sm">
                {song.artist}
              </p>

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="flex items-center gap-0.5 sm:gap-1">
                    <Play className="h-3 w-3" />
                    <span className="hidden sm:inline">{song.playCount}</span>
                    <span className="sm:hidden">
                      {formatCompactNumber(song.playCount)}
                    </span>
                  </span>
                  {song.duration && (
                    <span className="flex items-center gap-0.5 sm:gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(song.duration)}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:text-purple-500 sm:h-8 sm:w-8"
                    onClick={() => {
                      setSelectedSong(song);
                      setLyricsDialogOpen(true);
                    }}
                  >
                    <Mic2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:text-red-500 sm:h-8 sm:w-8"
                  >
                    <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
      
      {/* Lyrics Dialog */}
      {selectedSong && (
        <LyricsDialog
          open={lyricsDialogOpen}
          onOpenChange={setLyricsDialogOpen}
          songId={selectedSong.id}
          songTitle={selectedSong.title}
          artist={selectedSong.artist}
          audioUrl={selectedSong.audioUrl}
          duration={selectedSong.duration ?? undefined}
          currentTime={currentSong?.id === selectedSong.id ? currentTime : 0}
          isPlaying={currentSong?.id === selectedSong.id && isPlaying}
        />
      )}
    </>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
