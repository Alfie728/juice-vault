"use client";

import { useState } from "react";
import { Clock, Heart, Music, Pause, Play } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";

import { useAudioPlayer } from "~/features/player/hooks/use-audio-player";
import { Button } from "~/features/shared/components/ui/button";
import { Card } from "~/features/shared/components/ui/card";
import { type RouterOutputs } from "~/trpc/react";

type Song = RouterOutputs["song"]["list"][number];

interface SongGridProps {
  songs: Song[];
}

export function SongGrid({ songs }: SongGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { play, pause, currentSong, isPlaying, addToQueue } = useAudioPlayer();

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {songs.map((song, index) => (
        <motion.div
          key={song.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card
            className="group relative overflow-hidden border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-zinc-950/50 backdrop-blur-sm transition-all duration-300 hover:border-purple-600/50"
            onMouseEnter={() => setHoveredId(song.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-purple-900/20 to-blue-900/20">
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
                  <Music className="h-20 w-20 text-zinc-600" />
                </div>
              )}

              {/* Play button overlay */}
              <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
                  hoveredId === song.id || (currentSong?.id === song.id && isPlaying) ? "opacity-100" : "opacity-0"
                }`}
              >
                <div className="flex h-full items-center justify-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-16 w-16 rounded-full bg-purple-600 transition-all hover:scale-110 hover:bg-purple-700"
                    onClick={() => {
                      if (currentSong?.id === song.id && isPlaying) {
                        pause();
                      } else {
                        play(song as any);
                      }
                    }}
                  >
                    {currentSong?.id === song.id && isPlaying ? (
                      <Pause className="h-8 w-8 fill-white text-white" />
                    ) : (
                      <Play className="ml-1 h-8 w-8 fill-white text-white" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Unreleased badge */}
              {song.isUnreleased && (
                <div className="absolute top-2 right-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-2 py-1">
                  <span className="text-xs font-bold text-white">
                    UNRELEASED
                  </span>
                </div>
              )}
            </div>

            <div className="p-4">
              <h3 className="mb-1 truncate font-bold text-white">
                {song.title}
              </h3>
              <p className="mb-3 text-sm text-zinc-400">{song.artist}</p>

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    {song.playCount}
                  </span>
                  {song.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(song.duration)}
                    </span>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:text-red-500"
                >
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
