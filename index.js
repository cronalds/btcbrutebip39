import bip39 from "bip39";
import BIP32Factory from "bip32";
import { BIP32Interface } from "bip32";
import * as ecc from "tiny-secp256k1";
import fs from "node:fs/promises";

const bip32 = BIP32Factory(ecc);

let config = {
  doBip: false,
  bipLang: "english", //! chinese_simplified, chinese_traditional, czech, english, french, italian, japanese, korean, portuguese, spanish
  bipNum: 50000,
  bipOutCount: 10, //! how many files with bipNum bips as size
  windowSizes: [12, 15, 18, 21, 24],
  seeding: true,
};

if (config.doBip === true) {
  bip39.setDefaultWordlist(config.bipLang);
  let bip = [];
  for (let j = 0; j < config.bipOutCount; j++) {
    for (let i = 0; i < config.bipNum; i++) {
      bip.push(bip39.generateMnemonic());
    }

    let textFile = `./bipped/bippedText-${config.bipLang}-${j + 1}.txt`;

    // Check if a file exists and append to or write
    const exists = await fs
      .access(textFile)
      .then(() => fs.appendFile(textFile, ` ${bip.join(" ")}`))
      .catch(() => fs.writeFile(textFile, bip.join(" ")));

    bip = []; //! clear out the array so it doesnt just accumulate in size each time
  }
  console.log(
    `bipNum(${config.bipNum}) * 12 * bipOutCount(${config.bipOutCount}) = ${config.bipNum * 12 * config.bipOutCount} word count.`,
  );

  let bippedTextsFileNames = await fs.readdir("./bipped");

  let bippedTextsPaths = bippedTextsFileNames
    .map((item) => `./bipped/${item}`)
    .sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

  console.log(bippedTextsPaths);

  for (let path of bippedTextsPaths) {
    let currentFile = await fs.readFile(path, "utf8");
    let arr = currentFile.split(" ");
    let fileEnd = arr.length - 1;
    let bips = new Set();

    for (let windowStart = 0; windowStart < fileEnd - 2; windowStart++) {
      for (let size of config.windowSizes) {
        if (windowStart + size > fileEnd) {
          continue;
        }
        bips.add(arr.slice(windowStart, windowStart + size).join(" "));
      }
    }

    await fs.writeFile(
      `./handled/${path.split("/")[2]}`,
      JSON.stringify([...bips], null, 2),
    );
  }
}

if (config.seeding === true) {
  let handledTextsFileNames = await fs.readdir("./handled");

  let handledTextsPaths = handledTextsFileNames
    .map((item) => `./handled/${item}`)
    .sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

//! paths derivation

  for (let path of handledTextsPaths) {
    let currentFile = await fs.readFile(path, "utf8");

    for (let mnemonic of currentFile) {
      let seed = bip39.mnemonicToSeedSync(mnemonic);
      let master = bip32.fromSeed(seed);
      let child = master.derivePath(); //! need to derive all paths
    }
  }
}
