"use client";

import { useState } from "react";
import { Heart, MoreVertical, Music, Pause, Play } from "lucide-react";
import Image from "next/image";

import { Button } from "~/features/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/features/shared/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

interface SongWithUser {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  audioUrl: string;
  coverArtUrl?: string;
  releaseDate?: Date;
  isUnreleased: boolean;
  playCount: number;
  createdAt: Date;
  updatedAt: Date;
  uploadedById: string;
  uploadedBy: {
    id: string;
    name?: string;
    email?: string;
    image?: string;
  };
}

interface SongCardProps {
  song: SongWithUser;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onLike?: () => void;
  onAddToPlaylist?: () => void;
  onViewLyrics?: () => void;
  isLiked?: boolean;
}

export function SongCard({
  song,
  isPlaying = false,
  onPlay,
  onPause,
  onLike,
  onAddToPlaylist,
  onViewLyrics,
  isLiked = false,
}: SongCardProps) {
  const [imageError, setImageError] = useState(false);

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCompactPlays = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M plays`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K plays`;
    }
    return `${count} plays`;
  };

  return (
    <div className="group bg-card relative rounded-lg border p-4 sm:p-5 transition-all hover:shadow-lg hover:border-purple-600/50 w-full">
      <div className="flex gap-4 sm:gap-5">
        {/* Album Art */}
        <div className="bg-muted relative h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden rounded-md">
          {song.coverArtUrl && !imageError ? (
            <Image
              src={song.coverArtUrl}
              alt={song.title}
              width={96}
              height={96}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="text-muted-foreground h-8 w-8 sm:h-10 sm:w-10" />
            </div>
          )}

          {/* Play/Pause Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="bg-purple-600 text-white hover:bg-purple-700 h-10 w-10 sm:h-12 sm:w-12 rounded-full transition-transform hover:scale-110"
              onClick={handlePlayPause}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 sm:h-6 sm:w-6 fill-white" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 sm:h-6 sm:w-6 fill-white" />
              )}
            </Button>
          </div>
        </div>

        {/* Song Info */}
        <div className="flex flex-1 flex-col justify-center min-w-0">
          <h3 className="line-clamp-1 text-base sm:text-lg font-semibold text-white">{song.title}</h3>
          <p className="text-muted-foreground text-sm sm:text-base mb-1">{song.artist}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            {song.duration && <span>{formatDuration(song.duration)}</span>}
            {song.isUnreleased && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold">
                UNRELEASED
              </span>
            )}
            {song.duration && (
              <>
                <span>•</span>
                <span>{song.duration && formatDuration(song.duration)}</span>
              </>
            )}
            <span>•</span>
            <span>{formatCompactPlays(song.playCount)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={onLike}
            className={cn(
              "h-9 w-9",
              isLiked && "text-red-500 hover:text-red-600"
            )}
          >
            <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-9 w-9">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onViewLyrics}>
                View Lyrics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddToPlaylist}>
                Add to Playlist
              </DropdownMenuItem>
              <DropdownMenuItem>Share</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
