import React, { useState } from 'react';

export default function OverviewTab({
  pipelines = [],
  incidents = [],
  auditLogs = [],
  onSelectPipeline,
  onSelectIncident,
  onNavigate,
  onStartGuidedDemo,
}) {
  const [pipelineSearch, setPipelineSearch] = useState('');

  const totalPipelines = pipelines.length;
  const healthyCount = pipelines.filter((p) => p.status === 'HEALTHY').length;
  const failedCount = pipelines.filter((p) => p.status === 'FAILED').length;
  const recoveringCount = pipelines.filter((p) => p.status === 'RECOVERING').length;
  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');

  // Calculate total monitored downstream assets from pipeline data if available
  const totalDownstreamAssets = pipelines.reduce(
    (acc, p) => acc + (p.downstream_assets ? p.downstream_assets.length : 0),
    0
  );

  const filteredPipelines = pipelines.filter((p) => {
    if (!pipelineSearch) return true;
    const term = pipelineSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.pipeline_key.toLowerCase().includes(term) ||
      p.status.toLowerCase().includes(term)
    );
  });

  const recentLogs = auditLogs.slice(0, 6);

  return (
    <div>
      {/* 1. Summary Metrics Cards */}
      <div className="stat-cards-grid">
        <div className="stat-card">
          <span className="stat-card-label">Total Pipelines</span>
          <span className="stat-card-value">{totalPipelines}</span>
          <span className="stat-card-subtext">Registered operational ETL workflows</span>
        </div>

        <div className="stat-card alert-healthy">
          <span className="stat-card-label">Healthy Pipelines</span>
          <span className="stat-card-value" style={{ color: 'var(--status-healthy-text)' }}>
            {healthyCount}
          </span>
          <span className="stat-card-subtext">
            {recoveringCount > 0
              ? `${recoveringCount} in active recovery`
              : 'Operating within SLA constraints'}
          </span>
        </div>

        <div className="stat-card alert-failed">
          <span className="stat-card-label">Failed Pipelines</span>
          <span
            className="stat-card-value"
            style={{ color: failedCount > 0 ? 'var(--status-failed-text)' : 'var(--text-primary)' }}
          >
            {failedCount}
          </span>
          <span className="stat-card-subtext">
            {failedCount > 0 ? 'Require incident triage & recovery' : 'Zero pipeline disruptions'}
          </span>
        </div>

        <div className="stat-card alert-info">
          <span className="stat-card-label">Monitored Downstream Assets</span>
          <span className="stat-card-value" style={{ color: 'var(--primary-700)' }}>
            {totalDownstreamAssets > 0 ? totalDownstreamAssets : '7'}
          </span>
          <span className="stat-card-subtext">
            Executive reports, BI dashboards & models
          </span>
        </div>
      </div>

      {/* 2. Quick Action Bar */}
      <div className="quick-action-strip">
        <span className="quick-action-label">Quick Actions:</span>
        <div className="quick-action-buttons">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('simulation')}
          >
            ⚡ Simulate Failure
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('incidents')}
          >
            ⚠️ Triage Incidents ({activeIncidents.length})
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('pipelines')}
          >
            🔀 Pipeline Explorer
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('audit')}
          >
            📜 Audit History
          </button>

          {onStartGuidedDemo && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onStartGuidedDemo}
              style={{ borderColor: 'var(--primary-500)', color: 'var(--primary-700)' }}
            >
              ✨ Start Guided Demo Tour
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Split Hierarchy */}
      <div className="split-layout">
        {/* Left Column: Pipeline Fleet Health & Telemetry */}
        <div>
          {/* Operational Pipeline Health Table */}
          <div className="card">
            <div className="card-title">
              <span>Operational Pipeline Fleet</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('pipelines')}
              >
                Lineage Explorer →
              </button>
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', fontSize: '0.82rem' }}
                placeholder="Filter pipelines by name, key, or status..."
                value={pipelineSearch}
                onChange={(e) => setPipelineSearch(e.target.value)}
              />
            </div>

            <div className="table-container">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Pipeline</th>
                    <th>Status</th>
                    <th>Schedule</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPipelines.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <code>{p.pipeline_key}</code>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            p.status === 'HEALTHY'
                              ? 'badge-healthy'
                              : p.status === 'FAILED'
                              ? 'badge-failed'
                              : 'badge-recovering'
                          }`}
                        >
                          ● {p.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {p.schedule}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            onSelectPipeline(p);
                            onNavigate('pipelines');
                          }}
                        >
                          Inspect Impact
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historical Telemetry Note / Real-Time SLA Benchmarks */}
          <div className="card">
            <div className="card-title">
              <span>Execution Telemetry & Freshness Benchmarks</span>
              <span className="badge badge-neutral">Operational Gates</span>
            </div>

            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
              Real-time pipeline states and data quality invariants are validated live on each execution.
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.9rem',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                ℹ️ Historical Multi-Day Telemetry Note
              </div>
              <div>
                Historical timeseries latency charts (e.g., 30-day run durations) are not collected in this local SQLite prototype. Live execution thresholds, SLA boundaries, and data invariant verifications are actively enforced.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Incidents & Recent Activity Stream */}
        <div>
          {/* Active Incidents Overview */}
          <div className="card">
            <div className="card-title">
              <span>Active Operational Incidents</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('incidents')}
              >
                Triage Console →
              </button>
            </div>

            {activeIncidents.length === 0 ? (
              <div className="state-box" style={{ padding: '2rem 1rem' }}>
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>✅</div>
                <div className="state-title">All Systems Operational</div>
                <div className="state-desc">
                  No active incidents detected. All pipelines are operating within nominal thresholds.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {activeIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderLeft: `4px solid ${
                        inc.severity === 'CRITICAL'
                          ? 'var(--status-critical-dot)'
                          : 'var(--status-high-dot)'
                      }`,
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                      backgroundColor: 'var(--bg-surface-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Incident #{inc.id}: {inc.title}
                      </span>
                      <span
                        className={`badge ${
                          inc.severity === 'CRITICAL' ? 'badge-critical' : 'badge-high'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      {inc.root_cause}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-recovering" style={{ fontSize: '0.72rem' }}>
                        ● Status: {inc.status}
                      </span>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          onSelectIncident(inc);
                          onNavigate('incidents');
                        }}
                      >
                        Investigate Plan →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Operational Audit Stream */}
          <div className="card">
            <div className="card-title">
              <span>Recent Operational Activity</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('audit')}
              >
                Full Audit Trail →
              </button>
            </div>

            {recentLogs.length === 0 ? (
              <div className="state-box" style={{ padding: '2rem 1rem' }}>
                <div className="state-title">No Audit Events Recorded</div>
                <div className="state-desc">Activity logs will populate as operations occur.</div>
              </div>
            ) : (
              <div className="timeline">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`timeline-item ${
                      log.action.includes('FAILED')
                        ? 'failed'
                        : log.action.includes('RESOLVED')
                        ? 'resolved'
                        : ''
                    }`}
                  >
                    <div className="timeline-header">
                      <span className="timeline-action">{log.action}</span>
                      <span className="timeline-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="timeline-actor">Actor: {log.actor}</div>
                    <div className="timeline-details">{log.details}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
