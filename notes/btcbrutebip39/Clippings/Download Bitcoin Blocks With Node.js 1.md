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

Yes — with that clarification, your design can be **considerably simpler** than a full UTXO index.

The key is that you don't care about reconstructing transaction history. You care about maintaining a **current address state**:

```
address
balance
last sending transaction
script type
```

So you can discard almost everything else.

### Your database

```
btcAddresses
────────────────────────────────
address           TEXT PRIMARY KEY
balanceSats       TEXT
lastTransaction   INTEGER
scriptType        TEXT
```

And metadata:

```
metadata.json
────────────────────────────────
{
    "currentBlock": 950321,
    "currentBlockHash": "...",
    "updatedAt": 178...
}
```

I'd actually store **both height and hash** in the checkpoint. The hash lets you verify that the chain hasn't changed at your checkpoint before resuming.

---

You're right that you don't care **where** the BTC went or the transaction's overall details.

But there is still one thing you must resolve:

```
input
   ↓
previous transaction output
   ↓
address + value
```

You need the previous output's **value** because that's what you subtract from the address's balance.

You don't need to retain the previous transaction afterward.

So your processing can effectively be:

```
Input
 │
 ▼
resolve previous output
 │
 ├── owner address
 └── valueSats
       │
       ▼
is address in DB?
   │          │
  NO         YES
              │
              ▼
       balanceSats -= valueSats
              │
              ▼
       lastSendingTx = tx.time
```

You don't need:

```
destination
fee
transaction amount
transaction ID
input history
output history
```

unless you decide you want those later.

---

## But there's a useful simplification

Because your database contains **only addresses you're interested in**, you don't actually need to resolve every input's address.

You can optimize:

```
input
  ↓
previous txid + vout
  ↓
lookup previous output
  ↓
is its address in our DB?
```

If it isn't:

```
discard
```

If it is:

```
subtract value
update last sending transaction
```

This means your scanner can keep its working state extremely small.

---

## Your address lifecycle is also straightforward

What you're describing is essentially:

```
┌──────────────┐
        │ address not  │
        │ in database  │
        └──────┬───────┘
               │
        receives BTC
               │
               ▼
        ┌──────────────┐
        │ INSERT       │
        │ balance > 0  │
        └──────┬───────┘
               │
      ┌────────┴────────┐
      │                 │
   receives           spends
      │                 │
      ▼                 ▼
balance += X      balance -= X
                        │
                        ▼
                 balance == 0?
                    /       \
                  YES        NO
                   │          │
                   ▼          ▼
                DELETE      UPDATE
```

Then if that address receives BTC again later:

```
not in DB
   ↓
receive positive output
   ↓
INSERT
```

That's perfectly compatible with your objective.

---

## One important correction regarding lastTransaction

Since you specifically want **last sending transaction**, I'd rename it:

```
lastSendingTransaction
```

rather than:

```
lastTransaction
```

because otherwise you'll eventually forget whether it means:

```
last transaction of any kind
```

or:

```
last transaction where this address spent BTC
```

So I'd use:

```
btcAddresses
────────────────────────────────
address               TEXT PRIMARY KEY
balanceSats            TEXT
lastSendingTransaction INTEGER
scriptType             TEXT
```

You could store the **transaction timestamp** there, as you suggested, or the transaction ID if you ever want to resolve the transaction externally later.

Personally, I'd consider:

```
lastSendingTime
```

even clearer if you're storing Unix time.

---

## Your balanceSats as TEXT idea

That's reasonable if you want to eliminate any possibility of numeric precision problems across your JavaScript/database boundary.

Bitcoin amounts are integers in satoshis:

```
1 BTC = 100,000,000 sats
```

So:

```
"125000000"
```

can later become:

```
1.25 BTC
```

without floating-point issues **during the balance accounting**.

I'd keep the arithmetic in integer-safe form, though. JavaScript's `Number` is safe for integers only up to:

```
9,007,199,254,740,991
```

and Bitcoin's maximum supply in satoshis is only about:

```
2.1 × 10^15 sats
```

so a **single Bitcoin balance is actually safely representable as a JS Number**.

Therefore you don't strictly need strings for precision here.

That said, using strings can still be a deliberate storage convention, especially if you want a strict "integer amount represented as decimal text" model.

Your `isInBTC` flag is probably unnecessary, though.

I'd keep the canonical value:

```
balanceSats
```

and convert for display:

```
balanceBtc = sats / 100_000_000
```

You don't really gain anything by having:

```
balanceSats
isInBTC
```

because the unit is already defined by the column name.

---

## One thing I'd change about your metadata

Rather than just:

```
currentBlock
```

I'd use:

