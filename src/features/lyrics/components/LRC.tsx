import type { CSSProperties } from "react";
import { useEffect } from "react";
import { Lrc, useRecoverAutoScrollImmediately } from "react-lrc";

import { cn } from "~/lib/utils";

import useTimer from "../hooks/useTimer";
import Control from "./LyricsControl";

interface LRCProps {
  lrc: string;
  recoverAutoScrollInterval?: number;
  isOnLineClickRecoverAutoScroll?: boolean;
  verticalSpace?: boolean;
  className?: string;
  showControls?: boolean;
  initialTime?: number;
  onTimeUpdate?: (time: number) => void;
  externalTime?: number;
  isExternallyControlled?: boolean;
  onSeek?: (ms: number) => void;
}

export default function LRC({
  lrc,
  recoverAutoScrollInterval = 5000,
  isOnLineClickRecoverAutoScroll = true,
  verticalSpace = true,
  className,
  showControls = true,
  initialTime = 0,
  onTimeUpdate,
  externalTime,
  isExternallyControlled = false,
  onSeek,
}: LRCProps) {
  const {
    currentMillisecond,
    setCurrentMillisecond,
    reset,
    play,
    pause,
    paused,
  } = useTimer(1);
  const { signal, recoverAutoScrollImmediately } =
    useRecoverAutoScrollImmediately();

  // Sync with external time when controlled externally
  useEffect(() => {
    if (isExternallyControlled && externalTime !== undefined) {
      setCurrentMillisecond(externalTime);
    }
  }, [externalTime, isExternallyControlled, setCurrentMillisecond]);

  const lrcStyle: CSSProperties = {
    height: "100%",
    padding: "40px 0",
    maskImage:
      "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
    WebkitMaskImage:
      "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
  };

  const handleLineClick = ({ line }: any) => {
    if (line) {
      const newTime = line.startMillisecond || 0;

      if (isExternallyControlled && onSeek) {
        // When externally controlled, call the seek function
        onSeek(newTime);
      } else {
        // When self-controlled, update internal time
        setCurrentMillisecond(newTime);
        onTimeUpdate?.(newTime);
      }
    }
    if (isOnLineClickRecoverAutoScroll) {
      recoverAutoScrollImmediately();
    }
  };

  // Use external time if controlled externally, otherwise use internal timer
  const displayTime =
    isExternallyControlled && externalTime !== undefined
      ? externalTime
      : currentMillisecond;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {showControls && !isExternallyControlled && (
        <Control
          onPlay={play}
          onPause={pause}
          onReset={reset}
          current={currentMillisecond}
          setCurrent={(ms) => {
            setCurrentMillisecond(ms);
            onTimeUpdate?.(ms);
          }}
          recoverAutoScrollImmediately={recoverAutoScrollImmediately}
          isPlaying={!paused}
        />
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <Lrc
            lrc={lrc}
            lineRenderer={({ active, line: { content } }) => (
              <div
                className={cn(
                  "cursor-pointer px-4 py-4 text-center text-2xl transition-all duration-500",
                  "transform-gpu hover:scale-[1.01]",
                  active
                    ? "scale-105 font-bold text-white opacity-100 hover:scale-108"
                    : "font-medium text-zinc-500 opacity-60 hover:opacity-80"
                )}
                style={{
                  textShadow: active
                    ? "0 4px 20px rgba(168, 85, 247, 0.4)"
                    : "none",
                  lineHeight: "1.6",
                }}
              >
                {content || "♪ ♪ ♪"}
              </div>
            )}
            currentMillisecond={displayTime}
            verticalSpace={verticalSpace}
            style={lrcStyle}
            recoverAutoScrollSingal={signal}
            recoverAutoScrollInterval={recoverAutoScrollInterval}
            onLineClick={handleLineClick}
            onAutoScrollChange={console.log}
          />
        </div>
      </div>
    </div>
  );
}
