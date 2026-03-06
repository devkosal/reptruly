import os
from collections.abc import Sequence
from pathlib import Path

from fire import Fire

BASE_DIR = Path(__file__).parent.resolve()
PRODUCTION_DOTENVS_DIR = BASE_DIR / ".envs" / ".production"
PRODUCTION_DOTENV_FILES = [
    PRODUCTION_DOTENVS_DIR / ".django",
    PRODUCTION_DOTENVS_DIR / ".postgres",
]
LOCAL_DOTENVS_DIR = BASE_DIR / ".envs" / ".local"
LOCAL_DOTENV_FILES = [
    LOCAL_DOTENVS_DIR / ".django",
    LOCAL_DOTENVS_DIR / ".postgres",
]
DOTENV_FILE = BASE_DIR / ".env"


def merge(
    output_file: Path,
    files_to_merge: Sequence[Path],
) -> None:
    merged_content = ""
    for merge_file in files_to_merge:
        merged_content += merge_file.read_text()
        merged_content += os.linesep
    output_file.write_text(merged_content)


def create_merged_env(
    output_file: str | Path = DOTENV_FILE,
    use_production: bool = True,
):
    if isinstance(output_file, str):
        output_file = Path(output_file)
    if not output_file.is_file():
        raise ValueError("a file path must be passed for the output.")
    if use_production:
        merge(output_file, PRODUCTION_DOTENV_FILES)
        return
    merge(output_file, LOCAL_DOTENV_FILES)


if __name__ == "__main__":
    Fire(create_merged_env)
