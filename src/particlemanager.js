var Plugin = require('automata-plugin')
var Particle = require('particle-api-js')
var debug = require('debug')("Plugin:ParticleManager")
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
    return new Promise((resolve, reject) => {
      if(accessToken == null) {
        particle.login({username: username, password: password}).then((data) => {
          accessToken = data.body.access_token
          debug("Login success, Access Token: %s", accessToken)
          setTimeout((this.getDevices).bind(this),1000)
          refreshInterval = setInterval((this.getDevices).bind(this),deviceRefreshInterval)
          this.emit('particle-login')
          resolve(true)
        }, (err) => {
          reject("Login failure, check username and password")
        })
      } else {
        resolve('Already logged in, success')
      }
    })
  }

  getDevices() {
    if(accessToken != null) {
      particle.listDevices({auth: accessToken}).then((data) => {
        for(var device of data.body) {
          if(knownDevices.hasOwnProperty(device.name)) {
            // We know about this device
            //debug("We already know about this device")
            if(knownDevices[device.name].connected != device.connected) {
              // it's state has changed
              debug("Device %s has gone %s", device.name,
                  device.connected ? "online" : "offline")
            }
            // update the stored object with the new one
            knownDevices[device.name] = device
          } else {
            // we haven't seen this device before, add it to the list
            debug("New %s device: %s", device.connected ? "online" : "offline", device.name)
            knownDevices[device.name] = device
          }
        }
        this.emit('particle-devices-ready')
      })
    } else {
      debug("Not logged in, check username and password")
    }
  }

  callFunction(device, fn, args) {
    return new Promise((resolve, reject) => {
      if(accessToken != null) {
        if(knownDevices.hasOwnProperty(device)) {
          // The name is valid
          var deviceid = knownDevices[device].id
          var obj = {deviceId: deviceid, name: fn, argument: args, auth: accessToken}
          particle.callFunction(obj).then(
            (result) => {
              debug('success: %o', result)
              resolve(result)
            },(err) => {
              debug('error: %o', err)
              reject(err)
            })
        } else {
          debug("Unknown device: %s", device)
          reject(`Unknown device: ${device}`)
        }
      } else {
        debug("Not logged in, check username and password")
        reject('Not logged in, check username and password')
      }
    })
  }

  getVariable(device, variable) {
    debug('getVariable: %s : %s', device, variable)
    if(accessToken != null) {
      if(knownDevices.hasOwnProperty(device)) {
        var obj = {deviceId: knownDevices[device].id, name: variable, auth: accessToken}
        return particle.getVariable(obj)
      } else {
        debug("Unknown device: %s", device)
        return Promise.reject(`Unknown device: ${device}`)
      }
    } else {
      return Promise.reject('Not logged in, check username and password')
    }
  }

  deviceStatus(device, callback) {
    if(knownDevices.hasOwnProperty(device)) {
      var returnVal = {[device]: knownDevices[device].status}
      return callback == undefined ? returnVal : callback(null, returnVal)
    } else {
      return callback == undefined ? 'unknown device' : callback({error: 'unknown device'}, null)
    }
  }

  getDevicesByRole(role) {
    debug('getDevicesByRole: %s', role)
    if(accessToken != null) {
      if(knownDevices.length == 0) {
        var matches = []
        for(var device in knownDevices) {
          debug(device)
          if(knownDevices[device].connected) {
            debug('device %s is online, checking role', device)
            matches.push(new Promise((resolve, reject) => {
              var d = device
              this.getVariable(device, 'role').then((result) => {
                debug(d)
                resolve(d)
              }).catch((err) => {
                resolve()
              })
            }))
          } 
        }
        return Promise.all(matches)
      } else {
        Promise.reject('No known devices, please wait until devices have been enumerated')
      }
    } else {
      return Promise.reject('Not logged in, check username and password')
    }
  }
}

util.inherits(ParticleManager, EventEmitter)

module.exports = new ParticleManager
