import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import GuidedDemoBanner from './components/GuidedDemoBanner';
import OverviewTab from './components/OverviewTab';
import PipelineExplorerTab from './components/PipelineExplorerTab';
import IncidentInvestigationTab from './components/IncidentInvestigationTab';
import SimulationTab from './components/SimulationTab';
import AuditHistoryTab from './components/AuditHistoryTab';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Guided Demo Walkthrough State
  const [showGuidedDemo, setShowGuidedDemo] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Core Data
  const [pipelines, setPipelines] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Selected Items for deep-dive
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Simulation state
  const [simulating, setSimulating] = useState(false);

  // Fetch all core data from FastAPI backend
  const fetchAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    setError(null);

    try {
      // 1. Health check
      await api.checkHealth();
      setBackendOnline(true);

      // 2. Fetch parallel data
      const [pipeData, incData, logData] = await Promise.all([
        api.getPipelines(),
        api.getIncidents(),
        api.getAuditLogs(100),
      ]);

      setPipelines(pipeData || []);
      setIncidents(incData || []);
      setAuditLogs(logData || []);

      // Retain or select default pipeline if none selected
      setSelectedPipeline((prev) => {
        if (prev) {
          const updated = pipeData.find((p) => p.id === prev.id);
          return updated || pipeData[0] || null;
        }
        return pipeData[0] || null;
      });

      // Retain or select default incident
      setSelectedIncident((prev) => {
        if (prev) {
          const updated = incData.find((i) => i.id === prev.id);
          return updated || incData[0] || null;
        }
        return incData[0] || null;
      });
    } catch (err) {
      setBackendOnline(false);
      setError(err.message || 'Failed to connect to OpsPilot AI backend on port 8000.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handle Simulation Trigger
  const handleSimulate = async (pipelineId, failureType) => {
    setSimulating(true);
    setError(null);
    setNotification(null);

    try {
      const result = await api.simulateFailure(pipelineId, failureType);
      setNotification({
        type: 'success',
        message: result.message || 'Simulated failure successfully injected!',
      });

      // Refresh full dataset
      await fetchAllData(true);

      // Select newly affected pipeline and incident
      if (result.pipeline) {
        setSelectedPipeline(result.pipeline);
      }
      if (result.incident) {
        setSelectedIncident(result.incident);
        // Switch to incidents tab for immediate triage visibility
        setActiveTab('incidents');
      }
    } catch (err) {
      setError(err.message || 'Simulation failed.');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Top Header */}
      <Navbar
        backendOnline={backendOnline}
        onRefresh={() => fetchAllData(false)}
        refreshing={refreshing}
        showGuidedDemo={showGuidedDemo}
        onToggleGuidedDemo={() => setShowGuidedDemo((prev) => !prev)}
      />

      <div className="app-body-layout">
        {/* Left Sticky Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pipelines={pipelines}
          incidents={incidents}
          auditLogs={auditLogs}
        />

        {/* Main Content Viewport */}
        <main className="main-viewport" role="main">
          {/* Guided Demo Walkthrough Banner */}
          {showGuidedDemo && (
            <GuidedDemoBanner
              currentStepIndex={currentStepIndex}
              setCurrentStepIndex={setCurrentStepIndex}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onClose={() => setShowGuidedDemo(false)}
            />
          )}

          {/* Global Connectivity Error Alert */}
          {error && (
            <div className="alert-banner error">
              <div>
                <strong>Operational / Connection Alert:</strong> {error}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fetchAllData(false)}
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* Action Notification Banner */}
          {notification && (
            <div className={`alert-banner ${notification.type}`}>
              <div>{notification.message}</div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setNotification(null)}
              >
                ✕
              </button>
            </div>
          )}

          {/* Loading State or Active Tab View */}
          {loading ? (
            <div className="state-box">
              <div className="spinner" />
              <div className="state-title">Connecting to OpsPilot AI Control Center...</div>
              <div className="state-desc">
                Synchronizing data pipelines, foreign-key lineage, active incidents, and audit records from SQLite.
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  pipelines={pipelines}
                  incidents={incidents}
                  auditLogs={auditLogs}
                  onSelectPipeline={(p) => setSelectedPipeline(p)}
                  onSelectIncident={(i) => setSelectedIncident(i)}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onStartGuidedDemo={() => {
                    setShowGuidedDemo(true);
                    setCurrentStepIndex(0);
                  }}
                />
              )}

              {activeTab === 'pipelines' && (
                <PipelineExplorerTab
                  pipelines={pipelines}
                  selectedPipeline={selectedPipeline}
                  onSelectPipeline={(p) => setSelectedPipeline(p)}
                />
              )}

              {activeTab === 'incidents' && (
                <IncidentInvestigationTab
                  incidents={incidents}
                  selectedIncident={selectedIncident}
                  onSelectIncident={(i) => setSelectedIncident(i)}
                  onRefreshAll={() => fetchAllData(true)}
                />
              )}

              {activeTab === 'simulation' && (
                <SimulationTab
                  pipelines={pipelines}
                  incidents={incidents}
                  onSimulate={handleSimulate}
                  simulating={simulating}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'audit' && (
                <AuditHistoryTab
                  auditLogs={auditLogs}
                  onRefresh={() => fetchAllData(false)}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
