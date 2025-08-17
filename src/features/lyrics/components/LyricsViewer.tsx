"use client";

import type { RouterOutputs } from "~/trpc/react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Edit3, Loader2, Music2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/features/shared/components/ui/button";
import { ScrollArea } from "~/features/shared/components/ui/scroll-area";
import { Textarea } from "~/features/shared/components/ui/textarea";
import { cn } from "~/lib/utils";
import { useTRPC } from "~/trpc/react";

type Lyrics = RouterOutputs["lyrics"]["getBySongId"];
type LyricsLine = NonNullable<Lyrics>["lines"][number];

interface LyricsViewerProps {
  songId: string;
  songTitle: string;
  artist: string;
  audioUrl: string;
  duration?: number;
  currentTime?: number;
  isPlaying?: boolean;
}

export function LyricsViewer({
  songId,
  songTitle,
  artist,
  audioUrl,
  duration,
  currentTime = 0,
  isPlaying = false,
}: LyricsViewerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState("");
  const [activeLine, setActiveLine] = useState<number>(-1);

  // Fetch lyrics
  const { data: lyrics, isLoading } = useQuery(
    trpc.lyrics.getBySongId.queryOptions({ songId })
  );

  // Generate lyrics mutation
  const generateLyrics = useMutation(
    trpc.lyrics.generateLyrics.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Transcribing audio... This may take 1-2 minutes for longer songs."
        );
        void queryClient.invalidateQueries(
          trpc.lyrics.getBySongId.queryOptions({ songId })
        );
      },
      onError: (error) => {
        toast.error(`Failed to generate lyrics: ${error.message}`);
      },
    })
  );

  // Update lyrics mutation
  const updateLyrics = useMutation(
    trpc.lyrics.update.mutationOptions({
      onSuccess: () => {
        toast.success("Lyrics updated successfully");
        setIsEditing(false);
      },
      onError: (error) => {
        toast.error(`Failed to update lyrics: ${error.message}`);
      },
    })
  );

  // Update active line based on current playback time
  useEffect(() => {
    if (!lyrics?.lines || !isPlaying) return;

    const active = lyrics.lines.findIndex((line, index) => {
      const nextLine = lyrics.lines[index + 1];
      const isInRange =
        currentTime >= line.startTime &&
        (nextLine ? currentTime < nextLine.startTime : true);
      return isInRange;
    });

    if (active !== activeLine) {
      setActiveLine(active);

      // Auto-scroll to active line
      if (scrollRef.current && active >= 0) {
        const lineElement = scrollRef.current.querySelector(
          `[data-line-index="${active}"]`
        );
        lineElement?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentTime, lyrics?.lines, isPlaying, activeLine]);

  // Initialize edit mode with current lyrics
  useEffect(() => {
    if (lyrics?.fullText && isEditing) {
      setEditedLyrics(lyrics.fullText);
    }
  }, [lyrics?.fullText, isEditing]);

  const handleGenerateLyrics = () => {
    generateLyrics.mutate({
      songId,
      audioUrl,
      songTitle,
      artist,
      duration,
    });
  };

  const handleSaveLyrics = () => {
    if (!lyrics) return;

    updateLyrics.mutate({
      id: lyrics.id,
      fullText: editedLyrics,
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedLyrics(lyrics?.fullText ?? "");
  };

  if (isLoading) {
    return (
      <div className="flex h-[500px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // No lyrics found
  if (!lyrics) {
    return (
      <div className="flex h-[500px] flex-col items-center justify-center space-y-4">
        <Music2 className="h-16 w-16 text-zinc-600" />
        <p className="text-lg text-zinc-400">No lyrics available</p>
        <Button
          onClick={handleGenerateLyrics}
          disabled={generateLyrics.isPending}
          className="gap-2"
        >
          {generateLyrics.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Music2 className="h-4 w-4" />
              Generate Lyrics
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[500px] flex-col space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-lg font-semibold">{songTitle}</h3>
          <p className="text-sm text-zinc-400">{artist}</p>
        </div>

        <div className="flex gap-2">
          {!isEditing ? (
            <>
              {lyrics.lines && lyrics.lines.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveLyrics}
                disabled={updateLyrics.isPending}
                className="gap-2"
              >
                {updateLyrics.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Lyrics Content */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <Textarea
                value={editedLyrics}
                onChange={(e) => setEditedLyrics(e.target.value)}
                className="min-h-[400px] resize-none border-zinc-700 bg-zinc-900 text-white"
                placeholder="Enter lyrics here..."
              />
            </motion.div>
          ) : (
            <motion.div
              key="viewer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 p-4"
            >
              {lyrics.lines && lyrics.lines.length > 0 ? (
                // Synced lyrics with timing
                lyrics.lines.map((line, index) => (
                  <motion.div
                    key={`${line.orderIndex}-${index}`}
                    data-line-index={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      "rounded-lg px-3 py-2 transition-all duration-300",
                      activeLine === index && isPlaying
                        ? "scale-105 bg-purple-500/20 text-white"
                        : "text-zinc-400 hover:text-zinc-300"
                    )}
                  >
                    <p className="text-lg leading-relaxed">{line.text}</p>
                    {line.startTime !== undefined && (
                      <span className="text-xs text-zinc-600">
                        {formatTime(line.startTime)}
                      </span>
                    )}
                  </motion.div>
                ))
              ) : (
                // Plain lyrics without timing
                <div className="whitespace-pre-wrap text-zinc-300">
                  {lyrics.fullText}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Status */}
      {lyrics.isGenerated && !lyrics.isVerified && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-2 text-xs text-yellow-500">
          <Music2 className="h-3 w-3" />
          AI Generated - Not Verified
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
