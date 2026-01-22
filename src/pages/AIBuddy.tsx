import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Trash2, Sparkles, ImagePlus, X, Lightbulb, GraduationCap, FileText, RefreshCw, HelpCircle, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DashboardLayout } from '@/components/DashboardLayout';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import {
  fetchChatMessages,
  saveChatMessage,
  clearChatMessages,
  uploadChatImage,
  getBackendStatus,
  ChatMessageWithImage,
} from '@/lib/firebase-chat';

type ChatMode = 'explain' | 'exam' | 'notes' | 'revision' | 'simple' | 'format';

const chatModes = [
  { id: 'explain' as ChatMode, label: 'Explain', icon: Lightbulb, description: 'Easy to understand' },
  { id: 'exam' as ChatMode, label: 'Exam Focus', icon: GraduationCap, description: 'Exam-oriented' },
  { id: 'notes' as ChatMode, label: 'Notes', icon: FileText, description: 'Bullet points' },
  { id: 'revision' as ChatMode, label: 'Revision', icon: RefreshCw, description: 'Quick refresh' },
  { id: 'simple' as ChatMode, label: "I Don't Get It", icon: HelpCircle, description: 'Simpler language' },
  { id: 'format' as ChatMode, label: 'Exam Format', icon: Award, description: '2/5/10 marks' },
];

const modePrompts: Record<ChatMode, string> = {
  explain: 'Please explain this in simple, easy-to-understand terms with examples: ',
  exam: 'From an exam perspective, give me key points and common questions about: ',
  notes: 'Give me short, concise bullet-point notes on: ',
  revision: 'Give me a quick 1-minute revision refresher with the most important points about: ',
  simple: "I'm really struggling to understand this. Please explain it like I'm completely new to this topic, using simple analogies and real-life examples: ",
  format: 'Format this as an exam answer. Structure it with: Introduction, Main Points (numbered), Diagram hint (if applicable), and Conclusion. For: ',
};

