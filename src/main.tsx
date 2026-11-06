import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  declare state: ErrorBoundaryState;
  declare props: Readonly<{ children: React.ReactNode }>;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  handleRepairAndReload = () => {
    try {
      localStorage.removeItem('ficsit_node_labs_saves_v1');
      localStorage.removeItem('ficsit_node_labs_settings_v1');
    } catch {
      // Ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0B0F17] text-slate-100 p-6">
          <div className="max-w-md w-full rounded-xl border border-amber-500/40 bg-slate-900/95 p-6 shadow-2xl">
            <h1 className="text-lg font-bold text-amber-400 mb-2">
              Session Recovery Required
            </h1>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              A corrupted local save or cached state prevented the session from loading
              ({this.state.errorMessage || 'Unknown error'}).
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer"
              >
                Retry Load
              </button>
              <button
                type="button"
                onClick={this.handleRepairAndReload}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 cursor-pointer"
              >
                Reset Local Save &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
