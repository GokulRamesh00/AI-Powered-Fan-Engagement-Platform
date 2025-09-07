import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Send, Mic, X, Bot, User, Sparkles } from 'lucide-react';

const API_BASE_URL = "http://127.0.0.1:8000";

interface AIChatInterfaceProps {
  authorName: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export function AIChatInterface({ authorName, onClose }: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const firstName = authorName.split(' ')[0];

  // Sample responses for demonstration
  const sampleResponses = [
    `That's a fascinating question! In my writing, I often explore themes of identity and belonging. The characters face challenges that mirror our own struggles with finding our place in the world.`,
    `I'm glad you asked about that character! They were actually inspired by someone I met during my travels. Their resilience in the face of adversity really struck me and became central to their story arc.`,
    `The world-building process is one of my favorite parts of writing. I start with a single image or feeling, then build outward from there, asking myself how the society, magic system, and geography all interconnect.`,
    `Writing dialogue is like conducting an orchestra - each character has their own voice and rhythm. I spend a lot of time reading dialogue aloud to make sure it feels natural and distinct.`,
    `That plot twist was planned from the very beginning! I love planting subtle clues throughout the story that readers can pick up on during a re-read. It's like leaving breadcrumbs for the observant reader.`
  ];

  useEffect(() => {
    const startConversation = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/chat/start`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to start conversation');
        }
        const data = await response.json();
        setConversationId(data.conversation_id);
        // Set the initial AI greeting
        setMessages([
          {
            id: '1',
            type: 'ai',
            content: `Hello! I'm an AI trained on ${authorName}'s published works and interviews. I can discuss their characters, themes, writing process, and answer questions about their stories. What would you like to know?`,
            timestamp: new Date()
          }
        ]);
      } catch (error) {
        console.error("Error starting conversation:", error);
        // Handle error, e.g., show an error message to the user
      }
    };
    startConversation();

    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [authorName]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_query: currentInput,
          influencer_name: authorName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.ai_response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsTyping(false);
    }

    // Simulate AI response
    // setTimeout(() => {
    //   const aiResponse: ChatMessage = {
    //     id: (Date.now() + 1).toString(),
    //     type: 'ai',
    //     content: sampleResponses[Math.floor(Math.random() * sampleResponses.length)],
    //     timestamp: new Date()
    //   };
    //   setMessages(prev => [...prev, aiResponse]);
    //   setIsTyping(false);
    // }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickPrompts = [
    "Tell me about your writing process",
    "What inspired your latest book?",
    "How do you develop characters?",
    "What's your favorite scene you've written?"
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face" />
            <AvatarFallback>
              <Bot className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold">AI {firstName}</h3>
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Powered
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Based on {authorName}'s published works
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 overflow-hidden" ref={scrollAreaRef}>
        <div className="space-y-4 max-w-full overflow-hidden">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-2 ${message.type === 'user' ? 'max-w-[80%] flex-row-reverse space-x-reverse' : 'max-w-[85%]'}`}>
                <Avatar className="w-8 h-8 flex-shrink-0">
                  {message.type === 'user' ? (
                    <>
                      <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face" />
                      <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                    </>
                  ) : (
                    <>
                      <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face" />
                      <AvatarFallback><Bot className="w-4 h-4" /></AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div
                  className={`rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground max-w-fit'
                      : 'bg-accent text-accent-foreground min-w-0 flex-1'
                  } overflow-hidden`}
                >
                  <p className="text-sm leading-relaxed chat-message-content">
                    {message.content}
                  </p>
                  <p className={`text-xs mt-1 ${
                    message.type === 'user' 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face" />
                  <AvatarFallback><Bot className="w-4 h-4" /></AvatarFallback>
                </Avatar>
                <div className="bg-accent text-accent-foreground rounded-lg p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Prompts */}
      {messages.length === 1 && (
        <div className="px-4 py-2 border-t bg-accent/20">
          <p className="text-sm text-muted-foreground mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setInputMessage(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Ask AI ${firstName} anything about their work...`}
              className="w-full p-3 pr-12 rounded-lg border border-input bg-input-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
              disabled
            >
              <Mic className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
          <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || isTyping}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          AI responses are generated based on {authorName}'s published works and may not reflect their personal views.
        </p>
      </div>
    </div>
  );
}