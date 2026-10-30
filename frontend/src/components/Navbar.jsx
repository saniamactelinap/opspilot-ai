import React from 'react';

export default function Navbar({
  backendOnline,
  onRefresh,
  refreshing,
  showGuidedDemo,
  onToggleGuidedDemo,
}) {
  return (
    <header className="top-header">
      <div className="brand-group">
        <div className="brand-logo-badge">OP</div>
        <div>
          <div className="brand-text-title">
            <span>OpsPilot AI</span>
            <span className="prototype-pill">POC Prototype</span>
          </div>
          <div className="brand-text-subtitle">
            Operations Recovery & Business Blast Radius Platform
          </div>
        </div>
      </div>

      <div className="header-actions">
        {/* Backend Online/Offline Pill */}
        <div className="backend-status-pill">
          <div className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
          <span>{backendOnline ? 'API Connected (8000)' : 'API Disconnected'}</span>
        </div>

        {/* Guided Demo Button */}
        <button
          type="button"
          className={`btn btn-sm ${showGuidedDemo ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onToggleGuidedDemo}
          title="Toggle Step-by-Step Interactive Guided Tour"
        >
          <span>✨ Guided Demo</span>
        </button>

        {/* Refresh Data Button */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={refreshing}
          title="Synchronize fresh state from SQLite backend"
        >
          {refreshing ? 'Refreshing...' : '↻ Refresh Data'}
        </button>
      </div>
    </header>
  );
}
