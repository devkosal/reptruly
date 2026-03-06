# Bootstrap instructions:
# 1. First run with backend "local" (comment out the S3 backend block below,
#    uncomment the local backend block)
# 2. Run: terraform init && terraform apply
# 3. Once the S3 bucket and DynamoDB table are created, switch to the S3 backend
#    (uncomment S3 backend, comment out local backend)
# 4. Run: terraform init -migrate-state
# 5. Type "yes" to copy state to S3

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment this for initial bootstrap, then switch to S3 backend
  backend "local" {
    path = "terraform.tfstate"
  }

  backend "s3" {
    bucket         = "reptruly-terraform-state"
    key            = "mgmt/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "reptruly-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

variable "project_name" {
  default = "reptruly"
}

# S3 bucket for Terraform state
resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-terraform-state"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for state locking
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "${var.project_name}-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

# GitHub OIDC provider
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# IAM role for GitHub Actions
resource "aws_iam_role" "github_actions" {
  name = "${var.project_name}-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            # TODO: scope to your GitHub org/repo, e.g. "repo:your-org/your-repo:*"
            "token.actions.githubusercontent.com:sub" = "repo:YOUR_GITHUB_ORG/*:*"
          }
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "github_actions" {
  name = "${var.project_name}-github-actions-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECR"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      },
      {
        Sid      = "S3Deploy"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "arn:aws:s3:::${var.project_name}-terraform-state/deploy/*"
      },
      {
        Sid    = "EB"
        Effect = "Allow"
        Action = [
          "elasticbeanstalk:CreateApplicationVersion",
          "elasticbeanstalk:UpdateEnvironment",
          "elasticbeanstalk:DescribeEnvironments",
          "elasticbeanstalk:DescribeEvents"
        ]
        Resource = "*"
      },
      {
        Sid    = "Terraform"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-terraform-state",
          "arn:aws:s3:::${var.project_name}-terraform-state/*"
        ]
      },
      {
        Sid    = "TerraformLock"
        Effect = "Allow"
        Action = [
          "dynamodb:*"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:*:table/${var.project_name}-terraform-locks"
      },
      {
        Sid    = "TerraformManageResources"
        Effect = "Allow"
        Action = [
          "ec2:*",
          "elasticbeanstalk:*",
          "elasticache:*",
          "rds:*",
          "s3:*",
          "iam:*",
          "ssm:*",
          "ecr:*",
          "autoscaling:*",
          "elasticloadbalancing:*",
          "cloudwatch:*",
          "logs:*",
          "acm:*",
          "cloudfront:*",
          "sns:*",
          "cloudformation:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# ECR repositories
resource "aws_ecr_repository" "django" {
  name                 = "${var.project_name}-django"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "nginx" {
  name                 = "${var.project_name}-nginx"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "celeryworker" {
  name                 = "${var.project_name}-celeryworker"
  image_tag_mutability = "MUTABLE"
}

resource "aws_ecr_repository" "celerybeat" {
  name                 = "${var.project_name}-celerybeat"
  image_tag_mutability = "MUTABLE"
}

# ECR lifecycle policies
resource "aws_ecr_lifecycle_policy" "django" {
  repository = aws_ecr_repository.django.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = {
        type = "expire"
      }
    }]
  })
}

output "ecr_django_url" {
  value = aws_ecr_repository.django.repository_url
}

output "ecr_nginx_url" {
  value = aws_ecr_repository.nginx.repository_url
}

output "terraform_state_bucket" {
  value = aws_s3_bucket.terraform_state.bucket
}

output "terraform_locks_table" {
  value = aws_dynamodb_table.terraform_locks.name
}
