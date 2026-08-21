resource "aws_iam_policy" "s3" {
  name   = "${var.app_name}-s3-policy-${var.environment}"
  policy = data.aws_iam_policy_document.s3_policy.json
}

resource "aws_iam_policy" "dynamodb" {
  name   = "${var.app_name}-dynamodb-policy-${var.environment}"
  policy = data.aws_iam_policy_document.dynamodb_policy.json
}

resource "aws_iam_role_policy_attachment" "s3" {
  role       = aws_iam_role.fargate.name
  policy_arn = aws_iam_policy.s3.arn
}

resource "aws_iam_role_policy_attachment" "dynamodb" {
  role       = aws_iam_role.fargate.name
  policy_arn = aws_iam_policy.dynamodb.arn
}
