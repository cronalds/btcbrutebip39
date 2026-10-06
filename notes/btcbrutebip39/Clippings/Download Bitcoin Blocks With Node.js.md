---
title: "Download Bitcoin Blocks With Node.js"
source: "https://chatgpt.com/c/6ab8aed0-5904-83ec-90fb-bbd990e76038"
author:
published:
created: 2026-09-27
description: "ChatGPT conversation with 4 messages"
tags:
  - "clippings"
---
**You said**

ok, i need to download the btc blockchain in chunks of 1 block at a time to process and yield the appropriate data that i need, can i do this through js and node?

---

**ChatGPT said**

Yes. **Node.js is capable of downloading and processing Bitcoin blocks one at a time**, and for what you're trying to do, that can actually be a sensible architecture.

The important distinction is that you generally **don't want to download the entire blockchain as one huge file**. You want to obtain a block by height/hash, process it, extract the fields you need, persist the result, then move to the next block.

A basic pipeline would look like:

```
Bitcoin blockchain
       │
       ▼
  Block 0
       │
       ├── download
       ├── parse
       ├── extract required data
       ├── save to SQLite
       └── discard raw block
       │
       ▼
  Block 1
       │
       ├── download
       ├── parse
       ├── extract
       ├── save
       └── discard
       │
       ▼
     ...
       │
       ▼
  Block N
```

### There are two main ways to do it

| Method | Node.js | Internet dependency | Full blockchain access | Best for |
| --- | --- | --- | --- | --- |
| Bitcoin Core RPC | ✅ | Only initially/syncing | ✅ | Serious large-scale processing |
| Public block APIs | ✅ | ✅ | Partial | Small/experimental processing |
| Download `.blk` files | ✅ | No API required | ✅ | Direct blockchain parsing |
| Electrum-style servers | ✅ | ✅ | Transaction/block data | Targeted queries |

For **your particular project**, I'd strongly consider **Bitcoin Core + JSON-RPC**, rather than repeatedly downloading blocks from random public APIs.

---

## Bitcoin Core gives you exactly the interface you want

If you run a Bitcoin Core node locally, Node can communicate with it through its RPC interface.

Conceptually:

```
Node.js
   │
   │ JSON-RPC
   ▼
Bitcoin Core
   │
   ├── getblockcount
   ├── getblockhash
   ├── getblock
   ├── getrawtransaction
   └── ...
```

You could then do:

```
height = 0

while (height <= currentHeight) {

    blockHash = getblockhash(height)

    block = getblock(blockHash, verbosity=2)

    processBlock(block)

    saveResults()

    height++
}
```

And importantly, **you don't have to retain the entire block in memory** after processing it.

---

## What you can extract from each block

A block contains a lot of useful information.

For example:

```
Block
│
├── blockHash
├── previousBlockHash
├── height
├── timestamp
├── difficulty
├── nonce
├── version
├── merkleRoot
│
└── transactions[]
       │
       ├── txId
       ├── version
       ├── lockTime
       │
       ├── inputs[]
       │    ├── previousTxId
       │    ├── previousOutputIndex
       │    ├── scriptSig
       │    ├── sequence
       │    └── witness
       │
       └── outputs[]
            ├── value
            ├── scriptPubKey
            └── addresses
```

You can then transform that into your own compact database.

For example:

```
blocks
────────────────────────
height
hash
previousHash
timestamp
txCount
size
weight
difficulty

transactions
────────────────────────
txId
blockHeight
blockHash
timestamp
version
lockTime

inputs
────────────────────────
txId
inputIndex
previousTxId
previousOutputIndex
sequence

outputs
────────────────────────
txId
outputIndex
valueSats
scriptType
scriptPubKey
address
```

That is much more useful than keeping raw blockchain data indefinitely.

---

## One important complication

If your ultimate objective is something like:

> "Find all activity associated with addresses derived from a seed phrase"

then you **do not necessarily need to download/process every transaction in the entire blockchain** depending on what information you're trying to recover.

You previously mentioned your:

```
BIP39
  ↓
BIP32
  ↓
derivation paths
  ↓
private/public keys
  ↓
Bitcoin addresses
  ↓
has activity?
  ↓
get history
```

For that use case, there are two very different architectures.

### Architecture A — scan the blockchain

```
Bitcoin blockchain
       ↓
every block
       ↓
every transaction
       ↓
every output
       ↓
extract addresses
       ↓
compare against your addresses
       ↓
match
```

This gives you **complete historical coverage**, but is enormous.

### Architecture B — query known addresses

```
BIP39 seed
   ↓
derive addresses
   ↓
known address set
   ↓
query blockchain index
   ↓
has activity?
   ↓
retrieve matching transactions
```

This is dramatically smaller if you only care about a relatively small set of addresses.

---

## If you actually want your own blockchain dataset

Then I would structure your Node project something like:

