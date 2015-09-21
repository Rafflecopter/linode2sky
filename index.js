var args = require('minimist')(process.argv.slice(2))
  , request = require('request')
  , async = require('async')
  , Etcd = require('node-etcd')
  , api_key = args.api_key
  , etcd = new Etcd(args.etcd ? args.etcd.split(',') : null)
  , prefix = args.prefix || '/skydns/'
  , interval = args.interval || 300000

setInterval(function () {
  listLinodes(updateDNS)
}, interval)

listLinodes(updateDNS)

function updateDNS(records) {
  records.forEach(function (pair) {
    var ip = pair[0]
      , name = pair[1]

    etcd.set(prefix + name + "/1", JSON.stringify({host: ip}), function (err) {
      if (err) throw err
      console.log('Setting DNS for ' + name + ': ' + ip)
    })
  })
}

function listLinodes(callback) {
  async.parallel([
    apiGet.bind(null, 'linode.list'),
    apiGet.bind(null, 'linode.ip.list')
  ], function (_, lists) {
    var labels = lists[0].DATA.reduce(function (a, n) { a[n.LINODEID] = n.LABEL; return a }, {})
      , records = lists[1].DATA.filter(function (ip) { return !ip.ISPUBLIC })
          .map(function (ip) {
            return [ip.IPADDRESS, labels[ip.LINODEID]]
          })

    callback(records)
  })
}

function apiGet(action, cb) {
  request.get({
    uri: 'https://api.linode.com/?api_action='+action+'&api_key='+api_key,
    json: true
  }, function (err, res, body) {
    if (err) throw err
    if (!body) throw new Error('no body on ' + action + ' call')
    cb(null, body)
  })
}