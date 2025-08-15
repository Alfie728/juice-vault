"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
  debounceMs?: number;
}

export function SearchBar({
  placeholder = "Search songs, lyrics, albums...",
  onSearch,
  className,
  debounceMs = 300,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch?.(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, onSearch, debounceMs]);

  return (
    <div
      className={cn(
        "relative transition-all duration-300",
        isFocused && "scale-[1.02]",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 blur-xl opacity-0 transition-opacity duration-300"
           style={{ opacity: isFocused ? 1 : 0 }} />
      
      <div className="relative flex items-center">
        <Search className="absolute left-4 h-5 w-5 text-zinc-400" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            "h-12 w-full bg-zinc-900/50 backdrop-blur-sm border-zinc-800 pl-12 pr-12",
            "placeholder:text-zinc-500 text-white",
            "focus:border-purple-600/50 focus:bg-zinc-900/80",
            "transition-all duration-300"
          )}
        />
        {query && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setQuery("")}
            className="absolute right-2 h-8 w-8 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}