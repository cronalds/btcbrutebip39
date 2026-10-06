---
title: "Bitcoin wallet keys explained"
source: "https://chatgpt.com/c/6abb4471-c7f0-83ec-94b7-cfb438f63366"
author:
published:
created: 2026-09-29
description: "ChatGPT conversation with 5 messages"
tags:
  - "clippings"
---
**ChatGPT said**

Yes — **you can access/control Bitcoin with the private key alone**. You do not strictly need the seed phrase, but there are important differences between storing a seed phrase and storing individual keys.

### The relationship

For a typical Bitcoin wallet:

```
BIP39 seed phrase
       │
       ▼
   seed (512-bit)
       │
       ▼
   BIP32 master key
       │
       ├──► child private key
       │          │
       │          ▼
       │      public key
       │          │
       │          ▼
       │       address
       │
       ├──► another child private key
       │          │
       │          ▼
       │      another public key
       │          │
       │          ▼
       │       another address
       │
       └──► ...
```

And yes, **the public key is mathematically derived from the private key**:

```
private key
     │
     │ elliptic-curve multiplication
     ▼
public key
     │
     │ HASH160 / SHA256 etc., depending on address type
     ▼
Bitcoin address
```

The important one-way property is:

```
private key ─────────► public key ─────────► address
     X                    ↑                    ↑
     └──── cannot practically reverse ────────┘
```

You **cannot practically derive the private key from the public key**.

---

## So what do you actually need?

There are several different situations.

| What you have | Can control BTC? | Can recover other wallet keys? |
| --- | --- | --- |
| Seed phrase | ✅ Yes | ✅ Yes |
| Master private key | ✅ Yes | ✅ Usually, depending on what exactly you have |
| Individual child private key | ✅ Yes, for coins controlled by that key | ❌ No |
| Public key | ❌ No | ❌ No |
| Address | ❌ No | ❌ No |

The distinction between **individual private keys** and a **seed phrase/master key** is particularly important.

### Example

Suppose your seed generated:

```
m/84'/0'/0'/0/0
m/84'/0'/0'/0/1
m/84'/0'/0'/0/2
m/84'/0'/0'/0/3
...
```

You might have:

```
private key A → public key A → bc1q....
private key B → public key B → bc1q....
private key C → public key C → bc1q....
```

If you save **private key B**, you can spend BTC belonging to address B.

But private key B doesn't give you:

```
private key A
private key C
private key D
...
```

Whereas the seed phrase can regenerate the entire deterministic wallet.

---

## Why wallets use seed phrases

The seed phrase is essentially a **human-friendly backup for the whole key hierarchy**.

For example:

```
12/24 words
      │
      ▼
BIP39 seed
      │
      ▼
BIP32 master key
      │
      ├── account 0
      │    ├── external addresses
      │    └── change addresses
      │
      ├── account 1
      │
      └── account 2
```

That's why losing an individual private key isn't necessarily equivalent to losing the wallet.

A seed phrase lets you regenerate keys that haven't even been generated yet.

---

## Your Bitcoin project

This is especially relevant to what you've been doing with your BIP39/BIP32 code.

Your process is essentially:

```
mnemonic
   │
   ▼
mnemonicToSeedSync()
   │
   ▼
BIP32 master node
   │
   ▼
derivePath()
   │
   ▼
child private key
   │
   ▼
public key
   │
   ▼
scriptPubKey
   │
   ▼
address
```

So if your program generates:

```
mnemonic
    ↓
m/84'/0'/0'/0/0
    ↓
privateKey
    ↓
publicKey
    ↓
bc1q...
```

you **could discard the mnemonic and retain the child private key**.

That particular private key can still be used to spend the UTXOs belonging to the corresponding key/script.

But you've thrown away the convenient ability to regenerate the rest of the wallet.

---

### One subtle but important point

Don't think of:

> "the private key is the wallet."

More accurately:

```
Bitcoin
   │
   ├── UTXO ── locked by ── scriptPubKey
   │
   └── you spend it by providing a valid unlocking/signature
                              │
                              ▼
                         private key
```

The Bitcoin network doesn't actually store a "wallet."

It stores **UTXOs and scripts**.

Your wallet software maintains the keys necessary to spend those UTXOs.

So you could have:

```
Seed phrase
    ↓
Wallet
    ↓
100 derived private keys
    ↓
100 addresses
    ↓
UTXOs distributed among those addresses
```

If you only retain one private key, you've retained control of the UTXOs associated with that key — **not necessarily everything that came from the original wallet**.

### In short

**Yes, you're correct:**

```
Private key → Public key → Address
```

And:

```
Seed phrase → master key → child private keys → public keys → addresses
```

So **a private key is sufficient to control the Bitcoin associated with that key**, while the **seed phrase is a backup/recovery mechanism for the entire deterministic key tree**.

For your wallet-recovery project, this distinction is also why scanning the derivation paths you were discussing matters: a seed phrase can have funds sitting at many different child paths, whereas a single recovered private key only tells you about that particular branch/key.

---

**You said**

ok so seed phrase for the 0-19 account/addresses, and the private key on a per wallet basis?

---

**ChatGPT said**

Almost — but there's one terminology correction that will make your BTC model much clearer.

### Think of it as seed → accounts → addresses → private keys

