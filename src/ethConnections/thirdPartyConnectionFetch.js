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

// TODO: remove sprintf
class ThirdPartyConnectionFetch implements ConnectionFetch {
  connection: ConnectionUtils
  constructor (io: EdgeIo) {
    this.connection = new ConnectionUtils(io)
  }

  async getAddressBalance (address: string): Promise<string> {
    // const url = `?module=account&action=balance&address=${address}&tag=latest`
    const url = sprintf('?module=account&action=balance&address=%s&tag=latest', address)
    const balance = await this.connection.etherscanFetchGet(url)
    const valid = this.validateObject(balance, {
      'type': 'object',
      'properties': {
        'result': {'type': 'string'}
      },
      'required': ['result']
    })
    if (valid) {
      console.log(`Etherscan token balance: ${balance} for account: ${address}}`)
      return balance.result
    } else {
      throw new Error(`Error validation balance from etherscan for account: ${address}`)
    }
  }

  async getTokenBalance (address: string, token: string): Promise<string> {
    // const url = `?module=account&action=tokenbalance&contractaddress=${token}&address=${address}&tag=latest`
    const url = sprintf('?module=account&action=tokenbalance&contractaddress=%s&address=%s&tag=latest', token, address)
    const balance = await this.connection.etherscanFetchGet(url)
    const valid = this.validateObject(balance, {
      'type': 'object',
      'properties': {
        'result': {'type': 'string'}
      },
      'required': ['result']
    })
    if (valid) {
      console.log(`Etherscan token balance: ${balance} for account: ${address}, token: ${token}`)
      return balance.result
    } else {
      throw new Error(`Error validation token balance from etherscan for account: ${address}, token: ${token}`)
    }
  }

  async getHighestBlock (): Promise<number> {
    const url = '?module=proxy&action=eth_blockNumber'
    const jsonObj = await this.connection.etherscanFetchGet(url)
    const valid = this.validateObject(jsonObj, {
      'type': 'object',
      'properties': {
        'result': {'type': 'string'}
      },
      'required': ['result']
    })
    if (valid) {
      const highetBlockNumber:number = parseInt(jsonObj.result, 16)
      console.log(`Etherscan highest block: ${highetBlockNumber}`)
      return highetBlockNumber
    } else {
      throw new Error('Error getting highest block from etherscan')
    }
  }

  async getPendingTxs (address: string): Promise<any> {
    // const url = `${otherSettings.superethServers[0]}/v1/eth/main/txs/${address}`
    const url = sprintf('%s/v1/eth/main/txs/%s', otherSettings.superethServers[0], address)
    const pendingTxs = await this.connection.superEthfetchGet(url)
    const valid = this.validateObject(pendingTxs, {
      'type': 'array',
      'items': {
        'type': 'object',
        'properties': {
          'block_height': { 'type': 'number' },
          'fees': { 'type': 'number' },
          'received': { 'type': 'string' },
          'addresses': {
            'type': 'array',
            'items': { 'type': 'string' }
          },
          'inputs': {
            'type': 'array',
            'items': {
              'type': 'object',
              'properties': {
                'addresses': {
                  'type': 'array',
                  'items': { 'type': 'string' }
                }
              },
              'required': [
                'addresses'
              ]
            }
          },
          'outputs': {
            'type': 'array',
            'items': {
              'type': 'object',
              'properties': {
                'addresses': {
                  'type': 'array',
                  'items': { 'type': 'string' }
                }
              },
              'required': [
                'addresses'
              ]
            }
          }
        },
        'required': [
          'fees',
          'received',
          'addresses',
          'inputs',
          'outputs'
        ]
      }
    })

    if (valid) {
      console.log(`super eth return ${pendingTxs.result.length} pending Txs`)
      return pendingTxs.result
    } else {
      throw new Error('Error getting pending tx from super eth')
    }
  }

  async getAddressTxs (address: string, startBlock: number, endBlock: number): Promise<Array<any>> {
    // const urlNew = `?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=asc`
    const url = sprintf('?module=account&action=txlist&address=%s&startblock=%d&endblock=%d&sort=asc', address, startBlock, endBlock)
    const accountTxs = await this.connection.etherscanFetchGet(url)
    const valid = this.validateObject(accountTxs, {
      'type': 'object',
      'properties': {
        'result': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'blockNumber': {'type': 'string'},
              'timeStamp': {'type': 'string'},
              'hash': {'type': 'string'},
              'from': {'type': 'string'},
              'to': {'type': 'string'},
              'nonce': {'type': 'string'},
              'value': {'type': 'string'},
              'gas': {'type': 'string'},
              'gasPrice': {'type': 'string'},
              'cumulativeGasUsed': {'type': 'string'},
              'gasUsed': {'type': 'string'},
              'confirmations': {'type': 'string'}
            },
            'required': [
              'blockNumber',
              'timeStamp',
              'hash',
              'from',
              'to',
              'nonce',
              'value',
              'gas',
              'gasPrice',
              'cumulativeGasUsed',
              'gasUsed',
              'confirmations'
            ]
          }
        }
      },
      'required': ['result']
    })
    if (valid) {
      console.log(`Etherscan return ${accountTxs.length} Txs for account: ${address} `)
      return accountTxs.result
    } else {
      throw new Error(`Error validation transactions from etherscanfor account: ${address}`)
    }
  }

  async getTokenTxs (address: string, token: string, startBlock: number, endBlock: number): Promise<any> {
    // const url = `?module=logs&action=getLogs&fromBlock=startBlock&toBlock=latest&address=${token}&topic0=${address}`
    const url = sprintf('?module=logs&action=getLogs&fromBlock=%d&toBlock=latest&address=%s&topic0=%s', startBlock, token, address)
    const tokenTxs = await this.connection.etherscanFetchGet(url)
    const valid = this.validateObject(tokenTxs, {
      'type': 'object',
      'properties': {
        'result': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'data': {'type': 'string'},
              'blockNumber': {'type': 'string'},
              'timeStamp': {'type': 'string'},
              'transactionHash': {'type': 'string'},
              'gasPrice': {'type': 'string'},
              'gasUsed': {'type': 'string'},
              'topics': {
                'type': 'array',
                'items': { 'type': 'string' }
              }
            },
            'required': [
              'data',
              'blockNumber',
              'timeStamp',
              'transactionHash',
              'gasPrice',
              'gasUsed',
              'topics'
            ]
          }
        }
      },
      'required': ['result']
    })
    if (valid) {
      console.log(`Etherscan return ${tokenTxs.length} Txs of token: ${token} for account: ${address} `)
      return tokenTxs.result
    } else {
      throw new Error(`Error validation transactions from etherscanforof token: ${token} for account: ${address}`)
    }
  }

  async getBlockTxs (block: string): Promise<Array<any>> {
    // TBD - just for compiling
    throw new Error('not impelemente')
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
