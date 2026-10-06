---
title: "Bitcoin Wallet Popularity by Year"
source: "https://chatgpt.com/c/6ab1e511-dee0-83ec-abc7-664bb1cbbd63"
author:
published:
created: 2026-09-22
description: "ChatGPT conversation with 5 messages"
tags:
  - "clippings"
---
**ChatGPT said**

Yes — **conceptually you've got the pipeline right**, but there are two important corrections:

1. `bip32-utils` is **not a modern dependency of current `bitcoinjs-lib`**. The current bitcoinjs ecosystem uses the separate `bip32` package for HD key derivation. `bip32-utils` is an old package (v0.11.1, published 9 years ago) designed around `bitcoinjs-lib` v2/v3. [^1]
2. **`bitcoinjs-lib` does not itself check your BTC balance or query the blockchain.** It creates/parses/signs Bitcoin transactions; you need Bitcoin Core RPC or a blockchain/indexer API to obtain UTXOs/balance and broadcast. [^2]

So I'd structure it like this:

```
BIP-39 mnemonic
               │
               ▼
          bip39
               │
               ▼
         512-bit seed
               │
               ▼
            bip32
               │
               ▼
        HD wallet/root
               │
       derivePath(...)
               │
               ▼
     private/public key pairs
               │
               ▼
         BTC addresses
               │
     ┌─────────┴─────────┐
     │                   │
     ▼                   ▼
Blockchain API       bitcoinjs-lib
     │                   │
     │                   ├── construct TX
     │                   ├── create PSBT
     │                   ├── sign
     │                   └── finalize
     │
     ├── balance
     ├── UTXOs
     └── transaction history
                         │
                         ▼
                    broadcast TX
```

### What each part actually does

| Component | What it does |
| --- | --- |
| **`bip39`** | Generates/validates the mnemonic and converts mnemonic → BIP-39 seed |
| **`bip32`** | Converts seed → HD master key and derives child keys/paths |
| **`bitcoinjs-lib`** | Handles Bitcoin addresses/scripts/PSBTs/transactions/signing |
| **Bitcoin Core / API** | Finds UTXOs, calculates balance, gets fee information, broadcasts transactions |

The current `bitcoinjs-lib` documentation specifically says its old `HDNode` / `ECPair` functionality was separated into `bip32` and `ecpair`; current usage is `bitcoinjs-lib` + a key-derivation library as needed. [^2]

### One correction to your mental model

You said:

> "bip32-utils to convert phrases to whatever's next pretty sure public and private keys"

Close, but **BIP-32 doesn't operate directly on the mnemonic**.

It's:

```
Mnemonic
   │
   │ BIP-39
   ▼
Seed
   │
   │ BIP-32
   ▼
Master private key
   │
   ├── master public key
   │
   ├── child private key
   │      │
   │      └── child public key
   │
   └── ...
```

And then the Bitcoin address is derived from the appropriate public-key/script scheme.

For example, with BIP-84:

```
BIP39 mnemonic
      ↓
BIP39 seed
      ↓
BIP32 master key
      ↓
m/84'/0'/0'/0/0
      ↓
private key
      ↓
public key
      ↓
P2WPKH script
      ↓
bc1q... address
```

The current `bip32` package provides `derivePath()` for exactly this HD derivation process. [^3]

## And bip32-utils?

I'd **not use it for a new project**.

It's an old utility package and its own documentation says it is compatible with `bitcoinjs-lib ^2.0.0` and `^3.0.0`. Its examples use the old `bitcoin.HDNode` API. [^1]

Current `bitcoinjs-lib` is version 7.x and explicitly recommends the separate `bip32` package for HD keys. [^4]

So your modern stack should be:

```
npm install bip39 bip32 bitcoinjs-lib
```

And depending on the transaction/signing setup, you'll commonly also need an ECC/key implementation such as `tiny-secp256k1` and `ecpair`; the current bitcoinjs documentation specifically identifies those as companion libraries. [^2]

### The final piece you're missing

If your actual goal is:

> **"Give my program a BIP-39 phrase, discover all BTC belonging to that wallet, show balance, and send BTC."**

then the complete stack is:

```
bip39
  ↓
bip32
  ↓
bitcoinjs-lib
  ↓
Bitcoin blockchain interface
```

The **blockchain interface is essential**.

`bitcoinjs-lib` can't do:

```
getBalance()
getUTXOs()
getTransactions()
broadcast()
```

