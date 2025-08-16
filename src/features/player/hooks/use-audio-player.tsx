"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Song } from "~/domain/song/schema";

interface AudioPlayerContextType {
  // Current song
  currentSong: Song | null;
  isPlaying: boolean;
  
  // Playback state
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  
  // Controls
  play: (song: Song) => void;
  pause: () => void;
  resume: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  
  // Navigation
  playNext: () => void;
  playPrevious: () => void;
  
  // Queue
  queue: Song[];
  addToQueue: (song: Song) => void;
  removeFromQueue: (songId: string) => void;
  clearQueue: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [queue, setQueue] = useState<Song[]>([]);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    // Event listeners
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      // Auto-play next song if available
      if (queue.length > 0) {
        playNext();
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
    };

    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const play = (song: Song) => {
    if (!audioRef.current) {
      return;
    }
    
    // If it's the same song, just resume
    if (currentSong?.id === song.id && audioRef.current.paused) {
      audioRef.current.play();
      return;
    }
    
    // Load and play new song
    setCurrentSong(song);
    audioRef.current.src = song.audioUrl;
    audioRef.current.load();
    audioRef.current.play().catch(() => {
      // Playback error will be handled by the error event listener
    });
  };

  const pause = () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  };

  const resume = () => {
    if (audioRef.current && audioRef.current.paused && currentSong) {
      audioRef.current.play().catch(() => {
        // Playback error will be handled by the error event listener
      });
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      pause();
    } else if (currentSong) {
      resume();
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolumeHandler = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const playNext = () => {
    if (queue.length > 0) {
      const nextSong = queue[0];
      if (nextSong) {
        setQueue(queue.slice(1));
        play(nextSong);
      }
    }
  };

  const playPrevious = () => {
    // If we're more than 3 seconds into the song, restart it
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    // Otherwise, we'd need a history to go back to previous songs
  };

  const addToQueue = (song: Song) => {
    setQueue(prev => [...prev, song]);
  };

  const removeFromQueue = (songId: string) => {
    setQueue(queue.filter(s => s.id !== songId));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        currentSong,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isLoading,
        play,
        pause,
        resume,
        togglePlayPause,
        seek,
        setVolume: setVolumeHandler,
        toggleMute,
        playNext,
        playPrevious,
        queue,
        addToQueue,
        removeFromQueue,
        clearQueue,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return context;
}