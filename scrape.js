import fs from "node:fs/promises";

function satoshiToBTC(satoshiVal) {
  return satoshiVal / 100000000;
}

async function getBTCInfo({
  btcAddress = "18oB4LXP8K67c7sPw5xPe5cKzFCtSRNUPz", //! 18oB4LXP8K67c7sPw5xPe5cKzFCtSRNUPz = unicef
  api = "https://api.blockchain.info/explorer-gateway-kt/btc/address",
}) {
  let BTCSummary = await fetch(api, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ address: btcAddress }),
  });
  let BTCTransactions = await fetch(api + "/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ address: btcAddress, limit: 100, offset: 0 }),
  });
  let BTCSummaryData = await BTCSummary.json();
  let BTCTransactionData = transactionParse(await BTCTransactions.json());
  return { address: btcAddress, ...BTCSummaryData, BTCTransactionData };
}

function transactionParse(objArr) {
  let s = [];

  for (let transaction of objArr.transactions) {
    for (let inputs of transaction.inputs) {
      s.push({
        TransactionType: "receiving",
        address: inputs.address,
        value: satoshiToBTC(inputs.value),
        time: new Date(transaction.time * 1000),
      });
    }
    for(let outputs of transaction.outputs){
      s.push({
        TransactionType: "sending",
        address: outputs.address,
        value: satoshiToBTC(outputs.value),
        time: new Date(transaction.time * 1000),
      });
    }
  }

  return s;
}

function btcAddressSummary(btcInfoObject) {
  return `BTC Address: ${btcInfoObject.address} 
Confirmed balance: ${btcInfoObject.confirmed}
Unconfirmed balance: ${btcInfoObject.unconfirmed}
Unspent transaction output: ${btcInfoObject.utxo}
Transaction count: ${btcInfoObject.txCount}
Total received BTC in history: ${btcInfoObject.received}
Last 100 transactions: ${JSON.stringify(btcInfoObject.BTCTransactionData, null, 2)}`;
}

let theData = await getBTCInfo({});

fs.writeFile("./testScrape.json", JSON.stringify(theData, null, 2));

console.log(btcAddressSummary(theData));
