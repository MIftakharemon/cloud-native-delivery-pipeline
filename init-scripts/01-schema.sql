CREATE TABLE IF NOT EXISTS deployments (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    environment VARCHAR(50) NOT NULL DEFAULT 'development',
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deployed_by VARCHAR(255),
    commit_sha VARCHAR(40),
    notes TEXT
);

INSERT INTO deployments (service_name, version, status, environment, deployed_by, commit_sha, notes)
VALUES
    ('delivery-pipeline-backend', '1.0.0', 'success', 'development', 'system', 'abc1234', 'Initial deployment'),
    ('delivery-pipeline-frontend', '1.0.0', 'success', 'development', 'system', 'def5678', 'Initial deployment')
ON CONFLICT DO NOTHING;
