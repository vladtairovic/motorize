# MOTORIZE

Plataforma de cadastro e credenciamento municipal dos motociclistas de entrega de **Toritama/PE**.

São três aplicações conectadas pela mesma API e pelo mesmo banco:

| Aplicação | Quem usa | Endereço local |
|---|---|---|
| **App do entregador (PWA)** | Motociclista (cadastro, documentos, credencial com QR Code) e **agente da CTTU** em campo (modo agente, funciona sem sinal) | http://localhost:5173 |
| **Painel municipal** | Analista da CTTU (análise documental), gestor da Prefeitura (indicadores), administrador | http://localhost:5174 |
| **API** | As duas acima e futuras integrações municipais | http://localhost:3333/api/v1 |

---

## Como rodar (Windows, macOS ou Linux)

**Pré-requisitos:** [Node.js 22.9 ou mais novo](https://nodejs.org) e [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
npm install          # instala tudo (monorepo com workspaces)
npm run db:up        # sobe PostgreSQL 16 + PostGIS no Docker
npm run setup        # cria apps/api/.env, aplica as migrações e carrega dados de demonstração
npm run dev          # inicia API + app + painel juntos
```

> **Sem Docker?** Instale o PostgreSQL 16 para Windows e, no *Stack Builder* que abre no fim da instalação, marque **PostGIS**. Crie o usuário/banco `motorize` (senha `motorize`) ou ajuste `DATABASE_URL` em `apps/api/.env`. Depois rode `npm run setup` e `npm run dev`.

### Acessos de demonstração (dados fictícios)

| Perfil | Onde | Login | Senha |
|---|---|---|---|
| Entregador (persona Jorlan, já credenciado) | App | CPF `529.982.247-25` | `123456` |
| Agente de campo | App → "Sou agente da CTTU" | `agente@motorize.local` | `Motorize@2026` |
| Analista CTTU | Painel | `analista@motorize.local` | `Motorize@2026` |
| Gestora da Prefeitura | Painel | `gestor@motorize.local` | `Motorize@2026` |
| Administrador | Painel | `admin@motorize.local` | `Motorize@2026` |

`npm run db:seed -w apps/api` apaga e recria os dados de demonstração a qualquer momento.

### Testar no celular

A câmera (leitura do QR) só funciona em endereço seguro. Rode `npm run dev:https -w apps/app` e abra no celular `https://IP-DO-COMPUTADOR:5173` (mesma rede Wi-Fi; aceite o aviso de certificado). O app usa proxy para a API, então só a porta 5173 precisa estar acessível.

---

## Arquitetura

```
┌──────────────────────┐      ┌──────────────────────┐
│  App PWA (React)     │      │  Painel (React)      │
│  entregador + agente │      │  CTTU / Prefeitura   │
│  IndexedDB offline   │      │  gráficos + mapa     │
└─────────┬────────────┘      └──────────┬───────────┘
          │  HTTPS / JSON (JWT + refresh rotativo)
          └───────────────┬──────────────┘
                 ┌────────▼─────────┐
                 │  API NestJS      │  Fastify · Zod · Argon2id
                 │  /api/v1         │  Ed25519 (assinatura da credencial)
                 └────────┬─────────┘  cron de vencimentos · auditoria
                          │ Drizzle ORM
                 ┌────────▼─────────┐
                 │ PostgreSQL 16    │  PostGIS (mapa agregado)
                 │ + PostGIS        │  trilha de auditoria LGPD
                 └──────────────────┘
```

### Por que esta stack

Sistemas governamentais brasileiros semelhantes (CNH Digital / Carteira Digital de Trânsito, cadastros municipais como o CONDUMOTO de São Paulo, portais estaduais) convergem em: **PostgreSQL** como banco, **API REST** em camadas com injeção de dependência (tradicionalmente Java/Spring), **front-ends SPA**, **credencial com QR Code assinado digitalmente** e conformidade com LGPD. Mantivemos esse desenho e escolhemos, em cada camada, a opção mais enxuta e rápida para um município de pequeno porte:

| Camada | Escolha | Motivo |
|---|---|---|
| Banco | **PostgreSQL 16 + PostGIS** | Padrão do setor público (software livre, sem licença). PostGIS dá o georreferenciamento exigido no desafio. |
| API | **NestJS 11 sobre Fastify** | Mesma arquitetura em módulos/DI do Spring, em TypeScript (uma linguagem no projeto inteiro, mais fácil de manter pós-entrega). Fastify é ~2× mais rápido que Express. |
| Acesso a dados | **Drizzle ORM** + SQL direto onde convém | Sem binário/engine extra, consultas tipadas, migrações SQL legíveis e versionadas. |
| Validação | **Zod** | Mensagens de erro em português, campo a campo. |
| Senhas | **Argon2id** (parâmetros OWASP) | Recomendação atual da OWASP. |
| Sessão | **JWT de 15 min + refresh token rotativo** (hash no banco) | Sessões longas no celular sem expor token de longa duração; logout revoga de verdade. |
| Credencial | **QR Code assinado com Ed25519** | O agente valida a assinatura **sem internet**, só com a chave pública. Adulterar 1 caractere invalida o QR. |
| App | **React 19 + Vite 8 + PWA (Workbox) + IndexedDB (Dexie)** | Instala pelo navegador (sem loja), roda em Android simples, funciona offline. Pode virar app de loja depois com Capacitor sem reescrever. |
| Painel | **React 19 + Vite 8 + TanStack Query + Recharts + Leaflet/OSM** | Leve, sem custo de mapas. |

---

## O que está implementado

**Entregador (app)**
- Criar conta só com CPF (validado), nome, celular e senha + aceite do termo LGPD (base legal, finalidade, retenção, o que **não** é coletado).
- Cadastro em 4 etapas com progresso, salvamento automático e retomada: dados + CNH, moto (placa Mercosul ou antiga), documentos, revisão.
- Fotos reduzidas no próprio celular antes do envio (economia de dados móveis); aceita PDF (CNH digital/CRLV-e).
- Acompanhamento com histórico e **motivo exato** de cada pendência; correção e reenvio.
- **Credencial digital** com foto, placa, número, validade e QR Code — guardada no aparelho, abre sem internet, mantém a tela acesa, QR ampliável.
- Avisos (aprovação, pendência, vencimento em 30 e 7 dias, comunicados da Prefeitura).
- Renovação reaproveitando documentos já aceitos.
- LGPD: baixar cópia dos próprios dados; excluir conta (anonimização + revogação da credencial).

**Agente de campo (app, modo agente)**
- Baixa um "pacote offline" (chave pública + credenciais emitidas com foto).
- Lê o QR pela câmera (ou imagem/código colado); valida online quando há sinal e **offline pela assinatura** quando não há, checando suspensão/vencimento no pacote.
- Consultas feitas sem sinal ficam na fila e sobem sozinhas quando a conexão volta (idempotente).

**Consulta pública** (comerciante/cidadão): confere se a credencial é válida mostrando só nome abreviado e placa.

**Painel municipal**
- Visão geral com as métricas-chave do Lean Canvas: adesão (meta 300), fila, tempo até decisão, retrabalho, conclusão, vencimentos, fiscalização; evolução semanal, por bairro, por atividade; **mapa agregado em grade de ~250 m com ocultação de áreas com menos de 3 pessoas** (privacidade); exportação CSV sem CPF/telefone.
- Fila de solicitações com abas, busca por nome/CPF/placa/protocolo; trava de concorrência (dois analistas não pegam a mesma).
- Análise documental: visualizador de imagem/PDF, aceitar/recusar com motivos rápidos, aprovar (emite e assina a credencial), devolver com pendência, reprovar.
- Ficha do entregador: suspender, reativar, revogar credencial; histórico de consultas em campo.
- Comunicados oficiais (todos ou por bairro) com taxa de leitura.
- Gestão de servidores por perfil (Admin, Analista, Agente, Gestor).
- **Auditoria LGPD**: cada abertura de documento, ficha ou decisão fica registrada com autor, data e IP.

---

## Estrutura

```
motorize/
├─ docker-compose.yml        PostGIS (e perfil "prod" para a API)
├─ scripts/preparar.mjs      cria apps/api/.env com segredos aleatórios
├─ apps/api/                 NestJS + Drizzle
│  ├─ drizzle/               migrações SQL versionadas
│  ├─ keys/                  par Ed25519 (gerado no 1º uso; NÃO versionar)
│  ├─ storage/               documentos enviados (fora da pasta pública)
│  └─ src/
│     ├─ auth/               login, cadastro, refresh, guardas por perfil
│     ├─ entregador/         rotas do app do entregador
│     ├─ admin/              painel: solicitações, entregadores, indicadores
│     ├─ fiscalizacao/       pacote offline, validação, sincronização
│     ├─ credencial/         emissão/assinatura, rotina de vencimentos
│     ├─ publico/            saúde, chave pública, consulta pública
│     └─ db/                 schema, migrate, seed
├─ apps/app/                 PWA do entregador + modo agente
└─ apps/painel/              painel web municipal
```

## Principais rotas da API (`/api/v1`)

| Método | Rota | Perfil |
|---|---|---|
| POST | `/auth/entregador/cadastro` · `/auth/entregador/login` · `/auth/servidor/login` · `/auth/refresh` · `/auth/sair` | público |
| GET | `/auth/termo` · `/publico/chave` · `/publico/saude` · POST `/publico/validar` | público |
| GET/PUT/POST | `/entregador/painel` · `/dados` · `/motocicleta` · `/documentos/:tipo` · `/solicitacao/enviar` · `/renovacao` · `/credencial` · `/notificacoes` · `/meus-dados` · DELETE `/conta` | entregador |
| GET/POST | `/fiscalizacao/pacote` · `/fiscalizacao/validar` · `/fiscalizacao/consultas/sync` | agente |
| GET/POST/PATCH | `/admin/indicadores` · `/admin/solicitacoes[/:id]` · `/:id/iniciar-analise` · `/:id/decisao` · `/admin/documentos/:id` · `/admin/entregadores[/:id]` · `/admin/credenciais/:id/status` · `/admin/comunicados` · `/admin/relatorios/entregadores.csv` | analista / gestor |
| GET/POST/PATCH | `/admin/servidores` · `/admin/auditoria` | admin |

## Produção (checklist)

- Servir tudo em **HTTPS** (obrigatório para PWA, câmera e Web Crypto).
- Trocar `JWT_*_SECRET` e guardar a chave privada da credencial em cofre (`CREDENCIAL_PRIVATE_KEY_PEM` aceita o PEM por variável de ambiente). **Faça backup da chave**: perdê-la invalida todas as credenciais emitidas.
- `docker compose --profile prod up -d` sobe banco + API; publique `apps/app/dist` e `apps/painel/dist` em qualquer servidor estático (Nginx), com `/api` apontando para a API.
- Backup diário do PostgreSQL e da pasta `storage` (ou troque o driver de armazenamento por S3/MinIO em `src/common/storage.service.ts`).
- Ajustar `CORS_ORIGINS` para os domínios reais.

## Pontos em aberto (do dossiê) e onde mexer

- **Obrigatório × voluntário**: o sistema funciona nos dois modelos; nada no código depende disso.
- **Benefício ao credenciado**: comunicados e a consulta pública (comércio confiando no credenciado) já existem; um benefício novo entra como módulo.
- **Login gov.br**: o `AuthService` já separa emissão de sessão; integrar o OpenID Connect do gov.br é adicionar um provedor que chama `emitir()`.
- **Notificação por WhatsApp/push**: hoje os avisos ficam no app; a tabela `notificacoes` é o ponto para plugar um disparador.
- **Integração com sistemas municipais/DETRAN**: rotas REST versionadas em `/api/v1`, prontas para consumo.
