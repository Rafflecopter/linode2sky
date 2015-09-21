# linode2sky

This is a simple node application to poll the [Linode API](https://www.linode.com/api) for new linodes to put into a SkyDNS entry.

```
node index.js \
  --api_key=<linode_api_key> \
  --etcd=etcd1:4001,etcd2:4001 \
  --prefix=/skydns/com/mydomain/mysubdomain \
  --interval=60000
```

This will insert skydns records at the domain `<label>.node.mysubdomain.mydomain.com`

## Services

`linode2sky` can also list your services based on a label naming scheme. If your linode labels took the form `<env>-<svc>-<instance_num>`, you could use the following options to add service DNS entries.

```
node index.js \
  --api_key=<linode_api_key> \
  --prefix=/skydns/com/mydomain/mysubdomain \
  --service_name_regex='^\w+-(\w+)-\d+$'
  --service_ns_regex='^(\w+)-\w+-\d+$'
  --service_instance_regex='^\w+-\w+-(\d+)$'
```

This will insert skydns records at the domain `<instance_num>.<svc>.<env>.svc.mysubdomain.mydomain.com`

## License

MIT License in LICENSE file