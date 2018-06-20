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
    const balance = await this.connection.indyFetchGet(url)
    console.log(`Indy balance: ${balance} for account: ${address}`)
    return balance.result
  }

  async getTokenBalance (address: string, token: string): Promise<string> {
    const url = `/token/balance/${address}`
    const balance = await this.connection.indyFetchGet(url)
    console.log(`Indy token balance: ${balance} for account: ${address}, token: ${token}`)
    return balance.result
  }

  async getHighestBlock (): Promise<number> {
    const url = `/mempool/highest`
    console.log('Indy getHighestBlock')
    const highetBlockNumberResult = await this.connection.indyFetchGet(url)
    console.log(`Indy highest block: ${highetBlockNumberResult.result}`)
    return highetBlockNumberResult.result
  }

  async getPendingTxs (address: string): Promise<Array<any>> {
    const url = `/mempool/pending${address}`
    const pendingTxs = await this.connection.indyFetchGet(url)
    console.log(`Indy return ${pendingTxs.length} pending Txs`)
    return pendingTxs.result
  }

  async getAddressTxs (address: string, startBlock: number, endBlock: number): Promise<Array<any>> {
    const url = `/account/${address}/${startBlock}/${endBlock}`
    const accountTxs = await this.connection.indyFetchGet(url)
    console.log(`Indy return ${(accountTxs.length ? accountTxs.length : 0)} Txs for account: ${address} `)
    return accountTxs.result
  }

  async getTokenTxs (address: string, token: string, startBlock: number, endBlock: number): Promise<any> {
    const url = `/tokens/${address}/${token}/${startBlock}/${endBlock}`
    const tokenTxs = await this.connection.indyFetchGet(url)
    console.log(`Indy return ${(tokenTxs.length ? tokenTxs.length : 0)} Txs of token: ${token} for account: ${address} `)
    return tokenTxs.result
  }

  async getBlockTxs (block: string): Promise<Array<any>> {
    const url = `/mempool/block/${block}`
    const blockTxs = await this.connection.indyFetchGet(url)
    console.log(`Indy return ${blockTxs.length} Txs of block: ${block} `)
    return blockTxs.result
  }
}

export { IndyConnectionFetch }
