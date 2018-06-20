/**
 * Created by adys on 06/13/2018.
 * @flow
 */

import type { EdgeIo } from 'edge-core-js'
import { ConnectionFetch } from '../ethTypes'
import { IndyConnectionFetch } from './indyConnectionFetch'
import { ThirdPartyConnectionFetch } from './thirdPartyConnectionFetch'

class ConnectionManager implements ConnectionFetch {
  primaryConnection: IndyConnectionFetch
  secondaryConnection: ThirdPartyConnectionFetch

  constructor (io: EdgeIo) {
    this.primaryConnection = new IndyConnectionFetch(io)
    this.secondaryConnection = new ThirdPartyConnectionFetch(io)
  }

  connectionType (): string {
    return 'connectionManager'
  }

  async getAddressBalance (address: string): Promise<string> {
    try {
      const res = await this.primaryConnection.getAddressBalance(address)
      return res
    } catch (error) {
      try {
        const res = await this.secondaryConnection.getAddressBalance(address)
        return res
      } catch (error) {
        throw error
      }
    }
  }

  async getTokenBalance (address: string, token: string): Promise<string> {
    try {
      const res = await this.primaryConnection.getTokenBalance(address, token)
      return res
    } catch (error) {
      try {
        const res = await this.secondaryConnection.getTokenBalance(address, token)
        return res
      } catch (error) {
        throw error
      }
    }
  }

  async getHighestBlock (): Promise<number> {
    try {
      const res = await this.primaryConnection.getHighestBlock()
      return res
    } catch (error) {
      try {
        const res = await this.secondaryConnection.getHighestBlock()
        return res
      } catch (error) {
        throw error
      }
    }
  }

  async getPendingTxs (address: string): Promise<any> {
    try {
      const res = await this.primaryConnection.getPendingTxs(address)
      const resObj = {
        'connectionType': this.primaryConnection.connectionType(),
        'result': res
      }
      return resObj
    } catch (error) {
      try {
        const res = await this.secondaryConnection.getPendingTxs(address)
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

  async getAddressTxs (address: string, startBlock: number, endBlock: number): Promise<Array<any>> {
    try {
      const res = await this.primaryConnection.getAddressTxs(address, startBlock, endBlock)
      return res
    } catch (error) {
      try {
        const res = await this.secondaryConnection.getAddressTxs(address, startBlock, endBlock)
        return res
      } catch (error) {
        throw error
      }
    }
  }

  async getTokenTxs (address: string, token: string, startBlock: number, endBlock: number): Promise<any> {
    try {
      const res = await this.primaryConnection.getTokenTxs(address, token, startBlock, endBlock)
      const resObj = {
        'connectionType': this.primaryConnection.connectionType(),
        'result': res
      }
      return resObj
    } catch (error) {
      try {
        const res = await this.secondaryConnection.getTokenTxs(address, token, startBlock, endBlock)
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

  async getBlockTxs (block: string): Promise<Array<any>> {
    try {
      const res = await this.primaryConnection.getBlockTxs(block)
      return res
    } catch (error) {
      try {
        const res = await this.secondaryConnection.getBlockTxs(block)
        return res
      } catch (error) {
        throw error
      }
    }
  }
}

export { ConnectionManager }
