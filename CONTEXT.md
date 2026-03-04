# Contexto do Projeto IOT-ORBCOMM-MIDDLEWARE

## Visão Geral

Middleware Node.js/TypeScript que integra a API ORBCOMM OGWS (OGx Gateway Web Service) com um sistema legado IDP, atuando como adaptador entre os dois formatos. Coleta mensagens dos dispositivos via OGWS e encaminha via HTTP POST para uma API externa. Também consome mensagens de um tópico Kafka para enviar comandos aos dispositivos via API ORBCOMM.

---

## Arquitetura

```
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│  ORBCOMM OGWS   │◄────►│  IOT-ORBCOMM-        │      │  Forward API        │
│  API (OGx)      │      │  MIDDLEWARE           │─────►│  (localhost:8080)   │
└─────────────────┘      └──────────────────────┘      │  Formato IDP        │
                                   ▲                    └─────────────────────┘
                                   │
                          ┌────────┴───────────┐
                          │  KAFKA Consumer     │
                          │  Topic:             │
                          │  send.message.ogx   │
                          └────────────────────┘
```

### Fluxo de Dados

1. **Coleta (From-Mobile)**: OGWS → Middleware → HTTP POST para Forward API (formato IDP)
2. **Envio (To-Mobile)**: Kafka topic `send.message.ogx` → Middleware → ORBCOMM submit/messages

---

## Stack Tecnológica

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Node.js | >=18.0.0 | Runtime |
| TypeScript | ^5.3.3 | Linguagem |
| Fastify | ^5.7.4 | Framework HTTP |
| KafkaJS | ^2.2.4 | Consumer Kafka (envio de mensagens) |
| dotenv | ^17.2.4 | Variáveis de ambiente |

---

## Funcionalidades Implementadas

### 1. Autenticação OGWS
- OAuth2 Client Credentials
- Token Bearer com refresh automático
- Endpoint: `POST /auth/token`
- Content-Type: `application/x-www-form-urlencoded`

### 2. Coleta de Mensagens (From-Mobile / RE)
- Polling automático configurável
- Endpoint: `GET /get/re_messages`
- Parâmetros: `FromUTC`, `IncludeTypes`
- Usa `NextFromUTC` da resposta para próxima coleta

### 3. Encaminhamento via HTTP POST (Forward API)
- Mensagens coletadas da OGWS são encaminhadas via HTTP POST para API externa
- Formato IDP: converte `RawPayload` de Base64 para array de bytes
- Repassa todos os campos raw da OGWS sem filtrar (preserva `CustomerID`, `MobileOwnerID`, etc.)
- Endpoint de destino configurável via `FORWARD_API_URL`

### 4. Envio de Mensagens (To-Mobile / FW)
- Endpoint REST: `POST /api/messages/send`
- Endpoint ORBCOMM: `POST /submit/messages`
- Suporta `RawPayload` (Base64) ou `Payload` estruturado
- Requer `UserMessageID` e `DestinationID`

### 5. Consumer Kafka (Envio para Dispositivos)
- Consome mensagens do tópico `send.message.ogx`
- Aceita formato camelCase (`destinationId`) e PascalCase (`DestinationID`)
- Envia para dispositivos via API ORBCOMM `submit/messages`
- Conexão/desconexão graceful

---

## Endpoints REST do Middleware

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/messages` | Lista todas mensagens coletadas |
| GET | `/api/messages/mobile/:mobileId` | Mensagens por dispositivo |
| GET | `/api/messages/sin/:sin` | Mensagens por SIN |
| POST | `/api/messages/collect` | Força coleta manual |
| POST | `/api/messages/send` | Envia mensagem para dispositivo |
| DELETE | `/api/messages` | Limpa mensagens da memória |
| GET | `/api/status` | Status do serviço (collector, auth, forwarder, kafka) |
| POST | `/api/collector/start` | Inicia coletor |
| POST | `/api/collector/stop` | Para coletor |
| GET | `/api/health` | Health check |

---

## Variáveis de Ambiente (.env)

```env
# Servidor
PORT=3000
HOST=0.0.0.0

# ORBCOMM OGWS API
OGWS_BASE_URL=https://ogws.orbcomm.com/api/v1.0
OGWS_ACCESS_ID=70000918
OGWS_PASSWORD=UWLSUUVWIHVY

# Polling
POLLING_INTERVAL_SECONDS=60

# Forward API (encaminhamento de mensagens recebidas)
FORWARD_API_URL=http://localhost:8080/message
FORWARD_ACCOUNT_ID=60003666
FORWARD_API_ENABLED=true

