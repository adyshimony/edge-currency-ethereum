/**
 * Created by adys on 06/13/2018.
 * @flow
 */
import type { EdgeIo } from 'edge-core-js'
import { ConnectionFetch } from '../ethTypes'
import { ConnectionUtils } from './connectionUtils'

class IndyConnectionFetch implements ConnectionFetch {
  connection: ConnectionUtils
  constructor (io: EdgeIo) {
    this.connection = new ConnectionUtils(io)
  }

  connectionType (): string {
    return 'indy'
  }

  async fetch (apiName: string, url: string, ...args: any[]): Promise<any> {
    for (const arg of args) {
      url += `/${arg}`
    }
    const response = await this.connection.indyFetchGet(url)
    console.log(`Indy ${apiName} return : ${response.result} for url: ${url}`)
    return response.result
  }

  async getAddressBalance (address: string): Promise<string> {
    return this.fetch('getAddressBalance', '/account/balance/', address)
  }

  async getTokenBalance (address: string, token: string): Promise<string> {
    return this.fetch('getTokenBalance', '/token/balance', address, token)
  }

  async getHighestBlock (): Promise<number> {
    return this.fetch('getHighestBlock', '/mempool/highest')
  }

  async getPendingTxs (address: string): Promise<Array<any>> {
    return this.fetch('getPendingTxs', '/mempool/txs', address)
  }

  async getAddressTxs (address: string, startBlock: number, endBlock: number): Promise<Array<any>> {
    return this.fetch('getAddressTxs', '/account', address, startBlock, endBlock)
  }

  async getTokenTxs (address: string, token: string, startBlock: number, endBlock: number): Promise<any> {
    return this.fetch('getTokenTxs', '/tokens', address, token, startBlock, endBlock)
  }

  async getBlockTxs (block: string): Promise<Array<any>> {
    return this.fetch('getBlockTxs', '/mempool/block', block)
  }
}

export { IndyConnectionFetch }
