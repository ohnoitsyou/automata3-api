var Plugin = require('automata-plugin')
var pm = require('./particlemanager')
var debug = require('debug')('Plugin:Light')
var trace = require('debug')('Plugin:Light:Trace')

var targetRole = 'lights'

var knownDevices = []
var knownDevicesStates = {}

class Light extends Plugin {
  constructor() {
    super()
    this._initilizeRouter()
    pm.once('devices-ready', pm.getDevicesByRole.bind(pm, 'lights'))
    return this
  }
  
  _initilizeRouter() {
    trace('Initilizing the router')
    this.router.get('/', (req, res) => {
      trace('GET: /')
      return res.send('Lights')
    })
    this.router.get('/devices', (req, res) => {
      debug('GET: /devices')
      trace('GET: /devices : %o', {devices: knownDevices})
      return res.json({devices: knownDevices})
    })
    this.router.get('/device/:device', (req, res) => {
      debug('GET: /device/:device')
      trace('GET: /devices/%s', req.params.device)
      if(req.params.device == undefined) {
        return res.status('400').send('BAD_REQUEST')
      }
      if(knownDevices.hasOwnProperty(req.params.device)) {
        return res.send(knownDevices[req.params.device])
        //return res.send('')
      } else {
        trace(typeof knownDevices)
        trace(knownDevices)
      }
      return res.send('not known')
    })
    this.router.post('/device/:device', (req, res) => {
      debug('POST: /device/:device')
      trace('POST: /device/%s', req.params.device)
      trace('BODY: %o', req.body)
      if(req.body != undefined) {
        if(knownDevices.hasOwnProperty(req.body.device)) {
          return res.send('')
        } else {
          return res.status('400').send('UNKNOWN_DEVICE')
        }
      } else {
        return res.status('400').send('BAD_REQUEST')
      }
    })
  }
}

module.exports = new Light
