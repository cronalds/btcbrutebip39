---
title: "Derivation Path Review"
source: "https://chatgpt.com/c/6ab347ab-7b24-83ec-a234-60332a364c28"
author:
published:
created: 2026-09-23
description: "ChatGPT conversation with 5 messages"
tags:
  - "clippings"
---
**ChatGPT said**

Yep 👍 That gives you the flat arrays with all **account 0 paths first**, while preserving the rest of the generated ordering.

Your current setup is now consistent with the approach you're planning:

```
account 0 → all candidate paths
account 1 → all candidate paths
account 2 → all candidate paths
...
account 19 → all candidate paths
```

and:

```
pathsExternal[i] ↔ pathsInternal[i]
```

still remains aligned for the corresponding generated candidates.

---

**You said**

what other cryptocurrencies use bip39

---

**ChatGPT said**

Yes — **BIP39 is used by a large number of cryptocurrencies and wallets**, but there's an important distinction:

> **BIP39 is a mnemonic/seed standard, not a cryptocurrency-specific standard.**

A BIP39 mnemonic can be converted into the same underlying seed, and different cryptocurrencies can then derive completely different keys/addresses from that seed using their own derivation paths and address schemes.

### Major examples

| Cryptocurrency | Common coin type | Example BIP44-style path |
| --- | --- | --- |
| Bitcoin (BTC) | `0'` | `m/44'/0'/0'/0/0` |
| Litecoin (LTC) | `2'` | `m/44'/2'/0'/0/0` |
| Dogecoin (DOGE) | `3'` | `m/44'/3'/0'/0/0` |
| Dash (DASH) | `5'` | `m/44'/5'/0'/0/0` |
| DigiByte (DGB) | `20'` | `m/44'/20'/0'/0/0` |
| Monacoin (MONA) | `22'` | `m/44'/22'/0'/0/0` |
| Vertcoin (VTC) | `28'` | `m/44'/28'/0'/0/0` |
| Groestlcoin (GRS) | `17'` | `m/44'/17'/0'/0/0` |
| Viacoin (VIA) | `14'` | `m/44'/14'/0'/0/0` |
| Ethereum (ETH) | `60'` | `m/44'/60'/0'/0/0` |
| Ethereum Classic (ETC) | `61'` | `m/44'/61'/0'/0/0` |
| Cardano (ADA) | `1815'` | `m/1852'/1815'/0'/0/0` |
| Tezos (XTZ) | `1729'` | wallet-dependent |
| Solana (SOL) | `501'` | wallet-dependent |
| Avalanche | `9000'` / other wallet-specific schemes | wallet-dependent |
| Cosmos ecosystem | varies | wallet-dependent |

These coin-type numbers come from the **SLIP-0044 registry**, which maintains registered coin types for BIP44-style deterministic wallets. [^1]

### But there's an important catch for your project

You **cannot assume that every cryptocurrency in SLIP-0044 simply works like Bitcoin**.

Think of it as:

```
BIP39 mnemonic
                   │
                   ↓
            BIP39 seed
                   │
                   ↓
            BIP32 / HD wallet
                   │
      ┌────────────┼─────────────┐
      ↓            ↓             ↓
    Bitcoin      Ethereum      Cardano
      │            │             │
derivation      derivation    derivation
  scheme          scheme         scheme
      │            │             │
      ↓            ↓             ↓
   BTC addr      ETH addr       ADA addr
```

For Bitcoin, your current work with:

```
m/44'/0'/...
m/49'/0'/...
m/84'/0'/...
m/86'/0'/...
```

is appropriate for the respective Bitcoin standards.

For Ethereum, for example:

```
m/44'/60'/0'/0/0
```

uses **coin type `60'`**, but Ethereum's address generation is fundamentally different from Bitcoin's. You don't take the resulting public key and run Bitcoin's address machinery over it.

Likewise Cardano uses different derivation conventions; its commonly used Shelley-era path is based on **BIP32-Ed25519** and BIP1852 rather than simply treating it as a Bitcoin-style BIP44 wallet.

### This is especially relevant to your recovery scanner

If you're thinking:

> "I have a BIP39 seed, so I should scan every cryptocurrency."

Then the architecture should eventually become:

