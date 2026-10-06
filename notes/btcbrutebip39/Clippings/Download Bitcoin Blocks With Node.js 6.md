---
title: "Download Bitcoin Blocks With Node.js"
source: "https://chatgpt.com/c/6ab8aed0-5904-83ec-90fb-bbd990e76038"
author:
published:
created: 2026-09-29
description: "ChatGPT conversation with 5 messages"
tags:
  - "clippings"
---
**ChatGPT said**

They don't necessarily come from the raw blockchain data as explicit `"address"` fields. The viewer **derives addresses from the scripts**.

There are two slightly different situations.

### What Bitcoin actually stores

At the protocol level, a transaction output is essentially:

```
value
scriptPubKey
```

For example:

```
value = 0.18 BTC

scriptPubKey =
76a91463d26086738fb8b037960e49245898ec23a8788388ac
```

There isn't inherently:

```
address = "1..."
```

inside that serialized transaction.

A blockchain explorer sees the script and recognizes:

```
76 a9 14 <20-byte hash> 88 ac
```

as P2PKH, extracts the hash, and encodes it into the corresponding Bitcoin address.

So:

```
blockchain
   ↓
transaction
   ↓
vout
   ├── value
   └── scriptPubKey
          ↓
       decode script
          ↓
       determine type
          ↓
       extract hash/key
          ↓
       encode as address
```

That's what explorers do.

---

### But Bitcoin Core can give you addresses

This is where your earlier transaction object can be confusing.

If you call Bitcoin Core with sufficiently detailed RPC output, Core can **decode the script for you** and return something like:

```json
{
  "value": 0.18,
  "scriptPubKey": {
    "asm": "OP_DUP OP_HASH160 ... OP_EQUALVERIFY OP_CHECKSIG",
    "hex": "76a91463d26086738fb8b037960e49245898ec23a8788388ac",
    "type": "pubkeyhash",
    "address": "1..."
  }
}
```

The `"address"` there is **decoded/indexed information supplied by Core's RPC representation**. It isn't an additional piece of data that was stored in the original transaction.

That's why you may see:

```
scriptPubKey.address
```

when using Bitcoin Core's JSON RPC, even though the raw transaction itself doesn't contain an address field.

---

### Inputs are different

This is the important part for your scanner.

A normal input looks conceptually like:

```
vin
├── txid
├── vout
├── scriptSig
└── sequence
```

There generally isn't an:

```
address
```

there either.

Instead:

```
vin
   │
   ├── txid ─────────┐
   └── vout          │
                     ▼
              previous transaction
                     │
                     ▼
              previous vout
                     │
              ┌──────┴──────┐
              │             │
            value       scriptPubKey
                            │
                            ▼
                         address
```

So if:

```
vin:
    txid = ABC...
    vout = 1
```

the explorer looks up transaction `ABC...`, gets output `1`, and sees:

```
value = 500000 sats
scriptPubKey = ...
```

It can then determine:

```
address = 1XYZ...
```

Therefore an explorer can display:

```
FROM:
1XYZ...
-0.005 BTC

TO:
bc1q...
+0.0049 BTC
```

even though those literal addresses weren't necessarily present in the transaction's serialized data.

---

### This fits your resolver idea exactly

Your scanner can essentially reproduce the important part:

```
OUTPUT
    ↓
scriptPubKey
    ↓
decode → address
    ↓
is address tracked?
    ↓
YES
    ↓
store:
txid:vout → {
    address,
    valueSats
}
```

Then later:

```
INPUT
    ↓
previousTxid + previousVout
    ↓
your trackedOutputs lookup
    ↓
{
    address,
    valueSats
}
    ↓
balance -= valueSats
```

And you **don't need to decode `scriptSig` to accomplish this**.

In fact, for your particular goal, I'd think of it this way:

```
BLOCKCHAIN
            │
       transactions
       /           \
    inputs        outputs
      │               │
txid + vout       value + script
      │               │
      │          decode script
      │               │
      └──────┐    address
             │       │
             ▼       ▼
          resolve tracked
             output
                │
                ▼
           balance update
```

So the explorer isn't magically getting addresses from somewhere else. **It's interpreting the Bitcoin scripts and following the input references to previous outputs.** That's the fundamental mechanism you're about to implement yourself.

---

**You said**

If you call Bitcoin Core with sufficiently detailed RPC output, Core can **decode the script for you** and return something like: xxx // ok so i can just get it to do that when im downloading the blocks in my js setup?

