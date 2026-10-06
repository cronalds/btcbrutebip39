---
title: "Monero Seed Standards"
source: "https://chatgpt.com/c/6abb48ce-d7fc-83ec-b451-4563497abb86"
author:
published:
created: 2026-09-29
description: "ChatGPT conversation with 5 messages"
tags:
  - "clippings"
---
**ChatGPT said**

Exactly — the key is that **the information needed to identify and decrypt an output is present in the transaction, but it is encrypted/obfuscated so that only the recipient's wallet can interpret it.**

Think of a Monero transaction as containing a **locked package** rather than omitting the information entirely.

### 1\. The sender creates a one-time output for you

Suppose your wallet has:

```
Private view key
Private spend key

Public view key   = V
Public spend key  = S
```

The sender doesn't put your normal address directly into the transaction.

Instead, using your public keys and a random transaction key, the sender derives a **unique one-time public key**:

```
Your address
     │
     ├── public spend key S
     └── public view key V
              │
              ▼
       cryptographic derivation
              │
              ▼
      one-time public key P
```

That `P` is what gets placed in the transaction output. Monero describes the destination as a one-time public key derived from the recipient's public keys. [^1]

---

## 2\. Your wallet scans every output

Your wallet has your **private view key**.

It takes the transaction's public information and asks:

```
Blockchain output
          │
          ▼
    one-time key P
          │
          │ + my private view key
          ▼
   cryptographic test
          │
   ┌──────┴──────┐
   │             │
  NO            YES
   │             │
ignore       this is mine
```

This is why the official Monero documentation says scanning for incoming transactions requires the **private view key + public spend key**. [^1]

So the wallet doesn't search for:

```
"4abc...XYZ"
```

Instead it performs a cryptographic ownership test against every output.

---

## 3\. Once it knows an output is yours, it can decrypt the amount

This is the really clever part.

The transaction contains encrypted RingCT amount information.

The sender has effectively created something like:

```
Actual amount
         │
         ▼
 encryption using
 shared secret
         │
         ▼
blockchain data
```

Your wallet can independently calculate the same shared secret using:

```
sender's transaction public key
             +
your private view key
```

The Monero cryptography documentation describes this as a Diffie-Hellman shared secret and explains that the recipient can reconstruct the amount and blinding factor from the transaction public key and their private view key. [^2]

So:

```
Blockchain:

transaction public key
        │
        │
        ├───────────────┐
        │               │
        ▼               ▼
   encrypted        one-time
    amount             key
        │               │
        │               │
        └──────┬────────┘
               │
               ▼
        YOUR PRIVATE VIEW KEY
               │
               ▼
        shared secret
               │
               ▼
       decrypt amount
               │
               ▼
          2.500 XMR
```

Other people looking at the same blockchain **don't possess your private view key**, so they can't perform that decryption.

---

## 4\. But that's not enough to calculate your current balance

This is an important distinction.

Suppose you received:

```
Block 1 → +2 XMR
Block 2 → +5 XMR
Block 3 → +3 XMR
```

Your wallet can discover:

```
Received:
2 + 5 + 3 = 10 XMR
```

But perhaps you subsequently spent:

```
Block 4 → spent 4 XMR
```

The wallet needs to determine which of your outputs have been spent.

That's where **key images** come in.

Every spend produces a key image derived from the private key controlling the spent output. The blockchain records the key image, allowing nodes to detect double-spending without revealing which ring member was actually spent.

So your wallet can maintain something like:

```
Your discovered outputs

Output A → 2 XMR → key image X
Output B → 5 XMR → key image Y
Output C → 3 XMR → key image Z

                 │
                 ▼
       scan blockchain for
       corresponding key images

                 │
        ┌────────┼────────┐
        │        │        │
        ▼        ▼        ▼
       X       not Y      Z
      spent      │       spent
                 │
                 ▼
              unspent

Balance = 5 XMR
```

The Monero CLI documentation specifically notes that key images are used to update the wallet's knowledge of which outputs are spent; view-only wallets need imported key images from the normal wallet to determine the real balance. [^3]

---

## 5\. So your local scanner can do this

This is the architecture you were getting at with your offline blockchain idea:

