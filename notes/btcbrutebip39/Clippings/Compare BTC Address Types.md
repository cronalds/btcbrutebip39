---
title: "Compare BTC Address Types"
source: "https://chatgpt.com/c/6ab8abe8-0cf0-83ec-91f9-0af9b6de341a"
author:
published:
created: 2026-09-27
description: "ChatGPT conversation with 4 messages"
tags:
  - "clippings"
---
**You said**

difference between btc addresses like 18oB4LXP8K67c7sPw5xPe5cKzFCtSRNUPz and bc1qr6a22fuqqtscvup5unp0mlk9mvlwmcjrhfthq5 btc addresses, are they both using bip32?

---

**ChatGPT said**

Yes — **both can be generated from BIP32 HD wallets**, but the addresses represent **different Bitcoin output/address types**.

### Your two examples

| Address | Type | Encoding | Typical derivation |
| --- | --- | --- | --- |
| `18oB4LXP8K67c7sPw5xPe5cKzFCtSRNUPz` | **P2PKH** (legacy) | Base58Check | BIP44 → BIP32 |
| `bc1qr6a22fuqqtscvup5unp0mlk9mvlwmcjrhfthq5` | **P2WPKH** (native SegWit) | Bech32 | BIP84 → BIP32 |

The important distinction is:

> **BIP32 determines how the keys are derived. The address type determines how the derived public key is turned into a Bitcoin address.**

BIP44 explicitly builds on BIP32, while BIP84 defines a BIP32-based derivation scheme for native SegWit P2WPKH addresses. [^1]

---

## 1\. 18oB4L... — legacy P2PKH

An address beginning with **`1`** is normally a **P2PKH** address.

Conceptually:

```
BIP39 mnemonic
      │
      ▼
   seed
      │
      ▼
   BIP32
      │
      ▼
m/44'/0'/0'/0/0
      │
      ▼
private key
      │
      ▼
public key
      │
      ▼
HASH160(public key)
      │
      ▼
P2PKH script
      │
      ▼
Base58Check
      │
      ▼
18oB4LXP8K67c7sPw5xPe5cKzFCtSRNUPz
```

The usual BIP44 Bitcoin path is:

```
m/44'/0'/account'/change/addressIndex
```

For example:

```
m/44'/0'/0'/0/0
```

BIP44 specifies the hierarchy `m / purpose' / coin_type' / account' / change / address_index`, with BIP44 itself based on BIP32. [^1]

The resulting public key is converted into:

```
HASH160(pubkey)
```

and then wrapped in the traditional P2PKH script:

```
OP_DUP
OP_HASH160
<20-byte pubkey hash>
OP_EQUALVERIFY
OP_CHECKSIG
```

Bitcoin Core describes this as P2PKH. [^2]

---

Your second address:

```
bc1qr6a22fuqqtscvup5unp0mlk9mvlwmcjrhfthq5
```

is a **native SegWit P2WPKH** address.

The `bc1q` prefix is the giveaway:

```
bc1q...
│ │
│ └── witness version 0
└──── Bitcoin mainnet
```

It uses **Bech32** encoding, defined by BIP173. [^3]

The usual derivation is **BIP84**:

```
m/84'/0'/0'/0/0
```

BIP84 specifically defines:

```
m / 84' / 0' / account' / change / address_index
```

for P2WPKH accounts. [^4]

The overall process is:

```
BIP39 mnemonic
      │
      ▼
   seed
      │
      ▼
   BIP32
      │
      ▼
m/84'/0'/0'/0/0
      │
      ▼
private key
      │
      ▼
public key
      │
      ▼
HASH160(public key)
      │
      ▼
Witness v0 + 20-byte program
      │
      ▼
Bech32
      │
      ▼
bc1qr6a22fuqqtscvup5unp0mlk9mvlwmcjrhfthq5
```

BIP84 specifies the P2WPKH output as:

```
0 <20-byte-key-hash>
```

and uses Bech32 serialization. [^4]

---

## The key thing for your wallet project

Your previous understanding was essentially correct:

```
BIP39
        mnemonic
            │
            ▼
           seed
            │
            ▼
          BIP32
      HD key hierarchy
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
  BIP44          BIP84
  P2PKH         P2WPKH
     │             │
     ▼             ▼
 m/44'/...      m/84'/...
     │             │
     ▼             ▼
  pubkey        pubkey
     │             │
     ▼             ▼
 HASH160       HASH160
     │             │
     ▼             ▼
Base58Check    Bech32
     │             │
     ▼             ▼
   1...          bc1q...
```