# Kafka Consumer (envio de mensagens aos dispositivos)
KAFKA_BROKER=localhost:9092
KAFKA_GROUP_ID=iot-orbcomm-middleware
KAFKA_TOPIC_SEND=send.message.ogx
KAFKA_ENABLED=true
```

---

## Estrutura de Mensagens

### Formato OGx (API ORBCOMM — entrada)

```json
{
  "ErrorID": 0,
  "NextFromUTC": "2026-02-23 13:14:26",
  "Messages": [
    {
      "ID": 21578348727,
      "MessageUTC": "2026-02-12 13:26:02",
      "ReceiveUTC": "2026-02-12 13:26:02",
      "SIN": 152,
      "MobileID": "02009745SKY0712",
      "RawPayload": "mAHTG6dHyUZP0Sm9AAA=",
      "RegionName": "AORWSC",
      "OTAMessageSize": 14,
      "Transport": 1,
      "Network": 1
    }
  ]
}
```

### Formato IDP (Forward API — saída)

```json
{
  "account_id": 60003666,
  "Messages": [
    {
      "ID": 21659190092,
      "SIN": 152,
      "MobileID": "02203811SKY1D6C",
      "Transport": 1,
      "CustomerID": 0,
      "MessageUTC": "2026-02-23 13:14:26",
      "RawPayload": [152, 1, 211, 56, 162, 249, 222, 104, 59, 214, 182, 130, 128, 0, 26, 179, 64, 68, 27, 242, 136, 17, 53, 8, 64, 250, 64],
      "ReceiveUTC": "2026-02-23 13:14:26",
      "RegionName": "AORWSC",
      "MobileOwnerID": 60003666,
      "OTAMessageSize": 27
    }
  ]
}
```

### Adaptação OGx → IDP (implementada no message-forwarder)

| Campo | OGx (entrada) | IDP (saída) | Transformação |
|-------|---------------|-------------|---------------|
| `RawPayload` | Base64 string | Array de bytes | Decodificar Base64 |
| `CustomerID` | Ausente | Presente | Vem raw da OGWS (ou `0`) |
| `MobileOwnerID` | Ausente | Presente | Vem raw da OGWS (ou `FORWARD_ACCOUNT_ID`) |
| `Network` | Presente | Presente | Repassado raw |
| `account_id` | — | Presente | `FORWARD_ACCOUNT_ID` do .env |

---

### Formato Kafka Consumer (send.message.ogx)

Aceita tanto camelCase quanto PascalCase:

```json
{
  "DestinationID": "02009745SKY0712",
  "UserMessageID": 4,
  "RawPayload": [151, 200]
}
```

Ou:

```json
{
  "destinationId": "02009745SKY0712",
  "rawPayload": [128, 1, 84, 69, 83, 84, 69],
  "userMessageId": 12345
}
```

Opcionalmente com payload estruturado (sem rawPayload):

```json
{
  "destinationId": "02009745SKY0712",
  "sin": 16,
  "min": 2,
  "fields": [{"name": "param1", "value": "123"}]
}
```

---

## Envio de Mensagens para Dispositivos

### Via REST API

```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "destinationId": "02009745SKY0712",
    "rawPayload": [128, 1, 84, 69, 83, 84, 69]
  }'
```

### Via Kafka (tópico send.message.ogx)

Publicar mensagem no tópico `send.message.ogx` com o JSON:

```json
{"DestinationID":"02009745SKY0712","UserMessageID":4,"RawPayload":[151,200]}
```

### Estrutura enviada para API ORBCOMM (submit/messages)

```json
[
  {
    "DestinationID": "02009745SKY0712",
    "UserMessageID": 12345,
    "RawPayload": "gAFURVNURQ=="
  }
]
```

**Importante:**
- `RawPayload` deve ser Base64 ao enviar para ORBCOMM
- `UserMessageID` é obrigatório (gerado automaticamente se não fornecido)
- Request body é array direto (não objeto com chave `Messages`)
- `IsForward: "True"` necessário para payloads estruturados

---

## Erros Conhecidos

| ErrorID | Descrição | Solução |
|---------|-----------|---------|
| 23 | Message Definition Not Found | Verificar se dispositivo tem Message Definition configurada |
| - | `unauthorized_client` | Credenciais inválidas |
| - | `EADDRINUSE` | Porta em uso, matar processo anterior |
| - | `ECONNREFUSED :8080` | Forward API não está rodando |
| - | `ECONNREFUSED :9092` | Kafka broker não está rodando |

---

## Dispositivos de Teste

| MobileID | Modelo | Status |
|----------|--------|--------|
| 00002000SKY9307 | Simulador | Teste |
| 02009745SKY0712 | ST 2100 Real | Produção |

---

## Infraestrutura

### Kafka (Docker Compose)

Localização: `/home/bryan/Área de trabalho/mqtt_kafka/kafka/docker-compose.yml`

```bash
# Subir Kafka + Zookeeper
cd kafka && docker compose up -d

# Verificar status
docker ps --filter "name=kafka" --filter "name=zookeeper"

# Escutar tópico de envio
kcat -b localhost:9092 -t send.message.ogx -C

# Publicar mensagem de teste no tópico
echo '{"DestinationID":"02009745SKY0712","UserMessageID":4,"RawPayload":[151,200]}' | kcat -b localhost:9092 -t send.message.ogx -P
```

---

## Comandos Úteis

```bash
# Rodar em desenvolvimento
npm run dev

# Build
npm run build

# Produção
npm start

# Matar processo na porta
kill $(lsof -t -i:3000)
```

---

## Estrutura do Projeto

```
iot-orbcomm-middleware/
├── src/
│   ├── config/
│   │   └── env.ts                      # Configuração de ambiente
│   ├── routes/
│   │   └── messages.routes.ts          # Endpoints REST
│   ├── services/
│   │   ├── ogws-auth.service.ts        # Autenticação OGWS
│   │   ├── ogws-messages.service.ts    # Coleta de mensagens (polling)
│   │   ├── message-forwarder.service.ts # HTTP POST para Forward API
│   │   └── kafka-consumer.service.ts   # Consumer Kafka (envio p/ dispositivos)
│   ├── types/
│   │   └── ogws.types.ts              # Tipos TypeScript
│   └── index.ts                        # Entry point
├── .env                                # Variáveis de ambiente
├── .env.example                        # Exemplo de configuração
├── package.json
├── tsconfig.json
├── CONTEXT.md
└── README.md
```

---

## Credenciais ORBCOMM (Produção)

```
Base URL: https://ogws.orbcomm.com/api/v1.0
Access ID: 70000918
Password: UWLSUUVWIHVY
```

---

## Referências

- Documento: N214 OGWS User Guide.pdf
- API OGx: https://ogws.orbcomm.com/api/v1.0
- API Teste: https://ogws.swlab.ca/api/v1.0

---

*Última atualização: 2026-03-03*
