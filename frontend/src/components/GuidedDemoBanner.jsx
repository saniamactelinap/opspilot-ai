import React from 'react';

const DEMO_STEPS = [
  {
    step: 1,
    title: 'Simulate Pipeline Failure',
    tab: 'simulation',
    desc: "Navigate to the Failure Simulation tab, select a healthy pipeline (e.g., 'Inventory & Warehouse Sync'), choose a failure scenario (such as SCHEMA_MISMATCH), and click 'Simulate Failure' to inject a realistic operational issue.",
    actionLabel: 'Go to Failure Simulation',
  },
  {
    step: 2,
    title: 'Inspect Downstream Blast Radius',
    tab: 'pipelines',
    desc: 'Navigate to Pipeline Explorer to inspect the failed pipeline. Observe how foreign-key lineage relationships dynamically identify impacted executive reports, calculate business unit exposure, and assign severity.',
    actionLabel: 'Go to Pipeline Explorer',
  },
  {
    step: 3,
    title: 'Review Intelligent Recovery Playbook',
    tab: 'incidents',
    desc: 'Navigate to Incident Investigation and select the active incident. Review the deterministic recovery recommendation, diagnosis rationale, and sequential playbook steps formulated for this failure type.',
    actionLabel: 'Go to Incident Investigation',
  },
  {
    step: 4,
    title: 'Human-in-the-Loop Authorization Gate',
    tab: 'incidents',
    desc: "Notice the safety lock: recovery execution is blocked while the plan is in 'PENDING_APPROVAL'. Click 'Approve Recovery Plan' and confirm to record your authorization in the audit trail.",
    actionLabel: 'Go to Incident Approval',
  },
  {
    step: 5,
    title: 'Execute Recovery & Verify Quality Invariants',
    tab: 'incidents',
    desc: "Click 'Execute Approved Recovery Workflow'. Observe the state machine simulate recovery and automatically run 4 quality invariant checks (Schema, Completeness, Uniqueness, Freshness) before marking the incident RESOLVED.",
    actionLabel: 'Go to Recovery Execution',
  },
  {
    step: 6,
    title: 'Review Immutable Governance Audit Trail',
    tab: 'audit',
    desc: 'Navigate to Audit History to inspect the complete, timestamped chronological audit trail of the failure trigger, human approval, recovery orchestration, and verification check outcomes.',
    actionLabel: 'Go to Audit History',
  },
];

export default function GuidedDemoBanner({
  currentStepIndex,
  setCurrentStepIndex,
  onNavigateTab,
  onClose,
}) {
  const current = DEMO_STEPS[currentStepIndex] || DEMO_STEPS[0];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === DEMO_STEPS.length - 1;

  const handleGoToTab = () => {
    if (onNavigateTab && current.tab) {
      onNavigateTab(current.tab);
    }
  };

  return (
    <section className="guided-demo-banner" aria-label="Guided Demo Walkthrough">
      <div className="guided-demo-header">
        <div className="guided-demo-title-group">
          <span className="guided-step-badge">
            Guided Tour • Step {current.step} of {DEMO_STEPS.length}
          </span>
          <h3 className="guided-demo-title">{current.title}</h3>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onClose}
          title="Exit Guided Walkthrough"
        >
          ✕ Dismiss Tour
        </button>
      </div>

      <p className="guided-demo-desc">{current.desc}</p>

      <div className="guided-demo-action-bar">
        <div className="guided-step-indicators">
          {DEMO_STEPS.map((s, idx) => (
            <div
              key={s.step}
              className={`step-dot ${
                idx === currentStepIndex
                  ? 'active'
                  : idx < currentStepIndex
                  ? 'completed'
                  : ''
              }`}
              title={`Step ${s.step}: ${s.title}`}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleGoToTab}
          >
            {current.actionLabel} →
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={isFirst}
            onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
          >
            ← Previous
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={isLast}
            onClick={() =>
              setCurrentStepIndex((prev) => Math.min(DEMO_STEPS.length - 1, prev + 1))
            }
          >
            Next Step →
          </button>
        </div>
      </div>
    </section>
  );
}
