# ElastiCache subnet group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = local.common_tags
}

# ElastiCache Redis cluster
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${var.project_name}-redis"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  snapshot_retention_limit = 1
  snapshot_window          = "02:00-03:00"

  tags = local.common_tags
}

# Store Redis URL in SSM
resource "aws_ssm_parameter" "redis_url" {
  name  = "/${var.project_name}/${var.environment}/REDIS_URL"
  type  = "String"
  value = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:6379/0"
  tags  = local.common_tags
}
