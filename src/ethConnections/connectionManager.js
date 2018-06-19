/**
 * Created by adys on 06/13/2018.
 * @flow
 */

import type { EdgeIo } from 'edge-core-js'
import { ConnectionFetch } from '../ethTypes'
import { IndyConnectionFetch } from './indyConnectionFetch'
import { ThirdPartyConnectionFetch } from './thirdPartyConnectionFetch'

class ConnectionManager implements ConnectionFetch {
  indyConnection: IndyConnectionFetch
  etherscanConnection: ThirdPartyConnectionFetch

  constructor (io: EdgeIo) {
    this.indyConnection = new IndyConnectionFetch(io)
    this.etherscanConnection = new ThirdPartyConnectionFetch(io)
  }

  async getAddressBalance (address: string): Promise<string> {
    try {
      const res = await this.indyConnection.getAddressBalance(address)
      return res
    } catch (error) {
      try {
        const res = await this.etherscanConnection.getAddressBalance(address)
        return res
      } catch (error) {
        throw error
      }
    }
  }

  async getTokenBalance (address: string, token: string): Promise<string> {
    try {
      const res = await this.indyConnection.getTokenBalance(address, token)
      return res
    } catch (error) {
      try {
        const res = await this.etherscanConnection.getTokenBalance(address, token)
        return res
      } catch (error) {
        throw error
      }
    }
  }

  async getHighestBlock (): Promise<string> {
    try {
      const res = await this.indyConnection.getHighestBlock()
      return res
    } catch (error) {
      try {
        console.log('error indy - move to etherscan')
        console.log(`error indy: ${error}`)

        const res = await this.etherscanConnection.getHighestBlock()
        return res
      } catch (error) {
        throw error
      }
    }
  }

  async getPendingTxs (address: string): Promise<[]> {
    try {
      const res = await this.indyConnection.getPendingTxs(address)
      return res
    } catch (error) {
      try {
        const res = await this.etherscanConnection.getPendingTxs(address)
        return res
      } catch (error) {
        throw error
      }
    }
  }

  async getAddressTxs (address: string, startBlock: number, endBlock: number): Promise<[]> {
    try {
      const res = await this.indyConnection.getAddressTxs(address, startBlock, endBlock)
      return res
    } catch (error) {
      try {
        const res = await this.etherscanConnection.getAddressTxs(address, startBlock, endBlock)
        return res
      } catch (error) {
        throw error
      }
    }
  }

  async getTokenTxs (address: string, token: string, startBlock: number, endBlock: number): Promise<[]> {
    try {
      const res = await this.indyConnection.getTokenTxs(address, token, startBlock, endBlock)
      return res
    } catch (error) {
      try {
        const res = await this.etherscanConnection.getTokenTxs(address, token, startBlock, endBlock)
        return res
      } catch (error) {
        throw error
      }
    }
  }

  async getBlockTxs (block: string): Promise<[]> {
    try {
      const res = await this.indyConnection.getBlockTxs(block)
      return res
    } catch (error) {
      try {
        const res = await this.etherscanConnection.getBlockTxs(block)
        return res
      } catch (error) {
        throw error
      }
    }
  }
}

export { ConnectionManager }
