---
title: "Download Bitcoin Blocks With Node.js"
source: "https://chatgpt.com/c/6ab8aed0-5904-83ec-90fb-bbd990e76038"
author:
published:
created: 2026-09-27
description: "ChatGPT conversation with 5 messages"
tags:
  - "clippings"
---
**ChatGPT said**

Yes — **you've got the outputs part right**, but there is one important distinction with inputs.

### Outputs

For your purposes, you can reduce a normal output to:

```
{
    valueSats: btcToSats(vout.value),
    address: vout.scriptPubKey.address
}
```

Then:

```
balanceSats += valueSats
```

if that address is in your DB.

---

## Inputs: you do need some resolution

You **cannot simply treat an input as `-x` immediately**, because the input itself doesn't contain the amount or the address that owned the BTC.

It contains:

```
{
    txid: previousTransactionId,
    vout: previousOutputIndex
}
```

So:

```
vin
 │
 ├── txid
 └── vout
       │
       ▼
previous transaction
       │
       ▼
previous vout
       │
       ├── value
       └── address
```

You need that previous output to determine:

```
- valueSats
- address
```

### But you DON'T need to hold the entire transaction

That's the important distinction.

You don't need:

```
entire blockchain
    ↓
transaction history
    ↓
full transaction objects
```

You only need a way to resolve:

```
previousTxId + previousOutputIndex
             ↓
      value + address
```

---

## There's a very clean way to do this

As you process blocks sequentially, maintain a temporary **UTXO lookup**.

For every output you encounter:

```
TX A:vout 0
     │
     ├── address = bc1q...
     └── value = 50,000,000 sats
```

temporarily store:

```
TX A:0 → {
    address: "bc1q...",
    valueSats: 50000000
}
```

Then later:

```
TX B
vin[0]
    txid = TX A
    vout = 0
```

you can do:

```
lookup("TX A:0")
```

and get:

```
{
    address: "bc1q...",
    valueSats: 50000000
}
```

Then:

```
balanceSats -= 50000000
lastSendingTransaction = txTime
```

And because that output has now been spent:

```
delete("TX A:0")
```

So you're essentially maintaining a **temporary UTXO set**, not a transaction database.

---

## However, there's an even more important optimization for your use case

You don't necessarily need to store **every output**.

Your actual question is:

> "Does this output belong to an address I'm tracking?"

So when processing an output:

```
vout
 │
 ├── address
 └── value
      │
      ▼
Is address in btcAddresses?
```

If:

```
NO
```

you could potentially discard it.

If:

```
YES
```

you need to retain:

```
txid:vout → address + value
```

because that output may eventually be spent.

So your temporary resolver could contain **only UTXOs belonging to addresses currently in your database**.

```
OUTPUT
           │
           ▼
   address in DB?
     /         \
   NO           YES
   │             │
discard          ▼
           temporary UTXO
               lookup
```

Then when an input references that UTXO:

```
INPUT
 │
 └── txid:vout
       │
       ▼
 temporary UTXO lookup
       │
       ├── found
       │    │
       │    ├── balance -= value
       │    ├── lastSendingTransaction = time
       │    └── delete UTXO
       │
       └── not found
             │
             └── ignore
```

That's much closer to what you want.

---

## One caveat: addresses that hit zero

You said you'll remove an address when:

```
balanceSats === 0
```

That's fine for your main table, **but don't immediately discard its unresolved UTXOs** if there could be a later transaction spending them.

More importantly, if an address has multiple UTXOs:

```
Address A

UTXO 1 = 0.4 BTC
UTXO 2 = 0.6 BTC

balance = 1.0 BTC
```

and spends UTXO 1:

```
balance = 0.6 BTC
```

you keep the address.

If it spends both:

```
balance = 0
```

then you can remove the address **and its remaining tracked UTXOs**.

But if you're scanning chronologically, an address that reaches zero cannot receive again until a future output creates a new UTXO for it, at which point you can reinsert it.

---

## So your actual processing becomes

```
BLOCK
 │
 └── transactions
       │
       ├── inputs
       │     │
       │     └── resolve temporary UTXO
       │             │
       │             ▼
       │       tracked address?
       │             │
       │             ├── yes → balance -= value
       │             │          lastSendingTransaction = tx.time
       │             │
       │             └── delete UTXO
       │
       └── outputs
             │
             └── tracked address?
                    │
                    ├── yes → balance += value
                    │          store UTXO
                    │
                    └── no → discard
```

### And fees can be completely ignored

You don't need to calculate:

```
inputs - outputs = fee
```

because you're interested in the **address-level balance changes**, not the transaction's accounting.

---

### One important implementation detail

You should process **inputs before outputs within each transaction** conceptually, because an output created by a transaction cannot normally be spent by another transaction in the same block except through special cases involving coinbase maturity. Ordinary transactions can't spend an output created earlier in the same transaction.

But the bigger requirement is that your temporary UTXO lookup survives from:

```
Block N
```

through:

```
Block N+1
Block N+2
...
```

until the tracked output is eventually spent.

So yes: **you need temporary UTXO data, but you do not need to retain full transaction data.** That's the sweet spot for the compact scanner you're designing.

---

**You said**

ok, maybe ill do this 2 blocks at a time and then i wont have to create a temp store and i can resolve

---

**ChatGPT said**

Yeah, that can work, and it changes the tradeoff quite a bit.

If you process **two blocks as a unit**, you can use the second block to resolve inputs referring to outputs from the first block without maintaining a long-lived UTXO store.

