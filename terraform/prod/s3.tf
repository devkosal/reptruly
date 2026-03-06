# S3 bucket for static and media files
resource "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-assets"

  tags = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.assets.arn}/static/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.assets]
}

resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["https://${var.domain_name}"]
    max_age_seconds = 3600
  }
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "assets" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.assets.id}"

    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.assets.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = local.common_tags
}

# Store S3 bucket name in SSM
resource "aws_ssm_parameter" "s3_bucket" {
  name  = "/${var.project_name}/${var.environment}/AWS_STORAGE_BUCKET_NAME"
  type  = "String"
  value = aws_s3_bucket.assets.id
  tags  = local.common_tags
}

resource "aws_ssm_parameter" "cloudfront_domain" {
  name  = "/${var.project_name}/${var.environment}/AWS_CLOUDFRONT_DOMAIN"
  type  = "String"
  value = aws_cloudfront_distribution.assets.domain_name
  tags  = local.common_tags
}
