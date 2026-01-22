import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Suspense, lazy } from "react";
import { PerformanceMonitor } from "@/components/PerformanceMonitor";

// Lazy load components for better performance
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Syllabus = lazy(() => import("./pages/Syllabus"));
const AIBuddy = lazy(() => import("./pages/AIBuddy"));
const Review = lazy(() => import("./pages/Review"));
const Setup = lazy(() => import("./pages/Setup"));
const Planner = lazy(() => import("./pages/Planner"));
const Tests = lazy(() => import("./pages/Tests"));
const Profile = lazy(() => import("./pages/Profile"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading component for suspense fallback
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/syllabus" element={<Syllabus />} />
                <Route path="/ai-buddy" element={<AIBuddy />} />
                <Route path="/review" element={<Review />} />
                <Route path="/setup" element={<Setup />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/tests" element={<Tests />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/parent" element={<ParentDashboard />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <PerformanceMonitor />
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
