import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, BookOpen, Brain, RefreshCw, Settings, LogOut, Menu, X, GraduationCap, Moon, Sun, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { StudyTrackLogo } from './StudyTrackLogo';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: BarChart3 },
  { href: '/syllabus', label: 'Syllabus', icon: BookOpen },
  { href: '/planner', label: 'Planner', icon: BookOpen },
  { href: '/tests', label: 'Tests', icon: RefreshCw },
  { href: '/review', label: 'Review', icon: Settings },
  { href: '/ai-buddy', label: 'AI Buddy', icon: Brain },
  { href: '/setup', label: 'Setup', icon: GraduationCap },
  { href: '/profile', label: 'Profile', icon: Users },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background gpu-accelerated">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 xl:w-72 flex-col bg-card border-r border-border will-change-transform tablet-sidebar">
        <div className="flex items-center gap-3 p-6 border-b border-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-md">
            <StudyTrackLogo className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-semibold text-foreground">StudyTrack</h1>
            <p className="text-xs text-muted-foreground">Pro</p>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto mobile-optimized">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.href}>
                  <Link to={item.href}
                    className={cn('flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 touch-manipulation focus-visible desktop-hover',
                      isActive ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}                    aria-current={isActive ? 'page' : undefined}>
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {/* Parent Dashboard Link */}
            <li>
              <Link to="/parent"
                className={cn('flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 touch-manipulation focus-visible desktop-hover',
                  location.pathname === '/parent' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}                aria-current={location.pathname === '/parent' ? 'page' : undefined}>
                <Users className="h-5 w-5 flex-shrink-0" />
                Parent View
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground touch-manipulation focus-visible"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>

          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-primary">{user?.email?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive touch-manipulation focus-visible" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-card/95 backdrop-blur border-b border-border px-4 py-3 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shadow-sm">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-lg font-semibold">StudyTrack</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="touch-manipulation focus-visible" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="touch-manipulation focus-visible" aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background/98 backdrop-blur pt-16 animate-fade-in">
          <div className="h-full overflow-hidden">
            <nav className="h-full overflow-y-auto mobile-optimized px-4 py-4">
              <ul className="space-y-2 pb-8">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link to={item.href} onClick={() => setMobileMenuOpen(false)}
                        className={cn('flex items-center gap-3 rounded-xl px-4 py-4 text-base font-medium transition-all touch-manipulation focus-visible min-h-[56px]',
                          isActive ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-accent active:bg-accent')}                        aria-current={isActive ? 'page' : undefined}>
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                {/* Parent Dashboard Link */}
                <li>
                  <Link to="/parent" onClick={() => setMobileMenuOpen(false)}
                    className={cn('flex items-center gap-3 rounded-xl px-4 py-4 text-base font-medium transition-all touch-manipulation focus-visible min-h-[56px]',
                      location.pathname === '/parent' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-accent')}                    aria-current={location.pathname === '/parent' ? 'page' : undefined}>
                    <Users className="h-5 w-5 flex-shrink-0" />
                    Parent View
                  </Link>
                </li>
              </ul>
              <div className="border-t border-border pt-4 mt-4">
                <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive touch-manipulation focus-visible py-4 min-h-[56px]"
                  onClick={() => { signOut(); setMobileMenuOpen(false); }}>
                  <LogOut className="mr-2 h-5 w-5" />Sign out
                </Button>
              </div>
            </nav>
          </div>
        </div>
      )}

{/* Bottom Navigation for Mobile - REMOVED for cleaner UX */}
      {/* The hamburger menu in the header provides all navigation options */}

      <main className="lg:ml-64 xl:ml-72 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 xl:p-12 max-w-7xl mx-auto desktop-optimized">
          {children}
        </div>
      </main>
    </div>
  );
}
