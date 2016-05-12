var debug = require('debug')('automata')

var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var cors = require('cors')

var config = require('config')

var api = require('./src/api')
var light = require('./src/light')

var particleManager = require('./src/particlemanager')
particleManager.login(config.get('particle.particleUsername'), config.get('particle.particlePassword'))

var corsOpts = {
  origin: 'http://localhost:8080'
}

app.options('*', cors(corsOpts))
app.use(cors())

api.addMount('/light', light)
app.use('/api', api.router)

app.get('/', (req, res) => {
  res.send("Hello World!")
})

io.on('connection', (socket) => {
  debug('client connected')
  socket.on('disconnect', () => {
    debug('client disconnected')
  })
})

http.listen(config.get('api.port'), function() {
  debug('listening on port %s',config.get('api.port'))
})
