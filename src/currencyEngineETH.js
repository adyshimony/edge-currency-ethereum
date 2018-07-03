/**
 * Created by paul on 7/7/17.
 */
// @flow

import { currencyInfo } from './currencyInfoETH.js'
import type {
  EdgeCurrencyEngine,
  EdgeTransaction,
  EdgeCurrencyEngineCallbacks,
  EdgeCurrencyEngineOptions,
  EdgeSpendInfo,
  EdgeWalletInfo,
  EdgeMetaToken,
  EdgeCurrencyInfo,
  EdgeDenomination,
  EdgeFreshAddress,
  EdgeDataDump,
  EdgeIo
} from 'edge-core-js'
import { calcMiningFee } from './miningFees.js'
import { sprintf } from 'sprintf-js'
import { bns } from 'biggystring'
import { NetworkFeesSchema, CustomTokenSchema, EthGasStationSchema, EdgeSpendInfoSchema, CurrentyCodeSchema } from './ethSchema.js'
import {
  DATA_STORE_FILE,
  DATA_STORE_FOLDER,
  WalletLocalData,
  type EthCustomToken,
  type EthereumFeesGasPrice,
  type EthereumFee,
  type BroadcastResults
} from './ethTypes.js'
import { isHex, normalizeAddress, addHexPrefix, bufToHex, validateObject, toHex, padAddress, unpadAddress } from './ethUtils.js'
import { ConnectionManager } from './ethConnections/connectionManager.js'
import { ConnectionUtils } from './ethConnections/connectionUtils.js'

const Buffer = require('buffer/').Buffer
const abi = require('../lib/export-fixes-bundle.js').ABI
const ethWallet = require('../lib/export-fixes-bundle.js').Wallet
const EthereumTx = require('../lib/export-fixes-bundle.js').Transaction

const ADDRESS_POLL_MILLISECONDS = 3000
const BLOCKHEIGHT_POLL_MILLISECONDS = 5000
const NETWORKFEES_POLL_MILLISECONDS = (60 * 10 * 1000) // 10 minutes
const SAVE_DATASTORE_MILLISECONDS = 10000
// const ADDRESS_QUERY_LOOKBACK_BLOCKS = '8' // ~ 2 minutes
const ADDRESS_QUERY_LOOKBACK_BLOCKS = (4 * 60 * 24 * 7) // ~ one week

const PRIMARY_CURRENCY = currencyInfo.currencyCode
const CHECK_UNCONFIRMED = true
const INFO_SERVERS = ['https://info1.edgesecure.co:8444']

class EthereumParams {
  from: Array<string>
  to: Array<string>
  gas: string
  gasPrice: string
  gasUsed: string
  cumulativeGasUsed: string
  errorVal: number
  tokenRecipientAddress: string | null

  constructor (from: Array<string>,
    to: Array<string>,
    gas: string,
    gasPrice: string,
    gasUsed: string,
    cumulativeGasUsed: string,
    errorVal: number,
    tokenRecipientAddress: string | null) {
    this.from = from
    this.to = to
    this.gas = gas
    this.gasPrice = gasPrice
    this.gasUsed = gasUsed
    this.errorVal = errorVal
    this.cumulativeGasUsed = cumulativeGasUsed
    if (typeof tokenRecipientAddress === 'string') {
      this.tokenRecipientAddress = tokenRecipientAddress
    } else {
      this.tokenRecipientAddress = null
    }
  }
}

class EthereumEngine {
  walletInfo: EdgeWalletInfo
  edgeTxLibCallbacks: EdgeCurrencyEngineCallbacks
  walletLocalFolder: any
  engineOn: boolean
  addressesChecked: boolean
  tokenCheckStatus: { [currencyCode: string]: number } // Each currency code can be a 0-1 value
  walletLocalData: WalletLocalData
  walletLocalDataDirty: boolean
  transactionsChangedArray: Array<EdgeTransaction>
  currencyInfo: EdgeCurrencyInfo
  allTokens: Array<EdgeMetaToken>
  customTokens: Array<EdgeMetaToken>
  currentSettings: any
  timers: any
  walletId: string
  io: EdgeIo
  connectionManager: ConnectionManager
  connectionUtils: ConnectionUtils

  constructor (io_: any, walletInfo: EdgeWalletInfo, opts: EdgeCurrencyEngineOptions) {
    // Validate that we are a valid EdgeCurrencyEngine:
    // eslint-disable-next-line no-unused-vars
    const test: EdgeCurrencyEngine = this

    const { walletLocalFolder, callbacks } = opts

    this.io = io_
    this.engineOn = false
    this.addressesChecked = false
    this.tokenCheckStatus = {}
    this.walletLocalDataDirty = false
    this.transactionsChangedArray = []
    this.walletInfo = walletInfo
    this.walletId = walletInfo.id ? `${walletInfo.id} - ` : ''
    this.currencyInfo = currencyInfo
    this.allTokens = currencyInfo.metaTokens.slice(0)
    this.customTokens = []
    this.timers = {}
    this.connectionManager = new ConnectionManager(io_, false) // true for indy, false for etherscan
    this.connectionUtils = new ConnectionUtils(io_)

    if (typeof opts.optionalSettings !== 'undefined') {
      this.currentSettings = opts.optionalSettings
    } else {
      this.currentSettings = this.currencyInfo.defaultSettings
    }

    // Hard coded for testing
    // this.walletInfo.keys.ethereumKey = '389b07b3466eed587d6bdae09a3613611de9add2635432d6cd1521af7bbc3757'
    // this.walletInfo.keys.ethereumAddress = '0x9fa817e5A48DD1adcA7BEc59aa6E3B1F5C4BeA9a'
    this.edgeTxLibCallbacks = callbacks
    this.walletLocalFolder = walletLocalFolder

    // Fix messed-up wallets that have a private key in the wrong place:
    if (typeof this.walletInfo.keys.ethereumKey !== 'string') {
      if (walletInfo.keys.keys && walletInfo.keys.keys.ethereumKey) {
        this.walletInfo.keys.ethereumKey = walletInfo.keys.keys.ethereumKey
      }
    }

    // Fix messed-up wallets that have a public address in the wrong place:
    if (typeof this.walletInfo.keys.ethereumAddress !== 'string') {
      if (walletInfo.keys.ethereumPublicAddress) {
        this.walletInfo.keys.ethereumAddress = walletInfo.keys.ethereumPublicAddress
      } else if (walletInfo.keys.keys && walletInfo.keys.keys.ethereumPublicAddress) {
        this.walletInfo.keys.ethereumAddress = walletInfo.keys.keys.ethereumPublicAddress
      } else {
        const privKey = Buffer.from(this.walletInfo.keys.ethereumKey, 'hex')
        const wallet = ethWallet.fromPrivateKey(privKey)
        this.walletInfo.keys.ethereumAddress = wallet.getAddressString()
      }
    }
    this.log(`Created Wallet Type ${this.walletInfo.type} for Currency Plugin ${this.currencyInfo.pluginName} `)
  }

