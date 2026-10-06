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

I think I see what you're doing: you're taking an existing derivation path and replacing the **coin type** component.

There is one bug in `currencyConverter()`:

```javascript
return parts.join("");
```

That removes all the `/` separators.

For example:

```javascript
currencyConverter("m/44'/0'/0'/0/0", "60'")
```

currently produces:

```
m44'60'0'00
```

You want:

```
m/44'/60'/0'/0/0
```

So:

```javascript
function currencyConverter(derivationPathString, currencyIdentifier) {
  let parts = derivationPathString.split("/");

  parts[2] = currencyIdentifier;

  return parts.join("/");
}
```

Then:

```javascript
currencyConverter("m/44'/0'/0'/0/0", "60'")
```

→

```
m/44'/60'/0'/0/0
```

And your array version is fine:

```javascript
function arrayCurrencyConverter(derivationPathArray, currencyIdentifier) {
  let arr = [];

  for (let item of derivationPathArray) {
    arr.push(currencyConverter(item, currencyIdentifier));
  }

  return arr;
}
```

You could also make it slightly shorter with `.map()`:

```javascript
function arrayCurrencyConverter(derivationPathArray, currencyIdentifier) {
  return derivationPathArray.map(
    item => currencyConverter(item, currencyIdentifier)
  );
}
```

### One important distinction

For your Bitcoin paths:

```
m/84'/0'/0'/0/0
       ↑
     coin type
```

changing:

```
0'
```

to:

```
60'
```

does produce the **Ethereum BIP44-style path**:

```
m/44'/60'/0'/0/0
```

But you shouldn't assume you can convert *all* Bitcoin paths this way.

For example:

```
m/84'/0'/0'/0/0
```

→

```
m/84'/60'/0'/0/0
```

is not automatically a valid Ethereum wallet path just because the coin type changed. **Purpose and derivation standard are also part of the cryptocurrency's wallet convention.**

So your converter is useful as a **coin-type substitution utility**, but I'd probably eventually call it something more explicit such as:

```javascript
replaceCoinType(path, coinType)
```

rather than `currencyConverter()`, because it isn't actually converting a currency—it is modifying one component of an HD derivation path.

---

**You said**

function currencyConverter(derivationPathString, currencyIdentifier){ let parts = derivationPathString.split("/"); parts\[2\] = currencyIdentifier; return parts.join("/"); } function arrayCurrencyConverter(derivationPathArray, currencyIdentifier){ let arr = \[\]; for(let item of derivationPathArray){ arr.push(currencyConverter(item, currencyIdentifier)); } return arr; }

---

**ChatGPT said**

Yep, that's correct now.

For example:

```javascript
currencyConverter("m/44'/0'/0'/0/0", "60'")
```

returns:

```
m/44'/60'/0'/0/0
```

And:

```javascript
arrayCurrencyConverter(
  [
    "m/44'/0'/0'/0/0",
    "m/44'/0'/0'/0/1",
    "m/84'/0'/0'/0/0",
  ],
  "60'",
)
```

returns:

```
[
  "m/44'/60'/0'/0/0",
  "m/44'/60'/0'/0/1",
  "m/84'/60'/0'/0/0",
]
```

So the transformation is:

```
m / purpose' / 0' / account' / chain / index
             │
             ↓
m / purpose' / currencyIdentifier / account' / chain / index
```

And importantly, your function **doesn't mutate the original path string or array**. `split()` creates a new array, and `arrayCurrencyConverter()` creates a new result array.

One thing to keep in mind later: this is a **coin-type substitution**, not necessarily a valid derivation-path conversion for every cryptocurrency. Your modular coin implementations can decide which resulting paths are actually supported.

---

**You said**

Litecoin Dogecoin Dash DigiByte Monacoin Vertcoin Groestlcoin Viacoin Ethereum Ethereum Classic Cardano Tezos Solana Avalanche, which of these are currently supported with my current implementation, and which ones need changes and what changes for them?

---

**ChatGPT said**

Yes. Given your **current implementation specifically**, I'd distinguish between:

