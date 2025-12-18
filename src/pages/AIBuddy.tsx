import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Trash2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DashboardLayout } from '@/components/DashboardLayout';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function AIBuddy() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchMessages();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as ChatMessage[]) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !user) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message to UI immediately
    const tempUserMessage: ChatMessage = {
      id: crypto.randomUUID(),
      user_id: user.id,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      // Save user message to database
      await supabase.from('chat_messages').insert({
        user_id: user.id,
        role: 'user',
        content: userMessage,
      });

      // Call AI edge function
      const response = await supabase.functions.invoke('chat', {
        body: {
          messages: [...messages, tempUserMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const assistantContent = response.data?.content || response.data?.message || 'I apologize, but I encountered an issue processing your request.';

      // Save assistant message to database
      const { data: savedMessage, error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          role: 'assistant',
          content: assistantContent,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      setMessages((prev) => [...prev, savedMessage as ChatMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      let errorMessage = 'Failed to get response from AI';
      if (error.message?.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please try again in a moment.';
      } else if (error.message?.includes('402')) {
        errorMessage = 'AI credits exhausted. Please add more credits.';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      // Remove the temporary user message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
      setInput(userMessage);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await supabase.from('chat_messages').delete().eq('user_id', user?.id);
      setMessages([]);
      toast({
        title: 'Chat cleared',
        description: 'Your conversation history has been deleted',
      });
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear chat history',
        variant: 'destructive',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground">AI Study Buddy</h1>
              <p className="text-muted-foreground mt-1">Get personalized help with your studies</p>
            </div>
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearChat}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Chat
              </Button>
            )}
          </div>

          {/* Chat Area */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              {initialLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center mb-6">
                    <Sparkles className="h-10 w-10 text-primary-foreground" />
                  </div>
                  <h3 className="font-serif text-2xl font-semibold mb-2">Welcome to AI Study Buddy!</h3>
                  <p className="text-muted-foreground max-w-md mb-6">
                    I'm here to help you with your studies. Ask me questions about your subjects,
                    get explanations, or request practice problems!
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      'Explain photosynthesis',
                      'Help me with calculus',
                      'Quiz me on history',
                      'Summarize this topic',
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => setInput(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex gap-3',
                        message.role === 'user' ? 'flex-row-reverse' : ''
                      )}
                    >
                      <div
                        className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'gradient-primary text-primary-foreground'
                        )}
                      >
                        {message.role === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={cn(
                          'flex flex-col max-w-[80%]',
                          message.role === 'user' ? 'items-end' : 'items-start'
                        )}
                      >
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-3',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-muted rounded-tl-sm'
                          )}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {format(new Date(message.created_at), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
                          <span
                            className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"
                            style={{ animationDelay: '0.1s' }}
                          />
                          <span
                            className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"
                            style={{ animationDelay: '0.2s' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about your studies..."
                  className="min-h-[60px] max-h-[150px] resize-none"
                  disabled={loading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="h-auto px-4"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