  // *************************************
  // Private methods
  // *************************************

  // *************************************
  // Poll on the blockheight
  // *************************************
  async blockHeightInnerLoop () {
    try {
      const blockHeightRes = await this.connectionManager.getHighestBlock()
      const blockHeight:number = blockHeightRes.result
      if (blockHeight) {
        this.log(`Got block height ${blockHeight}`)
        if (this.walletLocalData.blockHeight !== blockHeight) {
          this.walletLocalData.blockHeight = blockHeight // Convert to decimal
          this.walletLocalDataDirty = true
          this.edgeTxLibCallbacks.onBlockHeightChanged(this.walletLocalData.blockHeight)
        }
      }
    } catch (err) {
      this.log('Error fetching height: ' + err)
    }
  }

  processTransaction (tx: any) {
    let netNativeAmount:string // Amount received into wallet
    const ourReceiveAddresses:Array<string> = []

    const nativeNetworkFee:string = bns.mul(tx.gasPrice, tx.gasUsed)

    if (tx.from.toLowerCase() === this.walletLocalData.ethereumAddress.toLowerCase()) {
      netNativeAmount = bns.sub('0', tx.value)

      // For spends, include the network fee in the transaction amount
      netNativeAmount = bns.sub(netNativeAmount, nativeNetworkFee)

      if (bns.gte(tx.nonce, this.walletLocalData.nextNonce)) {
        this.walletLocalData.nextNonce = bns.add(tx.nonce, '1')
      }
    } else {
      netNativeAmount = bns.add('0', tx.value)
      ourReceiveAddresses.push(this.walletLocalData.ethereumAddress.toLowerCase())
    }

    const ethParams = new EthereumParams(
      [ tx.from ],
      [ tx.to ],
      tx.gas,
      tx.gasPrice,
      tx.gasUsed,
      tx.cumulativeGasUsed,
      parseInt(tx.isError),
      null
    )

    const edgeTransaction:EdgeTransaction = {
      txid: tx.hash,
      date: parseInt(tx.timeStamp),
      currencyCode: 'ETH',
      blockHeight: parseInt(tx.blockNumber),
      nativeAmount: netNativeAmount,
      networkFee: nativeNetworkFee,
      ourReceiveAddresses,
      signedTx: 'unsigned_right_now',
      otherParams: ethParams
    }

    const idx = this.findTransaction(PRIMARY_CURRENCY, tx.hash)
    if (idx === -1) {
      this.log(sprintf('New transaction: %s', tx.hash))

      // New transaction not in database
      this.addTransaction(PRIMARY_CURRENCY, edgeTransaction)

      this.edgeTxLibCallbacks.onTransactionsChanged(
        this.transactionsChangedArray
      )
      this.transactionsChangedArray = []
    } else {
      // Already have this tx in the database. See if anything changed
      const transactionsArray = this.walletLocalData.transactionsObj[ PRIMARY_CURRENCY ]
      const edgeTx = transactionsArray[ idx ]

      if (
        edgeTx.blockHeight !== edgeTransaction.blockHeight ||
        edgeTx.networkFee !== edgeTransaction.networkFee ||
        edgeTx.nativeAmount !== edgeTransaction.nativeAmount ||
        edgeTx.otherParams.errorVal !== edgeTransaction.otherParams.errorVal
      ) {
        this.log(sprintf('Update transaction: %s height:%s', tx.hash, tx.blockNumber))
        this.updateTransaction(PRIMARY_CURRENCY, edgeTransaction, idx)
        this.edgeTxLibCallbacks.onTransactionsChanged(
          this.transactionsChangedArray
        )
        this.transactionsChangedArray = []
      } else {
        // this.log(sprintf('Old transaction. No Update: %s', tx.hash))
      }
    }
  }

