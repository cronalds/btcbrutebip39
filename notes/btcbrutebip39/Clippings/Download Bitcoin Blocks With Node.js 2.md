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

---

**You said**

└── transactions\[\] │ ├── txId ├── version ├── lockTime │ ├── inputs\[\] │ ├── previousTxId │ ├── previousOutputIndex │ ├── scriptSig │ ├── sequence │ └── witness │ └── outputs\[\] ├── value ├── scriptPubKey └── addresses /// go over this more, namely inputs and outputs

---

**ChatGPT said**

Absolutely. This is the part that matters most for your scanner, because **Bitcoin transactions don't directly say "Alice sent X BTC to Bob."** They work through **UTXOs**, with `inputs` consuming old outputs and `outputs` creating new ones.

Think of it as:

```
PREVIOUS TRANSACTIONS
        │
        ▼
 ┌─────────────┐
 │ old outputs │
 │   (UTXOs)   │
 └──────┬──────┘
        │
   consumed by
        │
        ▼
   TRANSACTION
   ┌───────────┐
   │  inputs   │
   │     ↓     │
   │  outputs  │
   └─────┬─────┘
         │
    creates
         ▼
  NEW UTXOs
```

## 1\. Outputs = where new BTC goes

An output (`vout`) essentially says:

> "Create a spendable amount of Bitcoin under this spending condition."

A simplified output looks like:

```json
{
  "value": 0.50000000,
  "n": 0,
  "scriptPubKey": {
    "type": "witness_v0_keyhash",
    "address": "bc1q..."
  }
}
```

The important pieces for **your scanner** are:

```
value
scriptPubKey
address
```

### value

Bitcoin Core may give you the value in BTC:

```
0.50000000 BTC
```

Internally Bitcoin uses satoshis:

```
50,000,000 sats
```

Your database can therefore do:

```
balanceSats += 50000000
```

---

### scriptPubKey

This is the actual Bitcoin locking script.

It defines the conditions that must be satisfied to spend the output.

For example, a modern P2WPKH output conceptually means:

```
"Whoever can provide the valid signature for this public-key hash
can spend this output."
```

The address is effectively a human-friendly representation of that locking condition.

That's why I mentioned earlier that **script type should ideally come from the script rather than simply examining the address prefix**.

---

### address

For standard address types, Bitcoin Core can provide the corresponding address in the `scriptPubKey` information.

For your purposes, that's extremely convenient:

```
output
   │
   ├── value
   └── address
          │
          ▼
    is address in DB?
       /       \
     yes        no
      │          │
      ▼          └── ignore
balance += value
```

So **outputs are the easy half of your scanner**.

---

## 2\. Inputs are fundamentally different

An input (`vin`) doesn't normally contain:

```
address
amount
```

Instead, it says:

> "I want to consume output #X from transaction Y."

For example:

```json
{
  "txid": "abc123...",
  "vout": 1,
  "scriptSig": {},
  "sequence": 4294967295
}
```

The important fields are:

```
txid
vout
```

These identify the **previous output being spent**.

Think:

```
Input
 │
 ├── txid
 │      │
 │      ▼
 │   previous transaction
 │
 └── vout
        │
        ▼
   specific output
```

So:

```
vin[0]

txid = AAA
vout = 1
```

means:

```
"Consume output #1 from transaction AAA."
```

---

## 3\. Example

Imagine transaction A:

```
TX A
─────────────────────────────

vout[0]
    0.3 BTC → Address X

vout[1]
    0.7 BTC → Address Y
```

These outputs are currently UTXOs.

Then transaction B comes along:

```
TX B
─────────────────────────────

vin[0]
    txid = TX A
    vout = 1
```

That means:

```
TX B
  │
  └── consumes TX A:vout[1]
                    │
                    ▼
                 0.7 BTC
                 Address Y
```

Therefore Address Y is spending **0.7 BTC**.

The input itself didn't tell us:

```
Address Y
0.7 BTC
```

It told us:

```
TX A
output 1
```

We have to resolve that reference.

---

## 4\. Outputs of the new transaction

Transaction B might then have:

```
TX B
─────────────────────────────

vin[0]
    consumes:
    TX A:vout[1]
    0.7 BTC

vout[0]
    0.6 BTC → Address Z

vout[1]
    0.099 BTC → Address Y

fee
    0.001 BTC
```

So:

```
TX B

┌─────────────────────┐
│ INPUT               │
│                     │
│ 0.700 BTC           │
│ from Address Y      │
└──────────┬──────────┘
           │
           │
     ┌─────▼─────┐
     │ TRANSACTION│
     └─────┬─────┘
           │
      ┌────┴─────┐
      │          │
      ▼          ▼
   0.600 BTC   0.099 BTC
   Address Z   Address Y

      0.001 BTC
         │
         ▼
        fee
```

So your scanner sees:

```
Input:
Address Y
-70000000 sats

Output:
Address Z
+60000000 sats

Output:
Address Y
+9900000 sats
```

