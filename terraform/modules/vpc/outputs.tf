# Export VPC details for other modules to use
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "Public subnet ID (for ALB)"
  value       = aws_subnet.public.id
}

output "private_subnet_id" {
  description = "Private subnet ID (for Fargate)"
  value       = aws_subnet.private.id
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = aws_security_group.alb.id
}

output "fargate_security_group_id" {
  description = "Fargate security group ID"
  value       = aws_security_group.fargate.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = [aws_subnet.public.id, aws_subnet.public_2.id]
}
