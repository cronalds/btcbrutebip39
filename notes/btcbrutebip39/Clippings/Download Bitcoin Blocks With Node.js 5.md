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

---

**You said**

ok, so scriptsig and scriptpubkey are what ill have to work off of as opposed to btcaddress, how do i generate those from the address?

///

```
{
  "version": "01000000",
  "inputcount": "01",
  "inputs": [
    {
      "txid": "fed8fff7ede813a76c722e5196723b7d1a4be08c7e812e6240c0988edf073bde",
      "vout": "01000000",
      "scriptsigsize": "6b",
      "scriptsig": "483045022100cf96ae41a89921da8983e6ba6355e1f1a8422c69f47bd024c3d85bb2ff2be86102207ad9e4f8a4b52ebbb8a51ea76d122f80fcb8dc4a23bd5e61d6e3a6c1dab32cfe01210365236abbf0eca705ccdee48271013fcea91318c49eb396c7ddd6baf62187a62b",
      "sequence": "ffffffff"
    }
  ],
  "outputcount": "02",
  "outputs": [
    {
      "amount": "b94e0a0000000000",
      "scriptpubkeysize": "19",
      "scriptpubkey": "76a91463d26086738fb8b037960e49245898ec23a8788388ac"
    },
    {
      "amount": "60c10b0000000000",
      "scriptpubkeysize": "19",
      "scriptpubkey": "76a914340764bd86ef20b0539206b16eda15fb8dbd4d5888ac"
    }
  ],
  "locktime": "00000000"
}
/// this is a transaction object so i have to work with whats in here, i dont see any btcaddress so i guess im working strictly with scriptsig and scriptpubkey; do i generate those from the bip39->bip32 public and private key using the scripts?
```

---

**ChatGPT said**

Yes — but there is an important distinction:

**You don't generate the `scriptSig` from the address when scanning the blockchain.**  
For your scanner, you primarily need to **derive/recognize the `scriptPubKey` associated with your tracked address**, then compare it against transaction outputs.

Your transaction object is a good example.

### 1\. Your scriptPubKey is the important part for outputs

You have:

```
scriptPubKey:
76a91463d26086738fb8b037960e49245898ec23a8788388ac
```

That is a **P2PKH** locking script.

Its structure is:

```
76        OP_DUP
a9        OP_HASH160
14        push 20 bytes
63d26086738fb8b037960e49245898ec23a878838
88        OP_EQUALVERIFY
ac        OP_CHECKSIG
```

The important part is:

```
63d26086738fb8b037960e49245898ec23a878838
```

That's the 20-byte public-key hash.

And that hash is what the corresponding Base58 Bitcoin address encodes.

So conceptually:

```
BIP39 mnemonic
      ↓
BIP32 HD key
      ↓
private/public key
      ↓
hash160(public key)
      ↓
      ├── address
      │     1...
      │
      └── scriptPubKey
            76a914...88ac
```

Therefore, **yes, your BIP32-derived public key ultimately gives you the information needed to construct the expected `scriptPubKey`.**

---

## 2\. You don't need to generate scriptSig for your tracked addresses

This is the big distinction.

`scriptPubKey`:

```
"How can these coins be spent?"
```

It belongs to the **output**.

`scriptSig`:

```
"Here is the information required to satisfy that output's spending conditions."
```

It belongs to the **input**.

So for your scanner:

```
TRANSACTION

┌───────────────────┐
│      INPUTS       │
│                   │
│ previous txid     │
│ previous vout     │
│ scriptSig         │
│ sequence          │
└───────────────────┘
         │
         │ spends
         ▼
┌───────────────────┐
│      OUTPUTS      │
│                   │
│ amount            │
│ scriptPubKey      │
└───────────────────┘
```

You don't need to understand or recreate the `scriptSig` to determine which tracked address is spending.

You resolve:

```
vin:
    txid = fed8...
    vout = 1
```

