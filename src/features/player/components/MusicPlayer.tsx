"use client";

import { useEffect, useState } from "react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  X,
  ListMusic,
  FileText,
} from "lucide-react";
import Image from "next/image";

import { Button } from "~/features/shared/components/ui/button";
import { Slider } from "~/features/shared/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/features/shared/components/ui/sheet";
import { cn } from "~/lib/utils";
import { useAudioPlayer } from "../hooks/use-audio-player";
import { LyricsDialog } from "~/features/lyrics/components/LyricsDialog";

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

  // Show player when a new song is loaded
  useEffect(() => {
    if (currentSong) {
      // Show player when it's a different song or first time
      if (currentSong.id !== lastSongId) {
        setShowPlayer(true);
        setImageError(false);
        setLastSongId(currentSong.id);
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

  if (!showPlayer || !currentSong) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex h-16 sm:h-20 items-center gap-2 sm:gap-4">
          {/* Song Info */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="relative h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 overflow-hidden rounded">
              {currentSong.coverArtUrl && !imageError ? (
                <Image
                  src={currentSong.coverArtUrl}
                  alt={currentSong.title}
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <Music className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs sm:text-sm font-medium">{currentSong.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {currentSong.artist}
              </p>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="hidden sm:flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={playPrevious}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                className="h-10 w-10"
                onClick={togglePlayPause}
                disabled={isLoading}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={playNext}
                disabled={queue.length === 0}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress Bar */}
            <div className="flex w-48 sm:w-64 md:w-80 lg:w-96 items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Mobile Playback Controls */}
          <div className="flex sm:hidden items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={playPrevious}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-9 w-9"
              onClick={togglePlayPause}
              disabled={isLoading}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={playNext}
              disabled={queue.length === 0}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume & Queue */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
            {/* Volume Control */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={toggleMute}
              >
                {isMuted ? (
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
                className="w-24"
              />
            </div>

            {/* Lyrics Button */}
            {currentSong && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setShowLyrics(true)}
              >
                <FileText className="h-4 w-4" />
              </Button>
            )}

            {/* Queue */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 relative"
                >
                  <ListMusic className="h-4 w-4" />
                  {queue.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
                      {queue.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Queue ({queue.length})</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {queue.length === 0 ? (
                    <p className="text-center text-muted-foreground">
                      Queue is empty
                    </p>
                  ) : (
                    queue.map((song, index) => (
                      <div
                        key={song.id}
                        className="flex items-center gap-2 rounded p-2 hover:bg-muted"
                      >
                        <span className="text-xs text-muted-foreground w-6">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{song.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {song.artist}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => removeFromQueue(song.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Close Player */}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setShowPlayer(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
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
    </div>
  );
}