```
LOCAL MONERO BLOCKCHAIN
            │
            ▼
    ┌──────────────┐
    │ Every block  │
    └──────┬───────┘
           │
           ▼
    Every transaction
           │
           ▼
      Every output
           │
           ▼
┌─────────────────────┐
│ Your private view   │
│ key + public spend  │
│ key                  │
└──────────┬──────────┘
           │
           ▼
   Is this output mine?
      │           │
     NO          YES
      │           │
    ignore        ▼
            decrypt amount
                  │
                  ▼
             record output
                  │
                  ▼
         scan key images
                  │
         ┌────────┴────────┐
         │                 │
      spent             unspent
         │                 │
         ▼                 ▼
      exclude          include
                           │
                           ▼
                    ┌────────────┐
                    │  Balance   │
                    └────────────┘
```

That's essentially what the Monero wallet is doing when it synchronizes. The official GUI documentation says the wallet uses its private keys to determine balance/history and connects to a full node to scan the blockchain for its transaction outputs. [^4]

### There's a nice consequence for your project

You **don't need to make the blockchain itself private**.

You can have:

```
Blockchain
          (public data)
                │
                ▼
       ┌─────────────────┐
       │   Your scanner  │
       │                 │
       │ private view key│
       │ public spend key│
       │ private spend   │
       └────────┬────────┘
                │
                ▼
         Wallet database
                │
      ┌─────────┴─────────┐
      ▼                   ▼
discovered outputs     spent outputs
      │                   │
      └─────────┬─────────┘
                ▼
             balance
```

And this is why **a local full/pruned node + your own wallet scanner is feasible**. The node supplies the public cryptographic transaction data; your wallet supplies the secret information required to recognize your outputs and decrypt their amounts.

One subtlety: **a private view key alone isn't sufficient to reliably determine the current spendable balance**, because it can identify incoming outputs but cannot independently establish all outgoing spends. Monero's documentation explicitly describes importing key images into a view-only wallet for this reason. [^3]

So if you're scanning a recovered **seed phrase**, you have the full spend key and view key, which is the ideal situation.

---

**You said**

so what information from each transaction in each block do i need to keep to get the balance of recovered wallets with offline derivation?

---

**ChatGPT said**

Yes. If your goal is specifically:

> **Download Monero once → disconnect from the network → derive wallets locally → scan the local chain and calculate balances**

then you need to retain the **transaction data required for wallet output scanning and spent-output detection**, not necessarily every human-readable field.

The important part is that you **shouldn't design the storage schema too aggressively at first**. Monero's transaction format is cryptographic and protocol-version dependent, so I'd retain the raw transaction data plus a smaller indexed representation.

### Minimum conceptual data

For each transaction, you need information from **both inputs and outputs**:

```
Transaction
│
├── Transaction public key / tx extra
│
├── Outputs
│   ├── one-time public key
│   ├── view tag
│   └── RingCT encrypted amount / commitment data
│
└── Inputs
    └── key images
```

Then your recovered wallet provides:

```
Recovered wallet
│
├── private view key
├── private spend key
├── public view key
└── public spend key
```

Your scanner essentially does:

```
LOCAL CHAIN
                 │
                 ▼
          transaction data
                 │
        ┌────────┴────────┐
        ▼                 ▼
     outputs            key images
        │                 │
        │                 │
        ▼                 │
private view key          │
        │                 │
        ▼                 │
identify owned output     │
        │                 │
        ▼                 │
decrypt amount            │
        │                 │
        └────────┬────────┘
                 ▼
          spent/unspent?
                 │
                 ▼
             BALANCE
```

## What I'd actually keep

For a serious scanner, I'd keep something closer to this:

