resource "aws_s3_bucket" "plants" {
  bucket = "${var.app_name}-bucket-${var.environment}"

  tags = {
    Name        = "${var.app_name}-bucket-${var.environment}"
    Environment = var.environment
  }
}


resource "aws_s3_bucket_public_access_block" "plants" {
  bucket = aws_s3_bucket.plants.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
