import { type CSSProperties, useEffect } from 'react';
import { Lrc, useRecoverAutoScrollImmediately } from 'react-lrc';
import useTimer from '../hooks/useTimer';
import Control from './LyricsControl';
import { cn } from '~/lib/utils';

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
  const { currentMillisecond, setCurrentMillisecond, reset, play, pause, paused } = useTimer(1);
  const { signal, recoverAutoScrollImmediately } = useRecoverAutoScrollImmediately();

  // Sync with external time when controlled externally
  useEffect(() => {
    if (isExternallyControlled && externalTime !== undefined) {
      setCurrentMillisecond(externalTime);
    }
  }, [externalTime, isExternallyControlled, setCurrentMillisecond]);

  const lrcStyle: CSSProperties = {
    height: '100%',
    padding: '20px 0',
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
  const displayTime = isExternallyControlled && externalTime !== undefined 
    ? externalTime 
    : currentMillisecond;

  return (
    <div className={cn("flex flex-col h-full", className)}>
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
      
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="absolute inset-0">
          <Lrc
            lrc={lrc}
            lineRenderer={({ active, line: { content } }) => (
              <div
                className={cn(
                  "min-h-[30px] px-6 py-3 text-center transition-all duration-300 cursor-pointer",
                  "hover:bg-zinc-800/50 rounded-lg",
                  active
                    ? "text-white scale-105 bg-purple-500/20 font-medium"
                    : "text-zinc-400"
                )}
              >
                {content}
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