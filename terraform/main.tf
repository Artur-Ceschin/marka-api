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
}