Net result:

```
Address Y
-70,000,000
+9,900,000
─────────────
-60,100,000 sats
```

And the miner receives the 100,000-sat fee indirectly through the coinbase transaction.

---

## 5\. This explains Bitcoin's "change"

This is also why you'll frequently see an address appear in **both inputs and outputs of the same transaction**.

Suppose you have:

```
Address A
10 BTC
```

and want to send:

```
3 BTC
```

Bitcoin can't simply subtract 3 BTC from the existing UTXO.

Instead:

```
10 BTC UTXO
     │
     ▼
   INPUT
     │
     ▼
┌───────────────┐
│  transaction  │
└───────┬───────┘
        │
        ├── 3 BTC → recipient
        │
        └── 6.99 BTC → change address
                     │
                     ▼
                  new UTXO
```

with approximately:

```
0.01 BTC
```

going to the miner as the fee.

That means your scanner must process **inputs and outputs independently**.

---

## 6\. For your database specifically

This is where your requirements simplify things considerably.

You ultimately care about:

```
address
balanceSats
lastSendingTransaction
scriptType
```

So when processing an output:

```
OUTPUT
  │
  ├── address
  └── value
       │
       ▼
address in DB?
  │
  ├── YES → balance += value
  │
  └── NO  → ignore
```

For an input:

```
INPUT
  │
  ├── previousTxId
  └── previousOutputIndex
       │
       ▼
resolve previous output
       │
       ├── address
       └── value
             │
             ▼
       address in DB?
          │
          ├── YES
          │     │
          │     ├── balance -= value
          │     └── lastSendingTransaction = tx time
          │
          └── NO → ignore
```

You don't care about the destination of the spending transaction.

---

## 7\. scriptSig and witness

These are the parts that can initially look confusing.

### scriptSig

Older transaction input types contain a `scriptSig`.

It provides data used to satisfy the previous output's spending conditions.

For example:

```
previous output
      │
      │ "prove you can spend this"
      ▼
   scriptSig
```

### witness

SegWit introduced witness data.

For a P2WPKH transaction, you'll commonly see something conceptually like:

```
vin
│
├── txid
├── vout
├── scriptSig
├── sequence
└── txinwitness
      │
      ├── signature
      └── public key
```

For your **balance scanner**, you generally don't care about the actual signature or witness contents.

They're relevant to validating/spending the transaction, but not necessary for maintaining your address balance.

---

## 8\. sequence

`sequence` is another input field:

```json
{
  "sequence": 4294967295
}
```

It has purposes involving things such as:

- relative locktime
- transaction replacement / BIP125 signalling
- transaction version/locktime semantics

You don't need it for your address-state database.

---

## 9\. lockTime

Similarly, transaction:

```
locktime
```

can constrain when a transaction is valid based on block height or timestamp.

Again:

**not relevant to your address balance calculation** once Bitcoin Core has given you a block containing the confirmed transaction.

---

## The fields you actually care about

From your original structure:

```
transactions[]
│
├── txId                 ← useful
├── version              ← don't need
├── lockTime             ← don't need
│
├── inputs[]
│    ├── previousTxId    ← REQUIRED
│    ├── previousOutputIndex ← REQUIRED
│    ├── scriptSig       ← don't need
│    ├── sequence        ← don't need
│    └── witness         ← don't need
│
└── outputs[]
     ├── value           ← REQUIRED
     ├── scriptPubKey    ← REQUIRED
     └── addresses       ← useful
```

And transaction/block timestamp:

```
block time
    │
    ▼
lastSendingTransaction
```

So you can mentally reduce a transaction to:

```
TRANSACTION
│
├── timestamp
│
├── INPUTS
│    └── "which old outputs am I consuming?"
│
└── OUTPUTS
     └── "which new outputs am I creating?"
```

That's really the fundamental model you need.

---

## One thing to be very careful about

For **historical scanning**, resolving an input's previous output is the part that requires some thought.

If you process:

```
Block 100
Block 101
Block 102
...
```

you could maintain enough temporary information about previously created outputs to resolve later inputs.

But because you **don't want a full UTXO database**, we'll want to design this carefully around your actual requirement:

```
"Only resolve previous outputs when they could belong to one of my tracked addresses."
```

That can potentially make your implementation much smaller than a conventional full UTXO index.

The next step I'd recommend is to work through **exactly how Bitcoin Core's `getblock(..., 2)` response represents `vin` / `vout`, including the coinbase transaction**, because that's where the implementation details for your scanner become important.

---

**You said**

ok so for outputs i need to get {value:value, address:scriptPubKey.address} ill make a conversion function for btcToSats i dont care about fees just i/o ok, so i need to temporarily hold some tx data to resolve receiving addresses and update balances? or do i just feed in sendings as -x and receivings as +x and no need to hold tx data as a resolver? scriptsig and witness are unnecessary for my needs but thanks anyway

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