"use client";

import type { RouterOutputs } from "~/trpc/react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Edit3, Loader2, Music2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/features/shared/components/ui/button";
import { ScrollArea } from "~/features/shared/components/ui/scroll-area";
import { Textarea } from "~/features/shared/components/ui/textarea";
import { useTRPC } from "~/trpc/react";

import LRC from "./LRC";

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
  seek?: (time: number) => void;
}

export function LyricsViewer({
  songId,
  songTitle,
  artist,
  audioUrl,
  duration,
  currentTime = 0,
  isPlaying = false,
  seek,
}: LyricsViewerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState("");

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

  // Initialize edit mode with current lyrics
  useEffect(() => {
    if (lyrics?.fullText && isEditing) {
      setEditedLyrics(lyrics.fullText);
    }
  }, [lyrics?.fullText, isEditing]);

  // Convert lyrics to LRC format
  const lrcContent = useMemo(() => {
    if (!lyrics?.lines || lyrics.lines.length === 0) return "";

    return lyrics.lines
      .map((line) => {
        if (line.startTime !== undefined) {
          const minutes = Math.floor(line.startTime / 60);
          const seconds = (line.startTime % 60).toFixed(2);
          const timeTag = `[${minutes.toString().padStart(2, "0")}:${seconds.padStart(5, "0")}]`;
          return `${timeTag}${line.text}`;
        }
        return line.text;
      })
      .join("\n");
  }, [lyrics?.lines]);

  // Check if lyrics have timing information
  const hasTimingInfo = useMemo(() => {
    return lyrics?.lines?.some((line) => line.startTime !== undefined) ?? false;
  }, [lyrics?.lines]);

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
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
      </div>
    );
  }

  // No lyrics found
  if (!lyrics) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <Music2 className="h-20 w-20 text-zinc-600" />
        <p className="text-lg text-zinc-400">No lyrics available</p>
        <Button
          onClick={handleGenerateLyrics}
          disabled={generateLyrics.isPending}
          className="gap-2 bg-purple-600 text-white hover:bg-purple-700"
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
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white">{songTitle}</h3>
          <p className="mt-1 text-sm text-zinc-400">{artist}</p>
        </div>

        <div className="flex gap-2">
          {!isEditing ? (
            <>
              {lyrics.lines && lyrics.lines.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveLyrics}
                disabled={updateLyrics.isPending}
                className="gap-2 bg-purple-600 text-white hover:bg-purple-700"
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
      {isEditing ? (
        <ScrollArea className="flex-1">
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
              className="min-h-[400px] resize-none border-zinc-800 bg-zinc-900/50 text-white placeholder:text-zinc-600 focus:border-purple-500"
              placeholder="Enter lyrics here..."
            />
          </motion.div>
        </ScrollArea>
      ) : (
        <div className="flex-1">
          {hasTimingInfo ? (
            <LRC
              lrc={lrcContent}
              showControls={false}
              externalTime={currentTime * 1000}
              isExternallyControlled={true}
              onSeek={seek ? (ms) => seek(ms / 1000) : undefined}
              className="h-full"
            />
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-4 whitespace-pre-wrap text-zinc-300">
                {lyrics.fullText || "No lyrics available"}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Status */}
      {lyrics.isGenerated && !lyrics.isVerified && (
        <div className="mt-4 flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1.5 text-xs text-purple-400">
          <Music2 className="h-3 w-3" />
          AI Generated • Not Verified
        </div>
      )}
    </div>
  );
}
