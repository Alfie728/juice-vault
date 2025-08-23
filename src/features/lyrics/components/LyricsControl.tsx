import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '~/features/shared/components/ui/button';
import { Slider } from '~/features/shared/components/ui/slider';

interface ControlProps {
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  current: number;
  setCurrent: (ms: number) => void;
  recoverAutoScrollImmediately: () => void;
  isPlaying?: boolean;
  duration?: number;
}

export default function Control({
  onPlay,
  onPause,
  onReset,
  current,
  setCurrent,
  recoverAutoScrollImmediately,
  isPlaying = false,
  duration = 300000, // Default 5 minutes
}: ControlProps) {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4 p-4 border-b border-zinc-800">
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {isPlaying ? (
            <Button size="icon" variant="outline" onClick={onPause}>
              <Pause className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" variant="outline" onClick={onPlay}>
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="outline" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={recoverAutoScrollImmediately}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm text-zinc-400 min-w-[50px]">
            {formatTime(current)}
          </span>
          <Slider
            value={[current]}
            max={duration}
            step={100}
            onValueChange={([value]) => setCurrent(value ?? 0)}
            className="flex-1"
          />
          <span className="text-sm text-zinc-400 min-w-[50px]">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}