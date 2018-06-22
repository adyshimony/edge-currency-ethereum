/**
 * Created by paul on 8/26/17.
 * @flow
 */

import { bns } from 'biggystring'
import { validate } from 'jsonschema'
const Buffer = require('buffer/').Buffer

function normalizeAddress (address: string) {
  return address.toLowerCase().replace('0x', '')
}

function addHexPrefix (value: string) {
  if (value.startsWith('0x')) {
    return value
  } else {
    return '0x' + value
  }
}

function validateObject (object: any, schema: any) {
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

function bufToHex (buf: any) {
  const signedTxBuf = Buffer.from(buf)
  const hex = '0x' + signedTxBuf.toString('hex')
  return hex
}

function toHex (num: string) {
  return bns.add(num, '0', 16)
}

export function isHex (h: string) {
  const out = /^[0-9A-F]+$/i.test(h)
  return out
}

function unpadAddress (address: string): string {
  const unpadded = bns.add('0', address, 16)
  return unpadded
}

function padAddress (address: string): string {
  const normalizedAddress = normalizeAddress(address)
  const padding = 64 - normalizedAddress.length
  const zeroString = '0000000000000000000000000000000000000000000000000000000000000000'
  const out = '0x' + zeroString.slice(0, padding) + normalizedAddress
  return out
}

export { normalizeAddress, addHexPrefix, bufToHex, validateObject, toHex, padAddress, unpadAddress }
