#!/usr/bin/env python3
"""
Post environment variables to AWS SSM Parameter Store.

Usage:
    python scripts/post_env_to_ssm.py local
    python scripts/post_env_to_ssm.py production
"""

from tempfile import NamedTemporaryFile

import boto3
from dotenv import dotenv_values
from fire import Fire
from tqdm import tqdm

from merge_dotenvs_in_dotenv import create_merged_env

ssm_client = boto3.client("ssm")
APP_NAME = "reptruly"
ENVS = {"local", "production"}


def update_parameter(name, value, type="SecureString"):
    ssm_client.put_parameter(
        Name=name,
        Value=value,
        Type=type,
        Overwrite=True,
    )


def post_env_to_ssm(env: str) -> None:
    """
    Post environment variables from .envs files to AWS SSM.

    Args:
        env: Environment name (local or production)

    Raises:
        ValueError: if invalid env passed
    """
    if env not in ENVS:
        raise ValueError(f"env must be one of {ENVS}")
    use_production = env == "production"
    output_file = NamedTemporaryFile(mode="w", suffix=".env", delete=False)
    create_merged_env(output_file.name, use_production)
    env_values: dict = dotenv_values(output_file.name)
    output_file.close()
    for name, value in tqdm(env_values.items()):
        name = f"/{APP_NAME}/{env}/{name}"
        update_parameter(name, value or "")
        print(f"updated parameter {name}")


if __name__ == "__main__":
    Fire(post_env_to_ssm)