by itself, because it's a Bitcoin protocol/transaction library rather than a blockchain indexer/node. Its own examples include transaction creation/broadcast through third-party blockchain providers, illustrating that network access is a separate layer. [^2]

For example:

```
YOUR WALLET
                  │
      ┌───────────┴───────────┐
      │                       │
  PRIVATE SIDE            PUBLIC SIDE
      │                       │
mnemonic → keys          addresses/xpub
      │                       │
      │                       ▼
      │                Bitcoin Core/API
      │                       │
      │                ┌──────┴──────┐
      │                │             │
      │             balance        UTXOs
      │                │             │
      │                └──────┬──────┘
      │                       │
      └──────────────► bitcoinjs-lib
                              │
                           PSBT
                              │
                           sign
                              │
                           TX hex
                              │
                              ▼
                         broadcast
```

**So yes, you're very close.** I'd replace **`bip32-utils` with `bip32`**, keep `bip39` + `bitcoinjs-lib`, and add **one blockchain data/broadcast layer**. That gives you the exact functionality you're after without needing a giant wallet framework.

---

**You said**

ok, i have bip39 for generating phrases, now list any other well maintained javascript libraries i will need for accessing wallet from phrase, getting balance, making transaction

---

**ChatGPT said**

Yes. Since you already have **`bip39`**, I'd keep the stack fairly small.

For a modern Node.js Bitcoin wallet that can:

1. accept/generate a BIP-39 phrase
2. derive the wallet
3. find its BTC balance
4. find UTXOs
5. create/sign transactions
6. broadcast transactions

I'd use the following.

## Core libraries

| Library | You need it? | Purpose |
| --- | --- | --- |
| **`bip39`** | ✅ Already have | Mnemonic ↔ BIP-39 seed |
| **`bip32`** | ✅ | BIP-32 HD wallet derivation |
| **`tiny-secp256k1`** | ✅ | ECC implementation used by `bip32` /Bitcoin signing |
| **`ecpair`** | ✅ | Creates/manages secp256k1 key pairs and signing |
| **`bitcoinjs-lib`** | ✅ | Bitcoin addresses, scripts, PSBTs, transactions and signing |
| **Blockchain API / Bitcoin Core** | ✅ | Balance, UTXOs, transaction history, broadcasting |
| `coinselect` | Optional | UTXO/input selection |

The current bitcoinjs documentation explicitly recommends installing `bip32` and `ecpair` separately; the old `HDNode` / `ECPair` functionality was split out of `bitcoinjs-lib`. [^2]

### Install

```
npm install bip39 bip32 tiny-secp256k1 ecpair bitcoinjs-lib
```

`bip32` itself requires an ECC implementation such as `tiny-secp256k1`. Its current usage is `BIP32Factory(ecc)`, followed by things such as `derivePath()`. [^5]

---

## What happens to your mnemonic

Your mental model should now be:

```
BIP-39 phrase
        │
        ▼
     bip39
        │
        ▼
 512-bit BIP-39 seed
        │
        ▼
      bip32
        │
        ▼
  Master HD key
        │
   derivePath()
        │
        ▼
Child private key
        │
        ▼
      ecpair
        │
        ▼
Public/private key
        │
        ▼
bitcoinjs-lib
        │
        ▼
  BTC address
```

For example, a native SegWit wallet might derive from:

```
m/84'/0'/0'/0/0
```

and produce a `bc1q...` address.

`bitcoinjs-lib` 's own integration tests demonstrate this general `bip39 → bip32 → bitcoinjs-lib` workflow. [^6]

---

## Then there's one separate component: blockchain access

This is the part that **`bitcoinjs-lib` doesn't provide**.

You need something like:

### Option 1 — Bitcoin Core

```
Your JS application
       │
       │ JSON-RPC
       ▼
 Bitcoin Core
       │
       ▼
 Bitcoin network
```

This is the self-hosted approach.

### Option 2 — Blockchain API

For example:

```
Your JS application
       │
       ▼
Bitcoin API/indexer
       │
       ├── address balance
       ├── UTXOs
       ├── transaction history
       ├── fee estimates
       └── broadcast transaction
```

This is considerably easier if you're just developing/testing a wallet.

---

## Your actual wallet pipeline

Once you add the blockchain layer:

