'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { api } from '@/lib/api';
import { Feedback } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, AlertCircle, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';

export default function FeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadFeedback();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Feedback page session:', session ? 'exists' : 'none');
  };

  const loadFeedback = async () => {
    console.log('Loading feedback...');
    setLoading(true);
    try {
      const data = await api.fetchFeedback(supabase);
      console.log('Feedback loaded:', data.length, 'items');
      setFeedbackList(data);
    } catch (err) {
      console.error('Error loading feedback:', err);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setSubmitting(true);
    const newFeedback = await api.createFeedback(content, 'feedback', supabase);

    if (newFeedback) {
      setFeedbackList([newFeedback, ...feedbackList]);
      setContent('');
      setDialogOpen(false);
      setShowConfirmation(false);
    }

    setSubmitting(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">Feedback & Suggestions</h1>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Your Thoughts</DialogTitle>
                  <DialogDescription>
                    what would make this tool more useful for YOU. share feedback on what works well, what could be improved, or suggest new features.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <Textarea
                    placeholder="Your feedback or feature suggestion..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[150px] resize-none"
                  />

                  {!showConfirmation && content.trim() && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        your submission will be <strong>permanently visible</strong> to everyone and cannot be deleted by you.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <DialogFooter>
                  {!showConfirmation ? (
                    <Button
                      onClick={() => setShowConfirmation(true)}
                      disabled={!content.trim()}
                      className="w-full"
                    >
                      continue
                    </Button>
                  ) : (
                    <div className="w-full space-y-2">
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          this will be permanent <strong>and public</strong>. are you sure?
                        </AlertDescription>
                      </Alert>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowConfirmation(false)}
                          className="flex-1"
                        >
                          back
                        </Button>
                        <Button
                          onClick={handleSubmit}
                          disabled={submitting}
                          className="flex-1"
                        >
                          {submitting ? 'Submitting...' : 'Confirm & Submit'}
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-sm text-muted-foreground">
            help improve this IB tracker by sharing your thoughts
          </p>
        </div>

        {/* Feedback List */}
        {loading ? (
          <p className="text-center text-muted-foreground py-12">loading...</p>
        ) : feedbackList.length === 0 ? (
          <Card className="rounded-lg border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">no feedback yet. be the first to share your thoughts!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {feedbackList.map((item) => (
              <Card key={item.id} className="rounded-lg">
                <CardContent className="p-5 pt-4">
                  <div className="flex flex-col gap-0.5 mb-3">
                    <span className="text-xs font-medium text-foreground/80 truncate" title={item.userEmail || 'Anonymous'}>
                      {item.userEmail || 'Anonymous'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