```
btcBlockchain/
│
├── src/
│   ├── bitcoinRpc.js
│   ├── blockProcessor.js
│   ├── transactionProcessor.js
│   ├── scriptParser.js
│   ├── database.js
│   └── index.js
│
├── data/
│   └── bitcoin.db
│
└── config.js
```

And the processing flow:

```
┌─────────────────┐
         │ Bitcoin Core    │
         └────────┬────────┘
                  │
             getblockhash
                  │
                  ▼
           ┌──────────────┐
           │ Block height │
           └──────┬───────┘
                  │
              getblock
                  │
                  ▼
          ┌───────────────┐
          │ Block parser  │
          └───────┬───────┘
                  │
      ┌───────────┴───────────┐
      ▼                       ▼
Transactions               Metadata
      │
      ▼
Inputs / Outputs
      │
      ▼
Script extraction
      │
      ▼
   SQLite
      │
      ▼
next block
```

You can also make it **restartable**.

For example:

```
processingState
────────────────────
lastProcessedHeight
lastProcessedHash
updatedAt
```

Then if your computer crashes at:

```
height = 425,381
```

you restart from there rather than beginning at block 0.

---

## And you can process one block at a time

You don't need:

```
download 1 TB+
       ↓
load into RAM
       ↓
process
```

You can instead have:

```
block N
  ↓
process
  ↓
SQLite
  ↓
release memory
  ↓
block N+1
```

Memory usage can therefore remain relatively stable even though the **total historical dataset is enormous**.

### One thing I'd change from "download"

If you're building this seriously, I'd distinguish between:

**Acquiring blocks**

and

**processing blocks**.

Bitcoin Core already stores the blockchain locally. Your Node program can ask it:

```
"Give me block 900000"
```

rather than repeatedly downloading that block over the public internet.

That gives you a much more reliable pipeline:

```
┌─────────────────────┐
│    Bitcoin Core     │
│ local blockchain    │
└──────────┬──────────┘
           │ RPC
           ▼
┌─────────────────────┐
│      Node.js        │
│  block processor    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│       SQLite        │
│ processed dataset   │
└─────────────────────┘
```

**So yes: Node.js is absolutely suitable for this.** In fact, given that you're already using Node/JavaScript for your Bitcoin tooling, you can keep essentially the entire acquisition → parsing → transformation → database pipeline in JS.

If your goal is specifically to build a **local Bitcoin blockchain scanner for your seed-derived addresses**, the next important decision is whether you want **Bitcoin Core's RPC interface or direct parsing of the `.blk` files**. Those have substantially different storage, speed, and implementation tradeoffs.

---

**You said**

ill use btc core rpc to get each block then ill process it and discard it and increment, then ill use electrum style servers for queries later on with up to date rt data for specific things such as balance etc ok, what js libs will i need to use btc core rpc?

---

**ChatGPT said**

Yes — and your architecture makes sense:

```
Bitcoin Core
    │
    │ RPC
    ▼
Node.js
    │
    ├── get block N
    ├── process block N
    ├── write required data
    ├── release block N
    │
    └── N++
          │
          ▼
      next block

Later:
Node.js
    │
    ▼
Electrum servers
    │
    ├── address balance
    ├── UTXOs
    ├── history
    └── current/mempool information
```

### For Bitcoin Core RPC, you actually need very little

The easiest option is the **`bitcoin-core` npm package**. It is specifically an RPC/REST client for Bitcoin Core and exposes the Core RPC methods through a Promise-based API. [^1]

[^2]

Install:

```
npm install bitcoin-core
```

Then your core stack can essentially be:

| Library | Purpose | Need? |
| --- | --- | --- |
| `bitcoin-core` | Bitcoin Core JSON-RPC client | **Yes** |
| `better-sqlite3` | Store your processed blockchain data | **Yes, for your project** |
| Node `fs/promises` | Files/checkpoints/logs | Optional |
| Node `crypto` | Hashing/crypto utilities | Optional |
| `bitcoinjs-lib` | Bitcoin scripts, addresses, transactions | **Probably yes** |
| `tiny-secp256k1` | secp256k1 operations | Already relevant to your wallet work |
| `bip39` | Seed phrases | Only for your wallet/derivation side |
| `bip32` | HD derivation | Only for your wallet/derivation side |

You **do not need a special Bitcoin blockchain parser library just to retrieve blocks through RPC**.

---

## The important RPC methods for your scanner

Bitcoin Core provides the exact operations you'll need.

### 1\. Get current blockchain height

```
getblockcount
```

This returns the height of the most-work fully validated chain. The genesis block is height `0`. [^3]

Conceptually:

```
currentHeight = await client.getBlockCount()
```

---

### 2\. Convert height → block hash

```
getblockhash(height)
```

Bitcoin Core explicitly provides this for retrieving the hash of the block at a particular height. [^3]

So:

