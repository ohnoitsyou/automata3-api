var Plugin = require('automata-plugin')
var particleManager = require('./particlemanager')
var debug = require('debug')('Plugin:Light')

var targetRole = 'light'

class Light extends Plugin {
  constructor() {
    super({})
    debug('Constructor for light plugin')
    this.state = {}//{ master: true, silent: true, mode: 1}
    this._initilizeRouter()
    particleManager.once('particle-devices-ready',this._enumerateDevices.bind(this))
    return this
  }

  _enumerateDevices() {
    particleManager.getDevicesByRole(targetRole).then((devices) => {
      return devices.filter((device) => {
        return device != undefined
      })
    }).then((devices) => {
      for(var device of devices) {
        this.state[device] = { master: true, silent: true, mode: 1}
      }
    }).then(() => {
      debug('showing state %o', this.state)
    })
  }

  _initilizeRouter() {
    debug('initilizing the router')
    this.router.get('/', (req, res) => {
      res.send("Lights")
    })
    this.router.get('/devices', (req, res) => {
      particleManager.getDevicesByRole('light')
        .then(
          (result) => {
          return result.filter((device) => {
            return device != undefined
          })
          },(error) => {
            res.send({error: error})
          })
        .then((devices) => {
          debug('matching devices %o', devices)
          res.send({lights: devices})
        })
    })
    this.router.get('/state', (req, res) => {
      res.send(this.state)
    })
    this.router.get('/state/:device', (req, res) => {
      if(this.state.hasOwnProperty(req.params.device)) {
        debug('Sending state for %s', req.params.device)
        res.send(this.state[req.params.device])
      } else {
        debug('Invalid device request: %s', req.params.device)
        res.status(400).send('Bad Request');
      }
    })
    this.router.get('/state/:toggle/:device', (req, res) => {
      if(this.state.hasOwnProperty(req.params.toggle)) {
        res.send({[req.params.device] : {[req.params.toggle]: this.state[req.params.toggle]}})
      } else {
        res.status(400).send('Bad Request');
      }
    })
    this.router.post('/mode/:button/:device', (req, res) => {
      debug('Button clicked: %s ', req.params.button)
      this.state.mode = req.params.button
      debug(particleManager.callFunction(req.params.device, 'setconfig', 'ro'+req.params.button))
      res.send({mode: this.state.mode})
    })
    this.router.post('/toggle/:toggle/:device', (req, res) => {
      if(this.state.hasOwnProperty(req.params.device)) {
        if(this.state[req.params.device].hasOwnProperty(req.params.toggle)) {
          this.state[req.params.device][req.params.toggle] = !this.state[req.params.device][req.params.toggle]
          debug('Toggle clicked: %s : %s', req.params.toggle, this.state[req.params.device][req.params.toggle])
          debug(particleManager.callFunction(req.params.device, 'setconfig', 'ts'))
          res.send({[req.params.device]: this.state[req.params.device][req.params.toggle]})
        } else {
          debug('Invalid toggle: %s', req.params.toggle)
          res.status(400).send('Bad toggle');
        }
      } else {
        debug('Invalid device: %s', req.params.device)
        res.status(400).send('Bad device')
      }
    })
  }
}

module.exports = new Light
