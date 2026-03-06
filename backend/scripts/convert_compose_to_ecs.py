import json

from container_transform.converter import Converter
from fire import Fire

DEFAULT_MEMORY = 1024
CONTAINER_TO_MEMORY_MAPPING = {
    "django": 2048,
    "celeryworker": 2048,
}
AWS_EB_DOCKERRUN_VERSION = 2


def convert_compose_to_ecs(
    input_file: str, output_file: str = "Dockerrun.aws.json"
) -> None:
    print(f"loading from {input_file}")
    converter = Converter(
        input_file,
        input_type="compose",
        output_type="ecs",
    )
    ecs_config = json.loads(converter.convert())
    ecs_config["AWSEBDockerrunVersion"] = AWS_EB_DOCKERRUN_VERSION
    for idx, container in enumerate(ecs_config["containerDefinitions"]):
        name = container["name"]
        memory = CONTAINER_TO_MEMORY_MAPPING.get(name, DEFAULT_MEMORY)
        ecs_config["containerDefinitions"][idx]["memory"] = memory
    print(f"writing to {output_file}")
    with open(output_file, "w") as f:
        json.dump(ecs_config, f, indent=2)


if __name__ == "__main__":
    Fire(convert_compose_to_ecs)
