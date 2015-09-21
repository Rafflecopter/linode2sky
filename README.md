# linode2sky

This is a simple node application to poll the [Linode API](https://www.linode.com/api) for new linodes to put into a SkyDNS entry.

```
node index.js --api_key=<linode_api_key> --etcd=etcd1:4001,etcd2:4001 --prefix=/skydns/com/mydomain/mysubdomain --interval=60000
```

## License

MIT License in LICENSE file