1. **Path generation support** — can your existing `currencyConverter()` produce the relevant path?
2. **Actual wallet/address support** — can your current Bitcoin-oriented derivation/address code correctly derive and recognize that cryptocurrency?

Those are very different. Your converter only changes the `coin_type` component; it doesn't make the rest of the derivation/address process coin-compatible.

BIP44's generic structure is `m/purpose'/coin_type'/account'/change/address_index`, and SLIP-0044 assigns the coin-type numbers. [^1]

## Your 14 coins

| Coin | Coin type | Your current path generator | Changes needed for actual support |
| --- | --- | --- | --- |
| **Litecoin** | `2'` | ✅ Mostly | Litecoin network/address parameters; potentially SegWit variants |
| **Dogecoin** | `3'` | ✅ Mostly | Dogecoin network/address parameters; wallet-specific derivation quirks |
| **Dash** | `5'` | ✅ Mostly | Dash-specific address/network handling |
| **DigiByte** | `20'` | ✅ Mostly | DGB network/address handling; account/path conventions as required |
| **Monacoin** | `22'` | ✅ Mostly | MONA network/address handling |
| **Vertcoin** | `28'` | ✅ Mostly | VTC network/address handling |
| **Groestlcoin** | `17'` | ✅ Mostly | GRS network/address handling; SegWit derivation if scanning it |
| **Viacoin** | `14'` | ✅ Mostly | VIA network/address handling |
| **Ethereum** | `60'` | ⚠️ Path only | Ethereum key/address derivation |
| **Ethereum Classic** | `61'` | ⚠️ Path only | ETC key/address derivation |
| **Cardano** | `1815'` | ❌ | CIP-1852 path + Cardano/Ed25519 derivation |
| **Tezos** | `1729'` | ⚠️ Path only | Tezos-specific derivation/key/address encoding |
| **Solana** | `501'` | ⚠️ Path only | Solana/Ed25519 derivation + Solana address encoding |
| **Avalanche** | `9000'` / `9005'` | ⚠️ Path only | Chain-specific handling; C-Chain is EVM-compatible |

The relevant SLIP-0044 assignments include LTC `2`, DOGE `3`, DASH `5`, VIA `14`, GRS `17`, DGB `20`, MONA `22`, VTC `28`, ETH `60`, ETC `61`, SOL `501`, XTZ `1729`, ADA `1815`, and Avalanche `9000` /C-Chain `9005`. [^2]

---

## 1\. Litecoin → very easy extension

Your existing:

```
m/44'/0'/0'/0/0
```

can become:

```
m/44'/2'/0'/0/0
```

because Litecoin is coin type `2'`. [^1]

The important change isn't BIP39 or the basic BIP44 path.

It's your **address layer**.

You need Litecoin's:

```
private key
    ↓
public key
    ↓
HASH160 / script
    ↓
Litecoin address encoding
```

rather than blindly using Bitcoin's network/address parameters.

### Difficulty for your architecture

**Low.**

It's one of the easiest coins to add after Bitcoin because it fits the BIP44 model closely.

---

## 2\. Dogecoin → easy-ish

Path:

```
m/44'/3'/0'/0/0
```

Dogecoin is coin type `3'`. [^1]

Again, your main additional work is:

```
Dogecoin network parameters
+
Dogecoin address encoding
```

rather than fundamentally changing BIP39.

I'd make the coin module supply something like:

```
coin
 ├── coinType
 ├── network
 ├── derivation
 └── addressEncoder
```

rather than hardcoding Bitcoin's network object.

---

## 3\. Dash → easy-ish

```
m/44'/5'/0'/0/0
```

Dash is coin type `5'`. [^1]

Same broad category:

```
BIP39
 ↓
BIP32
 ↓
BIP44
 ↓
Dash coin type
 ↓
Dash network/address encoding
```

So your existing architecture is highly reusable here.

---

## 4\. DigiByte

```
m/44'/20'/0'/0/0
```

DigiByte is coin type `20'`. [^2]

Again, broadly Bitcoin-like.

You'd need the DGB-specific:

- network parameters
- address encoding
- potentially the wallet-specific derivation schemes you want to scan

So this belongs in the **"small coin module"** category.

---

## 5\. Monacoin

```
m/44'/22'/0'/0/0
```

Coin type `22'`. [^2]

Same general situation:

```
your BIP39 seed
       ↓
BIP32
       ↓
BIP44
       ↓
22'
       ↓
Monacoin address encoding
```

Small extension.

---

## 6\. Vertcoin

```
m/44'/28'/0'/0/0
```

Coin type `28'`. [^2]

Again, structurally close to Bitcoin.

You'll mainly be adding the VTC network/address configuration.

---

## 7\. Groestlcoin

```
m/44'/17'/0'/0/0
```

GRS is coin type `17'`. [^2]

This one deserves a little more attention because if you're trying to recover wallets rather than merely generate legacy addresses, you'll want to investigate the address standards/wallets you're targeting, including SegWit.

Your Bitcoin-style:

```
44'
49'
84'
86'
```

shouldn't automatically be assumed to apply identically to every altcoin.

---

## 8\. Viacoin

```
m/44'/14'/0'/0/0
```

VIA is coin type `14'`. [^2]

Again, fundamentally similar to the Bitcoin-like group.

---

## So these eight are your easiest expansion

I'd group:

```
┌───────────────────────────────┐
│ Bitcoin-like                 │
├───────────────────────────────┤
│ Litecoin       2'            │
│ Dogecoin       3'            │
│ Dash           5'            │
│ Viacoin       14'            │
│ Groestlcoin   17'            │
│ DigiByte      20'            │
│ Monacoin      22'            │
│ Vertcoin      28'            │
└───────────────────────────────┘
```

Your current path architecture can handle the **BIP44 portion** of these very naturally.

---

## 9\. Ethereum → fundamentally different address layer

You can generate:

```
m/44'/60'/0'/0/0
```

because Ethereum is coin type `60'`. [^2]

Your:

```javascript
currencyConverter(path, "60'")
```

can therefore generate the path.

But don't feed the resulting key into your Bitcoin address generator.

Ethereum is more like:

```
BIP39
 ↓
seed
 ↓
BIP32
 ↓
m/44'/60'/0'/0/0
 ↓
secp256k1 private key
 ↓
public key
 ↓
Keccak-256
 ↓
last 20 bytes
 ↓
Ethereum address
```

So I'd create an Ethereum module rather than modifying your Bitcoin address code.

---

## 10\. Ethereum Classic

Very similar architecture to Ethereum.

Coin type:

```
61'
```

so:

```
m/44'/61'/0'/0/0
```

is the obvious BIP44-style candidate. [^1]

The address construction is Ethereum-like, so you could potentially share most of your implementation:

```
ethereum/
    derivation.js
    address.js

ethereumClassic/
    derivation.js
    address.js
```

with shared lower-level EVM utilities.

For your project I'd probably do:

```
evm/
 ├── derivation.js
 └── address.js

coins/
 ├── ethereum.js
 └── ethereumClassic.js
```

---

## 11\. Cardano → completely different

This is where your current converter stops being useful.

Cardano uses **CIP-1852** for HD wallets. The Cardano CIP repository lists CIP-1852 as the active HD-wallet specification. [^3]

The structure is:

```
m / purpose' / coin_type' / account' / role / index
```

rather than your current generic Bitcoin:

```
m / purpose' / coin_type' / account' / change / address_index
```

For Cardano's Shelley-era structure, you'll commonly encounter:

```
m/1852'/1815'/0'/0/0
```

where:

```
1852' = Cardano HD wallet purpose
1815' = ADA
0'    = account
0     = external role
0     = address index
```

The role concept includes external `0`, internal `1`, and other Cardano-specific roles such as staking. [^4]

And critically, Cardano uses **Ed25519-based derivation**, so don't try to run it through your Bitcoin secp256k1 implementation.

### Therefore:

```
Your current converter
        ↓
       ❌

New Cardano module
        ↓
CIP-1852
        ↓
Cardano-specific key derivation
        ↓
Cardano address construction
```

