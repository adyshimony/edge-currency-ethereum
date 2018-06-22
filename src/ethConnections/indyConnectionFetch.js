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

  async getAddressBalance (address: string): Promise<string> {
    const url = `/account/balance/${address}`
    console.log(`Indy getAddressBalance url: ${url}`)
    const balance = await this.connection.indyFetchGet(url)
    console.log(`Indy balance: ${balance.result} for account: ${address}`)
    return balance.result
  }

  async getTokenBalance (address: string, token: string): Promise<string> {
    const url = `/token/balance/${address}`
    console.log(`Indy getTokenBalance url: ${url}`)
    const balance = await this.connection.indyFetchGet(url)
    console.log(`Indy token balance: ${balance.result} for account: ${address}, token: ${token}`)
    return balance.result
  }

  async getHighestBlock (): Promise<number> {
    const url = `/mempool/highest`
    console.log(`Indy getHighestBlock url: ${url}`)
    const highetBlockNumberResult = await this.connection.indyFetchGet(url)
    console.log(`Indy highest block: ${highetBlockNumberResult.result}`)
    return highetBlockNumberResult.result
  }

  async getPendingTxs (address: string): Promise<Array<any>> {
    const url = `/mempool/txs/${address}`
    console.log(`Indy getPendingTxs url: ${url}`)
    const pendingTxs = await this.connection.indyFetchGet(url)
    console.log(`Indy return ${pendingTxs.count} pending Txs`)
    return pendingTxs.result
  }

  async getAddressTxs (address: string, startBlock: number, endBlock: number): Promise<Array<any>> {
    const url = `/account/${address}/${startBlock}/${endBlock}`
    console.log(`Indy getAddressTxs url: ${url}`)
    const accountTxs = await this.connection.indyFetchGet(url)
    console.log(`Indy return ${accountTxs.count} Txs for account: ${address} `)
    return accountTxs.result
  }

  async getTokenTxs (address: string, token: string, startBlock: number, endBlock: number): Promise<any> {
    const url = `/tokens/${address}/${token}/${startBlock}/${endBlock}`
    console.log(`Indy getTokenTxs url: ${url}`)
    const tokenTxs = await this.connection.indyFetchGet(url)
    console.log(`Indy return ${tokenTxs.count} Txs of token: ${token} for account: ${address} `)
    return tokenTxs.result
  }

  async getBlockTxs (block: string): Promise<Array<any>> {
    const url = `/mempool/block/${block}`
    console.log(`Indy getBlockTxs url: ${url}`)
    const blockTxs = await this.connection.indyFetchGet(url)
    console.log(`Indy return ${blockTxs.count} Txs of block: ${block} `)
    return blockTxs.result
  }
}

export { IndyConnectionFetch }
