"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface AnimatedTitleProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedTitle({
  children,
  className = "",
}: AnimatedTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      <h1 className="animate-pulse-slow bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
        {children}
      </h1>
    </motion.div>
  );
}