```
height
  ↓
getblockhash(height)
  ↓
blockHash
```

---

### 3\. Get the block

Then:

```
getblock(blockHash, 2)
```

This is particularly important for your project because Bitcoin Core supports different verbosity levels:

```
verbosity 0
    ↓
raw serialized block

verbosity 1
    ↓
block metadata + transaction IDs

verbosity 2
    ↓
block metadata + full transaction information
```

Bitcoin Core documents `getblock` verbosity `2` as returning the block information **and information about each transaction**. [^3]

For your initial implementation, I'd use **verbosity 2**.

---

## Your scanner therefore becomes very simple

```
getblockcount()
      │
      ▼
currentHeight
      │
      ▼
for height = startingHeight → currentHeight
      │
      ▼
getblockhash(height)
      │
      ▼
getblock(hash, 2)
      │
      ▼
processBlock(block)
      │
      ▼
SQLite
      │
      ▼
discard block
      │
      ▼
height++
```

And I'd make the processing function completely independent of the RPC client:

```
RPC layer
    ↓
raw Bitcoin Core block
    ↓
block processor
    ↓
normalized records
    ↓
database
```

That separation will make your system considerably easier to maintain.

---

## One important consideration: bitcoinjs-lib

You already have:

```
bip39
bip32
tiny-secp256k1
bitcoinjs-lib
```

from your wallet project.

I'd keep those.

The distinction is:

### Bitcoin Core

Handles:

```
blockchain
blocks
transactions
UTXO state
chain state
mempool
block headers
```

### bitcoinjs-lib

Handles things such as:

```
Bitcoin scripts
addresses
transaction structures
script parsing
script → address interpretation
address → output script
transaction construction
```

So your architecture could eventually look like:

```
Bitcoin Core
               │
          JSON-RPC
               │
               ▼
         ┌───────────┐
         │  Node.js  │
         └─────┬─────┘
               │
      ┌────────┴────────┐
      │                 │
      ▼                 ▼
Block processor     Script parser
      │                 │
      │           bitcoinjs-lib
      │                 │
      └────────┬────────┘
               ▼
            SQLite
```

---

## One thing I'd change in your original plan

You said:

> download each block then process it and discard it

Conceptually that's right, but with Bitcoin Core you're not really **downloading the block from the internet each time**.

Bitcoin Core has already downloaded and validated the blockchain and stores it locally.

Your Node program is essentially saying:

```
"Bitcoin Core, give me block 900000."
```

Bitcoin Core retrieves it from its local blockchain storage and sends the result over localhost RPC.

That's a much better arrangement.

---

## You should also consider pruning

There's an important Bitcoin Core configuration decision here.

If your objective is:

```
scan historical blocks
      ↓
extract your data
      ↓
discard processed block
```

you need to be careful about **pruned mode**.

A pruned Bitcoin Core node deletes old block data after it no longer needs it. Bitcoin Core exposes pruning information and block availability through its blockchain functionality. [^3]

For a **full historical scanner from genesis → current**, I'd therefore plan around a **non-pruned node**.

Otherwise you could eventually reach:

```
height 700,000
       ↓
"give me block 100,000"
       ↓
block data no longer available locally
```

That's exactly what you don't want.

---

## Your initial npm stack

I'd start with:

```
bitcoin-core
better-sqlite3
bitcoinjs-lib
tiny-secp256k1
bip39
bip32
```

But conceptually divide them into two groups:

### Blockchain scanner

```
bitcoin-core
better-sqlite3
bitcoinjs-lib
```

### Wallet/address derivation

```
bip39
bip32
tiny-secp256k1
bitcoinjs-lib
```

You don't need BIP39/BIP32 just to scan Bitcoin blocks.

---

### One more thing worth planning now

Because you're going to potentially process **hundreds of thousands to millions of transactions**, I'd make the scanner **checkpointable from day one**:

```
scannerState
────────────────────
lastProcessedHeight
lastProcessedHash
lastProcessedAt
```

Then:

```
Start
  ↓
read checkpoint
  ↓
height = checkpoint + 1
  ↓
get block
  ↓
process
  ↓
commit SQLite transaction
  ↓
update checkpoint
  ↓
next block
```

That means a crash at block `950,321` doesn't cost you weeks of processing.

Also, **don't process blocks concurrently initially**. One block at a time gives you a very clean transactional model; once it's working correctly, you can benchmark whether batching RPC calls or other optimizations are worthwhile.

[^1]: [npmjs.com](https://www.npmjs.com/package/bitcoin-core?activeTab=versions&utm_source=chatgpt.com)

[^2]: [npmjs.com](https://www.npmjs.com/package/bitcoin-core?utm_source=chatgpt.com)

[^3]: [doxygen.bitcoincore.org](https://doxygen.bitcoincore.org/blockchain_8cpp_source.html?utm_source=chatgpt.com)