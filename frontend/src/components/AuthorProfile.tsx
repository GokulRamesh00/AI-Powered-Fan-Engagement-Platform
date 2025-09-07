import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { AIChatInterface } from './AIChatInterface';
import { AIVoiceInterface } from './AIVoiceInterface';
import { ImageWithFallback } from './ImageWithFallback';
import { Heart, Users, BookOpen, Video, Gift, DollarSign, Star, Calendar, ExternalLink, Mic } from 'lucide-react';

interface AuthorProfileProps {
  author: any;
  onNavigate: (page: string) => void;
}

export function AuthorProfile({ author, onNavigate }: AuthorProfileProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showVoiceChat, setShowVoiceChat] = useState(false);

  if (!author) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Author not found</h2>
        <Button onClick={() => onNavigate('home')}>Back to Home</Button>
      </div>
    );
  }

  const subscriptionTiers = [
    {
      name: "Basic Reader",
      price: "$4.99/month",
      features: ["AI Chat Access", "Monthly Newsletter", "Community Access"],
      popular: false
    },
    {
      name: "Devoted Fan",
      price: "$9.99/month",
      features: ["Everything in Basic", "Exclusive Content", "Early Access", "Monthly Live Session"],
      popular: true
    },
    {
      name: "Inner Circle",
      price: "$19.99/month",
      features: ["Everything in Devoted", "1-on-1 Monthly Chat", "Manuscript Reviews", "Signed Books"],
      popular: false
    }
  ];

  const recentContent = [
    {
      type: "story",
      title: "The Lost Chapter: Aeron's Backstory",
      description: "Exclusive content revealing the hidden past of fan-favorite character Aeron",
      date: "2 days ago",
      exclusive: true
    },
    {
      type: "update",
      title: "Writing Progress Update",
      description: "Book 3 is now 65% complete! Here's what's coming next...",
      date: "1 week ago",
      exclusive: false
    },
    {
      type: "live",
      title: "Character Development Workshop",
      description: "Join me for a live session on creating compelling characters",
      date: "Tomorrow at 7 PM EST",
      exclusive: true
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-64 overflow-hidden">
        <ImageWithFallback
          src={author.banner}
          alt={`${author.name} banner`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column - Profile Info */}
          <div className="lg:w-1/3">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-background shadow-lg">
                    <AvatarImage src={author.avatar} />
                    <AvatarFallback>{author.name.split(' ').map((n: any[]) => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <h1 className="text-2xl font-bold mb-2">{author.name}</h1>
                  <Badge className="mb-2">{author.genre}</Badge>
                  <p className="text-muted-foreground mb-4">{author.description}</p>
                  
                  <div className="flex justify-center space-x-6 mb-6 text-sm">
                    <div className="text-center">
                      <div className="flex items-center justify-center">
                        <Users className="w-4 h-4 mr-1" />
                        <span className="font-semibold">{author.followers}</span>
                      </div>
                      <p className="text-muted-foreground">Followers</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center">
                        <BookOpen className="w-4 h-4 mr-1" />
                        <span className="font-semibold">{author.books}</span>
                      </div>
                      <p className="text-muted-foreground">Books</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center">
                        <Star className="w-4 h-4 mr-1" />
                        <span className="font-semibold">4.8</span>
                      </div>
                      <p className="text-muted-foreground">Rating</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => setShowChat(true)}
                    >
                      Chat with AI {author.name.split(' ')[0]}
                    </Button>
                    <Button 
                      className="w-full" 
                      size="lg"
                      variant="outline"
                      onClick={() => setShowVoiceChat(true)}
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      Voice with AI {author.name.split(' ')[0]}
                    </Button>
                    <Button 
                      variant={isFollowing ? "secondary" : "outline"} 
                      className="w-full"
                      onClick={() => setIsFollowing(!isFollowing)}
                    >
                      <Heart className={`w-4 h-4 mr-2 ${isFollowing ? 'fill-current' : ''}`} />
                      {isFollowing ? 'Following' : 'Follow'}
                    </Button>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Published Works</h3>
                  <div className="space-y-2">
                    <button className="w-full text-left p-2 rounded-lg hover:bg-accent/50 transition-colors flex items-center justify-between">
                      <span>The Mystic Realms Trilogy</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button className="w-full text-left p-2 rounded-lg hover:bg-accent/50 transition-colors flex items-center justify-between">
                      <span>Echoes of Tomorrow</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button className="w-full text-left p-2 rounded-lg hover:bg-accent/50 transition-colors flex items-center justify-between">
                      <span>Short Story Collection</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Content */}
          <div className="lg:w-2/3">
            <Tabs defaultValue="feed" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="feed">Feed</TabsTrigger>
                <TabsTrigger value="exclusive">Exclusive</TabsTrigger>
                <TabsTrigger value="live">Live Sessions</TabsTrigger>
                <TabsTrigger value="subscribe">Subscribe</TabsTrigger>
              </TabsList>

              <TabsContent value="feed" className="space-y-6">
                {recentContent.map((content, index) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant={content.type === 'live' ? 'destructive' : 'secondary'}>
                            {content.type === 'story' ? 'Story' : content.type === 'live' ? 'Live' : 'Update'}
                          </Badge>
                          {content.exclusive && (
                            <Badge variant="outline" className="border-primary text-primary">
                              Exclusive
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">{content.date}</span>
                      </div>
                      <CardTitle className="text-lg">{content.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{content.description}</p>
                      <Button variant="outline" size="sm">
                        {content.type === 'live' ? 'Join Session' : 'Read More'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="exclusive" className="space-y-6">
                <Card className="bg-gradient-to-br from-primary/5 to-accent/10 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Gift className="w-5 h-5 mr-2" />
                      Exclusive Content Library
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Unlock behind-the-scenes content, character backstories, and early access to new chapters.
                    </p>
                    <Button>Subscribe to Access</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="live" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Video className="w-5 h-5 mr-2" />
                      Upcoming Live Sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-accent/20 rounded-lg">
                        <div>
                          <h4 className="font-semibold">Character Development Workshop</h4>
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <Calendar className="w-4 h-4 mr-1" />
                            Tomorrow at 7:00 PM EST
                          </div>
                        </div>
                        <Button size="sm" onClick={() => onNavigate('live-session')}>
                          Join
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="subscribe" className="space-y-6">
                <div className="grid gap-6">
                  {subscriptionTiers.map((tier, index) => (
                    <Card key={index} className={`relative ${tier.popular ? 'border-primary shadow-lg' : ''}`}>
                      {tier.popular && (
                        <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary">
                          Most Popular
                        </Badge>
                      )}
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          {tier.name}
                          <span className="text-2xl font-bold">{tier.price}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 mb-6">
                          {tier.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-center text-sm">
                              <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        <Button className="w-full" variant={tier.popular ? 'default' : 'outline'}>
                          Subscribe Now
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* AI Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl h-[80vh] bg-background border rounded-lg shadow-xl overflow-hidden">
            <AIChatInterface
              authorName={author.name}
              onClose={() => setShowChat(false)}
            />
          </div>
        </div>
      )}

      {/* AI Voice Chat Modal */}
      {showVoiceChat && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl h-[80vh] bg-background border rounded-lg shadow-xl overflow-hidden">
            <AIVoiceInterface
              authorName={author.name}
              onClose={() => setShowVoiceChat(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}