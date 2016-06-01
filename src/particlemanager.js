var Plugin = require('automata-plugin')
var Particle = require('particle-api-js')
var debug = require('debug')("Plugin:ParticleManager")
var trace = require('debug')('Plugin:ParticleManager:trace')
var EventEmitter = require('events')
var util = require('util')

var deviceRefreshInterval = 60000

var refreshInterval
var deviceCache = []
var roleCache = []
var accessToken = null
var particle = new Particle
var version = "0.1.0"

class ParticleManager extends Plugin {
  constructor(options) {
    super(options)
    EventEmitter.call(this);
    return this
  }

  // Refactor to use the eventstream that the api provides
  //   Listen for device on/offline events and then requery devices
  login(username, password) {
    if(accessToken == null) {
      if(username == undefined || password == undefined || username == '' || password == '') {
        return Promise.reject(new Error('Login failure, Check username and password'))
      }
      return particle.login({username: username, password: password}).then((resp) => {
        accessToken = resp.body.access_token
        debug('Login success, Access token: %s', accessToken)
        this.cacheDevices()
        refreshInterval = setInterval((this.cacheDevices).bind(this),deviceRefreshInterval)
        trace('Emitting: login-success')
        this.emit('login-success')
        return Promise.resolve('Login success')
      }).catch((error) => {
        debug('login failure: %o', error)
        trace('Emitting: login-failure')
        this.emit('login-failure')
        return Promise.reject(new Error('Login failure, Check username and password'))
      })
    } else {
      return Promise.resolve('Already logged in, success')
    }
  }

  /*
  cacheDevices() {
    if(accessToken != null) {
      return particle.listDevices({auth: accessToken}).then((data) => {
        return data.body.map((device) => {
          trace('get-devices device: %o', device)
          if(deviceCache.hasOwnProperty(device.name)) {
            // We know about this device
            //debug("We already know about this device")
            if(deviceCache[device.name].connected != device.connected) {
              // it's state has changed
              debug("Device %s has gone %s", device.name,
                  device.connected ? "online" : "offline")
              trace('Emitting: device-changed-state')
              this.emit('device-changed-state', device.name)
            }
            // update the stored object with the new one
            deviceCache[device.name] = device
          } else {
            // we haven't seen this device before, add it to the list
            debug("New %s device: %s", device.connected ? "online" : "offline", device.name)
            deviceCache[device.name] = device
            trace('new-device: %s : %s', device.name, device.connected)
            this.emit('new-device', device.name, device.connected)
          }
          return device
        })
      }).then((devices) => {
        devices.map((device) => {
          this.getVariable(device.name, 'role').then((result) => {
            roleCache[device.name] = result;
            trace(roleCache[device.name])
          }).catch((error) => {
            trace(error)
          })
        })
      }).then(() => {
        trace('DONE: %o', roleCache)
      }).then(() => {
        trace('Emitting: devices-ready')
        this.emit('devices-ready')
        return Promize.resolve('devices-ready')
      })
    } else {
      debug("Not logged in, check username and password")
      return Promise.reject(new Error('Not logged in, check username and password'))
    }
  }
  */
	cacheDevices() {
		if(accessToken != null) {
			return particle.listDevices({auth: accessToken})
				.then((data) => {
					//cache devices
					return Promise.all(data.body.map((device) => {
						if(deviceCache.hasOwnProperty(device.name)) {
							if(deviceCache[device.name].connected != device.connected) {
								debug("Device %s has gone %s", device.name,
									device.connected ? "online" : "offline")
								trace('Emitting: device-changed-state')
								this.emit('device-changed-state', device.name)
							}   
							// store the updated state
							deviceCache[device.name] = device
						} else {
							// we haven't yet seen this device
							debug('New %s device: %s', device.connected ? 'online' : 'offline', device.name)
							deviceCache[device.name] = device
							trace('Emitting: new-device')
							this.emit('new-device', device.name, device.connected)
						}   
						trace('Resolving: %o', device)
						return Promise.resolve(device)
					})) 
				})  
        .then((devices) => {
          // we only want devices that are online
          return devices.filter((device) => {
            return device.connected == true
          })
        })
				.then((devices) => {
					// get the roles
					return Promise.all(devices.map((device) => {
            return this.getVariable(device.name, 'role').then((result) => {
              trace('map: %s : result : %s', device.name, result)
              return Promise.resolve({'name': device.name,'role': result});
            }).catch((result) => {
              return Promise.resolve();
            })
					})) 
				})  
        .then((devices) => {
          // filtering block
          return devices.filter((device) => {
            trace('filter: %o', device)
            return device != undefined
          })
        })
        .then((devices) => {
          // do the role caching
          return Promise.all(devices.map((device) => {
            trace('roleCache: name: %s, role: %s', device.name, device.role)
            roleCache[device.name] = device
            trace('stored roleCache: %o', roleCache[device.name])
            return Promise.resolve(device)
          }))
        })
				.then((devices) => {
					// debugging
          trace('debugging block: %o', devices)
          trace('device cache: %o', deviceCache)
          trace('role cache: %o', roleCache)
          return 
				})  
				.then(() => {
					// emitting
          trace('emitting block')
          trace('Emitting: devices-ready')
          this.emit('devices-ready')
          return Promize.resolve('devices-ready')
				})  
		}
	}

  callFunction(device, fn, args) {
    if(accessToken != null) {
      if(deviceCache.hasOwnProperty(device)) {
        // The name is valid
        var obj = {deviceId: deviceCache[device].id, name: fn, argument: args, auth: accessToken}
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
      if(deviceCache.hasOwnProperty(device)) {
        var obj = {deviceId: deviceCache[device].id, name: variable, auth: accessToken}
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
    if(deviceCache.hasOwnProperty(device)) {
      trace('deviceStatus: device: %s : status: %s', device, deviceCache[device].connected)
      return Promise.resolve(deviceCache[device].connected)
    } else {
      debug('deviceStatus: rejecting %s as unknown device', device)
      return Promise.reject(new Error(`Unknown device: ${device}`))
    }
  }
  
  /**
   * At the moment, this is a useless function...I'll actually utilize it later
  deviceRole(device) {
    if(deviceCache.hasOwnProperty(device)) {
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
  getRoleOfDevice(device) {
    return Promise.all(roleCaache.filter((device) => {
      return device.name == device
    })).then((device) => {
      return device.role
    })
  }

  getDevicesByRole(role) {
    debug('getting devicesByRole: %s', role)
    debug('roleCache: %o', roleCache)
    return roleCache.map((device) => {
      trace('device: %o', device)
      return device
    })
  }
}

util.inherits(ParticleManager, EventEmitter)

module.exports = new ParticleManager
