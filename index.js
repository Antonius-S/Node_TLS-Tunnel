/*
  TCP=>TLS tunnel with HTTP-proxy interface.
  (c) Antonius S. Hart https://github.com/Antonius-S
  License MIT
*/

'use strict';

const tls = require('tls');
const http = require('http');
const common = require('_http_common');

// ~~ Globals ~~

const config =
{
  listenPort: '8443'
};

const log =
{
  trace: (msg) => console.log('~', msg),
  info: (msg) => console.log('*', msg),
  warn: (msg) => console.log('!', msg),
  err: (msg) => console.log('!!!', msg)
};

const USAGE =
  [
    'TCP=>TLS proxy using HTTP CONNECT method',
    'Parameters:',
    '  -?, -h    - print this info',
    `  -p port   - port to listen (default: ${config.listenPort})`
  ].join('\n');

// ~~ Utils ~~

// HTTP stuff

const STATUS_CODE_200 = 200;
const STATUS_CODE_405 = 405;

const HDR_CONNECTION_CLOSE = 'Connection: close';

const DEFAULT_PORT = 443;
const CRLF = common.CRLF;

/**
  Write HTTP response and optionally close socket.
  @this net.Socket
  Intended to be used as a method of `net.Socket` object or prototype!
    @param {Boolean} close - if `true`, close the connection after send.
    @param {Number} httpCode - response code
    @param {String} [httpMessage] - response message (if omitted, standard HTTP message will be used)
 */
function socket_replyHTTP(close, httpCode, httpMessage)
{
  // Prepare response
  httpMessage = httpMessage || http.STATUS_CODES[httpCode];
  const content = [`HTTP/1.1 ${httpCode} ${httpMessage}`];
  if (close)
    content.push(HDR_CONNECTION_CLOSE);
  content.push(CRLF);
  const resp = Buffer.from(content.join(CRLF), 'ascii');

  if (close)
  {
    const self = this;
    this.end(resp, null, function () { self.destroy(); });
  }
  else
  {
    this.write(resp);
  }
}

// ~~ Constructors ~~

/**
  Create bidirectional pipe between two streams
    @param {NodeJS.Duplex} stm1 - stream1
    @param {NodeJS.Duplex} stm2 - stream2
 */
function twoWayPipe(stm1, stm2)
{
  stm1.pipe(stm2);
  stm2.pipe(stm1);
  // ! pipe() doesn't close writable end on readable end's error, we must do it manually
  stm1.on('close', () => stm2.destroy());
  stm2.on('close', () => stm1.destroy());
}

/**
  Create outgoing TLS socket
    @param {NodeJS.Socket} inSocket - incoming socket
    @param {Object} [logger] - logger

    @returns {tls.Socket}
 */
function createOutTLSSock(inSocket, logger)
{
  const res = new tls.TLSSocket();

  res.inSocket = inSocket;

  res.on('connect',
    /** @private */
    function () { logger.info(`Tunnel #${this.inSocket.connID} connected to dest ${this.remoteAddress}`); }
  );

  res.on('close',
    /** @private */
    function () { logger.info(`Tunnel #${this.inSocket.connID} closed`); }
  );

  res.on('error',
    /** @private */
    function (err) { logger.warn(`Tunnel #${this.inSocket.connID} error: ${err}`); }
  );

  res.on('connect',
    /** @private */
    function ()
    {
      // if connect succeeded, pipe incoming socket to outgoing TLS one
      twoWayPipe(this, this.inSocket);
      logger.info(`Tunnel #${this.inSocket.connID} ready`);
    });

  return res;
}

/**
  Create HTTP proxy that listens to TCP and connects via TLS
    @param {Object} options - options for http.createServer
    @param {Object} [logger] - logger

    @returns {http.Server}
 */
function HTTPProxyServer(options, logger)
{
  const res = http.createServer(options);

  res.connID = 1;

  res.on('listening',
    /** @this http.Server */
    function () { logger.info(`Listening to ${this.address().port}`); }
  );

  res.on('connection',
    /** @this http.Server
      @private */
    function (socket)
    {
      logger.info(`Connection #${this.connID} accepted on port`, this.address().port);
      socket.connID = this.connID;
      this.connID++;

      socket.on('close', () => logger.trace(`Connection #${socket.connID} closed`));
      socket.on('error', (err) => logger.trace(`Connection #${socket.connID} error: ${err}`));
      socket.replyHTTP = socket_replyHTTP;
    });

  // All requests beside CONNECT
  res.on('request',
    /** @this http.Server
      @private */
    function (req, resp)
    {
      logger.warn(`Connection #${this.connID}, wrong request ${req.method}`);
      resp.socket.replyHTTP(true, STATUS_CODE_405);
    });

  res.on('connect',
    /** @this http.Server
      @private */
    function(req, socket, head)
    {
      // Check url is valid
      let url;
      try { url = new URL('whatwgsux://' + req.url); } // URL parser requires protocol to operate properly even for host:port
      catch (err)
      {
        logger.warn(`Connection #${socket.connID}, invalid url ${req.url}`);
        socket.replyHTTP(true, STATUS_CODE_405, 'Invalid URL');
        return;
      }
      url.port = url.port | DEFAULT_PORT;

      logger.info(`Connection #${socket.connID}, establishing tunnel to ${url.hostname}:${url.port}`);

      const outTLSSock = createOutTLSSock(socket, logger);
      outTLSSock.on('connect',
        /** @this tls.Socket */
        function ()
        {
          socket.replyHTTP(false, STATUS_CODE_200, 'Connection Established');
          // Send head if present
          if (head)
            this.write(head);
        });

      logger.trace(`Tunnel #${socket.connID}, connecting to ${url.hostname}:${url.port}`);
      outTLSSock.connect(url.port, url.hostname);
    });

  return res;
}

// ~~ Main ~~

// Read args
const SCRIPT_ARGS_START_IDX = 2;
for (let i = SCRIPT_ARGS_START_IDX; i < process.argv.length; i++)
{
  switch (process.argv[i])
  {
    case '-?':
    case '-h':
      console.log(USAGE);
      return;
    case '-p':
      config.listenPort = Number(process.argv[i + 1]);
      i++;
      break;
    default:
      console.log('Unknown parameter', process.argv[i]);
  }
}

// Start
const serv = new HTTPProxyServer(null, log);
serv.listen(config.listenPort);