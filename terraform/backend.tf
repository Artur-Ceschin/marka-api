terraform {
  required_version = ">= 1.11"

  backend "s3" {
    bucket       = "marka-terraform-state-189761005421"
    key          = "marka-api/terraform.tfstate"
    profile     = "marka"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
