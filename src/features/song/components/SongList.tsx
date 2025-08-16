"use client";

import { motion } from "motion/react";
import { type RouterOutputs } from "~/trpc/react";
import { SongCard } from "./SongCard";
import { useAudioPlayer } from "~/features/player/hooks/use-audio-player";

type Song = RouterOutputs["song"]["list"][number];

interface SongListProps {
  songs: Song[];
}

export function SongList({ songs }: SongListProps) {
  const { play, pause, currentSong, isPlaying, addToQueue } = useAudioPlayer();

  return (
    <div className="flex flex-col gap-3">
      {songs.map((song, index) => (
        <motion.div
          key={song.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="w-full"
        >
          <SongCard
            song={{
              ...song,
              uploadedBy: {
                id: song.uploadedById,
                name: "Unknown",
                email: undefined,
                image: undefined,
              },
            }}
            isPlaying={currentSong?.id === song.id && isPlaying}
            onPlay={() => play(song)}
            onPause={() => pause()}
            onAddToPlaylist={() => addToQueue(song)}
          />
        </motion.div>
      ))}
    </div>
  );
}