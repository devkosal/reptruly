#!/bin/bash
# load .env file from a path to .env i.e. $1
# https://gist.github.com/mihow/9c7f559807069a03e302605691f85572?permalink_comment_id=4494251#gistcomment-4494251\
ENV_VARS="$(cat $1 | awk '!/^\s*#/' | awk '!/^\s*$/')"

eval "$(
  printf '%s\n' "$ENV_VARS" | while IFS='' read -r line; do
    key=$(printf '%s\n' "$line"| sed 's/"/\\"/g' | cut -d '=' -f 1)
    value=$(printf '%s\n' "$line" | cut -d '=' -f 2- | sed 's/"/\\\"/g')
    printf '%s\n' "export $key=\"$value\""
  done
)"
