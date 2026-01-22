import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Meh } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ConfidenceLevel = 'low' | 'medium' | 'high';

interface ConfidenceMeterProps {
  onSelect: (level: ConfidenceLevel) => void;
  selected?: ConfidenceLevel | null;
}

export function ConfidenceMeter({ onSelect, selected }: ConfidenceMeterProps) {
  const levels = [
    { id: 'low' as ConfidenceLevel, label: 'Not confident', emoji: '😰', icon: ThumbsDown, color: 'text-destructive' },
    { id: 'medium' as ConfidenceLevel, label: 'Somewhat confident', emoji: '🤔', icon: Meh, color: 'text-warning' },
    { id: 'high' as ConfidenceLevel, label: 'Very confident', emoji: '😊', icon: ThumbsUp, color: 'text-success' },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-center">How confident do you feel about this topic?</p>
      <div className="flex gap-2 justify-center">
        {levels.map((level) => (
          <button
            key={level.id}
            onClick={() => onSelect(level.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all touch-manipulation min-w-[80px]",
              selected === level.id
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            )}
          >
            <span className="text-2xl">{level.emoji}</span>
            <span className="text-xs font-medium">{level.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