```
{
    "lastProcessedHeight": 950321,
    "lastProcessedHash": "...",
    "updatedAt": 178...
}
```

Then your restart is:

```
metadata
   ↓
lastProcessedHeight
   ↓
+ 1
   ↓
getblockhash(height)
   ↓
process block
   ↓
commit database changes
   ↓
update metadata
```

### The ordering matters

You want:

```
process block
      ↓
COMMIT database
      ↓
update checkpoint
```

**not:**

```
update checkpoint
      ↓
process block
```

Otherwise a crash could produce:

```
metadata says:
block 950321 processed

database actually:
block 950320 processed
```

and you'd skip a block when restarting.

Even better, you can make the database update and checkpoint update part of the same SQLite transaction if you eventually move metadata into SQLite. But your JSON metadata approach is perfectly workable as long as you update it **after successful processing/commit**.

---

## So your actual scanner can remain very lean

```
Bitcoin Core
     │
     ▼
  Block N
     │
     ▼
 transactions
     │
     ├───────────────┐
     ▼               ▼
  outputs           inputs
     │               │
     │               ▼
     │        resolve previous
     │          output/value
     │               │
     ▼               ▼
 receiving         spending
     │               │
     └───────┬───────┘
             ▼
       address lookup
             │
             ▼
       btcAddresses
             │
      ┌──────┴──────┐
      ▼             ▼
   balance > 0   balance = 0
      │             │
    UPDATE        DELETE
      │
      ▼
  next block
```

And that's it.

You aren't building a blockchain explorer, transaction database, UTXO explorer, or historical address index. You're essentially building a **compact materialized view of the current state of selected Bitcoin addresses**, populated by walking the historical chain.

That is a much more manageable dataset and fits your stated goal very well.

---

**You said**

transaction date is fine no need for further resolution later ok ill just use a number then, it should be fine yeah ill just keep it in sats, compressing into btc for larger values wouldnt really make much of an impact on db size anyway tbf yeah fair enough ill use lastProcessedHeight, hash, updatedAt, not difficult and better yeah ill just do it in json, no need for more than 1 table especially for a single row

---

**ChatGPT said**

Yep, that gives you a nicely minimal design. 👍

I'd settle on:

### btcAddresses

```
btcAddresses
────────────────────────────────────
address                  TEXT PRIMARY KEY
balanceSats              INTEGER
lastSendingTransaction   INTEGER
scriptType               TEXT
```

Where:

- `address` → Bitcoin address
- `balanceSats` → current reconstructed balance in satoshis
- `lastSendingTransaction` → Unix timestamp of the most recent transaction in which the address spent BTC
- `scriptType` → `P2PKH`, `P2SH`, `P2WPKH`, `P2WSH`, `P2TR`, etc.

And:

### metadata.json

```json
{
  "lastProcessedHeight": 950321,
  "lastProcessedHash": "000000...",
  "updatedAt": 1784871234
}
```

That's all you really need.

### Processing lifecycle

```
metadata.json
                │
                ▼
       lastProcessedHeight
                │
               +1
                │
                ▼
           Bitcoin Core
                │
            getblock()
                │
                ▼
             Block N
                │
        ┌───────┴───────┐
        ▼               ▼
     outputs          inputs
        │               │
     receive          spend
        │               │
        └───────┬───────┘
                ▼
          address lookup
                │
       ┌────────┴────────┐
       ▼                 ▼
   address exists    address absent
       │                 │
       ▼                 └── discard
    UPDATE
       │
       ▼
 balance / timestamp
       │
       ▼
  SQLite COMMIT
       │
       ▼
update metadata.json
       │
       ▼
    N + 1
```

And when:

```
balanceSats === 0
```

you delete the address. If a later block sends BTC to that address, it gets inserted again.

One subtle point worth preserving in your implementation: **a receiving transaction should not overwrite `lastSendingTransaction`**. Only an input spend associated with that address should update that field.

This keeps the database exactly focused on the state you're interested in, without accumulating historical data you don't need.

---

**You said**

"updatedAt": 1784871234 // is this the time of update? that isnt necessary if it is, i probably wont use that

---

**ChatGPT said**

Correct. `updatedAt` would simply be **the time your scanner last updated the metadata file**. It isn't related to the Bitcoin blockchain itself.

For example:

```json
{
  "lastProcessedHeight": 950321,
  "lastProcessedHash": "000000..."
}
```

is sufficient for your purpose.

You already have the information you actually need:

- **`lastProcessedHeight`** → where to resume
- **`lastProcessedHash`** → verify the checkpoint corresponds to the expected chain
- No need for `updatedAt` unless you later want monitoring/logging such as "when did my scanner last run?"

So I'd keep the metadata exactly that small.