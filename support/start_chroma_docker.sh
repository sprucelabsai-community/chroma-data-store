#!/bin/bash

docker pull chromadb/chroma

# Check if container "chroma" exists (stopped or running)
if [ "$(docker ps -aq -f name=chroma)" ]; then
    # If it exists but is not running, start it
    if [ ! "$(docker ps -q -f name=chroma)" ]; then
        docker start chroma
    fi
else
    # If it doesn’t exist, run a new container
    docker run -d -p 8000:8000 --name chroma chromadb/chroma
fi
