TLS tunnel
==========

This small app enables non-TLS-enabled apps to communicate with TLS (SSL) services. It exposes HTTP-proxy interface for communication so a target app must support this feature.

Protocol
--------

Protocol for HTTP-proxy is very simple:

Client sends request to `proxyhost:proxyaddr`

```
CONNECT secure.example.com:443 HTTP/1.1
Host: proxyhost:proxyaddr
```

Remote port is optional, default is `443`.
Proxy connects to `secure.example.com:443` and responds

```
HTTP/1.1 200 Connection Established
```

Tunnel is set, client may send data to proxy just like it would do to a remote host.
In case of errors, proxy responds with HTTP code `405`.

Command line arguments
----------------------

  * `-?`, `-h` - print usage
  * `-p port` - listen to port `port`. Default is `8443`