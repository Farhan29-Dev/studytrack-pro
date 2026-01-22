import { useState, useEffect } from 'react';
import { User, Shield, Moon, Sun, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DashboardLayout } from '@/components/DashboardLayout';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type EnergyLevel = 'low' | 'medium' | 'high';

interface ProfileData {
  name: string | null;
  email: string | null;
  energy_level: string;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('medium');

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email, energy_level')
        .eq('user_id', user!.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setEnergyLevel((data.energy_level as EnergyLevel) || 'medium');
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateEnergyLevel = async (level: EnergyLevel) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ energy_level: level })
        .eq('user_id', user!.id);

      if (error) throw error;
      setEnergyLevel(level);
      toast({ title: 'Energy level updated', description: `Study intensity set to ${level}` });
    } catch (error) {
      console.error('Error updating energy level:', error);
      toast({ title: 'Error', description: 'Failed to update energy level', variant: 'destructive' });
    }
  };

  const energyLevels = [
    { id: 'low' as EnergyLevel, label: 'Low', emoji: '😴', description: 'Shorter tasks, simpler explanations' },
    { id: 'medium' as EnergyLevel, label: 'Medium', emoji: '🙂', description: 'Balanced workload' },
    { id: 'high' as EnergyLevel, label: 'High', emoji: '⚡', description: 'Intensive study sessions' },
  ];

  if (loading) {
    return (
      <RequireAuth>
        <DashboardLayout>
          <div className="flex items-center justify-center h-96">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </DashboardLayout>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-24 lg:pb-8">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Profile & Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
          </div>

          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {profile?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-lg">{profile?.name || 'Student'}</p>
                  <p className="text-sm text-muted-foreground">{profile?.email || user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Study Energy Mode */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Study Energy Mode
              </CardTitle>
              <CardDescription>
                Adjust the intensity of your study sessions based on how you're feeling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {energyLevels.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => updateEnergyLevel(level.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all touch-manipulation",
                      energyLevel === level.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-2xl">{level.emoji}</span>
                    <span className="font-medium text-sm">{level.label}</span>
                    <span className="text-xs text-muted-foreground text-center">{level.description}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Theme Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Switch between light and dark themes</p>
                </div>
                <Switch
                  id="dark-mode"
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Parent View Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Parent View
              </CardTitle>
              <CardDescription>
                Parents can view your study progress using this account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary/5 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">How it works:</p>
                <p className="text-sm text-muted-foreground">
                  Parents can log in with your account credentials and click "Parent View" 
                  in the sidebar to see a read-only dashboard of your progress.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <p className="font-medium mb-1">What parents can see:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Study time and progress</li>
                  <li>Test scores and performance</li>
                  <li>Subject-wise breakdown</li>
                  <li>Weekly activity trends</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Sign Out */}
          <Card>
            <CardContent className="pt-6">
              <Button variant="destructive" onClick={signOut} className="w-full">
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
