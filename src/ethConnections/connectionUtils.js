/**
 * Created by adys on 6/15/2018.
 * @flow
 */
import type { EdgeIo } from 'edge-core-js'
import { otherSettings } from '../currencyInfoETH'

class ConnectionUtils {
  io: EdgeIo

  constructor (io: EdgeIo) {
    this.io = io
  }

  async indyFetchGet (cmd: string) {
    const url = `${otherSettings.indyApiServers[0]}${cmd}`
    console.log(`Indy indyFetchGet url: ${url}`)
    const response = await this.io.fetch(url, {
      method: 'GET'
    })
    if (!response.ok) {
      console.log(`Indy indyFetchGet response fail`)
      throw new Error(
        `Indy server returned error code ${response.status} for ${url}`
      )
    }
    return response.json()
  }

  async etherscanFetchGet (cmd: string) {
    let apiKey = ''
    if (global.etherscanApiKey && global.etherscanApiKey.length > 5) {
      apiKey = '&apikey=' + global.etherscanApiKey
    }
    // const url = sprintf('%s/api%s%s', otherSettings.etherscanApiServers[0], cmd, apiKey)
    const url = `${otherSettings.etherscanApiServers[0]}/api${cmd}${apiKey}`

    console.log(`Etherscan fetch get url: ${url}`)
    const response = await this.io.fetch(url, {
      method: 'GET'
    })
    if (!response.ok) {
      const cleanUrl = url.replace(global.etherscanApiKey, 'private')
      throw new Error(
        `Etherscan server returned error code ${response.status} for ${cleanUrl}`
      )
    }
    return response.json()
  }

  async superEthfetchGet (url: string) {
    const response = await this.io.fetch(url, {
      method: 'GET'
    })
    if (!response.ok) {
      throw new Error(
        `SupterEth server returned error code ${response.status} for ${url}`
      )
    }
    return response.json()
  }

  async fetchPostBlockcypher (cmd: string, body: any) {
    let apiKey = ''
    if (global.blockcypherApiKey && global.blockcypherApiKey.length > 5) {
      apiKey = '&token=' + global.blockcypherApiKey
    }
    // const url = sprintf('%s/%s%s', otherSettings.blockcypherApiServers[0], cmd, apiKey)
    const url = `${otherSettings.blockcypherApiServers[0]}/${cmd}${apiKey}`

    const response = await this.io.fetch(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify(body)
    })
    return response.json()
  }
}

export { ConnectionUtils }
