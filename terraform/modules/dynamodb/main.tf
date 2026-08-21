resource "aws_dynamodb_table" "detections" {
  name           = "${var.app_name}-detections-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name        = "${var.app_name}-detections-${var.environment}"
    Environment = var.environment
  }
}