```
Seed phrase
    │
    ▼
Master key
    │
    ├── Account 0
    │     ├── Address 0 → Private key 0
    │     ├── Address 1 → Private key 1
    │     ├── ...
    │     └── Address 19 → Private key 19
    │
    ├── Account 1
    │     ├── Address 0 → Private key
    │     └── ...
    │
    └── Account 2
          └── ...
```

So if you're talking about the **first 20 receiving addresses of account 0**, then:

```
Seed phrase
    ↓
m/84'/0'/0'/0/0
m/84'/0'/0'/0/1
m/84'/0'/0'/0/2
...
m/84'/0'/0'/0/19
```

Each derivation produces a **different private key**, from which you derive the corresponding public key and address.

### But "private key per wallet" isn't quite right

A normal HD Bitcoin wallet doesn't generally have **one private key**.

It has potentially **thousands/millions of derived private keys**.

You could instead store:

| What you store | What it gives you |
| --- | --- |
| **Seed phrase** | Recovery of the whole HD wallet |
| **Master private key** | Recovery/derivation of descendants, depending on key type |
| **Individual child private key** | Control of that particular key/address |
| **Public key** | Identification/derivation of the corresponding address, but no spending ability |
| **Address** | Receive/observe, but no spending ability |

So for your project, I'd think of it as:

```
SEED PHRASE
                         │
                         ▼
                   HD WALLET TREE
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       Account 0      Account 1      Account 2
          │
          ▼
     External chain
          │
    ┌─────┼─────┐
    ▼     ▼     ▼
   #0     #1    #2 ... #19
    │
    ▼
Private key
    │
    ▼
Public key
    │
    ▼
Script
    │
    ▼
BTC address
```

**One important correction:** `0–19` are normally **address indexes**, not accounts. For example:

`m/84'/0'/0'/0/19`

means:

- `84'` = BIP84 purpose
- `0'` = Bitcoin
- `0'` = account 0
- `0` = external/receiving chain
- `19` = address index 19

So if you're scanning the first 20 addresses, you're scanning **20 addresses within account 0**, not 20 accounts.

---

**You said**

So if you're scanning the first 20 addresses, you're scanning **20 addresses within account 0**, not 20 accounts. /// yes but i can scan accounts incrementally also, or is there no point in doing that?

---

**ChatGPT said**

Yes — **you can absolutely scan accounts incrementally**, and there are situations where it makes sense. The important thing is that **account discovery works differently from address discovery**.

For BIP44/BIP49/BIP84/BIP86, the structure is:

```
m / purpose' / coin_type' / account' / change / address_index
                         │
                         └── account
```

So you could scan:

```
Account 0
  ├─ external 0–19
  └─ internal 0–19

Account 1
  ├─ external 0–19
  └─ internal 0–19

Account 2
  ├─ external 0–19
  └─ internal 0–19
...
```

### The catch: don't blindly scan accounts forever

BIP44 defines an **account discovery rule**: normally, you shouldn't use account `1` until account `0` has been used, and account `2` until account `1` has been used, etc.

In practical recovery software, you can therefore do something like:

```
Account 0
   │
   ├── scan addresses
   │
   └── any activity?
          │
       yes ──────► scan account 1
          │
        no
          │
          ▼
       stop
```

However, for **your particular recovery/scanning project**, you may want a more flexible strategy because you're trying to discover wallets rather than simply restore a wallet according to normal wallet-software behaviour.

For example:

```
Seed
 │
 ├── BIP44
 │    ├── Account 0 → addresses 0–19
 │    ├── Account 1 → addresses 0–19
 │    └── Account 2 → addresses 0–19
 │
 ├── BIP49
 │    ├── Account 0 → addresses 0–19
 │    ├── Account 1 → addresses 0–19
 │    └── ...
 │
 ├── BIP84
 │    ├── Account 0 → addresses 0–19
 │    ├── Account 1 → addresses 0–19
 │    └── ...
 │
 └── BIP86
      ├── Account 0 → addresses 0–19
      ├── Account 1 → addresses 0–19
      └── ...
```

You can then use your **"has activity → get full history"** approach:

```
derive address
      │
      ▼
check whether address has activity
      │
 ┌────┴────┐
 │         │
NO        YES
 │         │
 ▼         ▼
next     fetch full
address   history
```

### One important distinction

There are two separate things you're incrementing:

**Address discovery**

```
m/84'/0'/0'/0/0
m/84'/0'/0'/0/1
m/84'/0'/0'/0/2
...
```

**Account discovery**

```
m/84'/0'/0'/0/0
        ↑
     account 0

m/84'/0'/1'/0/0
        ↑
     account 1

m/84'/0'/2'/0/0
        ↑
     account 2
```

So yes, **account scanning is valid**, but you generally want to scan addresses within an account before advancing to the next account.

For your implementation, I'd make the hierarchy explicit:

```
purpose
  ↓
coin
  ↓
account
  ↓
chain
  ↓
addressIndex
```

and have configurable limits such as:

```
purposes:       [44, 49, 84, 86]
accounts:       0 → N
chains:         [0, 1]
addresses:      0 → 19
```

Then your scanner can progressively expand only when activity justifies it, rather than generating an enormous number of addresses up front.