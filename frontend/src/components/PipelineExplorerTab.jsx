import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function PipelineExplorerTab({
  pipelines = [],
  selectedPipeline,
  onSelectPipeline,
}) {
  const [impactReport, setImpactReport] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [impactError, setImpactError] = useState(null);

  // Search & Status Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // When selected pipeline changes, fetch its live impact report from the backend
  useEffect(() => {
    if (selectedPipeline) {
      setLoadingImpact(true);
      setImpactError(null);
      api
        .getPipelineImpact(selectedPipeline.id)
        .then((data) => {
          setImpactReport(data);
          setLoadingImpact(false);
        })
        .catch((err) => {
          setImpactError(err.message || 'Failed to load impact report');
          setLoadingImpact(false);
        });
    } else {
      setImpactReport(null);
    }
  }, [selectedPipeline]);

  const filteredPipelines = pipelines.filter((p) => {
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.pipeline_key.toLowerCase().includes(term) ||
      (p.description && p.description.toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Pipeline Explorer & Dynamic Blast Radius</h2>
          <p className="section-subtitle">
            Inspect data pipeline operational specifications, foreign-key dependency relationships, and dynamic downstream business blast radius.
          </p>
        </div>

        <div className="prototype-pill">
          Lineage: Direct Downstream DB Assets
        </div>
      </div>

      <div className="split-layout">
        {/* Left Column: Pipelines Directory with Search & Filters */}
        <div>
          <div className="card">
            <div className="card-title">
              <span>Pipeline Directory</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {filteredPipelines.length} of {pipelines.length} Pipelines
              </span>
            </div>

            {/* Filter Controls */}
            <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                style={{ flex: 1, minWidth: '160px' }}
                placeholder="Search pipeline name, key..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Status: All</option>
                <option value="HEALTHY">Healthy Only</option>
                <option value="FAILED">Failed Only</option>
                <option value="RECOVERING">Recovering Only</option>
              </select>
            </div>

            {/* Pipelines Table */}
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
                  {filteredPipelines.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No pipelines match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPipelines.map((p) => {
                      const isSelected = selectedPipeline && selectedPipeline.id === p.id;
                      return (
                        <tr
                          key={p.id}
                          style={{
                            backgroundColor: isSelected ? 'var(--primary-50)' : undefined,
                          }}
                        >
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
                              className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => onSelectPipeline(p)}
                            >
                              {isSelected ? 'Viewing' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Pipeline Specifications */}
          {selectedPipeline && (
            <div className="card">
              <div className="card-title">
                <span>Pipeline Specifications: {selectedPipeline.name}</span>
                <span
                  className={`badge ${
                    selectedPipeline.status === 'HEALTHY'
                      ? 'badge-healthy'
                      : 'badge-failed'
                  }`}
                >
                  ● {selectedPipeline.status}
                </span>
              </div>

              <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                {selectedPipeline.description || 'Operational data engineering pipeline.'}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  fontSize: '0.82rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Pipeline Identifier:</span>{' '}
                  <code>{selectedPipeline.pipeline_key}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Execution Schedule:</span>{' '}
                  <strong>{selectedPipeline.schedule}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Last Run Timestamp:</span>{' '}
                  <strong>
                    {selectedPipeline.last_run_at
                      ? new Date(selectedPipeline.last_run_at).toLocaleString()
                      : 'Pending initial run'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Database ID:</span>{' '}
                  <strong>#{selectedPipeline.id}</strong>
                </div>
              </div>

              {selectedPipeline.error_message && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--status-failed-bg)',
                    border: '1px solid var(--status-failed-border)',
                    fontSize: '0.82rem',
                    color: 'var(--status-failed-text)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <strong>Active Error Signal:</strong> {selectedPipeline.error_message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Downstream Blast Radius & Impact Report */}
        <div>
          {loadingImpact ? (
            <div className="state-box">
              <div className="spinner" />
              <div className="state-title">Analyzing Dynamic Downstream Impact...</div>
              <div className="state-desc">
                Traversing relational database foreign keys to identify affected dashboards and SLA risks.
              </div>
            </div>
          ) : impactError ? (
            <div className="alert-banner error">{impactError}</div>
          ) : impactReport ? (
            <>
              {/* Dynamic Severity Classification Card */}
              <div
                className="card"
                style={{
                  borderLeft: `5px solid ${
                    impactReport.severity_classification === 'CRITICAL'
                      ? 'var(--status-critical-dot)'
                      : impactReport.severity_classification === 'HIGH'
                      ? 'var(--status-high-dot)'
                      : 'var(--status-healthy-dot)'
                  }`,
                }}
              >
                <div className="card-title">
                  <span>Downstream Blast Radius & Severity</span>
                  <span
                    className={`badge ${
                      impactReport.severity_classification === 'CRITICAL'
                        ? 'badge-critical'
                        : impactReport.severity_classification === 'HIGH'
                        ? 'badge-high'
                        : 'badge-medium'
                    }`}
                  >
                    Severity: {impactReport.severity_classification}
                  </span>
                </div>

                {/* Explanation of Severity Classification */}
                <div
                  style={{
                    fontSize: '0.88rem',
                    color: 'var(--text-primary)',
                    lineHeight: 1.5,
                    marginBottom: '1rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Severity Classification Rationale:
                  </div>
                  {impactReport.severity_rationale}
                </div>

                {/* Blast Radius Metrics Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.65rem 0.85rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Affected Assets
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {impactReport.affected_assets_count}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.65rem 0.85rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Impacted Teams
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {impactReport.affected_business_teams.length}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.65rem 0.85rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Critical Count
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-critical-text)' }}>
                      {impactReport.criticality_breakdown.CRITICAL || 0}
                    </div>
                  </div>
                </div>

                {/* Explicit Lineage Architecture Note */}
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '0.65rem',
                  }}
                >
                  * Lineage Architecture: OpsPilot AI models direct downstream asset dependencies via relational foreign keys. Upstream ingestion sources are not modeled in this database schema.
                </div>
              </div>

              {/* Impacted Downstream Assets Table */}
              <div className="card">
                <div className="card-title">
                  <span>Impacted Business Assets ({impactReport.affected_assets.length})</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Teams: {impactReport.affected_business_teams.join(', ')}
                  </span>
                </div>

                <div className="table-container">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>Asset Name</th>
                        <th>Type</th>
                        <th>Business Unit</th>
                        <th>Criticality</th>
                        <th>SLA Window</th>
                      </tr>
                    </thead>
                    <tbody>
                      {impactReport.affected_assets.map((asset) => (
                        <tr key={asset.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{asset.name}</div>
                            {asset.description && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {asset.description}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: '0.78rem' }}>
                            <span className="badge badge-neutral">{asset.asset_type}</span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {asset.business_unit}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                asset.criticality === 'CRITICAL'
                                  ? 'badge-critical'
                                  : asset.criticality === 'HIGH'
                                  ? 'badge-high'
                                  : 'badge-medium'
                              }`}
                            >
                              {asset.criticality}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            &le; {asset.sla_threshold_hours}h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Illustrative Demo Risk Estimates (Clearly Disclaimed) */}
              {impactReport.demo_risk_estimate && (
                <div
                  className="card"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-muted)',
                  }}
                >
                  <div className="card-title">
                    <span>Illustrative Operational Risk Model</span>
                    <span className="badge badge-neutral">Demo Heuristic Only</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Illustrative Financial Risk:
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ${impactReport.demo_risk_estimate.illustrative_financial_risk_usd.toLocaleString()} USD
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Estimated SLA Window:
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ~{impactReport.demo_risk_estimate.estimated_sla_breach_mins} mins
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    <strong>Disclaimer:</strong> {impactReport.demo_risk_estimate.disclaimer}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="state-box">
              <div className="state-title">Select a Pipeline to Inspect Blast Radius</div>
              <div className="state-desc">
                Choose a pipeline from the directory to analyze its live downstream business asset dependencies and impact classification.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
