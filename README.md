# reptruly

A full-stack Django + React application

## Features

- **Backend**: Django 5.2, Django Ninja API, Celery, dj-stripe
- **Frontend**: React 18, Vite 5, TypeScript
- **Infrastructure**: Terraform (VPC, RDS, ElastiCache, S3, EBS)
- **CI/CD**: GitHub Actions (test, deploy, terraform)
- **Secrets**: AWS SSM Parameter Store

## Quick Start

```bash
docker compose -f local.yml up --build
```

App runs at **http://localhost:8002**

## Project Structure

```
reptruly/
├── backend/                 # Django application
│   ├── compose/             # Docker configs
│   ├── config/              # Django settings
│   ├── requirements/        # Python dependencies
│   ├── scripts/             # SSM & utility scripts
│   └── reptruly/  # Django apps
├── frontend/                # React + Vite
│   ├── src/
│   └── package.json
├── terraform/
│   ├── mgmt/                # State bucket, ECR
│   └── prod/                # VPC, RDS, Redis, EBS
├── .github/workflows/       # CI/CD
├── local.yml                # Local docker compose
└── production.yml           # Production docker compose
```

## Local Development

### Prerequisites

- Docker & Docker Compose
- AWS CLI (optional, for SSM secrets)

### Start Services

```bash
docker compose -f local.yml up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8002 |
| Admin | http://localhost:8002/admin/ |
| API Docs | http://localhost:8002/api/docs |
| Flower | http://localhost:5555 |

### Default Credentials

- **Admin**: `admin` / `admin`

### Environment Variables

Without AWS, the app uses local `.envs/` files:
```
backend/.envs/.local/.django
backend/.envs/.local/.postgres
```

With AWS SSM configured, secrets load automatically from Parameter Store.

## AWS Setup

### 1. Configure AWS CLI

```bash
# Create a named profile for your project
aws configure --profile reptruly
```

### 2. Deploy Management Infrastructure

This creates the S3 bucket for Terraform state and ECR for Docker images.

```bash
cd terraform/mgmt
terraform init
terraform apply
```

### 3. Deploy Production Infrastructure

```bash
cd terraform/prod
terraform init
terraform apply
```

This creates:
- VPC with public/private subnets
- RDS PostgreSQL 15
- ElastiCache Redis 7
- S3 buckets (static, media)
- Elastic Beanstalk environment
- Security groups

### 4. Push Secrets to SSM

```bash
# Create your production .env file
cp backend/.envs/.local/.django backend/.envs/.production/.django
# Edit with production values

# Push to SSM
cd backend
python scripts/post_env_to_ssm.py production
```

SSM path structure:
```
/reptruly/common/     # Shared across environments
/reptruly/local/      # Local development
/reptruly/production/ # Production
```

## Deployment

### GitHub Actions (Recommended)

1. Add repository secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

2. Push to `main` branch triggers:
   - Build & push Docker image to ECR
   - Deploy to Elastic Beanstalk

### Manual Deployment

```bash
# Build and push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin YOUR_ECR_URL
docker build -f backend/compose/production/django/Dockerfile -t reptruly .
docker tag reptruly:latest YOUR_ECR_URL:latest
docker push YOUR_ECR_URL:latest

# Deploy to EBS
eb deploy
```

## SSM Secrets Management

### View Current Secrets

```bash
aws ssm get-parameters-by-path \
  --path "/reptruly/production/" \
  --with-decryption \
  --profile reptruly
```

### Add/Update a Secret

```bash
aws ssm put-parameter \
  --name "/reptruly/production/SECRET_KEY" \
  --value "your-secret-value" \
  --type SecureString \
  --overwrite \
  --profile reptruly
```

### Required SSM Parameters

```
/reptruly/production/
├── SECRET_KEY
├── DJANGO_ALLOWED_HOSTS
├── POSTGRES_HOST
├── POSTGRES_PORT
├── POSTGRES_DB
├── POSTGRES_USER
├── POSTGRES_PASSWORD
├── REDIS_URL
├── AWS_STORAGE_BUCKET_NAME
├── STRIPE_LIVE_SECRET_KEY      # If using payments
├── STRIPE_LIVE_PUBLIC_KEY
└── DJSTRIPE_WEBHOOK_SECRET
```

## Terraform Variables

Create `terraform/prod/terraform.tfvars`:

```hcl
project_name     = "reptruly"
aws_region       = "us-east-1"
domain_name      = "yourdomain.com"  # Optional
db_instance_class = "db.t3.micro"
redis_node_type  = "cache.t3.micro"
```

## Customization

### Adding Django Apps

```bash
cd backend
python manage.py startapp your_app
```

Add to `INSTALLED_APPS` in `config/settings/base.py`.

### Adding API Endpoints

```python
# backend/reptruly/your_app/api/controllers.py
from ninja_extra import api_controller, route

@api_controller("/your-app", tags=["Your App"])
class YourAppAPI:
    @route.get("/items")
    def list_items(self):
        return {"items": []}
```

Register in `config/api_router.py`:
```python
api.register_controllers(YourAppAPI)
```

### Frontend API Client

Generate TypeScript client from OpenAPI:

```bash
cd frontend
npm run generate-api
```

## Useful Commands

```bash
# Django shell
docker compose -f local.yml exec django python manage.py shell

# Create migrations
docker compose -f local.yml exec django python manage.py makemigrations

# Run migrations
docker compose -f local.yml exec django python manage.py migrate

# Create superuser
docker compose -f local.yml exec django python manage.py createsuperuser

# Run tests
docker compose -f local.yml exec django pytest

# View logs
docker compose -f local.yml logs -f django
```

## Troubleshooting

### SSM Fallback

If AWS credentials aren't configured, the app falls back to local `.envs/` files:
```
WARNING: Could not load from SSM. Falling back to local .envs files.
```

### Database Connection

Check PostgreSQL is running:
```bash
docker compose -f local.yml logs postgres
```

### EB Deployment Failures

Container logs are streamed to CloudWatch:
```
/aws/elasticbeanstalk/reptruly-prod/var/log/eb-docker/containers/eb-current-app/stdouterr.log
```

### Frontend Not Loading

Check frontend container:
```bash
docker compose -f local.yml logs frontend
```
