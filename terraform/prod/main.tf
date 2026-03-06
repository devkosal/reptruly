# Prod infrastructure
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "reptruly-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "reptruly-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {}

# HTTPS: Uncomment the ACM certificate below after your first deploy.
# Then add the DNS validation CNAME record (NOT proxied) and wait for status: ISSUED.
#   aws acm describe-certificate --certificate-arn <ARN> \
#     --query 'Certificate.DomainValidationOptions[0].ResourceRecord'
#
# resource "aws_acm_certificate" "main" {
#   domain_name               = var.domain_name
#   subject_alternative_names = ["*.${var.domain_name}"]
#   validation_method         = "DNS"
#
#   tags = local.common_tags
#
#   lifecycle {
#     create_before_destroy = true
#   }
# }
