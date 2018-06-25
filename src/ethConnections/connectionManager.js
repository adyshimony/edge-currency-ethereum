/**
 * Created by adys on 06/13/2018.
 * @flow
 */

import type { EdgeIo } from 'edge-core-js'
import { ConnectionFetch } from '../ethTypes'
import { IndyConnectionFetch } from './indyConnectionFetch'
import { ThirdPartyConnectionFetch } from './thirdPartyConnectionFetch'

class ConnectionManager implements ConnectionFetch {
  primaryConnection: any
  secondaryConnection: any

  constructor (io: EdgeIo, indy: boolean = true) {
    this.primaryConnection = indy ? new IndyConnectionFetch(io) : new ThirdPartyConnectionFetch(io)
    this.secondaryConnection = !indy ? new ThirdPartyConnectionFetch(io) : new IndyConnectionFetch(io)
  }

  connectionType (): string {
    return 'connectionManager'
  }

  async callConnectionGet (getFunction: string, ...args: any[]): Promise<any> {
    try {
      const res = await this.primaryConnection[getFunction](...args)
      const resObj = {
        'connectionType': this.primaryConnection.connectionType(),
        'result': res
      }
      return resObj
    } catch (error) {
      try {
        const res = await this.secondaryConnection[getFunction](...args)
        const resObj = {
          'connectionType': this.primaryConnection.connectionType(),
          'result': res
        }
        return resObj
      } catch (error) {
        throw error
      }
    }
  }

  async getAddressBalance (address: string): Promise<string> {
    return this.callConnectionGet('getAddressBalance', address)
  }

  async getTokenBalance (address: string, token: string): Promise<string> {
    return this.callConnectionGet('getTokenBalance', address, token)
  }

  async getHighestBlock (): Promise<number> {
    return this.callConnectionGet('getHighestBlock')
  }

  async getPendingTxs (address: string): Promise<any> {
    return this.callConnectionGet('getPendingTxs', address)
  }

  async getAddressTxs (address: string, startBlock: number, endBlock: number): Promise<Array<any>> {
    return this.callConnectionGet('getAddressTxs', address, startBlock, endBlock)
  }

  async getTokenTxs (address: string, token: string, startBlock: number, endBlock: number): Promise<any> {
    return this.callConnectionGet('getTokenTxs', address, token, startBlock, endBlock)
  }

  async getBlockTxs (block: string): Promise<Array<any>> {
    return this.callConnectionGet('getBlockTxs', block)
  }
}

export { ConnectionManager }
