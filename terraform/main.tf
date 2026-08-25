module "vpc" {
  source = "./modules/vpc"

  app_name    = var.app_name
  environment = var.environment
  aws_region  = var.aws_region
  vpc_cidr    = var.vpc_cidr
}

module "iam" {
  source = "./modules/iam"

  app_name    = var.app_name
  environment = var.environment
}

module "s3" {
  source = "./modules/s3"

  app_name    = var.app_name
  environment = var.environment
}

module "dynamodb" {
  source = "./modules/dynamodb"

  app_name    = var.app_name
  environment = var.environment
}

module "fargate" {
  source = "./modules/fargate"

  app_name                  = var.app_name
  environment               = var.environment
  aws_region                = var.aws_region
  vpc_id                    = module.vpc.vpc_id
  private_subnet_id         = module.vpc.private_subnet_id
  public_subnet_ids         = module.vpc.public_subnet_ids
  fargate_security_group_id = module.vpc.fargate_security_group_id
  alb_security_group_id     = module.vpc.alb_security_group_id
  fargate_role_arn          = module.iam.fargate_role_arn
  certificate_arn           = aws_acm_certificate.api.arn
  image_tag                 = var.image_tag
}

resource "aws_acm_certificate" "api" {
  domain_name       = "marka-api.markaplant.app"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

output "acm_validation" {
  value = {
    name  = tolist(aws_acm_certificate.api.domain_validation_options)[0].resource_record_name
    value = tolist(aws_acm_certificate.api.domain_validation_options)[0].resource_record_value
  }
}
