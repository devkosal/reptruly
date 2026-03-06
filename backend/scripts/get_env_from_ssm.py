#!/usr/bin/env python3
"""
Fetch environment variables from AWS SSM Parameter Store.

Usage:
    python scripts/get_env_from_ssm.py local .env
    python scripts/get_env_from_ssm.py production .env
"""

import os

import boto3
from fire import Fire

ssm_client = boto3.client("ssm")
APP_NAME = "reptruly"
ENVS = {"local", "production"}


def build_env_config(base_path: str) -> dict:
    """Fetch all parameters under a given path prefix."""
    env_config = {}
    next_token = ""
    while next_token is not None:
        kwargs = {
            "Path": base_path,
            "MaxResults": 10,
            "WithDecryption": True,
        }
        if next_token:
            kwargs["NextToken"] = next_token
        parameters_response = ssm_client.get_parameters_by_path(**kwargs)
        parameters = parameters_response["Parameters"]
        next_token = parameters_response.get("NextToken")
        for parameter in parameters:
            name = parameter["Name"].split("/")[-1]
            value = parameter["Value"]
            env_config[name] = value
    return env_config


def get_env_from_ssm(env: str, output_file: str = ".env") -> None:
    """
    Fetch environment variables from AWS SSM and write to .env file.

    Args:
        env: Environment name (local or production)
        output_file: Output .env file path (default: .env)

    Raises:
        ValueError: if invalid env is passed
    """
    if env not in ENVS:
        raise ValueError(f"env must be one of {ENVS}. not {env}")
    print(f"loading {env} parameters into {output_file}")
    common_base_path = f"/{APP_NAME}/common/"
    env_base_path = f"/{APP_NAME}/{env}/"
    env_config = build_env_config(common_base_path) | build_env_config(env_base_path)
    print(f"loaded {len(env_config)} parameters from aws ssm")
    with open(output_file, "w") as f:
        for name, value in env_config.items():
            f.write(f"{name}={value}\n")


if __name__ == "__main__":
    Fire(get_env_from_ssm)
