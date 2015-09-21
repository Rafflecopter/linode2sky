var args = require('minimist')(process.argv.slice(2))
  , request = require('request')
  , async = require('async')
  , Etcd = require('node-etcd')
  , api_key = args.api_key
  , etcd = new Etcd(args.etcd ? args.etcd.split(',') : null)
  , prefix = args.prefix || '/skydns/'
  , prefix = prefix[prefix.length - 1] == '/' ? prefix : prefix + '/'
  , interval = args.interval || 300000
  , serviceNsRgx = args.service_ns_regex ? new RegExp(args.service_ns_regex) : null
  , serviceNameRgx = args.service_name_regex ? new RegExp(args.service_name_regex) : null
  , serviceInstRgx = args.service_instance_regex ? new RegExp(args.service_instance_regex) : null

process.on('uncaughtException', function (err) {
  console.error(err && err.stack || err)
})

setInterval(function () {
  run()
}, interval)
run()

function run() {
  async.waterfall([
    listLinodes,
    namesToEntries,
    updateDNS
  ], function () {
    console.log('Completed DNS Update')
  })
}

function namesToEntries(records, callback) {
  var rex = records.map(function (pair) {
    return ['node/' + pair[0] + '/1', pair[1]]
  })

  if (serviceNameRgx) {
    rex = rex.concat(records
      .filter(function (pair) { return serviceNameRgx.test(pair[0]) })
      .map(function (pair) {
        var svc = pair[0].match(serviceNameRgx)[1]
          , ns = serviceNsRgx && serviceNsRgx.test(pair[0])
                 ? pair[0].match(serviceNsRgx)[1]
                 : null
          , inst = serviceInstRgx && serviceInstRgx.test(pair[0])
                   ? pair[0].match(serviceInstRgx)[1]
                   : pair[0]

        return ['svc/' + (ns ? ns + '/' : '') + svc + '/' + inst, pair[1]]
      }))
  }

  callback(null, rex)
}

function updateDNS(records, callback) {
  etcd.get(prefix, {recursive:true}, function (err, retval) {
    var prekeylist = retval ? recurseToKeylist(retval) : []
      , prekeys = prekeylist.map(function (pair) { return pair[0] })
      , preobj = prekeylist.reduce(function (a, p) { a[p[0]] = p[1]; return a }, {})
      , postkeys = prekeylist.reduce(function (a, p) { a[p[0]] = true; return a }, {})

    async.map(records, function (pair, cb) {
      var key = prefix + pair[0]
        , value = JSON.stringify({host: pair[1]})

      delete postkeys[key]

      if (!preobj[key])
        console.log('Setting entry: ' + key + ' = ' + value)
      else if (preobj[key] != value)
        console.log('Updating entry: ' + key + ' = ' + value)
      else
        return cb()

      etcd.set(key, value, cb)
    }, function () {
      async.map(Object.keys(postkeys), function (key, cb) {
        console.log('Removing entry: ' + key)
        etcd.del(key, cb)
      }, callback)
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
            return [labels[ip.LINODEID], ip.IPADDRESS]
          })

    callback(null, records)
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

function recurseToKeylist(node) {
  if (node.node) {
    return recurseToKeylist(node.node)
  } else if (node.nodes) {
    return node.nodes.reduce(function (acc, ns) {
      return acc.concat(recurseToKeylist(ns))
    }, []).filter(function (x) { return x })
  } else if (node.value) {
    return [[node.key, node.value]]
  }
}