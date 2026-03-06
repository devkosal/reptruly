# SSH key pair for EB instances
resource "tls_private_key" "eb" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "eb" {
  key_name   = "${var.project_name}-${var.environment}-key"
  public_key = tls_private_key.eb.public_key_openssh

  tags = local.common_tags
}

# Security group for RDS
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eb.id]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-sg"
  })
}

# Security group for ElastiCache
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Security group for Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eb.id]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-redis-sg"
  })
}

# Security group for Elastic Beanstalk
resource "aws_security_group" "eb" {
  name        = "${var.project_name}-eb-sg"
  description = "Security group for Elastic Beanstalk"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-eb-sg"
  })
}