```
BIP39 mnemonic
       │
       ↓
    seed
       │
       ├── BTC
       │    ├── BIP44
       │    ├── BIP49
       │    ├── BIP84
       │    ├── BIP86
       │    └── BIP48
       │
       ├── LTC
       │    └── Litecoin derivation/address rules
       │
       ├── DOGE
       │    └── Dogecoin derivation/address rules
       │
       ├── ETH
       │    └── Ethereum derivation/address rules
       │
       ├── ADA
       │    └── Cardano derivation rules
       │
       └── SOL
            └── Solana derivation rules
```

So **BIP39 is the common entry point**, while the derivation/address layer becomes cryptocurrency-specific.

Also, BIP44 itself specifies a **20-address gap limit** for external-chain discovery, which is why your eventual scanner architecture can reuse the same general discovery concept where the particular wallet standard supports it. [^2]

If your eventual objective is broad seed recovery, I'd separate your implementation into **`mnemonic → seed → coin → wallet standard → derivation → address → activity`** rather than trying to make the Bitcoin path generator itself handle every coin.

---

**You said**

but i could modularise the code and use respective libraries for the other cryptos to do it instead

---

**ChatGPT said**

Exactly. That's probably the cleaner architecture for what you're building.

You can make the **BIP39 seed generation the common layer**, then have a separate module for each cryptocurrency that knows how to turn that seed into its own candidate addresses.

```
BIP39 mnemonic
      │
      ↓
 mnemonicToSeed()
      │
      ↓
 ┌────┴─────────────────────────────┐
 │                                  │
 ↓                                  ↓
BTC module                       ETH module
 │                                  │
 ├─ BIP44                           └─ ETH derivation
 ├─ BIP49
 ├─ BIP84
 ├─ BIP86
 └─ BIP48
 │
 ↓
candidate addresses
 │
 ↓
activity scanner
```

### Something like

```
src/
├── mnemonic/
│   └── bip39.js
│
├── coins/
│   ├── bitcoin/
│   │   ├── derivation.js
│   │   ├── addresses.js
│   │   └── scanner.js
│   │
│   ├── ethereum/
│   │   ├── derivation.js
│   │   ├── addresses.js
│   │   └── scanner.js
│   │
│   ├── litecoin/
│   │   └── ...
│   │
│   ├── dogecoin/
│   │   └── ...
│   │
│   └── cardano/
│       └── ...
│
└── scanner/
    ├── discovery.js
    └── activity.js
```

The common interface could conceptually be:

```
coinModule
    │
    ├── deriveCandidates(seed)
    │
    ├── getAddress(candidate)
    │
    └── checkActivity(address)
```

Then your main program doesn't need to know how Ethereum, Bitcoin, Cardano, etc. actually derive their addresses:

```
for each coin module
       ↓
derive candidates
       ↓
check activity
       ↓
record hits
```

### The nice part

Your Bitcoin module can remain exactly where you're currently concentrating your effort:

```
Bitcoin
 ├── BIP44
 ├── BIP49
 ├── BIP84
 ├── BIP86
 └── BIP48
```

Then later:

```
Ethereum
 └── Ethereum-compatible HD derivation

Litecoin
 └── Litecoin derivation/address encoding

Dogecoin
 └── Dogecoin derivation/address encoding

Cardano
 └── Cardano-specific derivation

Solana
 └── Solana-specific derivation
```

And you can use **well-established libraries for the coin-specific cryptography** rather than implementing every curve, address format, serialization format, and derivation scheme yourself.

One thing I'd keep separate even within each coin is:

```
seed
 ↓
derivation
 ↓
key
 ↓
address
 ↓
activity
```

because then you can test each layer independently.

For example, your Bitcoin module could eventually expose something conceptually like:

```
bitcoin
  ├── derivePath()
  ├── deriveKey()
  ├── publicKeyToAddress()
  ├── discoverAccount()
  └── scanAddress()
```

while the Ethereum implementation might have a completely different internal implementation but expose the same high-level operations.

That's much more maintainable than trying to make one universal `derivationPath()` function handle every cryptocurrency.

[^1]: [github.com](https://github.com/satoshilabs/slips/blob/master/slip-0044.md?plain=1&utm_source=chatgpt.com)

[^2]: [github.com](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki?utm_source=chatgpt.com)