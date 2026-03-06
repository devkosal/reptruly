output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.main.address
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "s3_bucket" {
  description = "S3 bucket for assets"
  value       = aws_s3_bucket.assets.id
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain"
  value       = aws_cloudfront_distribution.assets.domain_name
}

output "eb_environment_url" {
  description = "Elastic Beanstalk environment URL"
  value       = aws_elastic_beanstalk_environment.main.endpoint_url
}

output "eb_environment_name" {
  description = "Elastic Beanstalk environment name"
  value       = aws_elastic_beanstalk_environment.main.name
}

output "eb_ssh_private_key" {
  description = "Private key for SSH access to EB instances (save to .pem file)"
  value       = tls_private_key.eb.private_key_pem
  sensitive   = true
}
