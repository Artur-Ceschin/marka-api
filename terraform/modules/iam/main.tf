
resource "aws_iam_role" "fargate" {
  name               = "${var.app_name}-fargate-role-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.fargate_trust.json
}

data "aws_iam_policy_document" "s3_policy" {
  statement {
    actions = [
      "s3:PutObject",
      "s3:GetObject"
    ]
    resources = ["arn:aws:s3:::${var.app_name}-bucket-${var.environment}/*"]
  }
}


data "aws_iam_policy_document" "dynamodb_policy" {
  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:Query"
    ]
    resources = ["arn:aws:dynamodb:*:*:table/${var.app_name}-detections-${var.environment}"]
  }
}

data "aws_iam_policy_document" "fargate_trust" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}
