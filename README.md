# proof-genration-api

This repository contains Proof Generation API to fetch data to support Matic SDK. The Proof Generation API primarily helps the Matic SDK by executing a few heavy processes
on a dedicated backend server. Proof generation and block inclusion check are some of the endpoints on this Proof Generation API. The logic behind these API's involves making several RPC calls to the Polygon chain in order to generate the proof or check block checkpoint inclusion

## Installation

```bash
$ git clone https://github.com/maticnetwork/proof-generation-api
$ cd proof-generation-api
$ npm install

```

Create a 'config.yml' file in the Proof Generation Api directory. Refer to 'config.yml.sample' for the example data that needs to be added to 'config.yml'. You can add any number fallback RPCs for polygon mainnet and etheruem to facilitate RPC rotation in case of an error. If you add any other config variables, please make sure you make the necessary changes to "src/config/globals.js".


For development

```bash
# For APIs
$ npm run dev
```

For production

```bash
# For APIs
$ npm run start
```

With PM2

```bash
$ pm2 start processes.yml
```

To test the API

```bash
# To test API
$ npm run test
```

## API Endpoints

The following endpoints with the exception of "list all" and "healthcheck" are written for Polygon Mainnet. **In order to query the Mumbai Testnet, replace 'matic' in the endpoint path to 'mumbai'.**

  - Response Statuses:
    - '200': A successful response
    - '404': Invalid parameters
    - '404': No Block found
    - '500': Internal Server Error

### List all endpoints

* GET `/`
  - summary: Check all the endpoints

### Health-check

* GET `/health-check`
  - sumamry: Check if the server is running. Returns status 200

### Block inclusion in checkpoint

* GET `/api/v1/matic/block-included/{blockNumber}`  
  - summary: Check if a block is checkpointed

  - description: Checks if a block on Polygon Mainnet has been checkpointed to the Ethereum Mainnet by the validators. Also this endpoint returns details of the checkpoint in which the block has been included.

  - parameters:
    1. - name: blockNumber
       - in: path
       - description: block number to query
       - required: true

  - successful response body:
    ```
      {
        "headerBlockNumber": hex value of the header block number,
        "blockNumber": queried block number,
        "start": start block number of the range which includes the queried block number,
        "end": end block number of the range which includes the queried block number,
        "proposer": proposer's address,
        "root": root of the checkpoint,
        "createdAt": checkpoint timestamp,
        "message": "success"
      }
      ```


### Exit Payload

* GET `/api/v1/matic/exit-payload/{burnTxHash}?eventSignature={eventSignature}`   
  - summary: Returns the payload to complete the exit/proof submission.

  - description: Returns the input payload that has to be passed to the exit() function on the RootChainManager contract on the Ethereum Mainnet.

  - parameters:
    1. - name: burnTxHash
       - in: path
       - description: burn TransactionHash
       - required: true

    2. - name: eventSignature
       - in: query
       - description: event signature (keccack256 value of the corresponding Transfer function)
       - required: true

    3. - name: tokenIndex
       - in: query
       - description: Index of the tokenId in the tokenIds list in burnTransaction
       - required: false

  - successful response body:
    ```
      {
        "message": "Payload generation success",
        "result": exit proof
      }
    ```

### All Exit Payloads

* GET `/api/v1/matic/all-exit-payloads/{burnTxHash}?eventSignature={eventSignature}`   
  - summary: Returns an array of payloads of all tokens in a particular burnTx to complete the exit/proof submission.

  - description: Returns the input payloads that has to be passed individually to the exit() function on the RootChainManager contract on the Ethereum Mainnet.

  - parameters:
    1. - name: burnTxHash
       - in: path
       - description: burn TransactionHash
       - required: true

    2. - name: eventSignature
       - in: query
       - description: event signature (keccack256 value of the corresponding Transfer function)
       - required: true

  - successful response body:
    ```
      {
        "message": "Payload generation success",
        "result": [exit proof 1, exit proof 2, ...]
      }
    ```

### Fast Merkle Proof

* GET `/api/v1/matic/fast-merkle-proof?start={Start}&end={End}&number={BlockNumber}`
  - summary: Returns the fast merkle block proof.

  - description: Returns the block proof by making use of an optimised logic that gets the block details with minimum possible RPC calls to the Polygon Mainnet. This block proof can be further used to create the final payload that has to be used to complete the exit/proof submission step on the Ethereum mainnet.

  - parameters:
    1. - name: start
       - in: query
       - description: start block number of the range which includes the block number to query
       - required: true
    2. - name: end
       - in: query
       - description: end block number of the range which includes the block number to query
       - required: true
    3. - name: number
       - in: query
       - description: block number to query
       - required: true

  - successful response body:
    ```
      {
        "proof": proof value
      }
    ```
