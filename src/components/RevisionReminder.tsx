import { Bell, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface RevisionReminderProps {
  topicsCount: number;
  urgentCount: number;
}

export function RevisionReminder({ topicsCount, urgentCount }: RevisionReminderProps) {
  const navigate = useNavigate();

  if (topicsCount === 0) return null;

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
            <Bell className="h-6 w-6 text-warning" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold">Revision Reminder</h4>
              {urgentCount > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {urgentCount} urgent
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {topicsCount} topic{topicsCount !== 1 ? 's' : ''} due for review
            </p>
          </div>
        </div>
        <Button onClick={() => navigate('/review')}>
          Start Review
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
