"use client";

import { useState } from "react";
import { Play, Pause, Heart, MoreVertical, Music } from "lucide-react";
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

  return (
    <div className="group relative rounded-lg border bg-card p-4 transition-all hover:shadow-lg">
      <div className="flex gap-4">
        {/* Album Art */}
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {song.coverArtUrl && !imageError ? (
            <img
              src={song.coverArtUrl}
              alt={song.title}
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          
          {/* Play/Pause Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handlePlayPause}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Song Info */}
        <div className="flex flex-1 flex-col justify-center">
          <h3 className="font-semibold line-clamp-1">{song.title}</h3>
          <p className="text-sm text-muted-foreground">{song.artist}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {song.duration && <span>{formatDuration(song.duration)}</span>}
            {song.isUnreleased && (
              <>
                <span>•</span>
                <span className="text-orange-500">Unreleased</span>
              </>
            )}
            <span>•</span>
            <span>{song.playCount} plays</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={onLike}
            className={cn(
              "h-8 w-8",
              isLiked && "text-red-500 hover:text-red-600"
            )}
          >
            <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onViewLyrics}>
                View Lyrics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddToPlaylist}>
                Add to Playlist
              </DropdownMenuItem>
              <DropdownMenuItem>
                Share
              </DropdownMenuItem>
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