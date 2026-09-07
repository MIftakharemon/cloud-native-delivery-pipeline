const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Registry, collectDefaultMetrics } = require('prom-client');
const { Pool } = require('pg');
const Redis = require('ioredis');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const promClient = new Registry();
collectDefaultMetrics({ register: promClient });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'delivery_pipeline',
  user: process.env.POSTGRES_USER || 'pipeline_user',
  password: process.env.POSTGRES_PASSWORD || 'pipeline_pass',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

pgPool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
    httpRequestTotal.inc({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
  });
  next();
});

app.get('/health', async (req, res) => {
  const checks = { postgres: false, redis: false };

  try {
    await pgPool.query('SELECT 1');
    checks.postgres = true;
  } catch (err) {
    console.error('PostgreSQL health check failed:', err.message);
  }

  try {
    await redis.ping();
    checks.redis = true;
  } catch (err) {
    console.error('Redis health check failed:', err.message);
  }

  const isHealthy = checks.postgres && checks.redis;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    uptime: process.uptime(),
  });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.contentType);
    res.end(await promClient.metrics());
  } catch (err) {
    res.status(500).end('Error collecting metrics');
  }
});

app.get('/api/v1/ready', async (req, res) => {
  try {
    await pgPool.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

app.get('/api/v1/status', async (req, res) => {
  try {
    await redis.set('last_request', new Date().toISOString(), 'EX', 300);
    const lastRequest = await redis.get('last_request');

    res.json({
      service: 'delivery-pipeline-backend',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      lastRequest,
    });
  } catch (err) {
    res.status(500).json({ error: 'Service temporarily unavailable' });
  }
});

app.get('/api/v1/deployments', async (req, res) => {
  try {
    const result = await pgPool.query(
      'SELECT id, service_name, status, deployed_at FROM deployments ORDER BY deployed_at DESC LIMIT 10'
    );
    res.json({ deployments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

app.get('/api/v1/deployment-stats', async (req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT 
        COUNT(*) as total_deployments,
        COUNT(*) FILTER (WHERE status = 'success') as successful,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM deployments
    `);
    res.json({ stats: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deployment stats' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    await pgPool.end();
    redis.disconnect();
    console.log('All connections closed. Exiting.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
