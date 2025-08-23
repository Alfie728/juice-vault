"use client";

import { Dialog, DialogContent, DialogTitle } from "~/features/shared/components/ui/dialog";
import { LyricsViewer } from "./LyricsViewer";
import { ChevronDown } from "lucide-react";
import { Button } from "~/features/shared/components/ui/button";

interface LyricsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string;
  songTitle: string;
  artist: string;
  audioUrl: string;
  duration?: number;
  currentTime?: number;
  isPlaying?: boolean;
  seek?: (time: number) => void;
}

export function LyricsDialog({
  open,
  onOpenChange,
  songId,
  songTitle,
  artist,
  audioUrl,
  duration,
  currentTime,
  isPlaying,
  seek,
}: LyricsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 bg-gradient-to-b from-purple-900/20 via-zinc-950 to-zinc-950 border-0">
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          Lyrics for {songTitle} by {artist}
        </DialogTitle>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-full bg-black/20 backdrop-blur hover:bg-black/30 text-white"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-sm font-medium text-white/60">Playing from</h2>
              <p className="text-xs text-white/40">Your Library</p>
            </div>
          </div>
        </div>
        
        {/* Lyrics Content */}
        <div className="flex-1 overflow-hidden px-6 pb-6">
          <LyricsViewer
            songId={songId}
            songTitle={songTitle}
            artist={artist}
            audioUrl={audioUrl}
            duration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            seek={seek}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}