So **BIP32 is underneath both**.

BIP44 and BIP84 aren't replacements for BIP32. They're **different standards for organizing BIP32-derived keys and constructing addresses from them**.

---

## Why the same seed can produce both

This is especially important for what you're doing with your seed-phrase derivation.

Suppose:

```
BIP39 seed
```

is the same.

You can derive:

```
m/44'/0'/0'/0/0
```

and get one public/private key pair.

Then derive:

```
m/49'/0'/0'/0/0
```

and get another.

And:

```
m/84'/0'/0'/0/0
```

and get another.

And:

```
m/86'/0'/0'/0/0
```

and get another.

These can correspond to:

| Purpose | Standard | Address type | Mainnet appearance |
| --- | --- | --- | --- |
| `44'` | BIP44 | P2PKH | `1...` |
| `49'` | BIP49 | P2SH-P2WPKH | `3...` |
| `84'` | BIP84 | P2WPKH | `bc1q...` |
| `86'` | BIP86 | P2TR/Taproot | `bc1p...` |

BIP49 defines the nested SegWit/P2SH scheme, while BIP84 defines native SegWit and BIP86 defines single-key Taproot derivation. [^5]

So your Bitcoin scanning approach of checking:

```
44'
49'
84'
86'
```

makes sense if your goal is to discover different common Bitcoin address families from the same seed.

### One subtle but very important point

You **cannot take the same derived key and simply change `1...` into `bc1q...`**.

For example:

```
m/44'/0'/0'/0/0
```

and

```
m/84'/0'/0'/0/0
```

are normally **different BIP32 child keys**, because the derivation paths are different.

The address encoding is only the *last part* of the process.

So:

```
BIP39
  ↓
BIP32
  ↓
derivation path
  ↓
child key
  ↓
address construction method
  ↓
address encoding
```

is the mental model I'd use for your implementation.

---

**You said**

ok, so it comes down to script type defined by the purpose in its derivation path?

---

**ChatGPT said**

Exactly — **with one important refinement**.

The **purpose field strongly indicates the address/script standard**, while the actual script type is determined by the corresponding BIP's rules for turning the derived key into an output.

```
BIP39 mnemonic
      ↓
    seed
      ↓
    BIP32
      ↓
derivation path
      ↓
purpose'
      ↓
┌───────────────┬────────────────────┐
│ 44'           │ BIP44 → P2PKH      │ → 1...
│ 49'           │ BIP49 → P2SH-P2WPKH│ → 3...
│ 84'           │ BIP84 → P2WPKH     │ → bc1q...
│ 86'           │ BIP86 → P2TR       │ → bc1p...
└───────────────┴────────────────────┘
```

So for Bitcoin:

| Purpose | Standard | Output/script type | Address |
| --- | --- | --- | --- |
| `44'` | BIP44 | P2PKH | `1...` |
| `49'` | BIP49 | P2SH-wrapped P2WPKH | `3...` |
| `84'` | BIP84 | Native SegWit P2WPKH | `bc1q...` |
| `86'` | BIP86 | Taproot P2TR | `bc1p...` |

### But don't think of purpose' itself as the script

For example:

```
m/84'/0'/0'/0/0
```

The `84'` tells your wallet:

> "Use the BIP84 derivation/address scheme."

Then BIP84 tells you how to construct the **P2WPKH output** from the resulting public key.

So it's more accurately:

```
purpose'
   ↓
select standard
   ↓
derive key according to that standard
   ↓
construct corresponding output script
   ↓
encode script/program as an address
```

This distinction becomes particularly useful in your JavaScript implementation because you can essentially have:

```
purpose 44 → derive → P2PKH → Base58Check
purpose 49 → derive → P2SH-P2WPKH → Base58Check
purpose 84 → derive → P2WPKH → Bech32
purpose 86 → derive → P2TR → Bech32m
```

So **yes: purpose is effectively the switch that tells your wallet which Bitcoin address/script scheme to use**, but the purpose number itself isn't what creates the script.

[^1]: [github.com](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki?utm_source=chatgpt.com)

[^2]: [github.com](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md?utm_source=chatgpt.com)

[^3]: [github.com](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki?plain=1&utm_source=chatgpt.com)

[^4]: [github.com](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki?utm_source=chatgpt.com)

[^5]: [bitcoin.org](https://bitcoin.org/bips/?utm_source=chatgpt.com)