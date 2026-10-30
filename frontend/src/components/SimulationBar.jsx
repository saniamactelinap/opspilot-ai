import React, { useState, useEffect } from 'react';

export default function SimulationBar({ pipelines = [], onSimulate, simulating }) {
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [failureType, setFailureType] = useState('MISSING_PARTITION');

  // Set default selection when pipelines load
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const healthy = pipelines.find((p) => p.status === 'HEALTHY');
      setSelectedPipelineId(healthy ? String(healthy.id) : String(pipelines[0].id));
    }
  }, [pipelines, selectedPipelineId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedPipelineId) return;
    onSimulate(Number(selectedPipelineId), failureType);
  };

  return (
    <div
      className="card"
      style={{
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        borderLeft: '4px solid var(--status-failed-dot)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span className="badge badge-failed">Chaos Injection</span>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Quick Pipeline Failure Simulator
          </h3>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Simulated demo environment • Injects live anomalies into SQLite state
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '0.85rem',
          flexWrap: 'wrap',
        }}
      >
        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label className="form-label" htmlFor="pipeline-select">
            Target Pipeline:
          </label>
          <select
            id="pipeline-select"
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

        <div className="form-group" style={{ flex: 1, minWidth: '220px' }}>
          <label className="form-label" htmlFor="failure-type-select">
            Failure Scenario:
          </label>
          <select
            id="failure-type-select"
            className="form-select"
            value={failureType}
            onChange={(e) => setFailureType(e.target.value)}
            disabled={simulating}
          >
            <option value="MISSING_PARTITION">MISSING_PARTITION (Stalled Hourly Roll)</option>
            <option value="SCHEMA_MISMATCH">SCHEMA_MISMATCH (Upstream Drift)</option>
            <option value="API_TIMEOUT">API_TIMEOUT (504 SaaS Latency)</option>
          </select>
        </div>

        <button
          type="submit"
          className="btn btn-danger"
          disabled={simulating || !selectedPipelineId}
          style={{ height: '38px' }}
        >
          {simulating ? 'Injecting Anomaly...' : '⚡ Simulate Failure'}
        </button>
      </form>
    </div>
  );
}
