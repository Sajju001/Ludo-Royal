import React, { Component, ReactNode } from 'react';
import { Crown, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let displayMsg = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(displayMsg) as { error?: string };
      if (parsed && parsed.error) {
        displayMsg = parsed.error;
      }
    } catch {
      // Standard non-JSON error
    }
    return { hasError: true, message: displayMsg };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught ErrorBoundary exception:', error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen royal-bg-radial flex items-center justify-center p-6 text-white">
          <div className="max-w-md w-full rounded-2xl bg-[#24124D]/95 border border-white/15 p-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl royal-gold-gradient flex items-center justify-center text-[#24124D] shadow-lg">
              <Crown className="h-7 w-7" />
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Something Interrupted the Match</h2>
            <p className="text-sm text-purple-200/85 mb-6 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl royal-gold-gradient text-[#24124D] font-display font-bold text-sm shadow-lg hover:brightness-105 transition"
            >
              <RotateCcw className="h-4 w-4" />
              Reload Ludo Royale
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
