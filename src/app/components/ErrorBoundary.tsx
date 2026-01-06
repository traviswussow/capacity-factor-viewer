'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chart error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <h3 className="font-semibold mb-2">Something went wrong</h3>
            <p className="text-sm">{this.state.error?.message ?? 'An error occurred while rendering this component.'}</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-2 text-sm text-red-600 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