export default function AIBuddy() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessageWithImage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ChatMode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backendStatus = getBackendStatus();

  useEffect(() => {
    if (user) {
      loadMessages();
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

  const loadMessages = async () => {
    if (!user) return;
    try {
      const data = await fetchChatMessages(user.id);
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Oops! Wrong file type',
          description: 'Please pick an image (jpg, png, gif)',
          variant: 'destructive',
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Image too large',
          description: 'Please choose an image under 10MB',
          variant: 'destructive',
        });
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || loading || !user) return;

    let userMessage = input.trim();
    
    // Prepend mode prompt if selected
    if (selectedMode && userMessage) {
      userMessage = modePrompts[selectedMode] + userMessage;
    }
    
    setInput('');
    setLoading(true);

    let imageUrl: string | undefined;

    try {
      if (selectedImage) {
        setUploadingImage(true);
        imageUrl = await uploadChatImage(user.id, selectedImage);
        setUploadingImage(false);
        removeSelectedImage();
      }

      const tempUserMessage: ChatMessageWithImage = {
        id: crypto.randomUUID(),
        user_id: user.id,
        role: 'user',
        content: input.trim() || (imageUrl ? 'Analyze this image' : ''),
        created_at: new Date().toISOString(),
        image_url: imageUrl,
      };
      setMessages((prev) => [...prev, tempUserMessage]);

      await saveChatMessage(user.id, 'user', tempUserMessage.content, imageUrl);

      const aiMessages = [...messages, { ...tempUserMessage, content: userMessage || tempUserMessage.content }].map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.image_url && { image_url: m.image_url }),
      }));

      const response = await supabase.functions.invoke('chat', {
        body: { messages: aiMessages, mode: selectedMode },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const assistantContent =
        response.data?.content ||
        response.data?.message ||
        "Hmm, I couldn't process that. Let's try again!";

      const savedMessage = await saveChatMessage(user.id, 'assistant', assistantContent);
      setMessages((prev) => [...prev, savedMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);

      let errorMessage = "Something went wrong. Let's try again!";
      if (error.message?.includes('429')) {
        errorMessage = "I'm a bit busy right now. Please wait a moment!";
      } else if (error.message?.includes('402')) {
        errorMessage = 'AI credits used up. Time to top up!';
      }

      toast({
        title: 'Oops!',
        description: errorMessage,
        variant: 'destructive',
      });

      setMessages((prev) => prev.slice(0, -1));
      setInput(input);
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  const handleClearChat = async () => {
    if (!user) return;
    try {
      await clearChatMessages(user.id);
      setMessages([]);
      toast({
        title: 'All clear! 🧹',
        description: 'Your chat history has been wiped clean',
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
        <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
          {/* Header - Mobile optimized */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">AI Study Buddy</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Your friendly study companion 📚
              </p>
            </div>
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearChat} className="self-start sm:self-auto">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {/* Chat Area - Card based layout */}
          <Card className="flex-1 flex flex-col overflow-hidden shadow-lg">
            <ScrollArea className="flex-1 p-3 sm:p-4">
              {initialLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading your conversations...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4 sm:p-8">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full gradient-primary flex items-center justify-center mb-4 sm:mb-6 shadow-glow animate-pulse-soft">
                    <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
                  </div>
                  <h3 className="font-serif text-xl sm:text-2xl font-semibold mb-2">
                    Hey there! 👋
                  </h3>
                  <p className="text-muted-foreground max-w-md mb-4 sm:mb-6 text-sm sm:text-base">
                    I'm your AI study buddy! Ask me anything, upload a screenshot of a problem, or pick a study mode below.
                  </p>
                  
                  {/* Mode Selection */}
                  <div className="w-full max-w-md mb-4 sm:mb-6">
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Study Modes</p>
                    <div className="grid grid-cols-3 gap-2">
                      {chatModes.map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => setSelectedMode(selectedMode === mode.id ? null : mode.id)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all touch-manipulation",
                            selectedMode === mode.id
                              ? "border-primary bg-primary/10 shadow-md"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          )}
                        >
                          <mode.icon className={cn("h-5 w-5", selectedMode === mode.id ? "text-primary" : "text-muted-foreground")} />
                          <span className="text-xs font-medium">{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      '🌱 Explain photosynthesis',
                      '📐 Help with calculus',
                      '📖 Quiz me on history',
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => setInput(suggestion)}
                        className="text-xs sm:text-sm touch-manipulation"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex gap-2 sm:gap-3 animate-fade-in',
                        message.role === 'user' ? 'flex-row-reverse' : ''
                      )}
                    >
                      <div
                        className={cn(
                          'h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'gradient-primary text-primary-foreground'
                        )}
                      >
                        {message.role === 'user' ? (
                          <User className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </div>
                      <div
                        className={cn(
                          'flex flex-col max-w-[85%] sm:max-w-[80%]',
                          message.role === 'user' ? 'items-end' : 'items-start'
                        )}
                      >
                        <div
                          className={cn(
                            'rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-card border border-border rounded-tl-sm'
                          )}
                        >
                          {message.image_url && (
                            <img
                              src={message.image_url}
                              alt="Uploaded"
                              className="max-w-full max-h-48 sm:max-h-64 rounded-lg mb-2"
                            />
                          )}
                          {message.role === 'assistant' ? (
                            <MarkdownMessage content={message.content} />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>
                          )}
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 px-1">
                          {format(new Date(message.created_at), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Enhanced typing indicator */}
                  {loading && (
                    <div className="flex gap-2 sm:gap-3 animate-fade-in">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full gradient-primary flex items-center justify-center shadow-sm">
                        <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                      </div>
                      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                            <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.15s' }} />
                            <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.3s' }} />
                          </div>
                          <span className="text-xs text-muted-foreground ml-2">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              )}
            </ScrollArea>

            {/* Mode indicator when active */}
            {selectedMode && messages.length > 0 && (
              <div className="px-3 sm:px-4 py-2 border-t border-border bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {chatModes.find(m => m.id === selectedMode)?.icon && (
                      <div className="text-primary">
                        {(() => {
                          const Icon = chatModes.find(m => m.id === selectedMode)!.icon;
                          return <Icon className="h-4 w-4" />;
                        })()}
                      </div>
                    )}
                    <span className="text-xs font-medium text-primary">
                      {chatModes.find(m => m.id === selectedMode)?.label} mode
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedMode(null)} className="h-6 text-xs">
                    Clear mode
                  </Button>
                </div>
              </div>
            )}

            {/* Image Preview */}
            {imagePreview && (
              <div className="px-3 sm:px-4 py-2 border-t border-border bg-muted/30">
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Selected" className="max-h-20 sm:max-h-24 rounded-lg shadow-sm" />
                  <button
                    onClick={removeSelectedImage}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 hover:bg-destructive/90 shadow-md touch-manipulation"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Input Area - Mobile optimized with larger touch targets */}
            <div className="p-3 sm:p-4 border-t border-border bg-background/50">
              {/* Mode selector inline for when messages exist */}
              {messages.length > 0 && (
                <div className="flex gap-1 mb-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {chatModes.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setSelectedMode(selectedMode === mode.id ? null : mode.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all touch-manipulation",
                        selectedMode === mode.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      <mode.icon className="h-3 w-3" />
                      {mode.label}
                    </button>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || uploadingImage}
                  className="flex-shrink-0 h-12 w-12 sm:h-10 sm:w-10 touch-manipulation"
                  title="Upload image or screenshot"
                >
                  {uploadingImage ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedMode ? `Ask in ${chatModes.find(m => m.id === selectedMode)?.label} mode...` : "Ask me anything..."}
                  className="min-h-[48px] sm:min-h-[60px] max-h-[120px] resize-none text-base"
                  disabled={loading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !selectedImage) || loading}
                  className="h-12 w-12 sm:h-auto sm:w-auto sm:px-4 touch-manipulation"
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
