import React from 'react';

interface Props { children: React.ReactNode; label?: string; }
interface State { hasError: boolean; message?: string; }

export class PanelErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(err: unknown) { console.error('[PanelErrorBoundary]', this.props.label, err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
          This panel hit an error{this.props.label ? ` (${this.props.label})` : ''}: {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}
export default PanelErrorBoundary;
