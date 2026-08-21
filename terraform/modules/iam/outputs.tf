output "fargate_role_arn" {
  description = "ARN of Fargate IAM role"
  value       = aws_iam_role.fargate.arn
}

output "fargate_role_name" {
  description = "Name of Fargate IAM role"
  value       = aws_iam_role.fargate.name
}
