import React from 'react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  pipelines = [],
  incidents = [],
  auditLogs = [],
}) {
  const failedPipelines = pipelines.filter((p) => p.status === 'FAILED').length;
  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED').length;
  const healthyPipelines = pipelines.filter((p) => p.status === 'HEALTHY').length;

  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: '📊',
      badge: null,
    },
    {
      id: 'pipelines',
      label: 'Pipeline Explorer',
      icon: '🔀',
      badge: failedPipelines > 0 ? `${failedPipelines} Alert` : null,
      badgeType: 'alert',
    },
    {
      id: 'incidents',
      label: 'Incident Investigation',
      icon: '⚠️',
      badge: activeIncidents > 0 ? `${activeIncidents} Active` : null,
      badgeType: 'alert',
    },
    {
      id: 'simulation',
      label: 'Failure Simulation',
      icon: '⚡',
      badge: null,
    },
    {
      id: 'audit',
      label: 'Audit History',
      icon: '📜',
      badge: auditLogs.length > 0 ? String(auditLogs.length) : null,
      badgeType: 'neutral',
    },
  ];

  return (
    <aside className="left-sidebar" aria-label="Operations Navigation">
      <div className="sidebar-nav-list">
        <div className="sidebar-section-title">Operations Console</div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="sidebar-item-left">
                <span className="sidebar-item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`sidebar-nav-badge ${item.badgeType || 'neutral'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-quick-health">
          <div className="quick-health-title">
            <span>Fleet Status</span>
            <span
              className="badge badge-healthy"
              style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}
            >
              {healthyPipelines}/{pipelines.length} OK
            </span>
          </div>

          <div className="quick-health-row">
            <span>Active Alerts:</span>
            <strong>{activeIncidents}</strong>
          </div>

          <div className="quick-health-row">
            <span>Data Engine:</span>
            <strong>SQLite (Local)</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}
