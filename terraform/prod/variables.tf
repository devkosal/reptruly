variable "aws_region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  default     = "reptruly"
}

variable "environment" {
  description = "Environment name"
  default     = "prod"
}

variable "domain_name" {
  description = "Domain name for the application"
  default     = "reptruly.com"
}

variable "db_instance_class" {
  description = "RDS instance class"
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  default     = 20
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  default     = "cache.t3.micro"
}

variable "eb_instance_type" {
  description = "Elastic Beanstalk instance type"
  default     = "t3.medium"
}

variable "notification_email" {
  description = "Email for EB notifications"
  default     = "admin@reptruly.com"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

locals {
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}
