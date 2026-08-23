module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "19.21.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  cluster_security_group_additional_rules = {
    ingress_nodes_ephemeral_ports = {
      description = "Nodes to cluster API"
      protocol    = "tcp"
      from_port   = 1025
      to_port     = 65535
      type        = "ingress"
      self        = true
    }
  }

  node_security_group_additional_rules = {
    ingress_allow_access_from_control_plane = {
      type                          = "ingress"
      protocol                      = "tcp"
      from_port                     = 443
      to_port                       = 443
      source_cluster_security_group = true
      description                   = "Allow control plane to communicate with nodes"
    }

    egress_all = {
      type      = "egress"
      protocol  = "-1"
      from_port = 0
      to_port   = 0
      cidr_blocks = ["0.0.0.0/0"]
      description = "Allow all outbound traffic"
    }
  }

  eks_managed_node_groups = {
    application = {
      name           = "app-nodes"
      instance_types = var.node_instance_types

      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      disk_size = 50

      labels = {
        role        = "application"
        environment = var.environment
      }

      tags = {
        Environment = var.environment
        NodeType    = "application"
      }
    }
  }

  tags = {
    Environment = var.environment
    Project     = "cloud-native-delivery-pipeline"
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "eks_additional" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = module.eks.eks_managed_node_groups["application"].iam_role_name
}
