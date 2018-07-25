#! /bin/bash
set -e

export ADMIRAL_ENV="/etc/shippable/admiral.env"
export BOOT_WAIT=10

__bootstrap_vault() {
	echo "Bootstraping vault server"
	echo "Waiting $BOOT_WAIT seconds for vault server to start"
	sleep $BOOT_WAIT

	source $ADMIRAL_ENV

	# TODO: need to be different for remote?
	export VAULT_ADDR='http://127.0.0.1:8200'

	# TODO: randomize this to use different keys
	vault unseal $VAULT_UNSEAL_KEY1

	vault unseal $VAULT_UNSEAL_KEY2

	vault unseal $VAULT_UNSEAL_KEY3

	#TODO
	# handle error if keys not present?
}


__bootstrap_vault
