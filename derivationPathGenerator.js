import fs from "node:fs/promises";

/*
!| Cryptocurrency         |                        Common coin type | Example BIP44-style path |
!| ---------------------- | --------------------------------------: | ------------------------ |
!| Bitcoin (BTC)          |                                    `0'` | `m/44'/0'/0'/0/0`        |
!| Litecoin (LTC)         |                                    `2'` | `m/44'/2'/0'/0/0`        |
!| Dogecoin (DOGE)        |                                    `3'` | `m/44'/3'/0'/0/0`        |
!| Dash (DASH)            |                                    `5'` | `m/44'/5'/0'/0/0`        |
!| DigiByte (DGB)         |                                   `20'` | `m/44'/20'/0'/0/0`       |
!| Monacoin (MONA)        |                                   `22'` | `m/44'/22'/0'/0/0`       |
!| Vertcoin (VTC)         |                                   `28'` | `m/44'/28'/0'/0/0`       |
!| Groestlcoin (GRS)      |                                   `17'` | `m/44'/17'/0'/0/0`       |
!| Viacoin (VIA)          |                                   `14'` | `m/44'/14'/0'/0/0`       |
!| Ethereum (ETH)         |                                   `60'` | `m/44'/60'/0'/0/0`       |
!| Ethereum Classic (ETC) |                                   `61'` | `m/44'/61'/0'/0/0`       |
!| Cardano (ADA)          |                                 `1815'` | `m/1852'/1815'/0'/0/0`   |
*/

/*
!BIP39 mnemonic
!      ↓
!    seed
!      ↓
!    BIP32
!      ↓
!derivation path
!      ↓
!purpose'
!      ↓
!┌───────────────┬────────────────────┐
!│ 44'           │ BIP44 → P2PKH      │ → 1...
!│ 49'           │ BIP49 → P2SH-P2WPKH│ → 3...
!│ 84'           │ BIP84 → P2WPKH     │ → bc1q...
!│ 86'           │ BIP86 → P2TR       │ → bc1p...
!└───────────────┴────────────────────┘
*/

function currencyConverter(derivationPathString, currencyIdentifier){
  let parts = derivationPathString.split("/");
  parts[2] = currencyIdentifier;
  return parts.join("/");
}

function arrayCurrencyConverter(derivationPathArray, currencyIdentifier){
  let arr = [];
  for(let item of derivationPathArray){
    arr.push(currencyConverter(item, currencyIdentifier));
  }
  return arr;
}

let derivationPathPurposes = [44, 49, 84, 86];
let derivationPath = ({ purpose = 44, address = 0, account = 0, chain = 0 }) =>
  `m/${purpose}'/0'/${account}'/${chain}/${address}`;
/*
  m/84'/0'/0'/0/0
    │  │   │  │ │
    │  │   │  │ └─ address index; 0-19
    │  │   │  └─── chain: 0 external, 1 change
    │  │   └─────── account; 0-19
    │  └─────────── Bitcoin(0 means bitcoin)
    └─────────────── purpose / wallet standard

    for each supported purpose
    for each account
        scan external addresses
        use gap-limit/discovery rules

        if account is discovered:
            scan relevant change addresses
*/
let pathsExternal = [];
let pathsInternal = [];
for (let purpose of derivationPathPurposes) {
  for (let acc = 0; acc <= 19; acc++) {
    for (let addr = 0; addr <= 19; addr++) {
      pathsExternal.push(
        derivationPath({ purpose, address: addr, account: acc, chain: 0 }),
      );
      pathsInternal.push(
        derivationPath({ purpose, address: addr, account: acc, chain: 1 }),
      );
    }
  }
}

/*  
! 48 is different
m / purpose' / coin_type' / account' / script_type' / change / address_index

  m/48'/0'/0'/2'/0/0
     │  │  │  │  │ │
     │  │  │  │  │ └─ address index; 0-19
     │  │  │  │  └─── chain: 0 external, 1 change
     │  │  │  └─────── script type; e.g. 1' P2SH-P2WSH, 2' P2WSH, 3' P2SH ; 2' is most important
     │  │  └─────────── account; 0-19
     │  └─────────────── Bitcoin; 0 = mainnet, 1 = testnet
     └────────────────── purpose / BIP48 multisig
  */

let derivationPath48 = ({
  address = 0,
  account = 0,
  chain = 0,
  scriptType = 2,
}) => `m/48'/0'/${account}'/${scriptType}'/${chain}/${address}`;

for (let acc = 0; acc <= 19; acc++) {
  for (let addr = 0; addr <= 19; addr++) {
    for (let scr of [1, 2, 3]) {
      pathsExternal.push(
        derivationPath48({
          scriptType: scr,
          address: addr,
          account: acc,
          chain: 0,
        }),
      );
      pathsInternal.push(
        derivationPath48({
          scriptType: scr,
          address: addr,
          account: acc,
          chain: 1,
        }),
      );
    }
  }
}

//! sort logic !!!!!!!!
let tempExt = pathsExternal.filter(
  item => item.split("/")[3] === "0'",
);
let tempInt = pathsInternal.filter(
  item => item.split("/")[3] === "0'",
);

pathsExternal = [...tempExt, ...pathsExternal.filter(item => item.split("/")[3] !== "0'")]
pathsInternal = [...tempInt, ...pathsInternal.filter(item => item.split("/")[3] !== "0'")]

await fs.writeFile(
  `./derivationPaths/external.json`,
  JSON.stringify(pathsExternal, null, 2),
);
await fs.writeFile(
  `./derivationPaths/internal.json`,
  JSON.stringify(pathsInternal, null, 2),
);
