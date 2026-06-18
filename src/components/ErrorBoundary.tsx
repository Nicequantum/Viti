import { Component, type ErrorInfo, type ReactNode } from 'react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Something went wrong' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error boundary caught:', error, info);
    toast.error('An unexpected error occurred. You can try again.');
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="px-5 py-10 text-center">
            <div className="ios-card p-6">
              <div className="text-lg font-semibold mb-2">Something went wrong</div>
              <p className="text-sm text-[#8e8e93] mb-4">{this.state.message}</p>
              <button
                onClick={() => this.setState({ hasError: false, message: '' })}
                className="primary-btn px-6 h-11 text-sm"
              >
                Try again
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}