For example:

```
Block N
  ├── outputs
  │     └── tracked address → save temporary output
  │
  └── inputs
        └── resolve against Block N-1 / Block N data

Block N+1
  ├── inputs
  │     └── resolve outputs created in Block N
  │
  └── outputs
        └── save temporarily
```

But there's an important limitation:

### The two-block window doesn't guarantee resolution

A transaction can spend an output created **thousands of blocks earlier**:

```
Block 100
  └── Address A receives 1 BTC
          ↓
       ... 500 blocks ...
          ↓
Block 600
  └── Address A spends 1 BTC
```

The input in block 600 only says:

```
previousTxId = transaction from block 100
previousOutputIndex = 0
```

So if you only retain two blocks, you can't resolve that input locally.

### However, there's a nice alternative for your particular project

Since you're only tracking a relatively small set of addresses, you could do:

```
Process block
    ↓
Outputs
    ↓
Tracked address?
    ├── YES → update balance
    │          and remember txid:vout temporarily
    │
    └── NO → discard

Inputs
    ↓
Does txid:vout belong to one of our tracked outputs?
    ├── YES → subtract value
    │          update lastSendingTransaction
    │          delete temporary record
    │
    └── NO → ignore
```

The temporary record only needs to exist **for as long as that UTXO remains unspent**.

So the real issue isn't the number of blocks you're retaining; it's the lifetime of the tracked UTXOs.

You have three practical choices:

| Approach | DB size | RPC calls | Complexity |
| --- | --- | --- | --- |
| Keep tracked UTXOs in memory | Tiny | Low | Low |
| Keep tracked UTXOs in SQLite | Small | Low | Medium |
| Resolve every input through Core | Tiny | Potentially huge | Medium |

For your scanner, **I'd lean toward the in-memory tracked-UTXO map** if you're scanning continuously from genesis in one run.

You don't need a "temporary store" containing all blockchain outputs. It can literally just be:

```
txid:vout
    ↓
tracked address
value in sats
```

So if you're tracking 500 addresses, you might only have a relatively small number of live UTXOs at any given time, rather than millions/billions of blockchain UTXOs.

The two-block idea is still useful for reducing memory, but **it can't by itself solve historical input resolution**.

---

**You said**

scriptPubKey is not needed just address associated to it and value, because then i could assign that value to the address, and as for outputs ill store them in an object and yeah ill have to track those so i can -x the balance of the sender and +x the balance of the receiver, i may make a different table in the sqlite db but an object should be fine if not maybe even a little more efficient, ill figure it out something like: out = {txID:{voutID:{address:addr, val:val}}} so that vins: in = {txID:{voutID:voutID}} -> sqliteUpdate(resolveOut(txID\[voutID\])); remove vout then that will be easy to handle, and i can remove txID when all vouts have been resolved

---

**ChatGPT said**

Yep — that is essentially the minimal resolver you need. 👍

I'd structure the concept slightly differently just to make the lookup/removal logic cleaner:

```
trackedOutputs
│
├── txId1
│   ├── 0 → { address: "bc1...", valueSats: 500000 }
│   └── 2 → { address: "1ABC...", valueSats: 200000 }
│
└── txId2
    └── 1 → { address: "bc1...", valueSats: 1000000 }
```

Then an input gives you:

```
vin
├── txId      ← previous transaction
└── vout      ← previous output index
```

So:

```
resolveOut(txId, vout)
        │
        ▼
trackedOutputs[txId][vout]
        │
        ├── address
        └── valueSats
```

Then:

```
SQLite:
    address.balanceSats -= valueSats
    address.lastSendingTransaction = blockTime

trackedOutputs:
    delete txId[vout]

    if txId has no remaining vouts:
        delete txId
```

And for outputs:

```
vout
├── value
└── scriptPubKey.address
        │
        ▼
    tracked address?
       │
    ┌──┴──┐
   yes    no
    │      │
    ▼      └── discard
balance += valueSats

trackedOutputs[txId][voutIndex] = {
    address,
    valueSats
}
```

### One important optimization

You **don't actually need to store every output**.

Only store outputs whose address is currently in your SQLite address table.

So:

```
Blockchain output
       │
       ▼
Is address tracked?
   │          │
  YES         NO
   │           │
   ▼           └── discard completely
SQLite + balance
   │
   ▼
trackedOutputs
```

That keeps the object extremely small.

### And your cleanup idea is correct

Suppose:

```
txABC:
    0 → Address A, 500 sats
    1 → Address B, 800 sats
    2 → Address A, 200 sats
```

Then:

```
vin spends txABC:1
```

becomes:

```
txABC:
    0 → ...
    2 → ...
```

Then:

```
vin spends txABC:0
```

becomes:

```
txABC:
    2 → ...
```

And finally:

```
vin spends txABC:2
```

becomes:

```
txABC → {}
```

so you can remove `txABC` entirely.

One subtle point: **process inputs before outputs within each transaction**. That handles a transaction that spends an old tracked UTXO and simultaneously creates a new tracked output, including change back to the same address.

So your overall transaction processing becomes roughly:

```
transaction
    │
    ├── inputs
    │     └── resolve previous tracked outputs
    │            └── subtract
    │
    └── outputs
          └── check tracked addresses
                 └── add + store resolver entry
```

That's a very lean design. You don't need `scriptPubKey` in your persistent resolver object; you only need to inspect it momentarily to determine the destination address.