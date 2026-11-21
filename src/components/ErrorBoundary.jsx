import { Component } from 'react';
import { reportCrash } from '../errors';

// If a screen crashes while drawing, show a way back instead of a blank page. Progress is saved as it's made,
// so a reload loses nothing.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    reportCrash(err);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>Your progress is saved. Reload the page to keep going.</p>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>Reload</button>
      </main>
    );
  }
}
