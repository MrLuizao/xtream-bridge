const fastify = require('fastify')({ logger: true });
const { pipeline } = require('stream/promises');
const http = require('http');

const PORT = 3000;
// Reemplaza con la IP real de tu Mac/Servidor donde corra el motor de Ace Stream
const ACE_STREAM_ENGINE = 'http://127.0.0.1:6878'; 

// "Base de Datos" local con tus Content IDs de Ace Stream
const CHANNELS_DB = {
  "101": {
    "name": "DAZN 1",
    "content_id": "414222dc7b69a626f29eb964450dae44b3bc9b36"
  },
  "102": {
    "name": "DAZN 2",
    "content_id": "dac18df259f44258d81aa8f31cb343bb837f5ac7"
  },
  "103": {
    "name": "Onetoro TV",
    "content_id": "889db6c87a28fd5b3092333b63bcdddf05d26216"
  },
};

// =================================================================
// 1. ENDPOINT PRINCIPAL: API DE AUTENTICACIÓN Y ENRUTAMIENTO (Xtream)
// =================================================================
fastify.get('/player_api.php', async (request, reply) => {
  const { username, password, action, category_id } = request.query;

  // Middleware de validación básica de credenciales dev
  if (username !== 'luis' || password !== 'dev123') {
    return reply.status(403).send({ error: 'Unauthorized' });
  }

  // PASO A: Handshake Inicial / Login de simulación completa
  if (!action) {
    return {
      "user_info": {
        "auth": 1,
        "status": "Active",
        "exp_date": "1861920000", // Año 2029 (Timestamp Unix)
        "is_trial": "0",
        "active_cons": "0",
        "max_connections": "1",
        "created_at": "1625097600",
        "allowed_output_formats": ["ts", "m3u8"]
      },
      "server_info": {
        "url": "192.168.100.160",
        "port": PORT.toString(),
        "https_port": "0",
        "server_protocol": "http",
        "rtmp_port": "0",
        "timezone": "America/Mexico_City",
        "timestamp": Math.floor(Date.now() / 1000).toString()
      }
    };
  }

  // PASO B: Retornar Categorías (Casteo Estricto a String para Tizen)
  if (action === 'get_live_categories') {
    return [
      {
        "category_id": "1",
        "category_name": "Deportes P2P",
        "parent_id": "0"
      }
    ];
  }

  // PASO C: Retornar Listado de Canales Mapeados
  if (action === 'get_live_streams') {
    if (category_id === '1' || category_id === '1') {
      return Object.keys(CHANNELS_DB).map((id, index) => ({
        "num": index + 1,
        "name": CHANNELS_DB[id].name,
        "stream_id": parseInt(id),
        "stream_type": "live",
        "category_id": "1",
        "category_ids": [1],
        "stream_icon": "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=150",
        "epg_channel_id": null,
        "added": "1625097600",
        "custom_sid": "",
        "tv_archive": 0,
        "direct_source": "",
        "tv_archive_duration": 0,
        "container_extension": "ts"
      }));
    }
    return [];
  }

  return { error: 'Action not supported' };
});

// =================================================================
// 2. ENDPOINT DE STREAMING REFACTORIZADO (Soporte 302 Redirect y Multiformato)
// =================================================================
fastify.get('/live/:username/:password/:streamId', async (request, reply) => {
  const { username, password, streamId } = request.params;

  // Limpiar la extensión (.ts o .m3u8) para extraer el ID numérico puro
  const idLimpio = streamId.replace(/\.(ts|m3u8)$/, '');

  if (username !== 'luis' || password !== 'dev123') {
    return reply.status(403).send('Unauthorized');
  }

  const channel = CHANNELS_DB[idLimpio];
  if (!channel) {
    return reply.status(404).send('Canal no encontrado');
  }

  const aceStreamUrl = `${ACE_STREAM_ENGINE}/ace/getstream?id=${channel.content_id}`;
  fastify.log.info(`Iniciando conexión HTTP para hash P2P: ${channel.content_id}`);

  // Seteamos las cabeceras de streaming
  reply.header('Content-Type', streamId.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/mp2t');
  reply.header('Connection', 'keep-alive');
  reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');

  // Función helper recursiva para seguir redirecciones HTTP (302) de Ace Stream
  const fetchStreamWithRedirects = (url) => {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        // Si el motor nos manda un 302, seguimos la nueva URL en el header location
        if (res.statusCode === 302 || res.statusCode === 301) {
          fastify.log.info(`Ace Stream redirigió (302) hacia: ${res.headers.location}`);
          return resolve(fetchStreamWithRedirects(res.headers.location));
        }
        resolve(res);
      }).on('error', reject);
    });
  };

  try {
    const aceResponse = await fetchStreamWithRedirects(aceStreamUrl);

    if (aceResponse.statusCode !== 200) {
      fastify.log.error(`Motor Ace Stream falló tras redirección con código: ${aceResponse.statusCode}`);
      reply.status(502).send('El motor no pudo inicializar los peers del torrent');
      return;
    }

    // Desactivar timeouts para transmisiones de larga duración
    request.raw.setTimeout(0);
    reply.raw.writeHead(200, reply.headers);

    // Iniciar pipe binario directo a la TV Samsung
    await pipeline(aceResponse, reply.raw);
    fastify.log.info(`Stream finalizado de forma limpia para: ${channel.name}`);

  } catch (err) {
    fastify.log.error(`Error en el flujo del pipeline: ${err.message}`);
  }
});

// Inicialización del servidor escuchando en todas las interfaces de red de la Mac
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 Servidor Xtream Codes corriendo localmente en el puerto ${PORT}`);
});