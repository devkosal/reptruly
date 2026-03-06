import yaml
from fire import Fire


def convert_build_yml_to_production(
    input_file: str = "production.yml", output_file: str = "production-aws.yml"
) -> None:
    with open(input_file) as file:
        build_config = yaml.safe_load(file)
    for service in build_config["services"]:
        service_config = build_config["services"][service]
        if "build" not in service_config:
            continue
        del service_config["build"]
    with open(output_file, "w") as file:
        yaml.dump(build_config, file)


if __name__ == "__main__":
    Fire(convert_build_yml_to_production)
