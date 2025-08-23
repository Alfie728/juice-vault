"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, spring } from "framer-motion";
import {
  FileText,
  Heart,
  ListMusic,
  Maximize2,
  Music,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Image from "next/image";

import { LyricsDialog } from "~/features/lyrics/components/LyricsDialog";
import { Button } from "~/features/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/features/shared/components/ui/sheet";
import { Slider } from "~/features/shared/components/ui/slider";
import { cn } from "~/lib/utils";

import { useAudioPlayer } from "../hooks/use-audio-player";

export function MusicPlayer() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoading,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    playNext,
    playPrevious,
    queue,
    removeFromQueue,
  } = useAudioPlayer();

  const [showPlayer, setShowPlayer] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [lastSongId, setLastSongId] = useState<string | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");

  // Show player when a new song is loaded
  useEffect(() => {
    if (currentSong) {
      // Show player when it's a different song or first time
      if (currentSong.id !== lastSongId) {
        setShowPlayer(true);
        setImageError(false);
        setLastSongId(currentSong.id);
        setIsLiked(false); // Reset like status for new song
      }
    }
  }, [currentSong, lastSongId]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (value: number[]) => {
    if (value[0] !== undefined) {
      seek(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (value[0] !== undefined) {
      setVolume(value[0]);
    }
  };

  const toggleRepeat = () => {
    const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % 3]!);
  };

  if (!showPlayer || !currentSong) return null;

  return (
    <>
      <div className="fixed right-0 bottom-0 left-0 z-50 border-t border-zinc-800 bg-zinc-950">
        <div className="h-[90px] px-4">
          <div className="flex h-full items-center justify-between gap-4">
            {/* Left Section - Song Info */}
            <div className="flex min-w-0 flex-[0.3] items-center gap-3">
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded shadow-lg">
                {currentSong.coverArtUrl && !imageError ? (
                  <Image
                    src={currentSong.coverArtUrl}
                    alt={currentSong.title}
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800">
                    <Music className="h-6 w-6 text-zinc-500" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="cursor-pointer truncate text-sm font-medium text-white hover:underline">
                  {currentSong.title}
                </p>
                <p className="cursor-pointer truncate text-xs text-zinc-400 hover:text-zinc-300 hover:underline">
                  {currentSong.artist}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "h-8 w-8 transition-transform hover:scale-105",
                  isLiked && "text-purple-500"
                )}
                onClick={() => setIsLiked(!isLiked)}
              >
                <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
              </Button>
            </div>

            {/* Center Section - Player Controls */}
            <div className="flex max-w-[722px] flex-[0.4] flex-col items-center gap-2">
              {/* Control Buttons */}
              <div className="flex items-center gap-4">
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 transition-all hover:scale-105",
                    isShuffled
                      ? "text-purple-500"
                      : "text-zinc-400 hover:text-white"
                  )}
                  onClick={() => setIsShuffled(!isShuffled)}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white transition-all hover:scale-105"
                  onClick={playPrevious}
                >
                  <SkipBack className="h-5 w-5 fill-current" />
                </Button>

                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-white text-black transition-all hover:scale-105 hover:bg-white"
                  onClick={togglePlayPause}
                  disabled={isLoading}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  )}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white transition-all hover:scale-105"
                  onClick={playNext}
                  disabled={queue.length === 0}
                >
                  <SkipForward className="h-5 w-5 fill-current" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "relative h-8 w-8 transition-all hover:scale-105",
                    repeatMode !== "off"
                      ? "text-purple-500"
                      : "text-zinc-400 hover:text-white"
                  )}
                  onClick={toggleRepeat}
                >
                  <Repeat className="h-4 w-4" />
                  {repeatMode === "one" && (
                    <span className="absolute -top-0.5 -right-0.5 text-[10px] font-bold">
                      1
                    </span>
                  )}
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="flex w-full items-center gap-2">
                <span className="min-w-[40px] text-right text-[11px] text-zinc-400">
                  {formatTime(currentTime)}
                </span>
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1}
                  onValueChange={handleSeek}
                  className="flex-1 [&_[data-orientation]]:bg-white [&_[data-orientation]]:transition-colors hover:[&_[data-orientation]]:bg-purple-500 [&_[role=slider]]:h-1 [&_[role=slider]]:bg-zinc-700 [&_span[role=slider]]:h-3 [&_span[role=slider]]:w-3 [&_span[role=slider]]:border-0 [&_span[role=slider]]:bg-white [&_span[role=slider]]:opacity-0 [&_span[role=slider]]:transition-opacity hover:[&_span[role=slider]]:opacity-100"
                />
                <span className="min-w-[40px] text-[11px] text-zinc-400">
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* Right Section - Extra Controls */}
            <div className="flex flex-[0.3] items-center justify-end gap-2">
              {/* Lyrics Button */}
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "h-8 w-8 transition-all hover:scale-105",
                  showLyrics
                    ? "text-purple-500"
                    : "text-zinc-400 hover:text-white"
                )}
                onClick={() => setShowLyrics(true)}
              >
                <FileText className="h-4 w-4" />
              </Button>

              {/* Queue */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="relative h-8 w-8 text-zinc-400 transition-all hover:scale-105 hover:text-white"
                  >
                    <ListMusic className="h-4 w-4" />
                    {queue.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] font-medium text-white">
                        {queue.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="border-zinc-800 bg-zinc-950">
                  <SheetHeader>
                    <SheetTitle className="text-white">
                      Queue • {queue.length} tracks
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-1">
                    {queue.length === 0 ? (
                      <p className="py-8 text-center text-zinc-500">
                        Queue is empty
                      </p>
                    ) : (
                      queue.map((song, index) => (
                        <div
                          key={song.id}
                          className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-zinc-800/50"
                        >
                          <span className="w-5 text-center text-xs text-zinc-500">
                            {index + 1}
                          </span>
                          <div className="h-10 w-10 flex-shrink-0 rounded bg-zinc-800">
                            {song.coverArtUrl ? (
                              <Image
                                src={song.coverArtUrl}
                                alt={song.title}
                                width={40}
                                height={40}
                                className="h-full w-full rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Music className="h-4 w-4 text-zinc-600" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-white">
                              {song.title}
                            </p>
                            <p className="truncate text-xs text-zinc-500">
                              {song.artist}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => removeFromQueue(song.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              {/* Volume Control */}
              <div className="hidden items-center gap-2 md:flex">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-zinc-400 hover:text-white"
                  onClick={toggleMute}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-24 [&_[data-orientation]]:bg-white [&_[data-orientation]]:transition-colors hover:[&_[data-orientation]]:bg-purple-500 [&_[role=slider]]:h-1 [&_[role=slider]]:bg-zinc-700 [&_span[role=slider]]:h-3 [&_span[role=slider]]:w-3 [&_span[role=slider]]:border-0 [&_span[role=slider]]:bg-white [&_span[role=slider]]:opacity-0 [&_span[role=slider]]:transition-opacity hover:[&_span[role=slider]]:opacity-100"
                />
              </div>

              {/* Fullscreen */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-zinc-400 transition-all hover:scale-105 hover:text-white"
                onClick={() => setShowLyrics(true)}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Progress bar for mobile */}
        <div className="h-1 bg-zinc-800 sm:hidden">
          <div
            className="h-full bg-purple-500 transition-all duration-100"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Lyrics Dialog */}
      {currentSong && (
        <LyricsDialog
          open={showLyrics}
          onOpenChange={setShowLyrics}
          songId={currentSong.id}
          songTitle={currentSong.title}
          artist={currentSong.artist}
          audioUrl={currentSong.audioUrl}
          duration={duration}
          currentTime={currentTime}
          isPlaying={isPlaying}
          seek={seek}
        />
      )}
    </>
  );
}
