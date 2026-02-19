# IOT-ORBCOMM-MIDDLEWARE

Middleware para integração IoT com ORBCOMM OGx Gateway Web Service (OGWS).

Este serviço realiza coleta automática de mensagens From-Mobile (RE) da API OGWS, publica no Kafka e expõe endpoints REST para consulta e envio de mensagens.

## Requisitos

| Requisito | Versão |
|-----------|--------|
| Node.js | >= 18.0.0 (recomendado: 20.x) |
| npm | >= 9.0.0 |
| Kafka | >= 2.8.0 (opcional) |

## Dependências

| Pacote | Versão | Descrição |
|--------|--------|-----------|
| fastify | ^5.7.4 | Framework web |
| @fastify/cors | ^9.0.1 | Plugin CORS |
| kafkajs | ^2.2.4 | Cliente Kafka |
| dotenv | ^17.2.4 | Variáveis de ambiente |
| pino-pretty | ^10.3.0 | Logs formatados |
| typescript | ^5.3.3 | Suporte TypeScript |
| tsx | ^4.7.0 | Execução TypeScript |

## Instalação

```bash
git clone <repo-url>
cd iot-orbcomm-middleware
npm install
```

## Configuração

Crie um arquivo `.env` na raiz do projeto:

```bash
cp .env.example .env
```

### Variáveis de Ambiente

| Variável | Descrição | Obrigatório | Padrão |
|----------|-----------|-------------|--------|
| `PORT` | Porta do servidor | Não | `3000` |
| `HOST` | Host do servidor | Não | `0.0.0.0` |
| `OGWS_BASE_URL` | URL base da API OGWS | Sim | - |
| `OGWS_ACCESS_ID` | ID de acesso ORBCOMM | Sim | - |
| `OGWS_PASSWORD` | Senha ORBCOMM | Sim | - |
| `POLLING_INTERVAL_SECONDS` | Intervalo de coleta (segundos) | Não | `60` |
| `KAFKA` | Broker Kafka | Não | `localhost:9092` |
| `KAFKA_TOPIC` | Tópico para mensagens | Não | `orbcomm-messages` |
| `KAFKA_ENABLED` | Habilitar integração Kafka | Não | `true` |

### Exemplo de `.env`

```env
# Servidor
PORT=3000
HOST=0.0.0.0

# OGWS API
OGWS_BASE_URL=https://ogws.orbcomm.com/api/v1.0
OGWS_ACCESS_ID=seu_access_id
OGWS_PASSWORD=sua_senha

# Collector
POLLING_INTERVAL_SECONDS=60

# Kafka
KAFKA=localhost:9092
KAFKA_TOPIC=orbcomm-messages
KAFKA_ENABLED=true
```

## Uso

### Modo Desenvolvimento
```bash
npm run dev
```

### Modo Produção
```bash
npm run build
npm start
```

## Endpoints da API

### Informações
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Informações do serviço |
| GET | `/api/status` | Status completo (collector, auth, kafka) |
| GET | `/api/health` | Health check |

### Mensagens
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/messages` | Lista todas as mensagens |
| GET | `/api/messages/mobile/:mobileId` | Mensagens por MobileID |
| GET | `/api/messages/sin/:sin` | Mensagens por SIN |
| POST | `/api/messages/collect` | Força coleta imediata |
| POST | `/api/messages/send` | Envia mensagem para dispositivo |
| DELETE | `/api/messages` | Limpa mensagens armazenadas |

### Controle do Collector
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/collector/start` | Inicia coleta automática |
| POST | `/api/collector/stop` | Para coleta automática |

## Envio de Mensagens (To-Mobile)

### Com Payload estruturado (SIN/MIN)
```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{"destinationId":"02009745SKY0712","sin":16,"min":2}'
```

### Com RawPayload (bytes)
```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{"destinationId":"02009745SKY0712","rawPayload":[128,1,84,69,83,84,69]}'
```

## Kafka

### Consumir mensagens do tópico
```bash
kcat -b localhost:9092 -t orbcomm-messages -C -o beginning
```

### Formato das mensagens no Kafka
```json
{
  "id": 21578348727,
  "mobileId": "02009745SKY0712",
  "sin": 152,
  "messageUTC": "2026-02-12 13:26:02",
  "receiveUTC": "2026-02-12 13:26:02",
  "payload": null,
  "rawPayload": "mAHTG6dHyUZP0Sm9AAA=",
  "regionName": "AORWSC",
  "otaMessageSize": 14,
  "transport": 1,
  "network": 1,
  "timestamp": "2026-02-19T11:44:30.000Z"
}
```

## Estrutura do Projeto

```
iot-orbcomm-middleware/
├── src/
│   ├── config/
│   │   └── env.ts                  # Configurações e validação
│   ├── routes/
│   │   └── messages.routes.ts      # Rotas da API
│   ├── services/
│   │   ├── ogws-auth.service.ts    # Autenticação OGWS
│   │   ├── ogws-messages.service.ts # Coleta de mensagens
│   │   └── kafka.service.ts        # Publicação no Kafka
│   ├── types/
│   │   └── ogws.types.ts           # Tipos TypeScript
│   └── index.ts                    # Entry point
├── .env                            # Variáveis de ambiente (não commitado)
├── .env.example                    # Exemplo de configuração
├── package.json
├── tsconfig.json
└── README.md
```

## API ORBCOMM OGWS

Este middleware utiliza a API OGx Gateway Web Service (OGWS) da ORBCOMM.

- **Documentação**: [Partner Support](https://partner-support.orbcomm.com)
- **Ambiente de Produção**: https://ogws.orbcomm.com/api/v1.0
- **Ambiente de Teste**: https://ogws.swlab.ca/api/v1.0
- **Swagger/Docs**: https://ogws.orbcomm.com/docs/api/index.html

### Token de Autenticação
- Tipo: Bearer Token
- Validade: 7 dias
- Renovação: Automática pelo middleware

## Licença

ISC
