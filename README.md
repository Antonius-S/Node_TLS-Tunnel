TLS tunnel
==========

This small app enables non-TLS-enabled apps to communicate with encrypted TLS (SSL) services. Any TCP-based protocol is supported.
It exposes HTTP-proxy interface for communication so a target app must support this feature. Usually it is named "HTTP proxy" or more precisely "HTTP tunnel".

```
                                    PLAIN TEXT                                           TLS
┌───────────────────┐                                          ┌──────────┐                         ┌─────────┐
│                   ├─────────────────────────────────────────►│TLS tunnel├────────────────────────►│secure.  │
│Non-TLS-enabled app│ CONNECT secure.example.com:443 HTTP/1.1  │          │*socket connect*         │example. │
│                   │◄─────────────────────────────────────────┤          │                         │com      │
│                   │ HTTP/1.1 200 Connection Established      │          │                         │         │
│                   ├─────────────────────────────────────────►│          ├────────────────────────►│         │
└───────────────────┘ GET / HTTP/1.1                           └──────────┘ GET / HTTP/1.1          └─────────┘
                      Host: secure.example.com                              Host: secure.example.com
                      ...                                                   ...
```

Protocol
--------

Protocol for HTTP tunnel proxy is very simple:

Client sends request to `proxyhost:proxyaddr`

```
CONNECT secure.example.com:443 HTTP/1.1
```

Remote port is optional, default is `443`.
Proxy connects to `secure.example.com:443` and responds

```
HTTP/1.1 200 Connection Established
```

Tunnel is set, client may send data to proxy just like it would do to a remote host.
In case of errors, proxy responds with HTTP code `405`.

Note that there is another HTTP proxy protocol that means sending full destination URL in `GET` request to proxy address ([Ref](https://en.wikipedia.org/wiki/Proxy_server#Web_proxy_servers)). This manner is not supported.

Command line arguments
----------------------

  * `-?`, `-h` - print usage
  * `-p port` - listen to port `port`. Default is `8443`