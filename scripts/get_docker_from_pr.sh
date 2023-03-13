#!/bin/bash

set -Eeuo pipefail

TARGET_DIR=${TARGET_DIR:-"./pr_$PR"}

get_docker_tag() {
    curl -s https://github.com/DeFiCh/ain/pull/$PR/checks | grep "Dev Build" -B 1 | grep href | awk '{print $2}' | sed 's/.*"\(.*\)".*/\1/' | xargs -I{} curl -s https://github.com\{\} | grep HEAD | grep linux | sed 's/.*defichain-\(.*\)-x86.*/\1/'
}

get_binary_from_docker() {
    local DOCKER_TAG=$(get_docker_tag)
    local CONTAINER_ID=$(docker run -d defi/defichain:$DOCKER_TAG)

    echo "DOCKER_TAG : $DOCKER_TAG"
    echo "CONTAINER_ID : $CONTAINER_ID"

    docker cp $CONTAINER_ID:/app/bin $TARGET_DIR
    docker stop $CONTAINER_ID
}

get_binary_from_docker
