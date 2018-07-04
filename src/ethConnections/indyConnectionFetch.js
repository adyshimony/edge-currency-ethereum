/**
 * Created by adys on 06/13/2018.
 * @flow
 */
import type { EdgeIo, EdgeTransaction } from 'edge-core-js'
import type { ConnectionFetch, BroadcastResults } from '../ethTypes'
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
    return this.fetch('address balance', '/account/balance', address)
  }

  async getTokenBalance (address: string, token: string): Promise<string> {
    return this.fetch('token balance', '/token/balance', address, token)
  }

  async getHighestBlock (): Promise<number> {
    return this.fetch('highest block', '/mempool/highest')
  }

  async getPendingTxs (address: string): Promise<Array<any>> {
    return this.fetch('pending txs', '/mempool/txs', address)
  }

  async getAddressTxs (address: string, startBlock: number, endBlock: number): Promise<Array<any>> {
    return this.fetch('address txs', '/account', address, startBlock, endBlock)
  }

  async getTokenTxs (address: string, token: string, startBlock: number, endBlock: number): Promise<any> {
    return this.fetch('token txs', '/tokens', address, token, startBlock, endBlock)
  }

  async getBlockTxs (block: string): Promise<Array<any>> {
    return this.fetch('block txs', '/mempool/block', block)
  }

  async broadcastTransaction (edgeTransaction: EdgeTransaction): Promise<any> {
    const indyResponse = await this.connection.indyFetchGet(`/mempool/sendtx/${edgeTransaction.signedTx}`)

    const results: Array<BroadcastResults | null> = [null, null]
    const errors: Array<Error | null> = [null, null]

    const result: BroadcastResults = {
      incrementNonce: false,
      decrementNonce: false
    }

    if (!indyResponse.result) {
      console.log('Error sending indy transaction')
      if (indyResponse.message.includes('same hash was already imported')) {
        result.incrementNonce = true
        results[0] = result
        errors[1] = new Error('same hash was already imported')
      }
    }

    const response = {
      'results': results,
      'errors': errors
    }

    return response
  }
}

export { IndyConnectionFetch }
