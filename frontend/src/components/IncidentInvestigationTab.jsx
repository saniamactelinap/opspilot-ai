import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import ConfirmationModal from './ConfirmationModal';

export default function IncidentInvestigationTab({
  incidents = [],
  selectedIncident,
  onSelectIncident,
  onRefreshAll,
}) {
  const [recoveryPlan, setRecoveryPlan] = useState(null);
  const [incidentLogs, setIncidentLogs] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Recovery Execution States
  const [recovering, setRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState(null);
  const [simulateVerificationFailure, setSimulateVerificationFailure] = useState(false);

  // Search, Filters & Prioritization
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('PRIORITY'); // 'PRIORITY' | 'NEWEST' | 'OLDEST' | 'SLA'

  // Modal Confirmation States
  const [modalType, setModalType] = useState(null); // 'approve' | 'reject' | null
  const [modalLoading, setModalLoading] = useState(false);

  // Load details when selected incident changes
  const loadIncidentDetails = (incidentId) => {
    if (!incidentId) return;
    setLoadingDetails(true);
    setActionError(null);
    setRecoveryResult(null);

    Promise.all([
      api.getRecoveryPlan(incidentId).catch(() => null),
      api.getIncidentLogs(incidentId).catch(() => []),
    ])
      .then(([plan, logs]) => {
        setRecoveryPlan(plan);
        setIncidentLogs(logs || []);
        setLoadingDetails(false);
      })
      .catch((err) => {
        setActionError(err.message || 'Error loading incident recovery details');
        setLoadingDetails(false);
      });
  };

  useEffect(() => {
    if (selectedIncident) {
      loadIncidentDetails(selectedIncident.id);
    } else {
      setRecoveryPlan(null);
      setIncidentLogs([]);
    }
  }, [selectedIncident]);

  // Handle Approve
  const handleConfirmApprove = async () => {
    setModalLoading(true);
    setActionError(null);
    try {
      await api.approveRecoveryPlan(selectedIncident.id, 'Operations Engineer (Web Console)');
      setActionSuccess('Recovery plan successfully APPROVED. Recovery playbook is now unlocked for execution.');
      setModalType(null);
      await onRefreshAll();
      loadIncidentDetails(selectedIncident.id);
    } catch (err) {
      setActionError(err.message || 'Failed to approve recovery plan');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Reject
  const handleConfirmReject = async () => {
    setModalLoading(true);
    setActionError(null);
    try {
      await api.rejectRecoveryPlan(
        selectedIncident.id,
        'Operations Engineer (Web Console)',
        'Rejected via operations console: manual investigation required.'
      );
      setActionSuccess('Recovery plan REJECTED. Automated playbook has been blocked.');
      setModalType(null);
      await onRefreshAll();
      loadIncidentDetails(selectedIncident.id);
    } catch (err) {
      setActionError(err.message || 'Failed to reject recovery plan');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Execute Recovery
  const handleExecuteRecovery = async () => {
    setRecovering(true);
    setActionError(null);
    setActionSuccess(null);
    setRecoveryResult(null);

    try {
      const result = await api.recoverIncident(
        selectedIncident.id,
        simulateVerificationFailure,
        'OpsPilot Orchestrator'
      );
      setRecoveryResult(result);
      if (result.incident_status === 'RESOLVED') {
        setActionSuccess(
          'Recovery executed successfully! All 4 verification invariants passed and incident is RESOLVED.'
        );
      } else {
        setActionError(
          'Safety Invariant Violation: 1 of 4 checks failed (Duplicate-Record Check). Incident remains UNRESOLVED.'
        );
      }
      await onRefreshAll();
      loadIncidentDetails(selectedIncident.id);
    } catch (err) {
      setActionError(err.message || 'Error executing recovery workflow');
    } finally {
      setRecovering(false);
    }
  };

  // Smart Filtering & Prioritization
  const severityWeight = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

  const filteredIncidents = incidents
    .filter((inc) => {
      const matchesSeverity = severityFilter === 'ALL' || inc.severity === severityFilter;
      const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        String(inc.id).includes(term) ||
        inc.title.toLowerCase().includes(term) ||
        inc.error_type.toLowerCase().includes(term) ||
        inc.root_cause.toLowerCase().includes(term);

      return matchesSeverity && matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'PRIORITY') {
        // Open/Unresolved first
        const aOpen = a.status !== 'RESOLVED' ? 1 : 0;
        const bOpen = b.status !== 'RESOLVED' ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;

        // Higher severity first
        const aSev = severityWeight[a.severity] || 0;
        const bSev = severityWeight[b.severity] || 0;
        if (aSev !== bSev) return bSev - aSev;

        return b.id - a.id;
      }
      if (sortBy === 'NEWEST') return b.id - a.id;
      if (sortBy === 'OLDEST') return a.id - b.id;
      if (sortBy === 'SLA') {
        return (b.estimated_sla_breach_mins || 0) - (a.estimated_sla_breach_mins || 0);
      }
      return 0;
    });

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Incident Investigation & Human-in-the-Loop Recovery</h2>
          <p className="section-subtitle">
            Triage operational failures, review intelligent rule-based playbooks, enforce human authorization, and verify data quality invariants.
          </p>
        </div>

        <div className="prototype-pill">
          Safety Gate: Human Authorization Required
        </div>
      </div>

      {actionSuccess && (
        <div className="alert-banner success">
          <span>{actionSuccess}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setActionSuccess(null)}
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="alert-banner error">
          <span>{actionError}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setActionError(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="split-layout">
        {/* Left Column: Incidents Directory with Smart Search & Filters */}
        <div>
          <div className="card">
            <div className="card-title">
              <span>Operational Incidents</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {filteredIncidents.length} of {incidents.length} Records
              </span>
            </div>

            {/* Search & Filter Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search incident ID, title, error..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <select
                  className="form-select"
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                >
                  <option value="ALL">Severity: All</option>
                  <option value="CRITICAL">Critical Only</option>
                  <option value="HIGH">High Only</option>
                  <option value="MEDIUM">Medium Only</option>
                </select>

                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">Status: All</option>
                  <option value="OPEN">Open Only</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="VERIFICATION_FAILED">Verification Failed</option>
                  <option value="RESOLVED">Resolved Only</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Sort Order:
                </label>
                <select
                  className="form-select"
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="PRIORITY">Priority Score (Severity & Open State)</option>
                  <option value="NEWEST">Newest Opened First</option>
                  <option value="OLDEST">Oldest First</option>
                  <option value="SLA">Estimated SLA Window</option>
                </select>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                * Deterministic Priority Ranking: Critical & Open incidents prioritized at top.
              </div>
            </div>

            {/* Incidents Table */}
            <div className="table-container">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No incidents match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredIncidents.map((inc) => {
                      const isSelected = selectedIncident && selectedIncident.id === inc.id;
                      return (
                        <tr
                          key={inc.id}
                          style={{
                            backgroundColor: isSelected ? 'var(--primary-50)' : undefined,
                          }}
                        >
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                              #{inc.id}: {inc.title}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {inc.error_type}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                inc.severity === 'CRITICAL'
                                  ? 'badge-critical'
                                  : inc.severity === 'HIGH'
                                  ? 'badge-high'
                                  : 'badge-medium'
                              }`}
                            >
                              {inc.severity}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                inc.status === 'RESOLVED'
                                  ? 'badge-healthy'
                                  : inc.status === 'APPROVED'
                                  ? 'badge-high'
                                  : inc.status === 'VERIFICATION_FAILED'
                                  ? 'badge-failed'
                                  : 'badge-recovering'
                              }`}
                            >
                              {inc.status}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => onSelectIncident(inc)}
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
        </div>

        {/* Right Column: Selected Incident Deep-Dive, Decision Panel & Verifier */}
        <div>
          {selectedIncident ? (
            <>
              {/* Incident Header Specifications */}
              <div
                className="card"
                style={{
                  borderLeft: `5px solid ${
                    selectedIncident.severity === 'CRITICAL'
                      ? 'var(--status-critical-dot)'
                      : 'var(--status-high-dot)'
                  }`,
                }}
              >
                <div className="card-title">
                  <span>Incident #{selectedIncident.id}: Overview</span>
                  <span
                    className={`badge ${
                      selectedIncident.status === 'RESOLVED'
                        ? 'badge-healthy'
                        : selectedIncident.status === 'APPROVED'
                        ? 'badge-high'
                        : selectedIncident.status === 'VERIFICATION_FAILED'
                        ? 'badge-failed'
                        : 'badge-recovering'
                    }`}
                  >
                    ● {selectedIncident.status}
                  </span>
                </div>

                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  {selectedIncident.title}
                </h3>

                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1rem',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>Diagnosed Root Cause:</strong>{' '}
                  {selectedIncident.root_cause}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.65rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Failure Classification:</span>{' '}
                    <code>{selectedIncident.error_type}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Target Pipeline ID:</span>{' '}
                    <strong>#{selectedIncident.pipeline_id}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Opened At:</span>{' '}
                    <strong>{new Date(selectedIncident.opened_at).toLocaleTimeString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Resolved At:</span>{' '}
                    <strong>
                      {selectedIncident.resolved_at
                        ? new Date(selectedIncident.resolved_at).toLocaleTimeString()
                        : 'Unresolved'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Recovery Decision Panel */}
              {loadingDetails ? (
                <div className="state-box">
                  <div className="spinner" />
                  <div className="state-title">Retrieving Proposed Recovery Playbook...</div>
                </div>
              ) : recoveryPlan ? (
                <div className="card">
                  <div className="card-title">
                    <span>Intelligent Recovery Decision Panel</span>
                    <span
                      className={`badge ${
                        recoveryPlan.status === 'APPROVED'
                          ? 'badge-high'
                          : recoveryPlan.status === 'EXECUTED'
                          ? 'badge-healthy'
                          : recoveryPlan.status === 'REJECTED'
                          ? 'badge-failed'
                          : 'badge-recovering'
                      }`}
                    >
                      Plan Status: {recoveryPlan.status}
                    </span>
                  </div>

                  {/* Playbook Recommendation & Rationale */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      Proposed Playbook Action:
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                      {recoveryPlan.action_type}
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      {recoveryPlan.description}
                    </div>
                  </div>

                  {/* Playbook Steps */}
                  {recoveryPlan.playbook_steps && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Deterministic Playbook Execution Steps:
                      </div>
                      <pre
                        style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.85rem 1rem',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.5,
                        }}
                      >
                        {recoveryPlan.playbook_steps}
                      </pre>
                    </div>
                  )}

                  {/* Authorization Metadata */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      padding: '0.75rem 0.95rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.8rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Risk Level:</span>{' '}
                      <strong>{recoveryPlan.risk_level || 'LOW'}</strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Human Approval:</span>{' '}
                      <strong>{recoveryPlan.requires_approval ? 'Mandatory' : 'Optional'}</strong>
                    </div>

                    {recoveryPlan.approved_by && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Authorized By:</span>{' '}
                        <strong style={{ color: 'var(--primary-700)' }}>{recoveryPlan.approved_by}</strong>
                      </div>
                    )}
                  </div>

                  {/* Human-in-the-Loop Action Controls */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      paddingTop: '0.85rem',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    {recoveryPlan.status === 'PENDING_APPROVAL' && (
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ flex: 1 }}
                          onClick={() => setModalType('approve')}
                        >
                          ✓ Approve Recovery Plan
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setModalType('reject')}
                        >
                          ✕ Reject Plan
                        </button>
                      </div>
                    )}

                    {recoveryPlan.status === 'REJECTED' && (
                      <div className="alert-banner error" style={{ margin: 0 }}>
                        <div>
                          <strong>Plan Rejected:</strong> Automated recovery has been blocked. Manual intervention required.
                        </div>
                      </div>
                    )}

                    {/* Execute Recovery Button & Safety Lock Indicator */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-success btn-lg"
                        style={{ width: '100%' }}
                        disabled={
                          recovering ||
                          recoveryPlan.status !== 'APPROVED' ||
                          selectedIncident.status === 'RESOLVED'
                        }
                        onClick={handleExecuteRecovery}
                      >
                        {recovering
                          ? 'Executing Playbook & Verifying Invariants...'
                          : selectedIncident.status === 'RESOLVED'
                          ? '✓ Recovery Workflow Completed & Incident Resolved'
                          : '▶ Execute Approved Recovery Workflow'}
                      </button>

                      {recoveryPlan.status !== 'APPROVED' && selectedIncident.status !== 'RESOLVED' && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          🔒 Safety Guard: Execution is strictly disabled until the recovery plan is human-approved.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Verification Safety Panel */}
              <div className="card">
                <div className="card-title">
                  <span>Verification Safety Panel (4 Invariants)</span>
                  <span className="badge badge-neutral">Pre-Resolution Quality Gate</span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', lineHeight: 1.4 }}>
                  Before an incident can be marked RESOLVED and the pipeline returned to HEALTHY, OpsPilot AI enforces 4 automated quality invariant checks.
                </div>

                {/* Demo Testing Toggle */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                  }}
                >
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      checked={simulateVerificationFailure}
                      onChange={(e) => setSimulateVerificationFailure(e.target.checked)}
                      disabled={recovering || selectedIncident.status === 'RESOLVED'}
                    />
                    <span>
                      <strong>[Demo Testing] Force Simulated Verification Failure</strong>
                    </span>
                  </label>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.25rem', paddingLeft: '1.4rem' }}>
                    Demonstrates the safety lock: If verification invariants fail, the incident remains UNRESOLVED and the pipeline remains FAILED.
                  </div>
                </div>

                {/* Verification Results Display */}
                {recoveryResult && recoveryResult.verification_report && (
                  <div>
                    {recoveryResult.verification_report.all_passed ? (
                      <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
                        <div>
                          <strong>Verification Checks Passed:</strong> {recoveryResult.verification_report.summary}
                        </div>
                      </div>
                    ) : (
                      <div className="alert-banner error" style={{ marginBottom: '1rem' }}>
                        <div>
                          <strong>SAFETY LOCK ACTIVE:</strong> {recoveryResult.verification_report.summary}
                        </div>
                      </div>
                    )}

                    <div className="verification-checklist">
                      {recoveryResult.verification_report.checks.map((chk, idx) => (
                        <div
                          key={idx}
                          className={`verification-check-card ${chk.passed ? 'passed' : 'failed'}`}
                        >
                          <span className="check-icon-badge">
                            {chk.passed ? '✅' : '❌'}
                          </span>
                          <div>
                            <div className="check-content-title">
                              <span>{chk.check_name}</span>
                              <span
                                className={`badge ${chk.passed ? 'badge-healthy' : 'badge-failed'}`}
                                style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}
                              >
                                {chk.passed ? 'PASSED' : 'FAILED'}
                              </span>
                            </div>
                            <div className="check-content-details">{chk.details}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Persisted Incident Audit Timeline */}
              <div className="card">
                <div className="card-title">
                  <span>Incident Audit Timeline</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {incidentLogs.length} Persisted Events
                  </span>
                </div>

                {incidentLogs.length === 0 ? (
                  <div className="state-box" style={{ padding: '1.5rem 1rem' }}>
                    <div className="state-title">No Audit Events for Incident #{selectedIncident.id}</div>
                    <div className="state-desc">Audit events will record as actions are taken on this incident.</div>
                  </div>
                ) : (
                  <div className="timeline">
                    {incidentLogs.map((log) => (
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
            </>
          ) : (
            <div className="state-box">
              <div className="state-title">Select an Incident to Investigate</div>
              <div className="state-desc">
                Choose an incident from the operational list to review its root cause diagnosis, authorize recovery, and inspect invariant verification.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={modalType === 'approve'}
        title={`Authorize Recovery Plan for Incident #${selectedIncident?.id}`}
        message={
          <div>
            <p style={{ marginBottom: '0.75rem' }}>
              Are you sure you want to <strong>APPROVE</strong> the automated recovery playbook (
              <code>{recoveryPlan?.action_type}</code>) for <strong>{selectedIncident?.title}</strong>?
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Approving records your authorization in the immutable audit trail and unlocks execution of the simulated recovery workflow.
            </p>
          </div>
        }
        confirmText="Confirm Authorization"
        confirmType="primary"
        loading={modalLoading}
        onConfirm={handleConfirmApprove}
        onCancel={() => setModalType(null)}
      />

      <ConfirmationModal
        isOpen={modalType === 'reject'}
        title={`Reject Recovery Plan for Incident #${selectedIncident?.id}`}
        message={
          <div>
            <p style={{ marginBottom: '0.75rem' }}>
              Are you sure you want to <strong>REJECT</strong> the proposed recovery plan?
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Rejecting will block automated recovery and log the rejection with your username in the governance audit trail.
            </p>
          </div>
        }
        confirmText="Confirm Rejection"
        confirmType="danger"
        loading={modalLoading}
        onConfirm={handleConfirmReject}
        onCancel={() => setModalType(null)}
      />
    </div>
  );
}
