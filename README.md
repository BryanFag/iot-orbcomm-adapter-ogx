# IOT-ISADATAPRO-OGX-MIDDLEWARE

Middleware responsável pela tradução de mensagens entre os formatos OGx e IDP.

Este serviço consome mensagens OGx do Kafka, converte para formato IDP e encaminha para a Forward API. Também consome mensagens IDP, converte para formato OGx e publica no Kafka para envio via ORBCOMM. **Não se comunica diretamente com a API ORBCOMM** — essa responsabilidade é do `iot-orbcomm-middleware`.

## Arquitetura

```
   received.message.ogx                              send.message.ogx
   (OGx, Base64)                                     (OGx, Base64)
        │                                                  ▲
        ▼                                                  │
  ┌──────────────┐    Converte     ┌──────────────┐  ┌─────┴──────────┐
  │  Consumer 1  │───OGx → IDP───▶│  Forward API  │  │   Producer     │
  │  (received)  │   Base64→bytes  │  POST /message│  │(send.message   │
  └──────────────┘                 └──────────────┘  │    .ogx)        │
                                                     └─────┬──────────┘
  ┌──────────────┐    Converte                             │
  │  Consumer 2  │───IDP → OGx─────────────────────────────┘
  │  (translate) │   bytes→Base64
  └──────────────┘
        ▲
        │
   translate.message.ogx
   (IDP, byte array)
```

## Responsabilidades

| Fluxo | Tópico origem | Conversão | Destino |
|-------|--------------|-----------|---------|
| **From-Mobile** | `received.message.ogx` | OGx → IDP (Base64 → byte array) | Forward API (`POST /message`) |
| **To-Mobile** | `translate.message.ogx` | IDP → OGx (byte array → Base64) | Kafka `send.message.ogx` |

### Conversão OGx → IDP (From-Mobile)

| Campo | OGx | IDP |
|-------|-----|-----|
| RawPayload | Base64 string (`"l/1pqDV/"`) | Byte array (`[151, 253, 105, ...]`) |
| CustomerID | Não presente | Adicionado (padrão: `0`) |
| MobileOwnerID | Não presente | Adicionado (valor de `FORWARD_ACCOUNT_ID`) |

### Conversão IDP → OGx (To-Mobile)

| Campo | IDP | OGx |
|-------|-----|-----|
| RawPayload | Byte array (`[201, 20, 0, ...]`) | Base64 string (`"yRQAAA..."`) |
| UserMessageID | Opcional | Gerado automaticamente se ausente |

## Requisitos

| Requisito | Versão |
|-----------|--------|
| Node.js | >= 18.0.0 (recomendado: 20.x) |
| npm | >= 9.0.0 |
| Kafka | >= 2.8.0 |

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
cd iot-isadatapro-ogx-middleware
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
| `PORT` | Porta do servidor | Não | `3001` |
| `HOST` | Host do servidor | Não | `0.0.0.0` |
| `KAFKA_BROKER` | Endereço do broker Kafka | Não | `localhost:9092` |
| `KAFKA_TOPIC_RECEIVED` | Tópico de mensagens From-Mobile (OGx) | Não | `received.message.ogx` |
| `KAFKA_TOPIC_TRANSLATE` | Tópico de mensagens To-Mobile (IDP) | Não | `translate.message.ogx` |
| `KAFKA_TOPIC_SEND` | Tópico de saída To-Mobile (OGx) | Não | `send.message.ogx` |
| `KAFKA_GROUP_ID` | Group ID dos consumers Kafka | Não | `iot-isadatapro-ogx-middleware` |
| `KAFKA_ENABLED` | Habilitar integração Kafka | Não | `true` |
| `FORWARD_API_URL` | URL da Forward API (core-isadatapro) | Não | `http://localhost:8080/message` |
| `FORWARD_ACCOUNT_ID` | Account ID para Forward API | Não | `60003666` |
| `FORWARD_API_ENABLED` | Habilitar Forward API | Não | `true` |

### Exemplo de `.env`

```env
# Servidor
PORT=3001
HOST=0.0.0.0

# Kafka
KAFKA_BROKER=localhost:9092
KAFKA_TOPIC_RECEIVED=received.message.ogx
KAFKA_TOPIC_TRANSLATE=translate.message.ogx
KAFKA_TOPIC_SEND=send.message.ogx
KAFKA_GROUP_ID=iot-isadatapro-ogx-middleware
KAFKA_ENABLED=true

# Forward API
FORWARD_API_URL=http://localhost:8080/message
FORWARD_ACCOUNT_ID=60003666
FORWARD_API_ENABLED=true
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

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Informações do serviço e endpoints disponíveis |
| GET | `/api/status` | Status completo (consumers, producer, forwarder) |
| GET | `/api/health` | Health check |

## Kafka

### Tópico `received.message.ogx` (Consumer)

Consome mensagens OGx vindas do `iot-orbcomm-middleware`:

```json
{
  "ID": 21727314716,
  "MessageUTC": "2026-03-04 13:38:46",
  "ReceiveUTC": "2026-03-04 13:38:46",
  "SIN": 151,
  "MobileID": "02009745SKY0712",
  "Payload": null,
  "RawPayload": "l/1pqDV/",
  "RegionName": "AORWSC",
  "OTAMessageSize": 6,
  "Transport": 1,
  "Network": 1
}
```

### Tópico `translate.message.ogx` (Consumer)

Consome mensagens IDP vindas do `core-isadatapro-orbcomm-middleware`:

```json
{
  "DestinationID": "02009745SKY0712",
  "UserMessageID": 10,
  "RawPayload": [201, 20, 0, 0, 0, 100, 25, 77, 101, 110, 115, 97, 103, 101, 109]
}
```

### Tópico `send.message.ogx` (Producer)

Publica mensagens convertidas para OGx (consumidas pelo `iot-orbcomm-middleware`):

```json
{
  "DestinationID": "02009745SKY0712",
  "UserMessageID": 10,
  "RawPayload": "yRQAAABkGU1lbnNhZ2Vt"
}
```

### Forward API (HTTP POST)

Mensagens convertidas para IDP são encaminhadas via POST:

```json
{
  "account_id": 60003666,
  "Messages": [
    {
      "ID": 21727314716,
      "SIN": 151,
      "MobileID": "02009745SKY0712",
      "Transport": 1,
      "CustomerID": 0,
      "MessageUTC": "2026-03-04 13:38:46",
      "RawPayload": [151, 253, 105, 168, 53, 127],
      "ReceiveUTC": "2026-03-04 13:38:46",
      "RegionName": "AORWSC",
      "MobileOwnerID": 60003666,
      "OTAMessageSize": 6
    }
  ]
}
```

## Estrutura do Projeto

```
iot-isadatapro-ogx-middleware/
├── src/
│   ├── config/
│   │   └── env.ts                      # Configurações e variáveis de ambiente
│   ├── routes/
│   │   └── messages.routes.ts          # Rotas (status, health)
│   ├── services/
│   │   ├── kafka-consumer.service.ts   # Consumers (received + translate)
│   │   ├── kafka.service.ts            # Producer (send.message.ogx)
│   │   └── message-forwarder.service.ts # Conversão OGx→IDP e POST na Forward API
│   ├── types/
│   │   └── ogws.types.ts              # Tipos TypeScript (OGx, IDP, Translate, Send)
│   └── index.ts                        # Entry point
├── .env                                # Variáveis de ambiente (não commitado)
├── .env.example                        # Exemplo de configuração
├── package.json
├── tsconfig.json
└── README.md
```

## Licença

ISC
