variable "app_name" {
  description = "Application name"
  type        = string
}

variable "environment" {
  description = "Environment"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}
variable "private_subnet_id" {
  description = "Private subnet ID for Fargate"
  type        = string
}

variable "fargate_security_group_id" {
  description = "Security group ID for Fargate"
  type        = string
}

variable "fargate_role_arn" {
  description = "IAM role ARN for Fargate"
  type        = string
}

variable "alb_security_group_id" {
  description = "ALB security group ID"
  type        = string
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3333
}

variable "container_image" {
  description = "Docker image for Fastify API"
  type        = string
  default     = "189761005421.dkr.ecr.us-east-1.amazonaws.com/marka-api:latest"
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for ALB"
  type        = list(string)
}

variable "certificate_arn" {
  description = "ACM certificate ARN for the HTTPS listener"
  type        = string
}

variable "ecr_repository_url" {
  description = "ECR repository URL (no tag)"
  type        = string
  default     = "189761005421.dkr.ecr.us-east-1.amazonaws.com/marka-api"
}

variable "image_tag" {
  description = "Image tag to deploy"
  type        = string
}