```
┌──────────────────────────────────────────────┐
│                  YOUR WALLET                  │
├──────────────────────────────────────────────┤
│                                              │
│  mnemonic                                    │
│      │                                       │
│      ▼                                       │
│    bip39                                      │
│      │                                       │
│      ▼                                       │
│    seed                                       │
│      │                                       │
│      ▼                                       │
│    bip32                                      │
│      │                                       │
│      ▼                                       │
│  HD private keys                              │
│      │                                       │
│      ▼                                       │
│  ecpair / bitcoinjs-lib                       │
│      │                                       │
│      ▼                                       │
│  BTC addresses                                │
│                                              │
└──────────────────┬───────────────────────────┘
                   │
                   │ public addresses
                   ▼
          ┌───────────────────┐
          │ Bitcoin Core / API│
          ├───────────────────┤
          │ Balance            │
          │ UTXOs              │
          │ History            │
          │ Fees               │
          │ Broadcast          │
          └─────────┬─────────┘
                    │
                    │ UTXOs
                    ▼
             bitcoinjs-lib
                    │
                    ▼
                  PSBT
                    │
                    ▼
               sign locally
                    │
                    ▼
             signed transaction
                    │
                    ▼
               broadcast
```

## So your minimum stack is

**Already have:**

```
bip39
```

**Add:**

```
bip32
tiny-secp256k1
ecpair
bitcoinjs-lib
```

**Then choose one blockchain access method:**

```
Bitcoin Core RPC
        OR
Bitcoin blockchain API/indexer
```

`coinselect` is optional; you can initially implement simple UTXO selection yourself, but a dedicated coin-selection library becomes useful once you're dealing with multiple UTXOs and fee/change optimization. `bitcoinjs-lib` itself lists `coinselect` as a companion library for transaction input selection. [^2]

### One thing I would not add

I would **not use `bip32-utils`** for this new project. It's an older utility package; the current bitcoinjs architecture has `bip32` as the dedicated HD-key library. The bitcoinjs repositories are still actively maintained in 2026, with recent activity on `bitcoinjs-lib`, `bip32`, and related packages. [^7]

So, in short:

**`bip39` → `bip32` → `ecpair` / `tiny-secp256k1` → `bitcoinjs-lib` → Bitcoin Core/API**

That's the stack I'd use for the functionality you're describing.

---

**You said**

do i need bip32 if im not using a hard wallet and im only using a soft wallet? or will i need it when reclaiming from seed phrases used for my hard wallet? bip39 seed phrase -> bip39 alg -> resulting output of alg -> bip32 -> derivePath(masterHDKey) -> child private key -> ecpair -> public and private key -> bitcoinjs-lib -> btc address // correct where needed and walk through this more and be descriptive, step by step

---

**ChatGPT said**

Yes — **you need BIP-32 for a normal BIP-39 software wallet too** if the wallet follows the standard HD-wallet architecture. It isn't specifically a "hardware-wallet thing." BIP-32 is the mechanism that turns the seed into a **hierarchy of deterministic keys**. Hardware wallets use it; software wallets use it; restoring a hardware-wallet seed into software also uses it. [^2]

The important distinction is:

> **BIP-39 creates the seed; BIP-32 creates the key tree from that seed.**

Then BIP-44/49/84/86 etc. tell you **which branch of that tree to use** for particular Bitcoin address types. [^8]

---

## Your pipeline, corrected

You proposed:

```
BIP39 seed phrase
    ↓
BIP39 alg
    ↓
resulting output
    ↓
BIP32
    ↓
derivePath(masterHDKey)
    ↓
child private key
    ↓
ECPair
    ↓
public + private key
    ↓
bitcoinjs-lib
    ↓
BTC address
```

That's **very close**. I'd change it to:

```
BIP-39 mnemonic
      │
      │ mnemonicToSeed()
      ▼
BIP-39 seed
      │
      │ BIP-32 fromSeed()
      ▼
BIP-32 master extended private key
      │
      │ derivePath()
      ▼
BIP-32 child extended private key
      │
      ├──────────────► child private key
      │
      └──────────────► child public key
                              │
                              ▼
                       Bitcoin script/address
                              │
                              ▼
                         bitcoinjs-lib
```

And **ECPair isn't really a required step between BIP-32 and the address** in the way you're imagining. A BIP-32 child node already exposes the private/public key material needed by the Bitcoin libraries. `ECPair` is primarily a single-key/signing abstraction that can be used as the signer for `bitcoinjs-lib`. The bitcoinjs project explicitly separates `bip32` for HD keys and `ecpair` for single keys. [^2]

---

## Step 1 — Your BIP-39 mnemonic

Suppose your wallet has:

```
word1 word2 word3 ... word12
```

That's the **mnemonic**, not yet the BIP-32 master key.

