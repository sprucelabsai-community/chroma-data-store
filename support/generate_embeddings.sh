#!/bin/bash

# Define usage/help message
usage() {
  echo "Usage: $0 [prompt] [--help]"
  echo
  echo "Arguments:"
  echo "  prompt     The text prompt to send to the embedding API."
  echo "  --help     Display this help message."
  exit 0
}

# Check if --help is passed
if [[ "$1" == "--help" ]]; then
  usage
fi

# Check if a prompt is provided
if [[ -z "$1" ]]; then
  echo "Error: No prompt provided."
  echo "Use --help for usage information."
  exit 1
fi

# Get the prompt argument
PROMPT="$1"

# Perform the API request
curl http://localhost:11434/api/embeddings -d "{
  \"model\": \"nomic-embed-text\",
  \"prompt\": \"$PROMPT\"
}"
