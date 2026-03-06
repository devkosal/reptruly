# RDS subnet group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-db-subnet"
  })
}

# RDS instance
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "15"

  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = 100

  db_name  = replace(var.project_name, "-", "_")
  username = "postgres"
  password = random_password.db_password.result

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  multi_az               = false
  publicly_accessible    = false
  storage_encrypted      = true
  skip_final_snapshot    = true
  deletion_protection    = true

  performance_insights_enabled = true

  tags = local.common_tags
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

# Store database credentials in SSM
resource "aws_ssm_parameter" "db_host" {
  name  = "/${var.project_name}/${var.environment}/DATABASE_HOST"
  type  = "String"
  value = aws_db_instance.main.address
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "db_password" {
  name  = "/${var.project_name}/${var.environment}/DATABASE_PASSWORD"
  type  = "SecureString"
  value = random_password.db_password.result
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "database_url" {
  name  = "/${var.project_name}/${var.environment}/DATABASE_URL"
  type  = "SecureString"
  value = "postgres://postgres:${random_password.db_password.result}@${aws_db_instance.main.address}:5432/${replace(var.project_name, "-", "_")}"
  tags  = local.common_tags
}
