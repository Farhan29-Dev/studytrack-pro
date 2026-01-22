import { useState } from 'react';
import { Check, Clock, ChevronRight, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Topic } from '@/types';
import { format } from 'date-fns';
import { getDifficultyBadgeVariant } from '@/lib/spaced-repetition';

interface TopicCardProps {
  topic: Topic;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, name: string) => void;
  showSubject?: boolean;
  subjectName?: string;
  subjectColor?: string;
}

export function TopicCard({
  topic,
  onToggleComplete,
  onDelete,
  onEdit,
  showSubject,
  subjectName,
  subjectColor,
}: TopicCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      className={cn(
        'group relative flex items-center gap-4 p-4 transition-all duration-200',
        'hover:shadow-md border-l-4',
        topic.is_completed && 'opacity-70'
      )}
      style={{ borderLeftColor: subjectColor || 'hsl(var(--primary))' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Checkbox
        checked={topic.is_completed}
        onCheckedChange={(checked) => onToggleComplete(topic.id, checked as boolean)}
        className="h-5 w-5"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium truncate',
              topic.is_completed && 'line-through text-muted-foreground'
            )}
          >
            {topic.name}
          </span>
          {showSubject && subjectName && (
            <Badge variant="outline" className="text-xs">
              {subjectName}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          <Badge variant={getDifficultyBadgeVariant(topic.difficulty as any)} className="text-xs">
            {topic.difficulty}
          </Badge>

          {topic.next_review && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Review: {format(new Date(topic.next_review), 'MMM d')}</span>
            </div>
          )}

          {topic.review_count > 0 && (
            <span>Reviews: {topic.review_count}</span>
          )}
        </div>
      </div>

      {onEdit && isHovered && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary"
          onClick={() => onEdit(topic.id, topic.name)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      {onDelete && isHovered && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(topic.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      {topic.is_completed && (
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-success/10">
          <Check className="h-4 w-4 text-success" />
        </div>
      )}
    </Card>
  );
}