| Data | Keep? | Why |
| --- | --- | --- |
| Block height | **Yes** | Chain position |
| Block hash | **Yes** | Verification/indexing |
| Block timestamp | **Yes** | Wallet history |
| TX ID/hash | **Yes** | Unique transaction identifier |
| Transaction public key | **Yes** | Required for output scanning |
| `extra` | **Yes** | Transaction public-key/payment metadata can be encoded here |
| Output one-time public key | **Yes** | Required to identify wallet-owned outputs |
| Output view tag | **Yes** | Efficient output filtering/scanning |
| RingCT commitment | **Yes** | Required for amount verification |
| RingCT encrypted amount data | **Yes** | Required to recover owned output amount |
| Input key images | **Yes** | Determine whether outputs have been spent |
| Output index | **Yes** | Needed for derivation/scanning |
| Transaction fee | Useful | Wallet history/accounting |
| Transaction size/weight | Optional | Mostly metadata |
| Ring member references | **Probably yes initially** | Useful for complete transaction reconstruction/verification |
| Full raw transaction | **Strongly recommended** | Future-proofing |

### The big three

If you boil the problem down:

```
1. Output public keys
       ↓
   "Is this mine?"

2. RingCT encrypted amount/commitment data
       ↓
   "How much is it?"

3. Key images
       ↓
   "Has it been spent?"
```

Those are the pieces most directly related to calculating the balance.

---

## But don't throw away the raw transaction

This is the approach I'd recommend for your project:

```
Monero blockchain
       │
       ▼
   monerod RPC
       │
       ├───────────────┐
       ▼               ▼
raw transaction     parsed/indexed
    storage             storage
       │                   │
       │                   ├── txId
       │                   ├── blockHeight
       │                   ├── txPublicKey
       │                   ├── outputs
       │                   └── keyImages
       │
       └──────► retained for future re-processing
```

Why?

Because if you later discover:

> "I forgot that field is needed for XMR subaddress scanning."

you don't want to download **hundreds of GB of blockchain data again**.

For your project, disk space is already a constraint, so I'd probably use:

```
data/
└── monero/
    ├── raw/
    │   └── transactions/
    │
    └── index/
        ├── blocks
        ├── transactions
        ├── outputs
        └── keyImages
```

Or, even better, initially retain the **raw block/transaction data** and build your optimized SQLite index from it.

---

## There's another important complication: subaddresses

If you're eventually scanning recovered Monero wallets rather than just their primary address, your scanner needs to account for:

```
account 0
│
├── primary address
│
├── subaddress 0
├── subaddress 1
├── subaddress 2
├── ...
│
account 1
│
├── primary address
├── subaddress 0
└── ...
```

The transaction output itself doesn't simply tell you:

```
account = 0
subaddress = 37
```

Your wallet derives/checks the appropriate one-time keys.

So your scanner architecture should ultimately be:

```
seed
 │
 ├── private spend key
 ├── private view key
 │
 └── account/subaddress derivation
          │
          ▼
    public wallet keys
          │
          ▼
    scan chain outputs
          │
          ▼
    identify owned outputs
          │
          ├── account index
          └── subaddress index
```

That becomes important if you're trying to reproduce a normal Monero wallet rather than merely check its primary address.

---

## One important correction to simplify your thinking

You don't necessarily need to independently implement all of Monero's cryptography yourself.

You can have:

```
Your Node.js program
           │
           ▼
  monero-javascript
           │
   ┌───────┴───────┐
   ▼               ▼
wallet           daemon
   │               │
   │               ▼
   │         local monerod
   │               │
   │               ▼
   └──── blockchain
```

Then your job becomes mostly:

```
recover seed
     ↓
create/restore wallet
     ↓
connect wallet to local monerod
     ↓
scan
     ↓
retrieve balance
```

rather than implementing:

```
stealth-address derivation
RingCT decryption
key-image detection
subaddress derivation
CLSAG verification
Bulletproof verification
...
```

from scratch.

### For your specific project

I'd actually use **two layers**:

**Layer 1 — archival**

Keep enough raw blockchain information that you can reconstruct/reprocess transactions later.

**Layer 2 — scanner index**

Build a compact SQLite database containing:

```
blocks
transactions
outputs
keyImages
```

with the fields necessary for your wallet scanner.

That gives you the same general philosophy as your BTC project:

```
RAW MONERO DATA
                 │
                 ▼
              SQLite
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
wallet scanner          future analysis
     │
     ▼
recovered seed
     │
     ▼
  XMR balance
```

And importantly, **you can derive the wallet keys completely offline**. The only thing the blockchain supplies is the public transaction history needed to determine which outputs belong to the recovered wallet and whether those outputs remain unspent.