BIP-39 defines how the mnemonic is converted into a seed. The JavaScript `bip39` library exposes `mnemonicToSeed()` / `mnemonicToSeedSync()` for this. [^9]

Conceptually:

```
12/15/18/21/24 words
        │
        │ BIP-39
        ▼
512-bit seed
```

If a BIP-39 passphrase is used, it participates in this step too:

```
mnemonic
   +
optional passphrase
        │
        ▼
   BIP-39 seed
```

This is why a BIP-39 passphrase is sometimes called the **"25th word"**, although technically that's misleading: it isn't another mnemonic word; it's an optional passphrase used in seed derivation.

---

## Step 2 — BIP-32 takes the seed

Now your BIP-39 seed goes into BIP-32.

Conceptually:

```
BIP-39 seed
     │
     ▼
BIP-32
     │
     ├── master private key
     └── master chain code
```

Together, the private key + chain code form an **extended private key**.

Think of it as:

```
Master HD private node
┌─────────────────────────┐
│ private key             │
│ chain code              │
│ depth                   │
│ child index             │
│ parent fingerprint      │
│ network information     │
└─────────────────────────┘
```

The **chain code is important**. It isn't just "the private key plus some metadata." BIP-32 uses the chain code as part of the derivation process. The current `bip32` implementation returns an interface containing `privateKey`, `publicKey`, `chainCode`, depth, index, fingerprint, and derivation functions. [^10]

---

## Step 3 — You now have the master HD wallet

At this point:

```
BIP39 mnemonic
       ↓
BIP39 seed
       ↓
BIP32
       ↓
MASTER HD NODE
```

You haven't selected a particular Bitcoin address yet.

The master node is essentially the **root of a huge deterministic key tree**.

For example:

```
MASTER
                 │
  ┌──────────────┼──────────────┐
  │              │              │
branch          branch         branch
  │              │              │
 ...            ...            ...
```

BIP-32 allows many child keys to be deterministically derived from that root. [^11]

---

## Step 4 — derivePath()

This is the part that determines **which wallet/address branch you're actually using**.

For example:

```
m/84'/0'/0'/0/0
```

Break that apart:

```
m
│
├── 84'       purpose
│
├── 0'        Bitcoin
│
├── 0'        account 0
│
├── 0         external/receiving chain
│
└── 0         address index 0
```

BIP-44 defines the general structure:

```
m / purpose' / coin_type' / account' / change / address_index
```

[^8]

The `bitcoinjs` BIP-32 implementation provides `derivePath(path)` and handles hardened components such as `84'`. [^10]

---

## Step 5 — Why the path matters so much

This is probably the most important concept for **recovering an existing wallet**.

The same:

```
BIP-39 mnemonic
```

can produce different Bitcoin addresses depending on the derivation path.

For example:

```
SAME SEED
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
BIP-44        BIP-49        BIP-84
    │             │             │
m/44'/...      m/49'/...      m/84'/...
    │             │             │
    ▼             ▼             ▼
  BTC A          BTC B          BTC C
```

Common Bitcoin paths include:

| Standard | Typical first receiving path | Address style |
| --- | --- | --- |
| BIP-44 | `m/44'/0'/0'/0/0` | Legacy `1...` |
| BIP-49 | `m/49'/0'/0'/0/0` | Nested SegWit `3...` |
| BIP-84 | `m/84'/0'/0'/0/0` | Native SegWit `bc1q...` |
| BIP-86 | `m/86'/0'/0'/0/0` | Taproot `bc1p...` |

The BIP-44 structure is standardized, while BIP-49, BIP-84 and BIP-86 define other script/address schemes. [^11]

So when **restoring a hardware-wallet seed**, you need to know or determine the wallet's derivation scheme.

---

## Step 6 — What comes out of derivePath()

Suppose:

```
master
  ↓
derivePath("m/84'/0'/0'/0/0")
```

You now have a **child BIP-32 node**.

It contains things like:

```
child
├── privateKey
├── publicKey
├── chainCode
├── depth
├── index
├── parentFingerprint
└── ...
```

The `bip32` library's current interface exposes `privateKey`, `publicKey`, `chainCode`, `derive()`, `deriveHardened()`, and `derivePath()`. [^10]

So your understanding:

> "derivePath → child private key"

is basically correct, but more accurately:

> **`derivePath()` → child BIP-32 node, from which you can obtain the child private/public key and other HD metadata.**

---

## Step 7 — Where ECPair comes in

This is where I'd modify your diagram.

You don't necessarily want:

