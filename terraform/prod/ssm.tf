# SSM parameters for application secrets
# These should be populated manually or via CI/CD

resource "aws_ssm_parameter" "django_secret_key" {
  name        = "/${var.project_name}/${var.environment}/DJANGO_SECRET_KEY"
  description = "Django secret key"
  type        = "SecureString"
  value       = random_password.django_secret.result

  tags = local.common_tags

  lifecycle {
    ignore_changes = [value]
  }
}

resource "random_password" "django_secret" {
  length  = 50
  special = true
}

resource "aws_ssm_parameter" "django_allowed_hosts" {
  name  = "/${var.project_name}/${var.environment}/DJANGO_ALLOWED_HOSTS"
  type  = "String"
  value = "${var.domain_name},${aws_elastic_beanstalk_environment.main.cname}"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "django_settings_module" {
  name  = "/${var.project_name}/${var.environment}/DJANGO_SETTINGS_MODULE"
  type  = "String"
  value = "config.settings.production"

  tags = local.common_tags
}

# Placeholder parameters (to be filled manually)
resource "aws_ssm_parameter" "stripe_live_secret" {
  name        = "/${var.project_name}/${var.environment}/STRIPE_LIVE_SECRET_KEY"
  description = "Stripe live secret key"
  type        = "SecureString"
  value       = "sk_live_placeholder"

  tags = local.common_tags

  lifecycle {
    ignore_changes = [value]
  }
}
resource "aws_ssm_parameter" "sentry_dsn" {
  name        = "/${var.project_name}/${var.environment}/SENTRY_DSN"
  description = "Sentry DSN"
  type        = "SecureString"
  value       = ""

  tags = local.common_tags

  lifecycle {
    ignore_changes = [value]
  }
}
