import React, { useState } from 'react';

export default function AuditHistoryTab({ auditLogs = [], onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterActor, setFilterActor] = useState('ALL');

  // Extract unique actions & actors for filtering
  const uniqueActions = ['ALL', ...Array.from(new Set(auditLogs.map((l) => l.action)))];
  const uniqueActors = ['ALL', ...Array.from(new Set(auditLogs.map((l) => l.actor)))];

  const filteredLogs = auditLogs.filter((log) => {
    const matchesAction = filterAction === 'ALL' || log.action === filterAction;
    const matchesActor = filterActor === 'ALL' || log.actor === filterActor;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      log.action.toLowerCase().includes(term) ||
      log.actor.toLowerCase().includes(term) ||
      (log.details && log.details.toLowerCase().includes(term));
    return matchesAction && matchesActor && matchesSearch;
  });

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Audit History & Governance Trail</h2>
          <p className="section-subtitle">
            Immutable application-level audit trail tracking all failure detections, human approvals, recovery executions, and verification results.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
        >
          ↻ Refresh Logs
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', flex: 1 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search action, actor, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ minWidth: '220px', flex: 1 }}
          />

          <select
            className="form-select"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            {uniqueActions.map((action, idx) => (
              <option key={idx} value={action}>
                Action: {action}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
          >
            {uniqueActors.map((actor, idx) => (
              <option key={idx} value={actor}>
                Actor: {actor}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredLogs.length}</strong> of {auditLogs.length} events
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="table-container">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Details & Operational Metadata</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No audit log events match your search or filter criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isFail = log.action.includes('FAILED');
                const isResolved = log.action.includes('RESOLVED') || log.action.includes('PASSED');
                const isApproved = log.action.includes('APPROVED');

                return (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          isResolved
                            ? 'badge-healthy'
                            : isFail
                            ? 'badge-failed'
                            : isApproved
                            ? 'badge-high'
                            : 'badge-neutral'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--primary-700)', fontSize: '0.82rem' }}>
                      {log.actor}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {log.incident_id ? `Incident #${log.incident_id}` : ''}
                      {log.pipeline_id ? ` • Pipe #${log.pipeline_id}` : ''}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {log.details}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
