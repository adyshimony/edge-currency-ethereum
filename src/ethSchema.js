/**
 * Created by paul on 8/27/17.
 */

export const CurrencyInfoSchema = {
  'type': 'object',
  'properties': {
    'walletTypes': {
      'type': 'array',
      'items': {'type': 'string'}
    },
    'currencyCode': { 'type': 'string' },
    'currencyName': { 'type': 'string' },
    'addressExplorer': { 'type': 'string' },
    'transactionExplorer': { 'type': 'string' },
    'defaultSettings': {
      'type': 'object',
      'properties': {
        'otherSettings': {
          'type': 'object',
          'properties': {
            'etherscanApiServers': {
              'type': 'array',
              'items': {'type': 'string'}
            },
            'superethServers': {
              'type': 'array',
              'items': {'type': 'string'}
            }
          }
        }
      }
    },
    'denominations': {
      'type': 'array',
      'items': {
        'type': 'object',
        'properties': {
          'name': { 'type': 'string' },
          'multiplier': { 'type': 'string' },
          'symbol': { 'type': 'string' }
        },
        'required': [ 'name', 'multiplier' ]
      }
    },
    'symbolImage': { 'type': 'string' },
    'metaTokens': {
      'type': 'array',
      'items': {
        'type': 'object',
        'properties': {
          'currencyCode': { 'type': 'string' },
          'currencyName': { 'type': 'string' },
          'denominations': {
            'type': 'array',
            'items': {
              'type': 'object',
              'properties': {
                'name': { 'type': 'string' },
                'multiplier': { 'type': 'string' },
                'symbol': { 'type': 'string' }
              },
              'required': [ 'name', 'multiplier' ]
            }
          },
          'contractAddress': { 'type': 'string' },
          'symbolImage': { 'type': 'string' }
        },
        'required': [ 'currencyCode', 'currencyName', 'denominations' ]
      }
    }
  },
  'required': [
    'walletTypes',
    'currencyCode',
    'currencyName',
    'defaultSettings',
    'denominations',
    'symbolImage',
    'addressExplorer',
    'transactionExplorer'
  ]
}

export const NetworkFeesSchema = {
  'type': 'object',
  'additionalProperties': {
    'type': 'object',
    'properties': {
      'gasLimit': {
        'type': 'object',
        'properties': {
          'regularTransaction': { 'type': 'string' },
          'tokenTransaction': { 'type': 'string' }
        },
        'required': [ 'regularTransaction', 'tokenTransaction' ]
      },
      'gasPrice': {
        'type': 'object',
        'properties': {
          'lowFee': { 'type': 'string' },
          'standardFeeLow': { 'type': 'string' },
          'standardFeeHigh': { 'type': 'string' },
          'standardFeeLowAmount': { 'type': 'string' },
          'standardFeeHighAmount': { 'type': 'string' },
          'highFee': { 'type': 'string' }
        },
        'required': [ 'lowFee', 'standardFeeLow', 'standardFeeHigh', 'standardFeeLowAmount', 'standardFeeHighAmount', 'highFee' ]
      }
    },
    'required': [ 'gasLimit' ]
  }
}

export const EthGasStationSchema = {
  'type': 'object',
  'properties': {
    'safeLow': {'type': 'number'},
    'average': {'type': 'number'},
    'fastest': {'type': 'number'}
  },
  'required': ['safeLow', 'average', 'fastest']
}

export const CustomTokenSchema = {
  'type': 'object',
  'properties': {
    'currencyCode': {'type': 'string'},
    'currencyName': {'type': 'string'},
    'multiplier': {'type': 'string'},
    'contractAddress': {'type': 'string'}
  },
  'required': ['currencyCode', 'currencyName', 'multiplier', 'contractAddress']
}

export const EtherscanBalanceSchema = {
  'type': 'object',
  'properties': {
    'result': {'type': 'string'}
  },
  'required': ['result']
}

export const SuperethPendingSchema = {
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
}

export const EtherscanHighestSchema = {
  'type': 'object',
  'properties': {
    'result': {'type': 'string'}
  },
  'required': ['result']
}

export const EtherscanAccountTxSchema = {
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
}

export const EtherscanTokenTxSchema = {
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
}
