#!/bin/bash

set -Eeuo pipefail

setup_vars() {
    GCLOUD_ZONE=${GCLOUD_ZONE:-"europe-west1-b"}
    PROJECT=${PROJECT:-"br-blockchains-dev"}
    VM_SIZE_IN_GB=${VM_SIZE_IN_GB:-50}
    SSH="gcloud compute ssh $INSTANCE --project=$PROJECT --zone=$GCLOUD_ZONE"
    FETCH=${FETCH:-"wget"}
}

setup_latest_snapshot() {
    local SNAPSHOT=$(get_latest_snapshot)

    echo "SNAPSHOT: $SNAPSHOT"

    $SSH --command "\
    sudo su - defi -c \"\
    $FETCH https://defi-snapshots-europe.s3.eu-central-1.amazonaws.com/$SNAPSHOT &&\
    unzip -d .defi $SNAPSHOT
    \""
}

setup_latest_release() {
    local LATEST_RELEASE_VERSION=$(latest_release_version)
    local LATEST_RELEASE=$(get_release $LATEST_RELEASE_VERSION)
    local TARBALL="defichain-$LATEST_RELEASE_VERSION-x86_64-pc-linux-gnu.tar.gz"

    echo "LATEST_RELEASE: $LATEST_RELEASE"

    $SSH --command "\
    sudo su - defi -c \"\
    $FETCH $LATEST_RELEASE &&\
    tar -xvf $TARBALL\" &&\
    sudo cp /home/defi/defichain-$LATEST_RELEASE_VERSION/bin/* /usr/local/bin/"
}

create_instance() {
    gcloud compute instances create "$INSTANCE" --project="$PROJECT" --zone="$GCLOUD_ZONE" --machine-type=c2-standard-4 --network-interface=network-tier=PREMIUM,subnet=default --metadata=enable-oslogin=true --maintenance-policy=MIGRATE --provisioning-model=STANDARD --service-account=965426322273-compute@developer.gserviceaccount.com --scopes=https://www.googleapis.com/auth/devstorage.read_only,https://www.googleapis.com/auth/logging.write,https://www.googleapis.com/auth/monitoring.write,https://www.googleapis.com/auth/servicecontrol,https://www.googleapis.com/auth/service.management.readonly,https://www.googleapis.com/auth/trace.append --enable-display-device --create-disk=auto-delete=yes,boot=yes,device-name="$INSTANCE",image=projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220419,mode=rw,size="$VM_SIZE_IN_GB",type=projects/"$PROJECT"/zones/"$GCLOUD_ZONE"/diskTypes/pd-ssd --no-shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring --reservation-affinity=any

    sleep 60
}

create_defi_user() {
    $SSH --command "sudo useradd -m -d /home/defi -s /bin/bash defi && sudo bash -c 'echo \"defi ALL=(ALL) NOPASSWD:ALL\" >> /etc/sudoers'"
}

install_utils_dependencies() {
    $SSH --command "sudo apt-get update && sudo apt-get install wget jq aria2 unzip -y"
}

get_latest_snapshot() {
    curl -s https://defi-snapshots-europe.s3.eu-central-1.amazonaws.com/index.txt | grep snapshot | tail -n 1
}

get_release() {
    echo "https://github.com/DeFiCh/ain/releases/download/v$1/defichain-$1-x86_64-pc-linux-gnu.tar.gz"
}

latest_release_version() {
    curl -Ls https://github.com/defich/ain/releases/latest  | grep "title" | head -n 1 | awk '{print $2}' | cut -c 2-
}

start_mocknet() {
    echo "Args : $1"
    $SSH --command "\
    sudo su - defi -c \"\
    defid -daemon -debug=accountchange -masternode_operator=df1qu04hcpd3untnm453mlkgc0g9mr9ap39lyx4ajc -mocknet $1
    \""
}

main() {
    echo "Setting up a mocknet on instance $INSTANCE"
    setup_vars
    create_instance
    install_utils_dependencies
    create_defi_user
    setup_latest_snapshot
    setup_latest_release
    start_mocknet "-gen=0"
}

main "$@"
