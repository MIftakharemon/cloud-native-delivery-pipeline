module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  name = "${var.cluster_name}-vpc"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "production"
  one_nat_gateway_per_az = var.environment == "production"

  enable_dns_hostnames = true
  enable_dns_support   = true

  enable_flow_log                      = true
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_iam_role             = true

  public_subnet_tags = {
    "kubernetes.io/role/elb"                       = 1
    "kubernetes.io/cluster/${var.cluster_name}"    = "owned"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"              = 1
    "kubernetes.io/cluster/${var.cluster_name}"    = "owned"
  }

  tags = {
    Environment = var.environment
    Project     = "cloud-native-delivery-pipeline"
    ManagedBy   = "Terraform"
  }
}