  processTokenTransaction (tx: any, currencyCode: string, connectionType: string) {
    let netNativeAmount:string // Amount received into wallet
    const ourReceiveAddresses:Array<string> = []

    // const nativeValueBN = new BN(tx.value, 10)
    const paddedAddress = padAddress(this.walletLocalData.ethereumAddress)
    let fromAddress
    let toAddress

    if (connectionType === 'indy') {
      if (tx.from === this.walletLocalData.ethereumAddress) {
        netNativeAmount = bns.sub('0', tx.data)
        fromAddress = this.walletLocalData.ethereumAddress
        toAddress = tx.destination
      } else {
        fromAddress = tx.from
        toAddress = this.walletLocalData.ethereumAddress
        netNativeAmount = bns.add('0', tx.data)
        ourReceiveAddresses.push(this.walletLocalData.ethereumAddress.toLowerCase())
      }
    } else { // we got the transaction from etherscan
      if (tx.topics[1] === paddedAddress) {
        netNativeAmount = bns.sub('0', tx.data)
        fromAddress = this.walletLocalData.ethereumAddress
        toAddress = unpadAddress(tx.topics[2])
      } else {
        fromAddress = unpadAddress(tx.topics[1])
        toAddress = this.walletLocalData.ethereumAddress
        netNativeAmount = bns.add('0', tx.data)
        ourReceiveAddresses.push(this.walletLocalData.ethereumAddress.toLowerCase())
      }
    }

    if (netNativeAmount.length > 50) {
      // Etherscan occasionally send back a transaction with a corrupt amount in tx.data. Ignore this tx.
      return
    }

    const ethParams = new EthereumParams(
      [ fromAddress ],
      [ toAddress ],
      '',
      tx.gasPrice,
      tx.gasUsed,
      '',
      0,
      null
    )

    const edgeTransaction:EdgeTransaction = {
      txid: tx.transactionHash,
      date: parseInt(tx.timeStamp),
      currencyCode,
      blockHeight: parseInt(bns.add('0', tx.blockNumber)),
      nativeAmount: netNativeAmount,
      networkFee: '0',
      ourReceiveAddresses,
      signedTx: 'unsigned_right_now',
      otherParams: ethParams
    }

    const idx = this.findTransaction(currencyCode, tx.transactionHash)
    if (idx === -1) {
      this.log(sprintf('New token transaction: %s', tx.transactionHash))

      // New transaction not in database
      this.addTransaction(currencyCode, edgeTransaction)

      this.edgeTxLibCallbacks.onTransactionsChanged(
        this.transactionsChangedArray
      )
      this.transactionsChangedArray = []
    } else {
      // Already have this tx in the database. See if anything changed
      const transactionsArray = this.walletLocalData.transactionsObj[ currencyCode ]
      const edgeTx = transactionsArray[ idx ]

      if (
        edgeTx.blockHeight !== edgeTransaction.blockHeight ||
        edgeTx.networkFee !== edgeTransaction.networkFee ||
        edgeTx.nativeAmount !== edgeTransaction.nativeAmount ||
        edgeTx.otherParams.errorVal !== edgeTransaction.otherParams.errorVal
      ) {
        this.log(sprintf('Update token transaction: %s height:%s', edgeTx.txid, edgeTx.blockHeight))
        this.updateTransaction(currencyCode, edgeTransaction, idx)
        this.edgeTxLibCallbacks.onTransactionsChanged(
          this.transactionsChangedArray
        )
        this.transactionsChangedArray = []
      } else {
        // this.log(sprintf('Old transaction. No Update: %s', edgeTx.txid))
      }
    }
  }

  processUnconfirmedTransaction (txInfo: any) {
    const fromAddress = txInfo.from
    const toAddress = txInfo.to
    const epochTime = txInfo.epochTime
    const ourReceiveAddresses:Array<string> = []

    let nativeAmount: string
    if (normalizeAddress(fromAddress) === normalizeAddress(this.walletLocalData.ethereumAddress)) {
      nativeAmount = (0 - txInfo.value).toString(10)
      nativeAmount = bns.sub(nativeAmount, txInfo.txFees.toString(10))
    } else {
      nativeAmount = txInfo.value.toString(10)
      ourReceiveAddresses.push(this.walletLocalData.ethereumAddress)
    }

    const ethParams = new EthereumParams(
      [ fromAddress ],
      [ toAddress ],
      '',
      '',
      txInfo.fees.toString(10),
      '',
      0,
      null
    )

    const edgeTransaction:EdgeTransaction = {
      txid: addHexPrefix(txInfo.hash),
      date: epochTime,
      currencyCode: 'ETH',
      blockHeight: txInfo.blockHeight,
      nativeAmount,
      networkFee: txInfo.txFees.toString(10),
      ourReceiveAddresses,
      signedTx: 'iwassignedyoucantrustme',
      otherParams: ethParams
    }

    const idx = this.findTransaction(PRIMARY_CURRENCY, txInfo.hash)
    if (idx === -1) {
      this.log(sprintf('processUnconfirmedTransaction: New transaction: %s', txInfo.hash))

      // New transaction not in database
      this.addTransaction(PRIMARY_CURRENCY, edgeTransaction)

      this.edgeTxLibCallbacks.onTransactionsChanged(
        this.transactionsChangedArray
      )
      this.transactionsChangedArray = []
    } else {
      // Already have this tx in the database. See if anything changed
      // const transactionsArray:Array<EdgeTransaction> = this.walletLocalData.transactionsObj[ PRIMARY_CURRENCY ]
      // const edgeTx:EdgeTransaction = transactionsArray[ idx ]
      //
      // if (edgeTx.blockHeight < tx.block_height || edgeTx.date > epochTime) {
      //   this.log(sprintf('processUnconfirmedTransaction: Update transaction: %s height:%s', tx.hash, tx.blockNumber))
      //   this.updateTransaction(PRIMARY_CURRENCY, edgeTransaction, idx)
      //   this.edgeTxLibCallbacks.onTransactionsChanged(
      //     this.transactionsChangedArray
      //   )
      //   this.transactionsChangedArray = []
      // } else {
      // this.log(sprintf('processUnconfirmedTransaction: Old transaction. No Update: %s', tx.hash))
      // }
    }
  }

  async checkAddressFetch (tk: string, fetchFunction: Function) {
    let checkAddressSuccess = true
    try {
      const balanceRes = await fetchFunction()
      const balance = balanceRes.result
      if (balance) {
        if (typeof this.walletLocalData.totalBalances[tk] === 'undefined') {
          this.walletLocalData.totalBalances[tk] = '0'
        }
        if (!bns.eq(balance, this.walletLocalData.totalBalances[tk])) {
          this.walletLocalData.totalBalances[tk] = balance
          this.log(tk + ': token Address balance: ' + balance)
          this.edgeTxLibCallbacks.onBalanceChanged(tk, balance)
        }
      } else {
        checkAddressSuccess = false
      }
    } catch (e) {
      checkAddressSuccess = false
    }
    return checkAddressSuccess
  }

