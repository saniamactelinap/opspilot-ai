import React, { useState, useEffect } from 'react';

const SCENARIOS = [
  {
    type: 'MISSING_PARTITION',
    title: 'Missing Partition',
    subtitle: 'Hourly Partition Rollover Stall',
    errorPreview: "Partition '2026-10-25/hour=14' missing: upstream event buffer empty.",
    rootCause: 'Upstream webhook buffer failed to emit records during hourly rollover.',
    playbookAction: 'REPLAY_PARTITION_FROM_RAW_STREAM',
    tag: 'Data Pipeline',
  },
  {
    type: 'SCHEMA_MISMATCH',
    title: 'Schema Mismatch',
    subtitle: 'Upstream Contract Schema Drift',
    errorPreview: "Schema drift: received column 'customer_tier' VARCHAR(255), expected INTEGER.",
    rootCause: 'Upstream CRM release altered schema without backward-compatible DB migration.',
    playbookAction: 'APPLY_SCHEMA_ADAPTER_FALLBACK',
    tag: 'Contract Drift',
  },
  {
    type: 'API_TIMEOUT',
    title: 'External API Timeout',
    subtitle: 'HTTP 504 Gateway Latency',
    errorPreview: 'HTTP 504 Gateway Timeout connecting to external SaaS endpoint after 3 retries.',
    rootCause: 'External vendor rate limiting and high packet degradation exceeding retry budget.',
    playbookAction: 'BACKOFF_RETRY_WITH_CACHED_STATE',
    tag: 'Integration',
  },
];

export default function SimulationTab({
  pipelines = [],
  incidents = [],
  onSimulate,
  simulating,
  onNavigate,
}) {
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [selectedScenarioType, setSelectedScenarioType] = useState('SCHEMA_MISMATCH');

  // Default to first healthy pipeline or first pipeline
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const healthy = pipelines.find((p) => p.status === 'HEALTHY');
      setSelectedPipelineId(healthy ? String(healthy.id) : String(pipelines[0].id));
    }
  }, [pipelines, selectedPipelineId]);

  const targetPipeline = pipelines.find((p) => String(p.id) === String(selectedPipelineId));

  // Check if target pipeline has an active unresolved incident
  const activeIncident = targetPipeline
    ? incidents.find(
        (i) => i.pipeline_id === targetPipeline.id && i.status !== 'RESOLVED'
      )
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedPipelineId || activeIncident || simulating) return;
    onSimulate(Number(selectedPipelineId), selectedScenarioType);
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Failure Simulation & Chaos Testing</h2>
          <p className="section-subtitle">
            Inject deterministic operational anomalies into live data pipelines to evaluate automated blast-radius analysis, human approval gates, and invariant verifications.
          </p>
        </div>

        <div className="prototype-pill">
          Simulated Operations • SQLite Safe
        </div>
      </div>

      <div className="split-layout">
        {/* Left Column: Target Pipeline Selection & Trigger */}
        <div>
          <div className="card">
            <div className="card-title">
              <span>1. Select Target Pipeline</span>
              {targetPipeline && (
                <span
                  className={`badge ${
                    targetPipeline.status === 'HEALTHY'
                      ? 'badge-healthy'
                      : 'badge-failed'
                  }`}
                >
                  ● {targetPipeline.status}
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" htmlFor="sim-pipeline-select">
                  Target Pipeline:
                </label>
                <select
                  id="sim-pipeline-select"
                  className="form-select"
                  value={selectedPipelineId}
                  onChange={(e) => setSelectedPipelineId(e.target.value)}
                  disabled={simulating || pipelines.length === 0}
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} [{p.status}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Pipeline Metadata Card */}
              {targetPipeline && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.84rem',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    {targetPipeline.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                    {targetPipeline.description}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Identifier:</span>{' '}
                      <code>{targetPipeline.pipeline_key}</code>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Schedule:</span>{' '}
                      <strong>{targetPipeline.schedule}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Duplicate Active Incident Prevention Banner */}
              {activeIncident && (
                <div className="alert-banner warning" style={{ marginBottom: '1.25rem' }}>
                  <div>
                    <strong>Active Incident Exists:</strong> Incident #{activeIncident.id} ({activeIncident.severity}) is currently {activeIncident.status}.
                    Backend safety rules prevent creating duplicate active incidents for the same pipeline.
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigate('incidents')}
                  >
                    View Incident →
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-danger btn-lg"
                style={{ width: '100%' }}
                disabled={simulating || !selectedPipelineId || Boolean(activeIncident)}
              >
                {simulating ? 'Injecting Anomaly...' : '⚡ Inject Simulated Failure'}
              </button>

              <div
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.65rem',
                  textAlign: 'center',
                }}
              >
                Triggers state transition to <code>FAILED</code>, logs to audit trail, and opens an operational incident.
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Scenario Profiles */}
        <div>
          <div className="card">
            <div className="card-title">
              <span>2. Select Failure Scenario</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                3 Deterministic Failure Profiles
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {SCENARIOS.map((sc) => {
                const isSelected = selectedScenarioType === sc.type;
                return (
                  <div
                    key={sc.type}
                    className={`scenario-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedScenarioType(sc.type)}
                  >
                    <div className="scenario-card-header">
                      <div className="scenario-card-title">{sc.title}</div>
                      <span className="badge badge-blue">{sc.tag}</span>
                    </div>

                    <div className="scenario-card-desc">{sc.subtitle}</div>

                    <div
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        padding: '0.55rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--status-failed-text)',
                        marginBottom: '0.5rem',
                      }}
                    >
                      {sc.errorPreview}
                    </div>

                    <div className="scenario-card-footer">
                      Recommended Playbook: <strong>{sc.playbookAction}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
