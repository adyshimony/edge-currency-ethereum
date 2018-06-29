/**
 * Created by adys on 06/13/18.
 * @flow
 */
import type { EdgeIo } from 'edge-core-js'
import type { ConnectionFetch } from '../ethTypes'
import { ConnectionUtils } from './connectionUtils'
import { sprintf } from 'sprintf-js'
import { otherSettings } from '../currencyInfoETH'
import { validate } from 'jsonschema'
import { EtherscanBalanceSchema, SuperethPendingSchema, EtherscanHighestSchema, EtherscanAccountTxSchema, EtherscanTokenTxSchema } from '../ethSchema'

// TODO: remove sprintf
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
    // const url = `?module=account&action=balance&address=${address}&tag=latest`
    const url = sprintf('?module=account&action=balance&address=%s&tag=latest', address)
    return this.fetch('address balance', url, EtherscanBalanceSchema)
  }

  async getTokenBalance (address: string, token: string): Promise<any> {
    // const url = `?module=account&action=tokenbalance&contractaddress=${token}&address=${address}&tag=latest`
    const url = sprintf('?module=account&action=tokenbalance&contractaddress=%s&address=%s&tag=latest', token, address)
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
    // const url = `${otherSettings.superethServers[0]}/v1/eth/main/txs/${address}`
    const url = sprintf('%s/v1/eth/main/txs/%s', otherSettings.superethServers[0], address)
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
    // const urlNew = `?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=asc`
    const url = sprintf('?module=account&action=txlist&address=%s&startblock=%d&endblock=%d&sort=asc', address, startBlock, endBlock)
    return this.fetch('address txs', url, EtherscanAccountTxSchema)
  }

  async getTokenTxs (address: string, token: string, startBlock: number, endBlock: number): Promise<any> {
    // const url = `?module=logs&action=getLogs&fromBlock=startBlock&toBlock=latest&address=${token}&topic0=${address}`
    const url = sprintf('?module=logs&action=getLogs&fromBlock=%d&toBlock=latest&address=%s&topic0=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef&topic0_1_opr=and&topic1=%s&topic1_2_opr=or&topic2=%s', startBlock, token, address, address)
    return this.fetch('token txs', url, EtherscanTokenTxSchema)
  }

  async getBlockTxs (block: string): Promise<any> {
    // TBD - just for compiling
    throw new Error('not implemented in etherscan')
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