  async checkTransactionsFetch () {
    const address = this.walletLocalData.ethereumAddress
    const endBlock:number = 999999999
    let startBlock:number = 0
    let checkAddressSuccess = true
    if (this.walletLocalData.lastAddressQueryHeight > ADDRESS_QUERY_LOOKBACK_BLOCKS) {
      // Only query for transactions as far back as ADDRESS_QUERY_LOOKBACK_BLOCKS from the last time we queried transactions
      startBlock = this.walletLocalData.lastAddressQueryHeight - ADDRESS_QUERY_LOOKBACK_BLOCKS
    }

    try {
      const transactionsRes = await this.connectionManager.getAddressTxs(address, startBlock, endBlock)
      const transactions = transactionsRes.result
      if (transactions) {
        this.log('Fetched transactions count: ' + transactions.length)
        // Get transactions
        // Iterate over transactions in address
        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i]
          this.processTransaction(tx)
          this.tokenCheckStatus[ PRIMARY_CURRENCY ] = ((i + 1) / transactions.length)
          if (i % 10 === 0) {
            this.updateOnAddressesChecked()
          }
        }
        if (transactions.length === 0) {
          this.tokenCheckStatus[ PRIMARY_CURRENCY ] = 1
        }
        this.updateOnAddressesChecked()
      } else {
        checkAddressSuccess = false
      }
    } catch (e) {
      this.log(e)
      checkAddressSuccess = false
    }
    return checkAddressSuccess
  }

  updateOnAddressesChecked () {
    if (this.addressesChecked) {
      return
    }
    const activeTokens: Array<string> = []

    for (const tokenCode of this.walletLocalData.enabledTokens) {
      const ti = this.getTokenInfo(tokenCode)
      if (ti) {
        activeTokens.push(tokenCode)
      }
    }

    const perTokenSlice = 1 / activeTokens.length
    let numCompleteStatus = 0
    let totalStatus = 0
    for (const token of activeTokens) {
      const status = this.tokenCheckStatus[token]
      totalStatus += status * perTokenSlice
      if (status === 1) {
        numCompleteStatus++
      }
    }
    if (numCompleteStatus === activeTokens.length) {
      this.addressesChecked = true
      this.edgeTxLibCallbacks.onAddressesChecked(1)
      this.walletLocalData.lastAddressQueryHeight = this.walletLocalData.blockHeight
    } else {
      this.edgeTxLibCallbacks.onAddressesChecked(totalStatus)
    }
  }

  async checkTokenTransactionsFetch (currencyCode: string) {
    const address = padAddress(this.walletLocalData.ethereumAddress)
    let startBlock:number = 0
    const endBlock:number = 999999999
    let checkAddressSuccess = true
    if (this.walletLocalData.lastAddressQueryHeight > ADDRESS_QUERY_LOOKBACK_BLOCKS) {
      // Only query for transactions as far back as ADDRESS_QUERY_LOOKBACK_BLOCKS from the last time we queried transactions
      startBlock = this.walletLocalData.lastAddressQueryHeight - ADDRESS_QUERY_LOOKBACK_BLOCKS
    }

    const tokenInfo = this.getTokenInfo(currencyCode)
    let contractAddress = ''
    if (tokenInfo && typeof tokenInfo.contractAddress === 'string') {
      contractAddress = tokenInfo.contractAddress
    } else {
      return
    }

    try {
      const transactionsRes = await this.connectionManager.getTokenTxs(address, contractAddress, startBlock, endBlock)
      const transactions = transactionsRes.result
      if (transactions) {
        this.log(`Fetched token ${tokenInfo.currencyCode} transactions count: ${transactions.length}`)

        // Get transactions
        // Iterate over transactions in address
        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i]
          this.processTokenTransaction(tx, currencyCode, transactionsRes.connectionType)
          this.tokenCheckStatus[currencyCode] = ((i + 1) / transactions.length)
          if (i % 10 === 0) {
            this.updateOnAddressesChecked()
          }
        }
        if (transactions.length === 0) {
          this.tokenCheckStatus[currencyCode] = 1
        }
        this.updateOnAddressesChecked()
      } else {
        checkAddressSuccess = false
      }
    } catch (e) {
      this.log(e)
      checkAddressSuccess = false
    }
    return checkAddressSuccess
  }

  async checkUnconfirmedTransactionsFetch () {
    const address = normalizeAddress(this.walletLocalData.ethereumAddress)
    const pendingTransactionsRes = await this.connectionManager.getPendingTxs(address)
    const transactions = pendingTransactionsRes.result
    if (transactions) {
      for (const tx of transactions) {
        if (pendingTransactionsRes.connectionType === 'indy') {
          const txInfo = {
            'from': tx.from,
            'to': tx.to,
            'epochTime': Date.parse(tx.timeStamp) / 1000,
            'txFees': tx.gas * tx.gasPrice,
            'value': tx.value,
            'blockHeight': tx.blockNumber,
            'hash': tx.hash
          }
          this.processUnconfirmedTransaction(txInfo)
        } else {
          if (
            normalizeAddress(tx.inputs[0].addresses[0]) === address ||
            normalizeAddress(tx.outputs[0].addresses[0]) === address
          ) {
            const txInfo = {
              'from': '0x' + tx.inputs[0].addresses[0],
              'to': '0x' + tx.outputs[0].addresses[0],
              'epochTime': Date.parse(tx.received) / 1000,
              'txFees': tx.fees,
              'value': tx.total,
              'blockHeight': tx.block_height,
              'hash': tx.hash
            }
            this.processUnconfirmedTransaction(txInfo)
          }
        }
      }
    } else {
      this.log('Invalid data for unconfirmed transactions')
    }
  }

  // **********************************************
  // Check all addresses for new transactions
  // **********************************************
  async checkAddressesInnerLoop () {
    const address = this.walletLocalData.ethereumAddress
    try {
      // Ethereum only has one address
      let fetchFunction = async () => { await this.connectionManager.getAddressBalance(address) }
      const promiseArray = []

      // ************************************
      // Fetch token balances
      // ************************************
      // https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=0x57d90b64a1a57749b0f932f1a3395792e12e7055&address=0xe04f27eb70e025b78871a2ad7eabe85e61212761&tag=latest&apikey=YourApiKeyToken
      for (const tk of this.walletLocalData.enabledTokens) {
        if (tk === PRIMARY_CURRENCY) {
          // url = sprintf('?module=account&action=balance&address=%s&tag=latest', address)
          fetchFunction = async () => { return this.connectionManager.getAddressBalance(address) }
        } else {
          if (this.getTokenStatus(tk)) {
            const tokenInfo = this.getTokenInfo(tk)
            if (tokenInfo && typeof tokenInfo.contractAddress === 'string') {
              // url = sprintf('?module=account&action=tokenbalance&contractaddress=%s&address=%s&tag=latest', tokenInfo.contractAddress, this.walletLocalData.ethereumAddress)
              const contractAddress: string = tokenInfo.contractAddress.toString()
              fetchFunction = async () => { return this.connectionManager.getTokenBalance(this.walletLocalData.ethereumAddress, contractAddress) }
              promiseArray.push(this.checkTokenTransactionsFetch(tk))
            } else {
              continue
            }
          } else {
            continue
          }
        }
        promiseArray.push(this.checkAddressFetch(tk, fetchFunction))
      }

      promiseArray.push(this.checkTransactionsFetch())
      if (CHECK_UNCONFIRMED) {
        promiseArray.push(this.checkUnconfirmedTransactionsFetch())
      }
      await Promise.all(promiseArray)
    } catch (e) {
      this.log('Error fetching address transactions: ' + address)
    }
  }

  findTransaction (currencyCode: string, txid: string) {
    if (typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined') {
      return -1
    }

    const currency = this.walletLocalData.transactionsObj[currencyCode]
    return currency.findIndex(element => {
      return normalizeAddress(element.txid) === normalizeAddress(txid)
    })
  }

  sortTxByDate (a: EdgeTransaction, b: EdgeTransaction) {
    return b.date - a.date
  }

  addTransaction (currencyCode: string, edgeTransaction: EdgeTransaction) {
    // Add or update tx in transactionsObj
    const idx = this.findTransaction(currencyCode, edgeTransaction.txid)

    if (idx === -1) {
      this.log('addTransaction: adding and sorting:' + edgeTransaction.txid)
      if (typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined') {
        this.walletLocalData.transactionsObj[currencyCode] = []
      }
      this.walletLocalData.transactionsObj[currencyCode].push(edgeTransaction)

      // Sort
      this.walletLocalData.transactionsObj[currencyCode].sort(this.sortTxByDate)
      this.walletLocalDataDirty = true
      this.transactionsChangedArray.push(edgeTransaction)
    } else {
      this.updateTransaction(currencyCode, edgeTransaction, idx)
    }
  }

  updateTransaction (currencyCode: string, edgeTransaction: EdgeTransaction, idx: number) {
    // Update the transaction
    this.walletLocalData.transactionsObj[currencyCode][idx] = edgeTransaction
    this.walletLocalDataDirty = true
    this.transactionsChangedArray.push(edgeTransaction)
    this.log('updateTransaction:' + edgeTransaction.txid)
  }

  // *************************************
  // Save the wallet data store
  // *************************************
  async saveWalletLoop () {
    if (this.walletLocalDataDirty) {
      try {
        this.log('walletLocalDataDirty. Saving...')
        const walletJson = JSON.stringify(this.walletLocalData)
        await this.walletLocalFolder
          .folder(DATA_STORE_FOLDER)
          .file(DATA_STORE_FILE)
          .setText(walletJson)
        this.walletLocalDataDirty = false
      } catch (err) {
        this.log(err)
      }
    }
  }

  async checkUpdateNetworkFees () {
    try {
      const url = sprintf('%s/v1/networkFees/ETH', INFO_SERVERS[0])
      const jsonObj = await this.connectionUtils.fetchGet(url)
      const valid = validateObject(jsonObj, NetworkFeesSchema)

      if (valid) {
        this.walletLocalData.networkFees = jsonObj
      } else {
        this.log('Error: Fetched invalid networkFees')
      }
    } catch (err) {
      this.log('Error fetching networkFees:')
      this.log(err)
    }

    try {
      const url = sprintf('https://www.ethgasstation.info/json/ethgasAPI.json')
      const jsonObj = await this.connectionUtils.fetchGet(url)
      const valid = validateObject(jsonObj, EthGasStationSchema)

      if (valid) {
        const ethereumFee: EthereumFee = this.walletLocalData.networkFees['default']
        if (!ethereumFee.gasPrice) {
          return
        }
        const gasPrice: EthereumFeesGasPrice = ethereumFee.gasPrice

        const safeLow = Math.floor(jsonObj.safeLow / 10)
        let average = Math.floor(jsonObj.average / 10)
        let fastest = Math.floor(jsonObj.fastest / 10)

        // Sanity checks
        if (safeLow < 1 || safeLow > 300) {
          console.log('Invalid safeLow value from EthGasStation')
          return
        }
        if (average < 1 || average > 300) {
          console.log('Invalid average value from EthGasStation')
          return
        }
        if (fastest < 1 || fastest > 300) {
          console.log('Invalid fastest value from EthGasStation')
          return
        }

        gasPrice.lowFee = (safeLow * 1000000000).toString()

        if (average <= safeLow) average = safeLow + 1
        gasPrice.standardFeeLow = (average * 1000000000).toString()

        if (fastest <= average) fastest = average + 1
        gasPrice.highFee = (fastest * 1000000000).toString()

        // We use a value that is somewhere in between average and fastest for the standardFeeHigh
        gasPrice.standardFeeHigh = (Math.floor((average + fastest) * 0.75) * 1000000000).toString()
      } else {
        this.log('Error: Fetched invalid networkFees from EthGasStation')
      }
    } catch (err) {
      this.log('Error fetching networkFees from EthGasStation')
      this.log(err)
    }
  }

  doInitialCallbacks () {
    for (const currencyCode of this.walletLocalData.enabledTokens) {
      try {
        this.edgeTxLibCallbacks.onTransactionsChanged(
          this.walletLocalData.transactionsObj[currencyCode]
        )
        this.edgeTxLibCallbacks.onBalanceChanged(currencyCode, this.walletLocalData.totalBalances[currencyCode])
      } catch (e) {
        this.log('Error for currencyCode', currencyCode, e)
      }
    }
  }

  getTokenInfo (token: string) {
    return this.allTokens.find(element => {
      return element.currencyCode === token
    })
  }

  async addToLoop (func: string, timer: number) {
    try {
      // $FlowFixMe
      await this[func]()
    } catch (e) {
      this.log('Error in Loop:', func, e)
    }
    if (this.engineOn) {
      this.timers[func] = setTimeout(() => {
        if (this.engineOn) {
          this.addToLoop(func, timer)
        }
      }, timer)
    }
    return true
  }

  log (...text: Array<any>) {
    text[0] = `${this.walletId}${text[0]}`
    console.log(...text)
  }

  // *************************************
  // Public methods
  // *************************************

  updateSettings (settings: any) {
    this.currentSettings = settings
  }

  async startEngine () {
    this.engineOn = true
    this.doInitialCallbacks()
    this.addToLoop('blockHeightInnerLoop', BLOCKHEIGHT_POLL_MILLISECONDS)
    this.addToLoop('checkAddressesInnerLoop', ADDRESS_POLL_MILLISECONDS)
    this.addToLoop('saveWalletLoop', SAVE_DATASTORE_MILLISECONDS)
    this.addToLoop('checkUpdateNetworkFees', NETWORKFEES_POLL_MILLISECONDS)
  }

  async killEngine () {
    // Set status flag to false
    this.engineOn = false
    // Clear Inner loops timers
    for (const timer in this.timers) {
      clearTimeout(this.timers[timer])
    }
    this.timers = {}
  }

  async resyncBlockchain (): Promise<void> {
    await this.killEngine()
    const temp = JSON.stringify({
      enabledTokens: this.walletLocalData.enabledTokens,
      networkFees: this.walletLocalData.networkFees,
      ethereumAddress: this.walletLocalData.ethereumAddress
    })
    this.walletLocalData = new WalletLocalData(temp)
    this.walletLocalDataDirty = true
    await this.saveWalletLoop()
    await this.startEngine()
  }

  // synchronous
  getBlockHeight (): number {
    return parseInt(this.walletLocalData.blockHeight)
  }

  enableTokensSync (tokens: Array<string>) {
    for (const token of tokens) {
      if (this.walletLocalData.enabledTokens.indexOf(token) === -1) {
        this.walletLocalData.enabledTokens.push(token)
      }
    }
  }

  // asynchronous
  async enableTokens (tokens: Array<string>) {
    this.enableTokensSync(tokens)
  }

  disableTokensSync (tokens: Array<string>) {
    for (const token of tokens) {
      const index = this.walletLocalData.enabledTokens.indexOf(token)
      if (index !== -1) {
        this.walletLocalData.enabledTokens.splice(index, 1)
      }
    }
  }

  // asynchronous
  async disableTokens (tokens: Array<string>) {
    this.disableTokensSync(tokens)
  }

  async getEnabledTokens (): Promise<Array<string>> {
    return this.walletLocalData.enabledTokens
  }

  async addCustomToken (tokenObj: any) {
    const valid = validateObject(tokenObj, CustomTokenSchema)

    if (valid) {
      const ethTokenObj: EthCustomToken = tokenObj
      // If token is already in currencyInfo, error as it cannot be changed
      for (const tk of this.currencyInfo.metaTokens) {
        if (
          tk.currencyCode.toLowerCase() === ethTokenObj.currencyCode.toLowerCase() ||
          tk.currencyName.toLowerCase() === ethTokenObj.currencyName.toLowerCase()
        ) {
          throw new Error('ErrorCannotModifyToken')
        }
      }

      // Validate the token object
      if (ethTokenObj.currencyCode.toUpperCase() !== ethTokenObj.currencyCode) {
        throw new Error('ErrorInvalidCurrencyCode')
      }
      if (ethTokenObj.currencyCode.length < 2 || ethTokenObj.currencyCode.length > 7) {
        throw new Error('ErrorInvalidCurrencyCodeLength')
      }
      if (ethTokenObj.currencyName.length < 3 || ethTokenObj.currencyName.length > 20) {
        throw new Error('ErrorInvalidCurrencyNameLength')
      }
      if (bns.lt(ethTokenObj.multiplier, '1') || bns.gt(ethTokenObj.multiplier, '100000000000000000000000000000000')) {
        throw new Error('ErrorInvalidMultiplier')
      }
      let contractAddress = ethTokenObj.contractAddress.replace('0x', '').toLowerCase()
      if (!isHex(contractAddress) || contractAddress.length !== 40) {
        throw new Error('ErrorInvalidContractAddress')
      }
      contractAddress = '0x' + contractAddress

      for (const tk of this.customTokens) {
        if (
          tk.currencyCode.toLowerCase() === ethTokenObj.currencyCode.toLowerCase() ||
          tk.currencyName.toLowerCase() === ethTokenObj.currencyName.toLowerCase()
        ) {
          // Remove old token first then re-add it to incorporate any modifications
          const idx = this.customTokens.findIndex(element => element.currencyCode === ethTokenObj.currencyCode)
          if (idx !== -1) {
            this.customTokens.splice(idx, 1)
          }
        }
      }

      // Create a token object for inclusion in customTokens
      const denom: EdgeDenomination = {
        name: ethTokenObj.currencyCode,
        multiplier: ethTokenObj.multiplier
      }
      const edgeMetaToken: EdgeMetaToken = {
        currencyCode: ethTokenObj.currencyCode,
        currencyName: ethTokenObj.currencyName,
        denominations: [denom],
        contractAddress
      }

      this.customTokens.push(edgeMetaToken)
      this.allTokens = this.currencyInfo.metaTokens.concat(this.customTokens)
      this.enableTokensSync([edgeMetaToken.currencyCode])
    } else {
      throw new Error('Invalid custom token object')
    }
  }

  // synchronous
  getTokenStatus (token: string) {
    return this.walletLocalData.enabledTokens.indexOf(token) !== -1
  }

  // synchronous
  getBalance (options: any): string {
    let currencyCode = PRIMARY_CURRENCY

    if (typeof options !== 'undefined') {
      const valid = validateObject(options, CurrentyCodeSchema)
      if (valid) {
        currencyCode = options.currencyCode
      }
    }

    if (typeof this.walletLocalData.totalBalances[currencyCode] === 'undefined') {
      return '0'
    } else {
      const nativeBalance = this.walletLocalData.totalBalances[currencyCode]
      return nativeBalance
    }
  }

  // synchronous
  getNumTransactions (options: any): number {
    let currencyCode = PRIMARY_CURRENCY

    const valid = validateObject(options, CurrentyCodeSchema)
    if (valid) {
      currencyCode = options.currencyCode
    }

    if (typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined') {
      return 0
    } else {
      return this.walletLocalData.transactionsObj[currencyCode].length
    }
  }

  // asynchronous
  async getTransactions (options: any) {
    let currencyCode:string = PRIMARY_CURRENCY

    const valid:boolean = validateObject(options, CurrentyCodeSchema)
    if (valid) {
      currencyCode = options.currencyCode
    }

    if (typeof this.walletLocalData.transactionsObj[currencyCode] === 'undefined') {
      return []
    }

    let startIndex:number = 0
    let numEntries:number = 0
    if (options === null) {
      return this.walletLocalData.transactionsObj[currencyCode].slice(0)
    }
    if (options.startIndex !== null && options.startIndex > 0) {
      startIndex = options.startIndex
      if (
        startIndex >=
        this.walletLocalData.transactionsObj[currencyCode].length
      ) {
        startIndex =
          this.walletLocalData.transactionsObj[currencyCode].length - 1
      }
    }
    if (options.numEntries !== null && options.numEntries > 0) {
      numEntries = options.numEntries
      if (
        numEntries + startIndex >
        this.walletLocalData.transactionsObj[currencyCode].length
      ) {
        // Don't read past the end of the transactionsObj
        numEntries =
          this.walletLocalData.transactionsObj[currencyCode].length -
          startIndex
      }
    }

    // Copy the appropriate entries from the arrayTransactions
    let returnArray = []

    if (numEntries) {
      returnArray = this.walletLocalData.transactionsObj[currencyCode].slice(
        startIndex,
        numEntries + startIndex
      )
    } else {
      returnArray = this.walletLocalData.transactionsObj[currencyCode].slice(
        startIndex
      )
    }
    return returnArray
  }

  // synchronous
  getFreshAddress (options: any): EdgeFreshAddress {
    return { publicAddress: this.walletLocalData.ethereumAddress }
  }

  // synchronous
  addGapLimitAddresses (addresses: Array<string>, options: any) {
  }

  // synchronous
  isAddressUsed (address: string, options: any) {
    return false
  }

  // synchronous
  async makeSpend (edgeSpendInfo: EdgeSpendInfo) {
    // Validate the spendInfo
    const valid = validateObject(edgeSpendInfo, EdgeSpendInfoSchema)
    if (!valid) {
      throw (new Error('Error: invalid ABCSpendInfo'))
    }

    // Ethereum can only have one output
    if (edgeSpendInfo.spendTargets.length !== 1) {
      throw (new Error('Error: only one output allowed'))
    }

    let tokenInfo = {}
    tokenInfo.contractAddress = ''

    let currencyCode:string = ''
    if (typeof edgeSpendInfo.currencyCode === 'string') {
      currencyCode = edgeSpendInfo.currencyCode
      if (!this.getTokenStatus(currencyCode)) {
        throw (new Error('Error: Token not supported or enabled'))
      } else if (currencyCode !== 'ETH') {
        tokenInfo = this.getTokenInfo(currencyCode)
        if (!tokenInfo || typeof tokenInfo.contractAddress !== 'string') {
          throw (new Error('Error: Token not supported or invalid contract address'))
        }
      }
    } else {
      currencyCode = 'ETH'
    }
    edgeSpendInfo.currencyCode = currencyCode

    // ******************************
    // Get the fee amount

    let ethParams = {}
    const { gasLimit, gasPrice } = calcMiningFee(edgeSpendInfo, this.walletLocalData.networkFees)

    let publicAddress = ''
    if (typeof edgeSpendInfo.spendTargets[0].publicAddress === 'string') {
      publicAddress = edgeSpendInfo.spendTargets[0].publicAddress
    } else {
      throw new Error('No valid spendTarget')
    }

    if (currencyCode === PRIMARY_CURRENCY) {
      ethParams = new EthereumParams(
        [this.walletLocalData.ethereumAddress],
        [publicAddress],
        gasLimit,
        gasPrice,
        '0',
        '0',
        0,
        null
      )
    } else {
      let contractAddress = ''
      if (typeof tokenInfo.contractAddress === 'string') {
        contractAddress = tokenInfo.contractAddress
      } else {
        throw new Error('makeSpend: Invalid contract address')
      }
      ethParams = new EthereumParams(
        [this.walletLocalData.ethereumAddress],
        [contractAddress],
        gasLimit,
        gasPrice,
        '0',
        '0',
        0,
        publicAddress
      )
    }

    let nativeAmount = '0'
    if (typeof edgeSpendInfo.spendTargets[0].nativeAmount === 'string') {
      nativeAmount = edgeSpendInfo.spendTargets[0].nativeAmount
    } else {
      throw (new Error('Error: no amount specified'))
    }

    const InsufficientFundsError = new Error('Insufficient funds')
    InsufficientFundsError.name = 'ErrorInsufficientFunds'
    const InsufficientFundsEthError = new Error('Insufficient ETH for transaction fee')
    InsufficientFundsEthError.name = 'ErrorInsufficientFundsMoreEth'

    // Check for insufficient funds
    // let nativeAmountBN = new BN(nativeAmount, 10)
    // const gasPriceBN = new BN(gasPrice, 10)
    // const gasLimitBN = new BN(gasLimit, 10)
    // const nativeNetworkFeeBN = gasPriceBN.mul(gasLimitBN)
    // const balanceEthBN = new BN(this.walletLocalData.totalBalances.ETH, 10)

    const balanceEth = this.walletLocalData.totalBalances.ETH
    let nativeNetworkFee = bns.mul(gasPrice, gasLimit)
    let totalTxAmount = '0'
    let parentNetworkFee = null

    if (currencyCode === PRIMARY_CURRENCY) {
      totalTxAmount = bns.add(nativeNetworkFee, nativeAmount)
      if (bns.gt(totalTxAmount, balanceEth)) {
        throw (InsufficientFundsError)
      }
      nativeAmount = bns.mul(totalTxAmount, '-1')
    } else {
      parentNetworkFee = nativeNetworkFee

      if (bns.gt(nativeNetworkFee, balanceEth)) {
        throw (InsufficientFundsEthError)
      }

      nativeNetworkFee = '0' // Do not show a fee for token transations.
      const balanceToken = this.walletLocalData.totalBalances[currencyCode]
      if (bns.gt(nativeAmount, balanceToken)) {
        throw (InsufficientFundsError)
      }
      nativeAmount = bns.mul(nativeAmount, '-1')
    }

    // const negativeOneBN = new BN('-1', 10)
    // nativeAmountBN.imul(negativeOneBN)
    // nativeAmount = nativeAmountBN.toString(10)

    // **********************************
    // Create the unsigned EdgeTransaction

    const edgeTransaction:EdgeTransaction = {
      txid: '', // txid
      date: 0, // date
      currencyCode, // currencyCode
      blockHeight: 0, // blockHeight
      nativeAmount, // nativeAmount
      networkFee: nativeNetworkFee, // networkFee
      ourReceiveAddresses: [], // ourReceiveAddresses
      signedTx: '0', // signedTx
      otherParams: ethParams // otherParams
    }

    if (parentNetworkFee) {
      edgeTransaction.parentNetworkFee = parentNetworkFee
    }

    return edgeTransaction
  }

  // asynchronous
  async signTx (edgeTransaction: EdgeTransaction): Promise<EdgeTransaction> {
    // Do signing

    const gasLimitHex = toHex(edgeTransaction.otherParams.gas)
    const gasPriceHex = toHex(edgeTransaction.otherParams.gasPrice)
    let nativeAmountHex

    // let nativeAmountHex = bns.mul('-1', edgeTransaction.nativeAmount, 16)
    if (edgeTransaction.currencyCode === PRIMARY_CURRENCY) {
      // Remove the networkFee from the nativeAmount
      const nativeAmount = bns.add(edgeTransaction.nativeAmount, edgeTransaction.networkFee)
      nativeAmountHex = bns.mul('-1', nativeAmount, 16)
    } else {
      nativeAmountHex = bns.mul('-1', edgeTransaction.nativeAmount, 16)
    }

    // const nonceBN = new BN(this.walletLocalData.nextNonce.toString(10), 10)
    // const nonceHex = '0x' + nonceBN.toString(16)
    //
    const nonceHex = toHex(this.walletLocalData.nextNonce)
    let data
    if (edgeTransaction.currencyCode === PRIMARY_CURRENCY) {
      data = ''
    } else {
      const dataArray = abi.simpleEncode(
        'transfer(address,uint256):(uint256)',
        edgeTransaction.otherParams.tokenRecipientAddress,
        nativeAmountHex
      )
      data = '0x' + Buffer.from(dataArray).toString('hex')
      nativeAmountHex = '0x00'
    }

    const txParams = {
      nonce: nonceHex,
      gasPrice: gasPriceHex,
      gasLimit: gasLimitHex,
      to: edgeTransaction.otherParams.to[0],
      value: nativeAmountHex,
      data: data,
      // EIP 155 chainId - mainnet: 1, ropsten: 3
      chainId: 1
    }

    const privKey = Buffer.from(this.walletInfo.keys.ethereumKey, 'hex')
    const wallet = ethWallet.fromPrivateKey(privKey)

    this.log(wallet.getAddressString())

    const tx = new EthereumTx(txParams)
    tx.sign(privKey)

    edgeTransaction.signedTx = bufToHex(tx.serialize())
    edgeTransaction.txid = bufToHex(tx.hash())
    edgeTransaction.date = Date.now() / 1000

    return edgeTransaction
  }
  // asynchronous
  async broadcastTx (edgeTransaction: EdgeTransaction): Promise<EdgeTransaction> {
    const { results, errors } = await this.connectionManager.broadcastTransaction(edgeTransaction)

    let allErrored = true
    for (const e of errors) {
      if (!e) {
        allErrored = false
        break
      }
    }

    let anyResultIncNonce = false
    let anyResultDecrementNonce = false

    for (const r: BroadcastResults | null of results) {
      if (r && r.incrementNonce) {
        anyResultIncNonce = true
      }
      if (r && r.decrementNonce) {
        anyResultDecrementNonce = true
      }
    }

    if (allErrored) {
      throw errors[0] // Can only throw one error so throw the first one
    }

    this.log('broadcastTx errors:', errors)
    this.log('broadcastTx results:', results)

    if (anyResultDecrementNonce) {
      this.walletLocalData.nextNonce = bns.add(this.walletLocalData.nextNonce, '-1')
      this.log('Nonce too high. Decrementing to ' + this.walletLocalData.nextNonce.toString())
      // Nonce error. Increment nonce and try again
      const edgeTx = await this.signTx(edgeTransaction)
      const out = await this.broadcastTx(edgeTx)
      return out
    }

    if (anyResultIncNonce) {
      // All servers returned a nonce-too-low. Increment and retry sign and broadcast
      this.walletLocalData.nextNonce = bns.add(this.walletLocalData.nextNonce, '1')
      this.log('Nonce too low. Incrementing to ' + this.walletLocalData.nextNonce.toString())
      // Nonce error. Increment nonce and try again
      const edgeTx = await this.signTx(edgeTransaction)
      const out = await this.broadcastTx(edgeTx)
      return out
    }
    // Success
    this.walletLocalData.nextNonce = bns.add(this.walletLocalData.nextNonce, '1')

    return edgeTransaction
  }

  // asynchronous
  async saveTx (edgeTransaction: EdgeTransaction) {
    this.addTransaction(edgeTransaction.currencyCode, edgeTransaction)

    this.edgeTxLibCallbacks.onTransactionsChanged([edgeTransaction])
  }

  getDisplayPrivateSeed () {
    if (this.walletInfo.keys && this.walletInfo.keys.ethereumKey) {
      return this.walletInfo.keys.ethereumKey
    }
    return ''
  }

  getDisplayPublicSeed () {
    if (this.walletInfo.keys && this.walletInfo.keys.ethereumAddress) {
      return this.walletInfo.keys.ethereumAddress
    }
    return ''
  }

  dumpData (): EdgeDataDump {
    const dataDump: EdgeDataDump = {
      walletId: this.walletId.split(' - ')[0],
      walletType: this.walletInfo.type,
      pluginType: this.currencyInfo.pluginName,
      data: {
        walletLocalData: this.walletLocalData
      }
    }
    return dataDump
  }
}

export { EthereumEngine }
