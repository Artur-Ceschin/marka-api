output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "public_subnet_id" {
  description = "Public subnet ID (for ALB)"
  value       = module.vpc.public_subnet_id
}

output "private_subnet_id" {
  description = "Private subnet ID (for Fargate)"
  value       = module.vpc.private_subnet_id
}

output "alb_security_group_id" {
  description = "ALB security group"
  value       = module.vpc.alb_security_group_id
}

output "fargate_security_group_id" {
  description = "Fargate security group"
  value       = module.vpc.fargate_security_group_id
}
