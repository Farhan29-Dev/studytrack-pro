import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type EnergyLevel = 'low' | 'medium' | 'high';

interface EnergySelectorProps {
  value: EnergyLevel;
  onChange: (level: EnergyLevel) => void;
  compact?: boolean;
}

export function EnergySelector({ value, onChange, compact = false }: EnergySelectorProps) {
  const levels = [
    { id: 'low' as EnergyLevel, label: 'Low', emoji: '😴', description: 'Light study' },
    { id: 'medium' as EnergyLevel, label: 'Medium', emoji: '🙂', description: 'Balanced' },
    { id: 'high' as EnergyLevel, label: 'High', emoji: '⚡', description: 'Intensive' },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-1 p-1 rounded-full bg-muted">
        {levels.map((level) => (
          <button
            key={level.id}
            onClick={() => onChange(level.id)}
            className={cn(
              "px-3 py-1 rounded-full text-sm transition-all touch-manipulation",
              value === level.id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted-foreground/10"
            )}
          >
            {level.emoji}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Zap className="h-4 w-4" />
        <span>Study Energy</span>
      </div>
      <div className="flex gap-2">
        {levels.map((level) => (
          <button
            key={level.id}
            onClick={() => onChange(level.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all touch-manipulation",
              value === level.id
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            )}
          >
            <span className="text-xl">{level.emoji}</span>
            <span className="text-xs font-medium">{level.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
