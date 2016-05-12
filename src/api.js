var debug = require('debug')('api')
var express = require('express')

class API {
  constructor(options) {
    this.router = express.Router()
		this._initilizeRoutes(this.router)
    this._modules = new Array()
		return this
  }

  _initilizeRoutes(router) {
    router.get('/', (req, res, next) => {
			res.send('API')
		})
	}
  
  addRoute(method, mount, fn) {
    this.router[method].call(this.router, mount, fn)
  }

  addMount(path, module) {
    debug('adding a mount for %s', path)
    this.router.use(path, module.router)
  }
}

module.exports = new API
