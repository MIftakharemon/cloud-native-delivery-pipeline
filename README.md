# Cloud-Native Delivery Pipeline

A production-grade microservices deployment pipeline demonstrating infrastructure as code, container orchestration, and CI/CD automation on AWS EKS.

## Architecture Overview

```
                    ┌─────────────────────────────────────────────────┐
                    │                  GitHub Actions                 │
                    │  lint-test → build-push → deploy (EKS)         │
                    └────────────────────┬────────────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────────────┐
                    │              AWS EKS Cluster                    │
                    │                                                 │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
                    │  │ Frontend │──│ Backend  │──│ PostgreSQL   │  │
                    │  │ (React)  │  │ (Node.js)│  │ (RDS/ElastiC)│  │
                    │  └──────────┘  └────┬─────┘  └──────────────┘  │
                    │                     │                          │
                    │                ┌────▼─────┐                    │
                    │                │  Redis   │                    │
                    │                │(ElastiC) │                    │
                    │                └──────────┘                    │
                    └─────────────────────────────────────────────────┘
```

### Components

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| Frontend | React + Nginx | 8080 | Dashboard UI |
| Backend | Node.js + Express | 3001 | API service |
| Database | PostgreSQL 16 | 5432 | Persistent storage |
| Cache | Redis 7 | 6379 | Session & cache |

## Project Structure

```
cloud-native-delivery-pipeline/
├── app/
│   ├── backend/                 # Node.js API service
│   │   ├── src/server.js        # Express application
│   │   ├── Dockerfile           # Multi-stage build
│   │   └── package.json
│   └── frontend/                # React dashboard
│       ├── src/App.js           # Main component
│       ├── nginx.conf           # Production config
│       └── Dockerfile           # Multi-stage build
├── terraform/
│   ├── providers.tf             # AWS/K8s provider config
│   ├── variables.tf             # Input variables
│   ├── vpc.tf                   # VPC & subnets
│   ├── security-groups.tf       # Security groups
│   ├── eks-cluster.tf           # EKS cluster setup
│   └── outputs.tf               # Output values
├── k8s/
│   ├── namespace.yaml           # K8s namespace
│   ├── configmap.yaml           # Configuration data
│   ├── deployment.yaml          # Application deployments
│   ├── service.yaml             # ClusterIP services
│   ├── ingress.yaml             # Ingress with TLS
│   └── hpa.yaml                 # Horizontal pod autoscalers
├── .github/workflows/
│   └── deploy-pipeline.yml      # CI/CD pipeline
├── docker-compose.yml           # Local development
└── README.md
```

## Prerequisites

- Docker Desktop 4.x+
- Node.js 18+
- AWS CLI configured (`aws configure`)
- Terraform 1.5+
- kubectl 1.28+
- Access to an AWS account with EKS permissions

## Local Development

### Quick Start

```bash
# Clone and navigate to project
git clone https://github.com/<your-username>/cloud-native-delivery-pipeline.git
cd cloud-native-delivery-pipeline

# Start all services locally
docker-compose up -d

# Verify services are running
docker-compose ps
curl http://localhost:3001/health
curl http://localhost:8080
```

### Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:8080 | Dashboard UI |
| Backend API | http://localhost:3001 | REST API |
| Health Check | http://localhost:3001/health | Service health |
| Metrics | http://localhost:3001/metrics | Prometheus metrics |
| Deployment Stats | http://localhost:3001/api/v1/deployment-stats | Deployment statistics |

### Database Access

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U pipeline_user -d delivery_pipeline

# Connect to Redis
docker-compose exec redis redis-cli
```

## Production Deployment

### 1. Infrastructure Provisioning

```bash
cd terraform

# Initialize and plan
terraform init
terraform plan -var-file="terraform.tfvars"

# Apply infrastructure
terraform apply -var-file="terraform.tfvars"

# Export outputs for kubectl
terraform output -raw kubeconfig > ~/.kube/config
```

### 2. Deploy Applications

```bash
# Update kubeconfig
aws eks update-kubeconfig --name delivery-pipeline-cluster --region us-west-2

# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Verify deployment
kubectl get pods -n delivery-pipeline
kubectl get ingress -n delivery-pipeline
```

### 3. CI/CD Pipeline

The GitHub Actions workflow triggers on:

- **Push to main/develop**: Full pipeline (lint → build → deploy)
- **Pull requests**: Lint and test only
- **Manual dispatch**: Deploy to staging or production

Required GitHub Secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ACCOUNT_ID`

## Production Design Considerations

### Security

- **Non-root containers**: All Docker images run as non-root user (UID 1001)
- **Network policies**: Services communicate through Kubernetes network policies
- **TLS termination**: Ingress handles SSL/TLS with cert-manager integration
- **Secret management**: Kubernetes Secrets for sensitive configuration
- **Security groups**: Database access restricted to EKS node security group only

### Scalability

- **Horizontal Pod Autoscaler**: Backend scales 2-10 pods based on CPU/memory
- **EKS Managed Node Groups**: Auto-scaling worker nodes
- **Multi-AZ deployment**: VPC spans 3 availability zones
- **Redis clustering**: Ready for ElastiCache Redis cluster mode

### Reliability

- **Health checks**: HTTP liveness/readiness probes on all services
- **Graceful shutdown**: SIGTERM handlers with connection draining
- **Pod disruption budgets**: Ensures minimum availability during updates
- **Topology spread constraints**: Pods distributed across nodes

### Cost Optimization

- **Single NAT gateway**: Development/staging environments use single NAT
- **Right-sized instances**: t3.medium nodes for cost-effective compute
- **Reserved capacity**: Production workloads can leverage Reserved Instances
- **Storage lifecycle**: EBS snapshots with automated lifecycle policies

## Monitoring & Observability

- **Prometheus metrics**: `/metrics` endpoint exposes HTTP request duration, total requests
- **Structured logging**: JSON logs via morgan for centralized logging
- **Health endpoints**: `/health` returns dependency status (PostgreSQL, Redis)
- **Uptime tracking**: Process uptime included in health responses

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Application environment |
| `PORT` | 3001 | Backend server port |
| `POSTGRES_HOST` | localhost | PostgreSQL host |
| `POSTGRES_PORT` | 5432 | PostgreSQL port |
| `POSTGRES_DB` | delivery_pipeline | Database name |
| `REDIS_HOST` | localhost | Redis host |
| `REDIS_PORT` | 6379 | Redis port |

## Cleanup

```bash
# Destroy Kubernetes resources
kubectl delete namespace delivery-pipeline

# Destroy infrastructure
cd terraform
terraform destroy -var-file="terraform.tfvars"

# Remove local containers
docker-compose down -v
```

## License

MIT