---

## 12\. Tezos

Tezos has coin type:

```
1729'
```

in SLIP-0044. [^2]

But Tezos isn't simply:

```
Bitcoin path
+
1729
```

for every wallet.

You need a Tezos-specific module handling:

```
derivation
key type
address encoding
```

So I'd classify it:

**Path generation: easy**

**Actual recovery: separate implementation**

---

## 13\. Solana

Solana is coin type:

```
501'
```

in SLIP-0044. [^2]

But again, don't just do:

```javascript
currencyConverter("m/44'/0'/0'/0/0", "501'");
```

and assume the result is universally correct.

Solana wallets commonly use hardened derivation paths, with paths such as:

```
m/44'/501'/0'/0'
```

or other wallet-specific variants.

So Solana needs its own:

```
solana/
 ├── derivation.js
 ├── key.js
 └── address.js
```

and specifically an **Ed25519** implementation rather than your Bitcoin secp256k1 flow.

---

## 14\. Avalanche is the weird one

This one is worth treating separately.

SLIP-0044 currently has:

```
9000  AVAX
9005  AVAXC
```

for Avalanche and Avalanche C-Chain. [^2]

But Avalanche isn't one homogeneous address system.

You have:

```
Avalanche
├── X-Chain
├── P-Chain
└── C-Chain
```

The **C-Chain is EVM-compatible**, so its address/key machinery is much closer to Ethereum.

Therefore:

```
Avalanche C-Chain
       ↓
EVM-compatible
       ↓
Ethereum-style key/address handling
```

whereas X-Chain and P-Chain require Avalanche-specific handling.

So I'd make:

```
avalanche/
 ├── cChain/
 ├── xChain/
 └── pChain/
```

rather than treating "AVAX" as one ordinary coin.

---

## The architecture I'd use for your project

This actually reinforces your idea of modularising it.

```
BIP39
                        │
                        ↓
                   mnemonic seed
                        │
       ┌────────────────┼─────────────────┐
       │                │                 │
       ↓                ↓                 ↓
  Bitcoin-like         EVM             Special
       │                │                 │
       │                │                 │
  BTC/LTC/etc       ETH/ETC            ADA
       │            AVAX C             SOL
       │                                 XTZ
       ↓                                 ...
  BIP32/BIP44
       │
       ↓
coin-specific address
```

### I'd divide your 14 into three implementation tiers

| Tier | Coins | Why |
| --- | --- | --- |
| **Tier 1 — small changes** | LTC, DOGE, DASH, DGB, MONA, VTC, GRS, VIA | Bitcoin-like BIP44 structure; mainly coin/network/address differences |
| **Tier 2 — shared new module** | ETH, ETC, Avalanche C-Chain | EVM/secp256k1-style address machinery |
| **Tier 3 — dedicated modules** | ADA, XTZ, SOL, Avalanche X/P | Different derivation/address/key conventions |

The key insight is that your `currencyConverter()` is useful, but I'd regard it as a **path-template utility**, not the actual multi-coin support layer.

For example:

```javascript
currencyConverter("m/44'/0'/0'/0/0", "2'")
```

is perfectly valid as a string transformation:

```
m/44'/2'/0'/0/0
```

But then:

```
path
         ↓
    coin module
         ↓
 ┌───────┴────────┐
 │                │
Bitcoin-like     EVM
 │                │
network/address  keccak/address
```

The coin module is what makes the resulting path **meaningful for actual wallet recovery**.

And your current account-first ordering can remain useful across the modules where the account model applies; BIP44 explicitly defines sequential account discovery and the 20-address gap limit. [^1]

[^1]: [github.com](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki?utm_source=chatgpt.com)

[^2]: [github.com](https://github.com/satoshilabs/slips/blob/master/slip-0044.md?utm_source=chatgpt.com)

[^3]: [github.com](https://github.com/cardano-foundation/CIPs?utm_source=chatgpt.com)

[^4]: [github.com](https://github.com/cardano-foundation/CIPs/issues/889?utm_source=chatgpt.com)