import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { 
  X, 
  Bot, 
  User, 
  Sparkles, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff,
  Volume2,
  VolumeX
} from 'lucide-react';

const API_BASE_URL = "http://127.0.0.1:8000";

interface AIVoiceInterfaceProps {
  authorName: string;
  onClose: () => void;
}

interface VoiceMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
}

export function AIVoiceInterface({ authorName, onClose }: AIVoiceInterfaceProps) {
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  // WebRTC and audio references
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const firstName = authorName.split(' ')[0];

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Initialize with system message
    setMessages([
      {
        id: '1',
        type: 'system',
        content: `Ready to start voice conversation with AI ${firstName}. Click "Start Call" to begin.`,
        timestamp: new Date()
      }
    ]);

    return () => {
      // Cleanup on unmount
      stopCall();
    };
  }, [firstName]);

  const addMessage = (type: 'user' | 'ai' | 'system', content: string) => {
    const newMessage: VoiceMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const saveMessage = async (role: string, content: string) => {
    if (!conversationId) return;
    
    try {
      // Use chat endpoint to save messages (they use the same database)
      // We'll create the message directly in the database by calling the chat endpoint
      // For now, we'll just store in local state and let the chat history handle persistence
      console.log('Message saved locally:', { role, content, conversationId });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const startCall = async () => {
    setIsConnecting(true);
    addMessage('system', 'Connecting to voice chat...');

    try {
      // 1. Get microphone access
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // 2. Create RTCPeerConnection
      peerConnectionRef.current = new RTCPeerConnection();

      // 3. Handle remote audio
      if (remoteAudioRef.current) {
        peerConnectionRef.current.ontrack = (event) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
          }
        };
      }

      // 4. Add local audio tracks
      micStreamRef.current.getAudioTracks().forEach((track) => {
        if (peerConnectionRef.current && micStreamRef.current) {
          peerConnectionRef.current.addTrack(track, micStreamRef.current);
        }
      });

      // 5. Create data channel for events
      dataChannelRef.current = peerConnectionRef.current.createDataChannel("oai-events");

      dataChannelRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different event types
          switch (data.type) {
            case 'input_audio_buffer.speech_started':
              setIsRecording(true);
              break;
              
            case 'input_audio_buffer.speech_stopped':
              setIsRecording(false);
              break;
              
            case 'conversation.item.input_audio_transcription.completed':
              if (data.transcript) {
                addMessage('user', data.transcript);
                saveMessage('user', data.transcript);
              }
              break;
              
            case 'response.audio_transcript.delta':
              // Handle AI response transcription
              break;
              
            case 'response.audio_transcript.done':
              if (data.transcript) {
                addMessage('ai', data.transcript);
                saveMessage('assistant', data.transcript);
              }
              break;
              
            case 'error':
              addMessage('system', `Error: ${data.error?.message || 'Unknown error'}`);
              break;
          }
        } catch (error) {
          console.error('Error parsing event data:', error);
        }
      };

      // 6. Create offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      // 7. Get session from backend (using main chat endpoint)
      const sessionResponse = await fetch(`${API_BASE_URL}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_query: "Starting voice conversation", // Initial query for RAG context
          influencer_name: authorName,
          is_voice_session: true,
          voice_model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "alloy"
        }),
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error('Session creation failed:', errorText);
        throw new Error(`Failed to create voice session: ${sessionResponse.status} - ${errorText}`);
      }

      const sessionData = await sessionResponse.json();
      console.log('Session data received:', sessionData); // Debug: see what we're getting
      setConversationId(sessionData.conversation_id);
      
      // Store the session configuration from backend for later use
      const backendSessionConfig = sessionData.session_config;
      
      // Check different possible structures for the ephemeral key
      let ephemeralKey = null;
      if (sessionData.client_secret?.value) {
        ephemeralKey = sessionData.client_secret.value;
      } else if (typeof sessionData.client_secret === 'string') {
        ephemeralKey = sessionData.client_secret;
      } else if (sessionData.client_secret?.client_secret?.value) {
        ephemeralKey = sessionData.client_secret.client_secret.value;
      }
      
      console.log('Ephemeral key extracted:', ephemeralKey); // Debug: see what key we extracted
      
      if (!ephemeralKey) {
        console.error('Full session data:', JSON.stringify(sessionData, null, 2));
        throw new Error('No ephemeral key received');
      }

      // 8. Connect to OpenAI realtime API
      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
        }
      );

      const answerSDP = await sdpResponse.text();
      await peerConnectionRef.current.setRemoteDescription({ 
        type: 'answer', 
        sdp: answerSDP 
      });

      // Set up the data channel event handlers after we have the session config
      if (dataChannelRef.current) {
        dataChannelRef.current.onopen = () => {
          addMessage('system', 'Voice connection established. You can now speak!');
          setIsConnected(true);
          setIsConnecting(false);
          
          // Use the session configuration from the backend to ensure consistency
          if (dataChannelRef.current && backendSessionConfig) {
            console.log('Applying backend session config:', backendSessionConfig);
            dataChannelRef.current.send(JSON.stringify({
              type: "session.update",
              session: backendSessionConfig,
            }));
          } else {
            console.warn('No backend session config available, using fallback');
            // Fallback configuration if backend config is not available
            dataChannelRef.current.send(JSON.stringify({
              type: "session.update",
              session: {
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  silence_duration_ms: 1500,
                  prefix_padding_ms: 300,
                  create_response: true,
                  interrupt_response: true,
                },
                input_audio_transcription: { 
                  model: "whisper-1" 
                },
                temperature: 0.7,
                max_response_output_tokens: 1000,
              },
            }));
          }
        };
      }

    } catch (error) {
      console.error('Error starting call:', error);
      addMessage('system', `Failed to start call: ${error.message}`);
      setIsConnecting(false);
      stopCall();
    }
  };

  const stopCall = async () => {
    setIsConnected(false);
    setIsConnecting(false);
    setIsRecording(false);

    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop microphone
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    // Stop remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    addMessage('system', 'Voice call ended');
  };

  const toggleMute = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

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
              <h3 className="font-semibold">Voice Chat with AI {firstName}</h3>
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                Real-time AI
              </Badge>
              {isConnected && (
                <Badge variant="default" className="text-xs bg-green-500">
                  Connected
                </Badge>
              )}
              {isRecording && (
                <Badge variant="default" className="text-xs bg-red-500 animate-pulse">
                  Recording
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time voice conversation with {authorName}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Voice Controls */}
      <div className="p-4 border-b bg-accent/20">
        <div className="flex items-center justify-center space-x-4">
          {!isConnected && !isConnecting && (
            <Button onClick={startCall} size="lg" className="bg-green-600 hover:bg-green-700">
              <Phone className="w-5 h-5 mr-2" />
              Start Call
            </Button>
          )}
          
          {isConnecting && (
            <Button disabled size="lg">
              <Phone className="w-5 h-5 mr-2 animate-pulse" />
              Connecting...
            </Button>
          )}
          
          {isConnected && (
            <>
              <Button
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
              >
                {isMuted ? <MicOff className="w-5 h-5 mr-2" /> : <Mic className="w-5 h-5 mr-2" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
              
              <Button onClick={stopCall} variant="destructive" size="lg">
                <PhoneOff className="w-5 h-5 mr-2" />
                End Call
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 overflow-hidden" ref={scrollAreaRef}>
        <div className="space-y-4 max-w-full overflow-hidden">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === 'user' ? 'justify-end' : 
                message.type === 'system' ? 'justify-center' : 'justify-start'
              }`}
            >
              <div className={`flex items-start space-x-2 ${
                message.type === 'user' ? 'max-w-[80%] flex-row-reverse space-x-reverse' : 
                message.type === 'system' ? 'max-w-[90%] flex-col items-center' : 'max-w-[85%]'
              }`}>
                {message.type !== 'system' && (
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
                )}
                
                <div
                  className={`rounded-lg p-3 overflow-hidden ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground max-w-fit'
                      : message.type === 'system'
                      ? 'bg-muted text-muted-foreground text-center text-sm max-w-fit'
                      : 'bg-accent text-accent-foreground min-w-0 flex-1'
                  }`}
                >
                  <p className={`leading-relaxed chat-message-content ${message.type === 'system' ? 'text-sm' : 'text-sm'}`}>
                    {message.content}
                  </p>
                  {message.type !== 'system' && (
                    <p className={`text-xs mt-1 ${
                      message.type === 'user' 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Hidden audio element for remote audio */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Footer */}
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Real-time voice conversation powered by OpenAI. Audio is processed in real-time.
        </p>
      </div>
    </div>
  );
}
