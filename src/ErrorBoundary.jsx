import { Component } from 'react';
import { AlertCircle } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Error logging would go here in production
    // For now, we just set state to show error UI
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-100">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md border border-rose-200">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-rose-600" size={24} />
              <h2 className="text-lg font-bold text-slate-800">Something went wrong</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              An unexpected error occurred. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-500 transition-colors"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4">
                <summary className="text-xs text-slate-500 cursor-pointer">Error Details</summary>
                <pre className="mt-2 text-xs text-slate-700 bg-slate-50 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

