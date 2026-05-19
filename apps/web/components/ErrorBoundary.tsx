'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// Wrapper component to get translations
function ErrorFallback({ error, onReload }: { error?: Error; onReload: () => void }) {
  // Note: This is a functional component wrapper to enable hooks in the future
  // For now, using static text since ErrorBoundary class can't use hooks
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          Oops! Something went wrong
        </h2>
        <p className="text-gray-600 mb-4">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={onReload}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Filter out known extension errors
    const errorString = error.toString();
    const isExtensionError = 
      errorString.includes('chrome.runtime.sendMessage') ||
      errorString.includes('chrome-extension://');

    // Don't show error UI for extension errors
    if (isExtensionError) {
      return { hasError: false };
    }

    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Filter out extension errors from logging
    const errorString = error.toString();
    const isExtensionError = 
      errorString.includes('chrome.runtime.sendMessage') ||
      errorString.includes('chrome-extension://');

    if (!isExtensionError) {
      console.error('Error caught by boundary:', error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error} 
          onReload={this.handleReload} 
        />
      );
    }

    return this.props.children;
  }
}