against your previously stored:

```
trackedOutputs[fed8...][1]
```

and that tells you:

```
address
valueSats
```

Then:

```
balanceSats -= valueSats
```

---

## 3\. Your existing BIP39 → BIP32 process gives you the address

Suppose your derivation produces:

```
publicKey
    ↓
hash160(publicKey)
    ↓
BTC address
```

For a legacy P2PKH address:

```
1xxxxxxxxxxxxxxxxxxxxxxxxx
```

the corresponding locking script is:

```
OP_DUP
OP_HASH160
<20-byte pubKeyHash>
OP_EQUALVERIFY
OP_CHECKSIG
```

serialized as:

```
76 a9 14 <20-byte-hash> 88 ac
```

So if you're tracking:

```
1ABC...
```

you can derive its corresponding scriptPubKey locally.

You **do not need the network to do this**.

---

## 4\. But you actually have an even easier option

Since you're using `bitcoinjs-lib`, you don't need to manually construct:

```
76a914...88ac
```

You can derive the address and its output script using the appropriate payment type.

Conceptually:

```
publicKey
    ↓
bitcoinjs-lib payment
    ↓
{
    address,
    output
}
```

where `output` is the serialized `scriptPubKey`.

For example, for P2PKH:

```
public key
     ↓
P2PKH payment
     ↓
address = 1...
output  = 76a914...88ac
```

For your scanner, I'd actually store the **scriptPubKey bytes/hex as the lookup key** rather than repeatedly converting scripts into addresses.

For example:

```
trackedAddresses
────────────────────────────
address
scriptPubKey
balanceSats
lastSendingTransaction
scriptType
```

Then when you encounter:

```
vout.scriptPubKey
```

you can essentially do:

```
Does this script match one of my tracked scripts?
```

If yes:

```
address = trackedScriptLookup[scriptPubKey]
```

and you immediately have:

```
address
valueSats
```

---

## 5\. This is especially useful because you have multiple address types

You're working with:

```
BIP44 → P2PKH
BIP49 → P2SH-P2WPKH
BIP84 → P2WPKH
BIP86 → P2TR
```

They don't all have the same `scriptPubKey` format.

For example:

```
BIP44
1...
    ↓
P2PKH
    ↓
76 a9 14 ... 88 ac
```

while:

```
BIP49
3...
    ↓
P2SH
    ↓
a9 14 ... 87
```

and:

```
BIP84
bc1q...
    ↓
P2WPKH
    ↓
00 14 <20-byte-hash>
```

and:

```
BIP86
bc1p...
    ↓
P2TR
    ↓
51 20 <32-byte-x-only-pubkey>
```

So **the address prefix isn't what you should use to identify the output**.

Instead:

```
BIP39
 ↓
BIP32
 ↓
derived public key
 ↓
payment/script type
 ↓
scriptPubKey
 ↓
address
```

And when scanning:

```
block
 ↓
transaction
 ↓
vout.scriptPubKey
 ↓
lookup against your known scriptPubKeys
 ↓
tracked address
```

That is a much more direct blockchain-level representation.

---

## One more thing about your example

Your first output:

```
76a91463d26086738fb8b037960e49245898ec23a8788388ac
```

is P2PKH.

Your second:

```
76a914340764bd86ef20b0539206b16eda15fb8dbd4d5888ac
```

is also P2PKH.

So if your tracked-address set contains the address corresponding to:

```
63d26086738fb8b037960e49245898ec23a878838
```

you've found a receiving output.

Then you can store:

```
trackedOutputs[txId][0] = {
    address,
    valueSats
}
```

You don't need to retain:

```
scriptPubKey
scriptSig
sequence
locktime
```

in your temporary resolver.

The script is essentially the **lookup mechanism**; once you've identified the address, your compact object can contain exactly what you proposed:

```
{
    address,
    valueSats
}
```

And for the input, the `txid + vout` tells you which previous output to resolve.