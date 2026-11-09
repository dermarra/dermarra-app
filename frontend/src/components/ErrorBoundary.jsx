import { Component } from "react";

/** Catches render errors so one broken page shows a recoverable message
 * instead of white-screening the whole app (there was no boundary at all).
 * Keyed on the route path in App.jsx, so navigating away resets it. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Render error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display font-semibold text-3xl text-ink mb-2">Something went wrong</h1>
        <p className="text-ink/70 text-sm">This page hit an unexpected error. Reloading usually fixes it.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            Reload page
          </button>
          <a href="/" className="btn btn-secondary">
            Go home
          </a>
        </div>
      </div>
    );
  }
}
