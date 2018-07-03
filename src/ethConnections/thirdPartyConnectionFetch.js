/**
 * Created by adys on 06/13/18.
 * @flow
 */
import type { EdgeIo, EdgeTransaction } from 'edge-core-js'
import type { ConnectionFetch, BroadcastResults } from '../ethTypes'
import { ConnectionUtils } from './connectionUtils'
import { otherSettings } from '../currencyInfoETH'
import { validate } from 'jsonschema'
import { sprintf } from 'sprintf-js'
import { EtherscanBalanceSchema, SuperethPendingSchema, EtherscanHighestSchema, EtherscanAccountTxSchema, EtherscanTokenTxSchema } from '../ethSchema'

class ThirdPartyConnectionFetch implements ConnectionFetch {
  connection: ConnectionUtils
  constructor (io: EdgeIo) {
    this.connection = new ConnectionUtils(io)
  }

  connectionType (): string {
    return 'etherscan'
  }

  async fetch (apiName: string, url: string, validationObject: any): Promise<any> {
    const response = await this.connection.etherscanFetchGet(url)
    const valid = this.validateObject(response, validationObject)
    if (valid) {
      console.log(`Etherscan ${apiName} return : ${response.result} for url: ${url}`)
      return response.result
    } else {
      throw new Error(`Error validation etherscan ${apiName} url: ${url}`)
    }
  }

  async getAddressBalance (address: string): Promise<any> {
    // const url = sprintf('?module=account&action=balance&address=%s&tag=latest', address)
    const url = `?module=account&action=balance&address=${address}&tag=latest`
    return this.fetch('address balance', url, EtherscanBalanceSchema)
  }

  async getTokenBalance (address: string, token: string): Promise<any> {
    // const url = sprintf('?module=account&action=tokenbalance&contractaddress=%s&address=%s&tag=latest', token, address)
    const url = `?module=account&action=tokenbalance&contractaddress=${token}&address=${address}&tag=latest`
    return this.fetch('token balance', url, EtherscanBalanceSchema)
  }

  async getHighestBlock (): Promise<any> {
    const url = '?module=proxy&action=eth_blockNumber'
    const res = await this.fetch('highest block', url, EtherscanHighestSchema)
    const highetBlockNumber: number = parseInt(res, 16)
    console.log(`Etherscan getHighestBlock after parsing: ${highetBlockNumber}`)
    return highetBlockNumber
  }

  async getPendingTxs (address: string): Promise<any> {
    // const url = sprintf('%s/v1/eth/main/txs/%s', otherSettings.superethServers[0], address)
    const url = `${otherSettings.superethServers[0]}/v1/eth/main/txs/${address}`
    const response = await this.connection.superEthfetchGet(url)
    const valid = this.validateObject(response, SuperethPendingSchema)
    if (valid) {
      console.log(`supereth pending tx return : ${response.result} for url: ${url}`)
      return response.result
    } else {
      throw new Error(`Error validation etherscan supereth pending tx url: ${url}`)
    }
  }

  async getAddressTxs (address: string, startBlock: number, endBlock: number): Promise<any> {
    // const url = sprintf('?module=account&action=txlist&address=%s&startblock=%d&endblock=%d&sort=asc', address, startBlock, endBlock)
    const url = `?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=asc`
    return this.fetch('address txs', url, EtherscanAccountTxSchema)
  }

  async getTokenTxs (address: string, token: string, startBlock: number, endBlock: number): Promise<any> {
    const tokenTransferTopicCode = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    const urlTest = sprintf('?module=logs&action=getLogs&fromBlock=%d&toBlock=latest&address=%s&topic0=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef&topic0_1_opr=and&topic1=%s&topic1_2_opr=or&topic2=%s', startBlock, token, address, address)
    const url = `?module=logs&action=getLogs&fromBlock=${startBlock}&toBlock=latest&address=${token}&topic0=${tokenTransferTopicCode}&topic0_1_opr=and&topic1=${address}&topic1_2_opr=or&topic2=${address}`
    if (!url.localeCompare(urlTest)) {
      console.log('error in tx string')
    } else {
      console.log('OK tx string')
    }
    return this.fetch('token txs', url, EtherscanTokenTxSchema)
  }

