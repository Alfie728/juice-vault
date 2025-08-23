"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { Button } from "~/features/shared/components/ui/button";
import { cn } from "~/lib/utils";

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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* Animated Overlay */}
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </DialogPrimitive.Overlay>

            {/* Animated Content */}
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className={cn(
                  "fixed left-[50%] top-[50%] z-50",
                  "flex h-[90vh] w-full max-w-6xl flex-col",
                  "border-0 bg-gradient-to-b from-purple-900/40 via-zinc-950 to-zinc-950",
                  "rounded-xl shadow-2xl overflow-hidden"
                )}
                initial={{ 
                  opacity: 0, 
                  scale: 0.95,
                  x: "-50%",
                  y: "-45%"
                }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  x: "-50%",
                  y: "-50%"
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.95,
                  x: "-50%",
                  y: "-45%"
                }}
                transition={{ 
                  type: "spring",
                  damping: 25,
                  stiffness: 300,
                  duration: 0.3
                }}
              >
                {/* Visually hidden title for accessibility */}
                <DialogPrimitive.Title className="sr-only">
                  Lyrics for {songTitle} by {artist}
                </DialogPrimitive.Title>

                {/* Header */}
                <motion.div 
                  className="flex items-center justify-between p-6 pb-4"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex items-center gap-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onOpenChange(false)}
                      className="h-8 w-8 rounded-full bg-black/20 text-white backdrop-blur hover:bg-black/30 transition-all hover:scale-110"
                    >
                      <ChevronDown className="h-5 w-5" />
                    </Button>
                    <div>
                      <h2 className="text-sm font-medium text-white/60">
                        Playing from
                      </h2>
                      <p className="text-xs text-white/40">Your Library</p>
                    </div>
                  </div>
                </motion.div>

                {/* Lyrics Content with staggered animation */}
                <motion.div 
                  className="flex-1 overflow-hidden px-6 pb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
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
                </motion.div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}