"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/features/shared/components/ui/dialog";
import { LyricsViewer } from "./LyricsViewer";

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
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Lyrics</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
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