  async getBlockTxs (block: string): Promise<any> {
    // TBD - just for compiling
    throw new Error('not implemented in etherscan')
  }

  async broadcastTransaction (edgeTransaction: EdgeTransaction): Promise<any> {
    const results: Array<BroadcastResults | null> = [null, null]
    const errors: Array<Error | null> = [null, null]

    // Because etherscan will allow use of a nonce that's too high, only use it if Blockcypher fails
    // If we can fix this or replace etherscan, then we can use an array of promises instead of await
    // on each broadcast type
    try {
      results[0] = await this.broadcastBlockCypher(edgeTransaction)
    } catch (e) {
      errors[0] = e
    }

    if (errors[0]) {
      try {
        results[1] = await this.broadcastEtherscan(edgeTransaction)
      } catch (e) {
        errors[1] = e
      }
    }

    // Use code below once we actually use a Promise array and simultaneously broadcast with a Promise.all()
    //
    // for (let i = 0; i < results.length; i++) {
    //   results[i] = null
    //   errors[i] = null
    //   try {
    //     results[i] = await results[i]
    //   } catch (e) {
    //     errors[i] = e
    //   }
    // }

    return {
      'results': results,
      'errors': errors
    }
  }

  async broadcastEtherscan (edgeTransaction: EdgeTransaction): Promise<BroadcastResults> {
    const result: BroadcastResults = {
      incrementNonce: false,
      decrementNonce: false
    }
    const transactionParsed = JSON.stringify(edgeTransaction, null, 2)

    console.log(`Etherscan: sent transaction to network:\n${transactionParsed}\n`)
    const url = `?module=proxy&action=eth_sendRawTransaction&hex=${edgeTransaction.signedTx}`
    const jsonObj = await this.connection.etherscanFetchGet(url)

    console.log(`broadcastEtherscan jsonObj: ${jsonObj}`)

    if (typeof jsonObj.error !== 'undefined') {
      console.log('Error sending transaction')
      if (
        jsonObj.error.code === -32000 ||
        jsonObj.error.message.includes('nonce is too low') ||
        jsonObj.error.message.includes('nonce too low') ||
        jsonObj.error.message.includes('incrementing the nonce') ||
        jsonObj.error.message.includes('replacement transaction underpriced')
      ) {
        result.incrementNonce = true
      } else {
        throw (jsonObj.error)
      }
      return result
    } else if (typeof jsonObj.result === 'string') {
      // Success!!
      return result
    } else {
      throw new Error('Invalid return value on transaction send')
    }
  }

  async broadcastBlockCypher (edgeTransaction: EdgeTransaction): Promise<BroadcastResults> {
    const result: BroadcastResults = {
      incrementNonce: false,
      decrementNonce: false
    }

    const transactionParsed = JSON.stringify(edgeTransaction, null, 2)
    console.log(`Blockcypher: sent transaction to network:\n${transactionParsed}\n`)

    const url = sprintf('v1/eth/main/txs/push')
    const hexTx = edgeTransaction.signedTx.replace('0x', '')
    const jsonObj = await this.connection.fetchPostBlockcypher(url, {tx: hexTx})

    console.log(`broadcastBlockCypher jsonObj: ${jsonObj}`)
    if (typeof jsonObj.error !== 'undefined') {
      console.log('Error sending transaction')
      if (
        typeof jsonObj.error === 'string' &&
        jsonObj.error.includes('Account nonce ') &&
        jsonObj.error.includes('higher than transaction')
      ) {
        result.incrementNonce = true
      } else if (
        typeof jsonObj.error === 'string' &&
        jsonObj.error.includes('Error validating transaction') &&
        jsonObj.error.includes('orphaned, missing reference')
      ) {
        result.decrementNonce = true
      } else {
        throw (jsonObj.error)
      }
      return result
    } else if (jsonObj.tx && typeof jsonObj.tx.hash === 'string') {
      // Success!!
      return result
    } else {
      throw new Error('Invalid return value on transaction send')
    }
  }

  validateObject (object: any, schema: any) {
    const result = validate(object, schema)
    if (result.errors.length === 0) {
      return true
    } else {
      for (const n in result.errors) {
        const errMsg = result.errors[n].message
        console.log('ERROR: validateObject:' + errMsg)
      }
      return false
    }
  }
}

export { ThirdPartyConnectionFetch }
