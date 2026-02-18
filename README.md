# IOT-ORBCOMM-MIDDLEWARE

Middleware para integração IoT com ORBCOMM OGx Gateway Web Service (OGWS).

Este serviço realiza polling automático de mensagens From-Mobile (RE) da API OGWS e expõe endpoints REST para consulta.

## Requisitos

- Node.js >= 18.0.0

## Instalação

```bash
npm install
```

## Configuração

Configure as variáveis de ambiente (ou use os valores padrão de teste):

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `3000` |
| `HOST` | Host do servidor | `0.0.0.0` |
| `OGWS_BASE_URL` | URL base da API OGWS | `https://ogws.swlab.ca/api/v1.0` |
| `OGWS_ACCESS_ID` | ID de acesso ORBCOMM | `70000934` |
| `OGWS_PASSWORD` | Senha ORBCOMM | `password` |
| `POLLING_INTERVAL_SECONDS` | Intervalo de polling | `60` |

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
| GET | `/api/status` | Status completo do serviço |
| GET | `/api/health` | Health check |

### Mensagens
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/messages` | Lista todas as mensagens |
| GET | `/api/messages/mobile/:mobileId` | Mensagens por MobileID |
| GET | `/api/messages/sin/:sin` | Mensagens por SIN |
| POST | `/api/messages/poll` | Força busca imediata |
| DELETE | `/api/messages` | Limpa mensagens armazenadas |

### Controle de Polling
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/polling/start` | Inicia polling automático |
| POST | `/api/polling/stop` | Para polling automático |

## Estrutura do Projeto

```
iot-orbcomm-middleware/
├── src/
│   ├── config/
│   │   └── env.ts              # Configurações
│   ├── routes/
│   │   └── messages.routes.ts  # Rotas da API
│   ├── services/
│   │   ├── ogws-auth.service.ts     # Autenticação OGWS
│   │   └── ogws-messages.service.ts # Serviço de mensagens
│   ├── types/
│   │   └── ogws.types.ts       # Tipos TypeScript
│   └── index.ts                # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

## API ORBCOMM OGWS

Este middleware utiliza a API OGx Gateway Web Service (OGWS) da ORBCOMM.

- **Documentação**: [Partner Support](https://partner-support.orbcomm.com)
- **Ambiente de Teste**: https://ogws.swlab.ca/api/v1.0
- **Swagger/Docs**: https://ogws.swlab.ca/docs/api/index.html

### Credenciais de Teste
- Access ID: `70000934` (SuperUser) ou `70000935` (User)
- Password: `password`

### MobileIDs de Teste
- OGx: `00002000SKY9307`, `00002001SKY9317`
- IsatData Pro: `01097623SKY2C68`, `01014034SKY9397`

## Licença

ISC
