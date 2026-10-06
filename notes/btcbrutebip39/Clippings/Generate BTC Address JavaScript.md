---
title: "Generate BTC Address JavaScript"
source: "https://chatgpt.com/c/6ab38768-7cec-83ec-a337-ea638cca2cdd"
author:
published:
created: 2026-09-23
description: "ChatGPT conversation with 2 messages"
tags:
  - "clippings"
---
**You said**

ok, if i have the bip39 seed phrase and the derivation path, how do i get the btc address from that? using javascript, bip39 lib, bip32 lib, tiny-secp256k1 lib, bitcoinjs-lib

---

**ChatGPT said**

Yes. With those libraries, the standard flow is:

```
BIP39 mnemonic
     │
     ▼
bip39.mnemonicToSeed()
     │
     ▼
BIP32 master node
     │
     │ derivation path, e.g. m/84'/0'/0'/0/0
     ▼
BIP32 child node
     │
     ├── private key
     └── public key
             │
             ▼
       bitcoinjs-lib
             │
             ▼
        BTC address
```

The important distinction is that **BIP39 creates the seed**, while **BIP32 uses that seed to create the HD wallet/key tree**, and then the **derivation path selects the particular child key**. `bitcoinjs-lib` turns that public key into an address according to the address type.

### 1\. Install the libraries

```powershell
npm install bip39 bip32 tiny-secp256k1 bitcoinjs-lib
```

### 2\. Complete JavaScript example

```javascript
import * as bip39 from "bip39";
import * as ecc from "tiny-secp256k1";
import { BIP32Factory } from "bip32";
import * as bitcoin from "bitcoinjs-lib";

const bip32 = BIP32Factory(ecc);

const mnemonic =
    "your twelve or twenty four word bip39 mnemonic here";

const derivationPath = "m/84'/0'/0'/0/0";

const network = bitcoin.networks.bitcoin;

// BIP39:
// mnemonic -> 512-bit seed
const seed = await bip39.mnemonicToSeed(mnemonic);

// BIP32:
// seed -> master HD node
const root = bip32.fromSeed(seed, network);

// BIP32:
// master node -> child node at derivation path
const child = root.derivePath(derivationPath);

// Public key
const publicKey = Buffer.from(child.publicKey);

// Generate address
const { address } = bitcoin.payments.p2wpkh({
    pubkey: publicKey,
    network
});

console.log("Address:", address);
console.log("Derivation path:", derivationPath);
console.log("Public key:", publicKey.toString("hex"));
```

For an actual BIP84 path such as:

```
m/84'/0'/0'/0/0
```

the resulting address will be a **native SegWit P2WPKH address**, normally beginning with:

```
bc1q...
```

---

## What each library is doing

| Stage | Library | Operation |
| --- | --- | --- |
| Mnemonic → seed | `bip39` | `mnemonicToSeed()` |
| Seed → master HD key | `bip32` | `fromSeed()` |
| Derive child | `bip32` | `derivePath()` |
| Elliptic-curve operations | `tiny-secp256k1` | Used internally by BIP32/BitcoinJS |
| Public key → BTC address | `bitcoinjs-lib` | `payments.*()` |

So conceptually:

```
mnemonic
   │
   │ BIP39
   ▼
seed
   │
   │ BIP32
   ▼
master HD node
   │
   │ m/84'/0'/0'/0/0
   ▼
child HD node
   │
   ├── child.privateKey
   │
   └── child.publicKey
              │
              │ P2WPKH
              ▼
          bc1q... address
```

### The critical part: the address type

The **derivation path alone does not completely tell `bitcoinjs-lib` how to encode the address**.

For example:

| Standard | Typical path | Address | `bitcoinjs-lib` payment |
| --- | --- | --- | --- |
| BIP44 | `m/44'/0'/0'/0/0` | `1...` | `p2pkh` |
| BIP49 | `m/49'/0'/0'/0/0` | `3...` | `p2sh({ redeem: p2wpkh(...) })` |
| BIP84 | `m/84'/0'/0'/0/0` | `bc1q...` | `p2wpkh` |
| BIP86 | `m/86'/0'/0'/0/0` | `bc1p...` | Taproot `p2tr` |

For example, **BIP44** would use:

```javascript
const { address } = bitcoin.payments.p2pkh({
    pubkey: Buffer.from(child.publicKey),
    network
});
```

giving a traditional:

```
1...
```

address.

For **BIP49**, you need the nested SegWit structure:

```javascript
const payment = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network
});

const { address } = bitcoin.payments.p2sh({
    redeem: payment,
    network
});
```

giving:

```
3...
```

And for **BIP84**:

```javascript
const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network
});
```

giving:

```
bc1q...
```

So if you're building your wallet-recovery implementation, I would structure it roughly as:

```
┌───────────────┐
          │ BIP39 mnemonic│
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │ BIP39 seed    │
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │ BIP32 root    │
          └───────┬───────┘
                  │
           derivationPath
                  │
                  ▼
          ┌───────────────┐
          │ child node    │
          └───────┬───────┘
                  │
             public key
                  │
    ┌─────────────┴─────────────┐
    ▼                           ▼
BIP44/49                     BIP84
address type                 address type
    │                           │
    ▼                           ▼
1... / 3...                  bc1q...
```

**One important point for your implementation:** if you already have both the **mnemonic and the exact derivation path**, you do **not** need to brute-force the path. You simply derive that path directly. If you're trying to recover wallets where the path is *unknown*, that's a separate problem: you'd need to test plausible standards/account/change/index paths and compare the resulting addresses against known wallet activity.