```
BIP32
 ↓
private key
 ↓
ECPair
 ↓
public key
```

Instead, think:

```
BIP32 child node
      │
      ├── privateKey
      │
      └── publicKey
```

Then, if you need an `ECPair` signer:

```
BIP32 child
     │
     ▼
child.privateKey
     │
     ▼
ECPair.fromPrivateKey(...)
     │
     ▼
Signer
```

`bitcoinjs-lib` uses `ECPair` as a separate single-key abstraction. The project documentation explicitly describes `ecpair` as the ECPair class for single keys and `bip32` as the HD-key library. [^2]

So ECPair is mainly useful when you're saying:

> "Here is the private key that should sign this Bitcoin transaction."

---

## Step 8 — Public key → Bitcoin address

This is another place where `bitcoinjs-lib` does more than simply "load the wallet."

A public key **isn't itself a Bitcoin address**.

For example:

```
private key
     │
     ▼
public key
     │
     ▼
Bitcoin output/script construction
     │
     ▼
Bitcoin address
```

The exact process depends on the address type.

For native SegWit:

```
public key
     ↓
HASH160 / witness program
     ↓
P2WPKH output
     ↓
bech32 encoding
     ↓
bc1q...
```

For Taproot, it's a different construction:

```
public key
     ↓
x-only public key / Taproot tweaking
     ↓
P2TR output
     ↓
bech32m
     ↓
bc1p...
```

`bitcoinjs-lib` handles these Bitcoin payment/script constructions. Its examples include payment objects and transaction construction. [^2]

---

## Step 9 — Now you have an address

Suppose you've derived:

```
m/84'/0'/0'/0/0
```

and created:

```
bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Now you can query the blockchain.**

This is where your wallet application needs a node or blockchain API.

```
Your wallet
           │
           ▼
   derived BTC address
           │
           ▼
 Bitcoin Core / indexer
           │
  ┌────────┼────────┐
  ▼        ▼        ▼
UTXOs    balance   history
```

`bitcoinjs-lib` does **not** magically know the balance associated with that address. It works with Bitcoin data you provide to it.

---

## Step 10 — Balance is actually UTXO accounting

This is another important fundamental.

Bitcoin doesn't fundamentally have an account balance like:

```
balance = 0.25 BTC
```

Instead, you have **unspent transaction outputs**:

```
UTXO #1 = 0.10 BTC
UTXO #2 = 0.05 BTC
UTXO #3 = 0.20 BTC
```

Therefore:

```
wallet balance
    =
sum of spendable UTXOs
```

For example:

```
0.10
+0.05
+0.20
─────
0.35 BTC
```

Your blockchain/indexer layer finds those UTXOs.

---

## Step 11 — Making a transaction

Suppose you want to send:

```
0.10 BTC
```

You need:

```
your UTXOs
     │
     ▼
select inputs
     │
     ▼
construct transaction
     │
     ├── recipient output
     ├── change output
     └── transaction fee
```

For example:

```
INPUT
0.20 BTC UTXO
       │
       ▼
┌───────────────────────────┐
│       Bitcoin TX          │
│                           │
│  Output 1: 0.10 BTC       │──► recipient
│                           │
│  Output 2: 0.099 BTC      │──► your change address
│                           │
│  Fee:      0.001 BTC      │
└───────────────────────────┘
```

The transaction needs to spend an existing UTXO.

---

## Step 12 — Sign the transaction

This is where your **private key** becomes critical.

Conceptually:

```
unsigned transaction
        +
private key
        │
        ▼
     signature
        │
        ▼
signed transaction
```

With modern Bitcoin transaction construction, you'll commonly use a **PSBT**:

```
UTXOs
  │
  ▼
PSBT
  │
  ▼
sign with private key
  │
  ▼
finalize
  │
  ▼
raw Bitcoin transaction
```

`bitcoinjs-lib` supports PSBT-based transaction workflows. [^2]

---

## Step 13 — Broadcast

Finally:

```
signed transaction
        │
        ▼
Bitcoin node/API
        │
        ▼
Bitcoin network
        │
        ▼
mempool
        │
        ▼
block
```

Your JavaScript wallet needs a network layer to submit the signed transaction.

---

## The complete picture

So I'd draw your system like this:

```
USER
                  │
                  │ 12/24-word mnemonic
                  ▼
            ┌───────────┐
            │   BIP-39  │
            └─────┬─────┘
                  │
                  │ mnemonicToSeed()
                  ▼
            BIP-39 SEED
                  │
                  ▼
            ┌───────────┐
            │   BIP-32  │
            └─────┬─────┘
                  │
                  │ fromSeed()
                  ▼
         MASTER HD NODE
                  │
                  │ derivePath()
                  ▼
         CHILD HD NODE
          /               \
         /                 \
        ▼                   ▼
