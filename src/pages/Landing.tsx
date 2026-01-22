import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, BarChart3, Brain, RefreshCw, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { StudyTrackLogo } from '@/components/StudyTrackLogo';

const features = [
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Track your progress with beautiful charts and insights to understand your learning patterns.',
  },
  {
    icon: Brain,
    title: 'AI Study Buddy',
    description: 'Get instant help with any topic. Our AI tutor explains concepts and answers your questions.',
  },
  {
    icon: RefreshCw,
    title: 'Spaced Repetition',
    description: 'Science-backed review system that schedules topics at optimal intervals for long-term retention.',
  },
];

const benefits = [
  'Organize subjects, units, and topics',
  'Track completion progress in real-time',
  'AI-powered study assistance',
  'Intelligent review scheduling',
  'Beautiful, intuitive interface',
  'Works on all devices',
];

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
              <StudyTrackLogo className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-semibold">StudyTrack Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6 animate-fade-in">
            <Brain className="h-4 w-4" />
            AI-Powered Learning
          </div>

          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 animate-slide-up">
            Master Your Studies
            <br />
            <span className="gradient-primary bg-clip-text text-transparent">with Intelligence</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            The ultimate study companion that combines smart organization, AI assistance,
            and science-backed spaced repetition to help you learn faster and retain longer.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Button size="lg" asChild className="text-lg px-8">
              <Link to="/auth">
                Start Learning Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8">
              <a href="#features">See Features</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Powerful tools designed to make studying more effective and enjoyable
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={feature.title}
                className="group hover:shadow-lg transition-all duration-300 border-0 bg-card animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-8">
                  <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-6">
                Study Smarter, Not Harder
              </h2>
              <p className="text-muted-foreground mb-8">
                StudyTrack Pro brings together the best tools for effective learning.
                From organizing your syllabus to AI-powered tutoring, we've got you covered.
              </p>

              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li
                    key={benefit}
                    className="flex items-center gap-3 animate-slide-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="aspect-square max-w-md mx-auto rounded-3xl gradient-hero p-8 flex items-center justify-center">
                <div className="text-center text-primary-foreground">
                  <GraduationCap className="h-24 w-24 mx-auto mb-4" />
                  <p className="text-2xl font-serif font-bold">StudyTrack Pro</p>
                  <p className="text-sm opacity-80">Your path to academic success</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 gradient-hero">
        <div className="container mx-auto text-center text-primary-foreground">
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Learning?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Join thousands of students who are already studying smarter with StudyTrack Pro.
          </p>
          <Button size="lg" variant="secondary" asChild className="text-lg px-8">
            <Link to="/auth">
              Get Started Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-serif font-semibold">StudyTrack Pro</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} StudyTrack Pro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