---

**ChatGPT said**

Exactly. That's probably the simplest approach for your scanner.

When your Node.js code asks Bitcoin Core for a block, request **verbosity 2**:

```
getblock(blockHash, 2)
```

Core will return the transactions with decoded transaction information, including the `scriptPubKey` details.

So instead of working with raw:

```
76a91463d26086738fb8b037960e49245898ec23a8788388ac
```

you can receive something along the lines of:

```
vout
├── value
└── scriptPubKey
      ├── asm
      ├── hex
      ├── type
      └── address
```

Then your processing becomes very straightforward:

```
get block
   ↓
transactions
   ↓
for each transaction
   ├── inputs
   │     └── txid + vout
   │            ↓
   │       resolve tracked output
   │
   └── outputs
         ├── address
         └── value
               ↓
          tracked address?
               ↓
          update balance
```

### One caveat

`scriptPubKey.address` isn't guaranteed to exist for **every possible Bitcoin output**. Some scripts are non-standard, unspendable, or represent script types where Core can't give you a conventional address.

For your BIP44/49/84/86-derived addresses, though, you're dealing with standard address/script types, so this is exactly the kind of decoding you want.

And importantly, **you don't need to generate the `scriptPubKey` yourself just to scan the blockchain**.

You can generate your tracked addresses from your BIP39/BIP32 process, put them in SQLite, and let Core decode the block outputs:

```
Your wallet side                 Blockchain side

BIP39                            Bitcoin Core
 ↓                                  ↓
BIP32                             block
 ↓                                  ↓
derivePath                       transaction
 ↓                                  ↓
address ←───────────────────── scriptPubKey → address
 ↓                                  ↓
SQLite                         compare addresses
```

So yes: **let Bitcoin Core do the script → address decoding while your JS scanner processes each block.** That saves you a lot of unnecessary script parsing code.

---

**You said**

`scriptPubKey.address` isn't guaranteed to exist for **every possible Bitcoin output**. Some scripts are non-standard, unspendable, or represent script types where Core can't give you a conventional address. /// non standard and unspendable?

---

**ChatGPT said**

Yeah. These are two related but different concepts.

### 1\. Standard vs non-standard

A **standard Bitcoin script** is a script that Bitcoin Core's policy recognizes as a normal transaction output type.

Examples include:

```
P2PKH    → 1...
P2SH     → 3...
P2WPKH   → bc1q...
P2WSH    → bc1q...
P2TR     → bc1p...
```

These have well-defined ways to represent them as addresses.

A **non-standard script** is an output whose `scriptPubKey` doesn't fit one of those recognized standard templates.

For example, someone can create an output containing a custom script such as:

```
<some custom Bitcoin Script>
```

The Bitcoin protocol can still validate it according to the Script rules, but Core's normal transaction-policy machinery may not treat it as a standard relayable output.

**Non-standard does not necessarily mean invalid.**

That's an important distinction:

```
standard
    ↓
normal recognized output

non-standard
    ↓
valid script may exist
but doesn't fit normal standard templates
```

---

### 2\. Unspendable is different

An **unspendable output** is one where the coins are effectively intentionally destroyed.

The classic example is:

```
OP_RETURN
```

For example:

```
OP_RETURN "Hello Bitcoin"
```

The output can contain arbitrary data, but the script is designed so that the output cannot be spent in the normal way.

You might see something conceptually like:

```
vout
├── value
└── scriptPubKey
      ├── type: nulldata
      └── asm: OP_RETURN ...
```

There isn't a normal Bitcoin address associated with that output because there isn't a recipient who can later satisfy the script and spend those coins.

If someone sends BTC to an `OP_RETURN` output, those sats are effectively burned.

---

### Why this matters for your scanner

Most outputs you'll encounter that are relevant to your BIP44/49/84/86 addresses will be normal standard outputs:

```
P2PKH
P2SH
P2WPKH
P2WSH
P2TR
```

So you can essentially do:

```
vout
  ↓
scriptPubKey.address exists?
  │
  ├── yes → process it
  │
  └── no → ignore it
```

You don't need to understand every weird Bitcoin script just to track your addresses.

And there's another useful distinction:

**"No `address` field" doesn't mean "unspendable."**

A script can be valid and spendable while simply not having a conventional address representation. So your scanner should really treat the absence of `address` as **"not an address I can process through this simple path"**, rather than assuming the coins are burned.