---

**You said**

ok so bare minimum is output public keys(onetime and transaction), ringct amount, key images; and as for metadata ill keep track of block height, for each transaction ill keep the txID and output index; i can get the raw transaction back if ever i need from block height and txID

---

**ChatGPT said**

Yes — **that's basically the right minimal architecture**, with one important correction: I would also retain the **view tag** and the relevant **transaction `extra` / transaction public-key information**, rather than assuming the transaction public key is always a standalone field.

Your compact representation can look like:

```
Block
├── blockHeight
│
└── Transactions
    │
    ├── txId
    │
    ├── txPublicKey / relevant tx-extra data
    │
    ├── Outputs
    │   ├── outputIndex
    │   ├── oneTimePublicKey
    │   ├── viewTag
    │   └── RingCT amount/commitment data
    │
    └── Inputs
        └── keyImages[]
```

### Your metadata idea

I'd use:

```
blocks
────────────
blockHeight
blockHash
timestamp        ← optional but useful

transactions
────────────
txId
blockHeight

outputs
────────────
txId
outputIndex
oneTimePublicKey
viewTag
ringCtData

keyImages
────────────
txId
keyImage
```

The **block hash** isn't strictly necessary for your wallet-balance calculation if you trust your locally synchronized chain, but I'd keep it because it's tiny and useful for integrity/reorg handling.

### One correction about recovering the raw transaction

Your statement:

> "I can get the raw transaction back if ever I need from block height and txID"

**Yes, provided you still have the local blockchain/node data available.**

Conceptually:

```
blockHeight
     +
txId
     │
     ▼
local monerod
     │
     ▼
raw transaction
```

You don't need to store the entire transaction blob in your scanner database if your local Monero node remains available.

However, I would **not rely on block height + txID alone as an archival strategy** if your intention is to delete the underlying Monero blockchain afterward. Your SQLite index wouldn't be sufficient to reconstruct every raw transaction.

So there are two different goals:

| Goal | Your compact data sufficient? |
| --- | --- |
| Calculate recovered-wallet balances | **Yes, assuming you retain all cryptographically required fields** |
| Identify wallet-owned outputs | **Yes** |
| Determine spent outputs | **Yes, with key images** |
| Display basic transaction history | Mostly |
| Reconstruct the original raw transaction | **No** |
| Re-download/retrieve raw tx later from your own node | **Yes, while node data is retained** |
| Completely delete blockchain and retain archival capability | **No** |

And I'd make one small addition to your "bare minimum":

**Keep the transaction public key/ `extra` and view tag together with the one-time output key.**

That gives you a much safer minimal scanner record:

```
txId
blockHeight

transaction:
    txPublicKey / txExtra

output:
    outputIndex
    oneTimePublicKey
    viewTag
    ringCtAmountData

inputs:
    keyImages[]
```

Then your offline balance calculation becomes:

```
recovered seed
             │
             ▼
    XMR private/public keys
             │
             ▼
     scan local SQLite
             │
     ┌───────┴────────┐
     ▼                ▼
   outputs         key images
     │                │
     ▼                ▼
 identify          mark spent
  owned               │
     │                │
     ▼                │
recover amount        │
     │                │
     └───────┬────────┘
             ▼
     sum unspent outputs
             │
             ▼
          XMR balance
```

**One thing I'd do before implementing the database:** verify the exact current Monero transaction fields needed by the wallet library you're planning to use (`monero-javascript` /Monero wallet RPC), because the cryptographic representation has evolved across Monero protocol versions. That will prevent you from building a schema that works for current transactions but can't scan older ones.

[^1]: [getmonero.org](https://www.getmonero.org/resources/moneropedia/transaction.html?utm_source=chatgpt.com)

[^2]: [getmonero.org](https://www.getmonero.org/library/Zero-to-Monero-2-0-0.pdf?utm_source=chatgpt.com)

[^3]: [github.com](https://github.com/monero-project/monero-docs/blob/master/docs/en/interacting/monero-wallet-cli-reference.md?utm_source=chatgpt.com)

[^4]: [docs.getmonero.org](https://docs.getmonero.org/interacting/monero-wallet-gui-reference/?utm_source=chatgpt.com)