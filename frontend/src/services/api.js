/**
 * OpsPilot AI - Centralized Frontend API Service
 * Communicates directly with the FastAPI backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    // Parse JSON response body if present
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      const errorMessage =
        data && data.detail
          ? typeof data.detail === 'string'
            ? data.detail
            : JSON.stringify(data.detail)
          : `HTTP error ${response.status}: ${response.statusText}`;
      const err = new Error(errorMessage);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(
        `Cannot connect to OpsPilot AI backend at ${API_BASE_URL}. Ensure the backend server is running on port 8000.`
      );
    }
    throw error;
  }
}

export const api = {
  // Health
  checkHealth: () => request('/api/health'),

  // Pipelines
  getPipelines: () => request('/api/pipelines'),
  getPipeline: (id) => request(`/api/pipelines/${id}`),
  getPipelineImpact: (id) => request(`/api/pipelines/${id}/impact`),

  // Incidents
  getIncidents: () => request('/api/incidents'),
  getIncident: (id) => request(`/api/incidents/${id}`),

  // Simulation
  simulateFailure: (pipelineId, failureType) =>
    request('/api/simulate/fail', {
      method: 'POST',
      body: JSON.stringify({
        pipeline_id: Number(pipelineId),
        failure_type: failureType,
      }),
    }),

  // Recovery & Human-in-the-Loop Approval
  getRecoveryPlan: (incidentId) => request(`/api/incidents/${incidentId}/recovery-plan`),
  approveRecoveryPlan: (incidentId, approvedBy = 'Operations Engineer') =>
    request(`/api/incidents/${incidentId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved_by: approvedBy }),
    }),
  rejectRecoveryPlan: (incidentId, rejectedBy = 'Operations Engineer', reason = 'Manual triage preferred') =>
    request(`/api/incidents/${incidentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejected_by: rejectedBy, reason }),
    }),
  recoverIncident: (incidentId, simulateVerificationFailure = false, recoveredBy = 'OpsPilot Orchestrator') =>
    request(`/api/incidents/${incidentId}/recover`, {
      method: 'POST',
      body: JSON.stringify({
        simulate_verification_failure: simulateVerificationFailure,
        recovered_by: recoveredBy,
      }),
    }),

  // Audit Logs
  getIncidentLogs: (incidentId) => request(`/api/incidents/${incidentId}/logs`),
  getAuditLogs: (limit = 100) => request(`/api/audit-logs?limit=${limit}`),
};
