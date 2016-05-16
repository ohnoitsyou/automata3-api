var Plugin = require('automata-plugin')
var Particle = require('particle-api-js')
var debug = require('debug')("Plugin:ParticleManager")
var trace = require('debug')('Plugin:ParticleManager:trace')
var EventEmitter = require('events')
var util = require('util')

var deviceRefreshInterval = 60000

var refreshInterval
var knownDevices = []
var accessToken = null
var particle = new Particle
var version = "0.1.0"

class ParticleManager extends Plugin {
  constructor(options) {
    super(options)
    EventEmitter.call(this);
    return this
  }

  login(username, password) {
    if(accessToken == null) {
      if(username == undefined || password == undefined) {
        return Promise.reject(new Error('Login failure, Check username and password'))
      }
      return particle.login({username: username, password: password}).then((resp) => {
        accessToken = resp.body.access_token
        debug('Login success, Access token: %s', accessToken)
        this.getDevices()
        refreshInterval = setInterval((this.getDevices).bind(this),deviceRefreshInterval)
        trace('Emitting: login-success')
        this.emit('login-success')
        return Promise.resolve('Login success')
      }).catch((error) => {
        debug('login failure: %s', error)
        trace('Emitting: login-failure')
        this.emit('login-failure')
        return Promise.reject(new Error('Login failure, Check username and password'))
      })
    } else {
      return Promise.resolve('Already logged in, success')
    }
  }

  getDevices() {
    if(accessToken != null) {
      return particle.listDevices({auth: accessToken}).then((data) => {
        data.body.map((device) => {
          trace('get-devices device: %o', device)
          if(knownDevices.hasOwnProperty(device.name)) {
            // We know about this device
            //debug("We already know about this device")
            if(knownDevices[device.name].connected != device.connected) {
              // it's state has changed
              debug("Device %s has gone %s", device.name,
                  device.connected ? "online" : "offline")
              trace('Emitting: device-changed-state')
              this.emit('device-changed-state', device.name)
            }
            // update the stored object with the new one
            knownDevices[device.name] = device
          } else {
            // we haven't seen this device before, add it to the list
            debug("New %s device: %s", device.connected ? "online" : "offline", device.name)
            knownDevices[device.name] = device
            trace('new-device: %s : %s', device.name, device.connected)
            this.emit('new-device', device.name, device.connected)
          }
        })
      }).then(() => {
        trace('Emitting: devices-ready')
        this.emit('devices-ready')
      })
    } else {
      debug("Not logged in, check username and password")
      return Promise.reject(new Error('Not logged in, check username and password'))
    }
  }

  callFunction(device, fn, args) {
    if(accessToken != null) {
      if(knownDevices.hasOwnProperty(device)) {
        // The name is valid
        var obj = {deviceId: knownDevices[device].id, name: fn, argument: args, auth: accessToken}
        trace('callFunction: Calling: %s : Arguments: %s', fn.name, args)
        return particle.callFunction(obj)
      } else {
        debug("Unknown device: %s", device)
        return Promise.reject(new Error(`Unknown device: ${device}`))
      }
    } else {
      debug("Not logged in, check username and password")
      return Promise.reject(new Error('Not logged in, check username and password'))
    }
  }

  getVariable(device, variable) {
    debug('getVariable: %s : %s', device, variable)
    if(accessToken != null) {
      if(knownDevices.hasOwnProperty(device)) {
        var obj = {deviceId: knownDevices[device].id, name: variable, auth: accessToken}
        trace('getVariable: device: %s : variable %s', device, variable)
        return particle.getVariable(obj).then((result) => {
          return Promise.resolve(result.body.result)
        }).catch((error) => {
          return Promise.reject(new Error(`Unable to retrieve variable: ${variable}:` +  error))
        })
      } else {
        debug("Unknown device: %s", device)
        return Promise.reject(`Unknown device: ${device}`)
      }
    } else {
      return Promise.reject('Not logged in, check username and password')
    }
  }

  deviceStatus(device) {
    if(knownDevices.hasOwnProperty(device)) {
      trace('deviceStatus: device: %s : status: %s', device, knownDevices[device].connected)
      return Promise.resolve(knownDevices[device].connected)
    } else {
      debug('deviceStatus: rejecting %s as unknown device', device)
      return Promise.reject(new Error(`Unknown device: ${device}`))
    }
  }
  
  /**
   * At the moment, this is a useless function...I'll actually utilize it later
  deviceRole(device) {
    if(knownDevices.hasOwnProperty(device)) {
      return this.deviceStatus().then((connected) => {
        trace('deviceRole: Resolving %s : %s', device, connected)
        return Promise.resolve(connected)
      })
    } else {
      debug('deviceRole: Rejecting %s as unknown device', device)
      return Promise.reject(new Error(`Unknown device: ${device}`))
    }
  }
  */

  getDevicesByRole(role) {
    debug('getDevicesByRole: Starting')
    if(accessToken != null) {
      trace('getDevicesByRole: AccessToken is good')
      var numDevices = (Object.keys(knownDevices).length)
      if(numDevices > 0) {
        trace('getDevicesByRole: We have known devices: %s', numDevices) 
        var matches = []
        for(let device in knownDevices) {
          trace('getDevicesByRole: inside the map: %s', device)
          if(knownDevices[device].connected) {
            debug('device %s is online, checking role', device)
            matches.push(new Promise((resolve, reject) => {
              this.getVariable(device, 'role').then((result) => {
                trace('Result: %o', result)
                debug('Matches? %s == %s: %s',result, role, result == role)
                if(result == role) {
                  trace('getDevicesByRole: resolving: %s', device)
                  resolve(device)
                } else {
                  // it doesn't match, but we cant reject
                  trace('getDevicesByRole: doesn\'t mach, resolve empty: %s', device)
                  resolve()
                }
              }).catch((err) => {
                // resolve it as empty so it returns, we will filter later
                trace('getDevicesByRole: resolve empty: %s', device)
                resolve()
              })
            }))
          } 
        }
        return Promise.all(matches).then((matches) => {
          return matches.filter((device) => {
            trace('getDevicesByRole: filtering %s', device)
            return device != undefined
          })
        })
      } else {
        trace('getDevicesByRole: No known devices: %s', (Object.keys(knownDevices)).length)
        return Promise.reject(new Error('No known devices, please wait until devices have been enumerated'))
      }
    } else {
      return Promise.reject(new Error('Not logged in, check username and password'))
    }
  }
}

util.inherits(ParticleManager, EventEmitter)

module.exports = new ParticleManager
