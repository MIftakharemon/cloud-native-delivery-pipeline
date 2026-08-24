import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      const [statusRes, healthRes, deployRes, statsRes] = await Promise.allSettled([
        axios.get(`${API_BASE}/api/v1/status`),
        axios.get(`${API_BASE}/health`),
        axios.get(`${API_BASE}/api/v1/deployments`),
        axios.get(`${API_BASE}/api/v1/deployment-stats`),
      ]);

      if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);
      if (deployRes.status === 'fulfilled') setDeployments(deployRes.value.data.deployments);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.stats);

      setLoading(false);
      setError(null);
    } catch (err) {
      setError('Failed to connect to backend service');
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'degraded': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading pipeline status...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Cloud-Native Delivery Pipeline</h1>
        <p style={styles.subtitle}>Infrastructure Observability Dashboard</p>
      </header>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Service Health</h2>
          {health && (
            <div>
              <div style={{ ...styles.statusBadge, backgroundColor: getStatusColor(health.status) }}>
                {health.status.toUpperCase()}
              </div>
              <div style={styles.checks}>
                <div style={styles.check}>
                  <span>PostgreSQL</span>
                  <span style={{ color: health.checks.postgres ? '#22c55e' : '#ef4444' }}>
                    {health.checks.postgres ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div style={styles.check}>
                  <span>Redis</span>
                  <span style={{ color: health.checks.redis ? '#22c55e' : '#ef4444' }}>
                    {health.checks.redis ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
              <div style={styles.uptime}>Uptime: {Math.floor(health.uptime)}s</div>
            </div>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Service Info</h2>
          {status && (
            <div style={styles.info}>
              <div style={styles.infoRow}><span>Service:</span><span>{status.service}</span></div>
              <div style={styles.infoRow}><span>Version:</span><span>{status.version}</span></div>
              <div style={styles.infoRow}><span>Environment:</span><span>{status.environment}</span></div>
              <div style={styles.infoRow}><span>Last Request:</span><span>{status.lastRequest}</span></div>
            </div>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Deployment Statistics</h2>
          {stats ? (
            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <span style={styles.statValue}>{stats.total_deployments}</span>
                <span style={styles.statLabel}>Total</span>
              </div>
              <div style={styles.statBox}>
                <span style={{ ...styles.statValue, color: '#22c55e' }}>{stats.successful}</span>
                <span style={styles.statLabel}>Successful</span>
              </div>
              <div style={styles.statBox}>
                <span style={{ ...styles.statValue, color: '#ef4444' }}>{stats.failed}</span>
                <span style={styles.statLabel}>Failed</span>
              </div>
              <div style={styles.statBox}>
                <span style={{ ...styles.statValue, color: '#f59e0b' }}>{stats.pending}</span>
                <span style={styles.statLabel}>Pending</span>
              </div>
            </div>
          ) : (
            <p style={styles.noData}>No stats available</p>
          )}
        </div>

        <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
          <h2 style={styles.cardTitle}>Recent Deployments</h2>
          {deployments.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Service</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Deployed At</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d) => (
                  <tr key={d.id} style={styles.tr}>
                    <td style={styles.td}>{d.id}</td>
                    <td style={styles.td}>{d.service_name}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.deployBadge,
                        backgroundColor: d.status === 'success' ? '#22c55e' : d.status === 'failed' ? '#ef4444' : '#f59e0b'
                      }}>{d.status}</span>
                    </td>
                    <td style={styles.td}>{new Date(d.deployed_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.noData}>No deployment records found</p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    backgroundColor: '#0f172a',
    minHeight: '100vh',
    color: '#e2e8f0',
  },
  header: {
    marginBottom: '2rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #1e293b',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '600',
    margin: 0,
    color: '#f8fafc',
  },
  subtitle: {
    margin: '0.5rem 0 0',
    color: '#94a3b8',
    fontSize: '0.9rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '1.5rem',
    border: '1px solid #334155',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: '500',
    margin: '0 0 1rem',
    color: '#cbd5e1',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '1rem',
  },
  checks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  check: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem',
    backgroundColor: '#0f172a',
    borderRadius: '4px',
    fontSize: '0.85rem',
  },
  uptime: {
    marginTop: '0.75rem',
    fontSize: '0.8rem',
    color: '#94a3b8',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem',
    backgroundColor: '#0f172a',
    borderRadius: '4px',
    fontSize: '0.85rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem',
    borderBottom: '1px solid #334155',
    fontSize: '0.8rem',
    color: '#94a3b8',
    fontWeight: '500',
  },
  tr: {
    borderBottom: '1px solid #1e293b',
  },
  td: {
    padding: '0.75rem',
    fontSize: '0.85rem',
  },
  deployBadge: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: '#fff',
  },
  noData: {
    color: '#64748b',
    fontSize: '0.85rem',
    textAlign: 'center',
    padding: '2rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#0f172a',
    borderRadius: '4px',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#f8fafc',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginTop: '0.25rem',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    color: '#94a3b8',
    fontSize: '1rem',
  },
  errorBanner: {
    padding: '0.75rem 1rem',
    backgroundColor: '#7f1d1d',
    border: '1px solid #991b1b',
    borderRadius: '6px',
    marginBottom: '1.5rem',
    fontSize: '0.85rem',
    color: '#fecaca',
  },
};

export default App;