privateKey             publicKey
     │                     │
     │                     ▼
     │              bitcoinjs-lib
     │                     │
     │                     ▼
     │                BTC ADDRESS
     │                     │
     │                     ▼
     │              Blockchain API
     │                     │
     │                ┌────┴────┐
     │                ▼         ▼
     │              UTXOs    balance
     │                │
     │                ▼
     │         construct PSBT
     │                │
     └───────────────►│
                      ▼
                 sign PSBT
                      │
                      ▼
               finalize transaction
                      │
                      ▼
                   broadcast
                      │
                      ▼
                 Bitcoin network
```

## And hardware wallets?

This is where your original question becomes particularly useful.

### Software wallet

Your application has the seed/private keys:

```
Mnemonic
   ↓
BIP39
   ↓
BIP32
   ↓
private keys
   ↓
sign locally
```

### Hardware wallet

The architecture is different:

```
Your computer
        │
mnemonic never here
        │
        ▼
Hardware wallet
        │
    BIP39/BIP32
        │
        ▼
   private keys
        │
        │ sign
        ▼
    signature
        │
        ▼
Your computer
        │
        ▼
   broadcast
```

The hardware wallet keeps the private key material inside the device.

But **BIP-32 is still involved**. The hardware wallet needs to derive the same deterministic key hierarchy so that the address your computer displays corresponds to the key branch on the device.

### Recovering a hardware-wallet seed into software

This is where you absolutely need to pay attention to:

```
Mnemonic
+
BIP39 passphrase, if any
+
derivation scheme
+
account
+
address/change branch
```

For example, if the hardware wallet used:

```
m/84'/0'/0'
```

and your software wallet searches:

```
m/44'/0'/0'
```

you can enter the **correct seed and still see the wrong addresses / apparently empty wallet**.

That's because the seed is the same, but you're looking at a different branch of the deterministic tree. BIP-44 defines the account/change/address hierarchy specifically to organize these branches. [^8]

---

## One terminology correction worth remembering

Don't think:

```
BIP39
  ↓
private key
```

Think:

```
BIP39
  ↓
seed
  ↓
BIP32
  ↓
HD key tree
  ↓
specific derivation path
  ↓
specific private/public key
  ↓
Bitcoin script
  ↓
address
```

And don't think:

```
hardware wallet → BIP32
software wallet → no BIP32
```

Think:

```
BIP32 HD wallet
                 │
     ┌───────────┴───────────┐
     │                       │
Software wallet         Hardware wallet
     │                       │
keys available          keys stay inside
     │                       │
     └─────── same deterministic
              key hierarchy ──┘
```

That's the fundamental relationship.

One final nuance: **not every wallet uses BIP-39 + BIP-32 in exactly the same combination or derivation paths**, so for seed recovery you must identify the original wallet's standards/path rather than assuming `m/84'/0'/0'/0/0`. BIP-44/49/84/86 are different conventions for different output types. [^11]

[^1]: [npmjs.com](https://www.npmjs.com/package/bip32-utils?activeTab=readme&utm_source=chatgpt.com)

[^2]: [github.com](https://github.com/bitcoinjs/bitcoinjs-lib?utm_source=chatgpt.com)

[^3]: [npmjs.com](https://www.npmjs.com/package/bip32?utm_source=chatgpt.com)

[^4]: [npmjs.com](https://www.npmjs.com/package/bitcoinjs-lib?utm_source=chatgpt.com)

[^5]: [github.com](https://github.com/bitcoinjs/bip32?utm_source=chatgpt.com)

[^6]: [github.com](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/bip32.spec.ts?utm_source=chatgpt.com)

[^7]: [github.com](https://github.com/bitcoinjs?utm_source=chatgpt.com)

[^8]: [github.com](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki?utm_source=chatgpt.com)

[^9]: [github.com](https://github.com/bitcoinjs/bip39?utm_source=chatgpt.com)

[^10]: [github.com](https://github.com/bitcoinjs/bip32/blob/master/ts-src/bip32.ts?utm_source=chatgpt.com)

[^11]: [github.com](https://github.com/bitcoinbook/bitcoinbook/blob/develop/ch05_wallets.adoc?utm_source=chatgpt.com)