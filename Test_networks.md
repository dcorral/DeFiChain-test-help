# Testing networks and features

## 1. Mocknet

- Creates MN on initialization. 
- Enables Foundation like behaviour. (OCG, splits, create tokens, minttokens, consortium, adjust fees...)
- Ability to mint block on demand with `generatetoaddress`.
- Works with mainnet's data. 
- Only local node, no comunication with other nodes. Changes in mocknet will not affect other nodes.

##### Set of options:

- `-mocknet`: If present activates mocknet.
- `-mocknet-key=<pubkey>`: Provide an address that will be added to fundation members. 
- `-mocknet-blocktime=<seconds>`: (optional) Set a different blocktime, defaults to 30s.
- `-maxtipage=<n>`: (optional) Maximum tip age in seconds to consider node in initial block download. Defaults to 2207520000 (10 years)
- `-nnnnHeight=<n>`: Set specific activation heights for different forks. Handy for testing not yet active forks.

Note:
If gen=1 in .defi.conf a new antrance to `masternode_operator` is added automatically, so a MasterNode is created.
Otherwise we must initialize mocknet with `-masternode_operator=<address>`

##### Purpose

Mocknet is used to test node features with mainnet data. This way the node behaviour can be predicted when using large data sets. 
dStoks split is a good testing example. When a slipt is planned we can see how the node processes the current data in mainnet and what the final result after the split will be in all accounts, vaults, pools...

Mocknet generated blocks are invalid for mainnet, meaning any action runned by the node will only have effects locally.


#### Activation (TODO)

Mocknet patch can be applied for testing mocknet in mainnet (patch currently not working also not mandatory):

```shell
git apply contrib/devtools/mocknet.patch
```

1. Run `defid` and wait for node to sync to the last valid block on mainnet.
2. Get a new address in the wallet for mocknet
```shell
$ defi-cli getnewaddress
dKSyNQdRYuSTtJdZY6Xgkwx7J1K2XLg8M2
````
3. Stop `defid` and restart with:
```shell
$ defid -mocknet -mocknet-key=dKSyNQdRYuSJtjwZY6Xgkwx7J1K2XLg8M2
```

Now that mocknet is active we can generate new blocks on demand with `generatetoaddress`:
```shell
$ defi-cli getnewaddress
dLsKNQdRYuSUtJdZY6Xskwx7J1K2XLg9n1

```

## 2. Regtest

- Clean network. 
- Different rules apply to this network for the ease of testing.
- Ability to mint block on demand with `generatetoaddress`.
- Functional tests in ./test/functional written in python.
- JellyFishSDK JavaScript includes a frameworkd for testing in regtest (playground).
- DefiTestFramework in python.
- Create from scratch nodes and TX to test specific behaviour.

##### Set of options:

- `-simulatemainnet=1`: If present adjusts parameters to match mainnet behaviour (i.e FixedPricePeriod, Oracle rules TODO expand)
- `-jellyfish_regtest=1`: Main node with balance to avoid generating the necessary blocks.
- `-nnnnHeight=<n>`: Set specific activation heights for different forks.

##### Purpose

Regtest is used mainly for functional tests. Test data is created as needed for specific checks in a newly created empty network.
There is no interaction whatsoever with any other networks including other regtest networks. Once the tests are executed the network is removed.
This networks is handy for testing edge cases in which different RPCs might fall. 


#### Activation

1. Execute:
```shell
$ defid -regtest
````
2. In a new terminal:
```shell
$ defi-cli -regtest getblockcount
```

## 3. Devnet

- Network containig testnet data.
- Same rules of testnet apply to this network.
- Exclusive use for developers.
- Must be maintained by the developers
- Deployed on-demand to test RC and see the impact on the network (i.e spot chain splits)
- TBD Public|Private|Hybrid

Note: addnode command needs to be run in orther to connect to other devnet nodes or use `-addnode` flag

##### Set of options:

- `-devnet-bootstrap`: This flag will make the node sync all data into devnet. No need to run `-devnet` if this is set in `defid`
- `-devnet`: Connect to devnet (cli or daemon)

##### Purpose

Devnet is ment for developers to test the impact of new releases in a data populated chain. Nodes in this network will have to manually find othe nodes in the devnet network to generate traffic, thus maintainance need to be done by developers. Breaking devnet has no impact in other networks, leaving testnet and mainnet always stable. 

#### Activation

1. Execute and let the node sync (automatically syncs with testnet):
```shell
$ defid -devnet-bootstrap
````
2. In a new terminal:
```shell
$ defi-cli -devnet getblockcount
```

## 4. Testnet

- Maintainde by community.
- Same rules as in mainnet.
- Public.

##### Set of options:

- `-testnet`: Connect to devnet
- TODO (any other specific flags for testnet??)

##### Purpose

Testnet is a testing network for companies and developers building services and applications that need to interact with the network. This network needs to be stable and releases must ideally not be tested in this network.

#### Activation

1. Execute:
```shell
$ defid -testnet
````
2. In a new terminal:
```shell
$ defi-cli -testnet getblockcount
```

