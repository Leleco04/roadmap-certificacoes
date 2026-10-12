# Modelo de dados

Modelos de domínio implementados no P0 em `src/domain/models.ts`. P2/P3 acrescentam schema SQL/RLS e P4 implementa Supabase Auth, cujo aceite real permanece sem confirmação. P5 sincroniza contas via Supabase com cache local; visitante permanece local. Ver [arquitetura](ARCHITECTURE.md) para responsabilidades e [roadmap](ROADMAP.md) para fases.

## CertificationProvider

| Campo | Conceito |
| --- | --- |
| `id` | Identificador estável e único do provider. |
| `name` | Nome de exibição. |
| `slug` | Identificador legível e único. |
| `website` | URL oficial. |

Exemplos de ids/slugs: `microsoft`, `aws`, `anthropic`, `github`, `google-cloud`. Poderá ser configuração, dados tipados, arquivo estático ou tabela se necessário; nenhuma tabela é definida agora.

## Track

Conceitualmente, uma track possui `id`, `name` e `slug` estáveis. Representa uma área, independentemente do provider. Referências em certificações devem apontar para tracks existentes, sem duplicação.

Lista inicial planejada: Artificial Intelligence, Cloud, Cybersecurity, Data, DevOps e Development. Novas tracks devem ser adicionadas como dados, sem alterar uma enum fechada de domínio.

## Certification

| Campo | Conceito |
| --- | --- |
| `provider` | Referência ao `id` da organização emissora. |
| `code` | Código próprio da certificação, único dentro do provider. |
| `name` | Nome de exibição. |
| `tracks` | Uma ou mais referências a áreas de conhecimento. |
| `level` | Texto flexível conforme a nomenclatura do provider; pode estar ausente quando não houver nível. |
| `levelRank` | Número opcional para ordenação lógica; não mede dificuldade absoluta. |
| `recommendedOrder` | Ordem recomendada opcional por contexto de provider/trilha; pode ter entradas diferentes para tracks distintas. |
| `validity` | Informação opcional de validade, incluindo duração ou ausência de expiração quando confirmada. |
| `renewal` | Informação opcional de renovação. |
| `difficulty` | Avaliação editorial opcional, separada do nível. |
| `priority` | Prioridade editorial opcional do catálogo; não representa preferência do usuário. |
| `mainContent` | Lista de tópicos principais. |
| `prerequisites` | Requisitos/recomendações, com referências a outras certificações quando aplicável. |
| `relevance` | Descrição da aplicabilidade profissional. |
| `sourceUrl` | URL da fonte oficial para conferência. |

Informações desconhecidas permanecem ausentes, sem inferir validade, renovação ou requisitos. No P0, `recommendedOrder` mapeia ids de tracks para números; `validity`, `renewal`, `difficulty`, `priority`, `prerequisites` e `relevance` usam texto opcional. `mainContent` é uma lista de textos. A sequência de cada roadmap fica em configuração própria. Os pré-requisitos são descritos em texto neste estágio, sem grafo de dependências.

`level` não é uma enum Microsoft: aceita Fundamentals, Foundational, Foundations, Associate, Professional, Expert, Specialty ou outras nomenclaturas. Valores conceituais de `levelRank`: Foundational/Fundamentals → 10; Associate → 20; Professional → 30; Expert → 40; Specialty → 50. São convenções de ordenação, sem equivalência de dificuldade ou competência entre providers. Registros sem rank continuam válidos e precisam de ordenação previsível.

`recommendedOrder` é contextual, não uma sequência universal. Uma certificação pode ter posições diferentes em diferentes trilhas. Alterações editoriais nesses campos não alteram o progresso individual.

### Revisão Microsoft do P1

Recorte técnico revisado em **08/10/2026**, com 29 credenciais e fontes individuais em `src/catalog/data.ts`. As 29 páginas oficiais responderam HTTP 200 e referenciam os códigos usados. As 12 identidades P0 foram mantidas; nenhuma alteração no formato de progresso v1.

| Área principal do recorte | Credenciais incluídas |
| --- | --- |
| IA | AI-901, AI-103, AI-200, AI-300, AI-500, AB-620, AB-100 |
| Cloud | AZ-900, AZ-104, AZ-305, AZ-700, AZ-400, AZ-140, AZ-120, AZ-802 |
| Cybersecurity | SC-900, SC-300, SC-500, SC-200, SC-401, SC-100 |
| Data | DP-900, DP-700, DP-750, DP-600, DP-800, DP-300, DP-420, PL-300 |

Essa tabela agrupa cada credencial uma vez pelo foco principal. Associações reais entre áreas produzem 12 registros na track AI, 13 em Cloud, 7 em Cybersecurity e 10 em Data; DevOps (2) e Development (3) são tracks secundárias existentes. Não se atribui Cloud automaticamente a tudo que usa Azure.

AB-620 e AB-100 entram pela integração e arquitetura técnica de agentes, em caminho empresarial opcional. PL-300 entra por analytics; SC-401 por proteção técnica de dados e IA; AZ-120 por infraestrutura Azure para SAP. Credenciais funcionais de Dynamics, Microsoft 365 e Power Platform, business/leadership e Applied Skills ficam fora do recorte.

**Níveis e política:** `level` preserva o tier oficial presente no nome da credencial (Fundamentals, Associate, Expert ou Specialty), sem confundir com os rótulos pedagógicos Beginner/Intermediate/Advanced do portal. A UI omite apenas o prefixo repetido “Microsoft Certified:”. O domínio continua aceitando outros níveis. Fundamentals não expira; Associate, Expert e Specialty valem um ano. A renovação é gratuita, na janela de seis meses antes do vencimento quando a credencial estiver elegível; credenciais novas podem ainda não ter avaliação de renovação disponível. Para beta, obtenção/expiração são baseadas na correção oficial do exame, não em datas inventadas pela aplicação. [Política de expiração](https://learn.microsoft.com/en-us/credentials/support/credential-expiration-policy), [FAQ de renovação](https://learn.microsoft.com/en-us/credentials/certifications/renew-your-microsoft-certification-faq).

**Critérios editoriais:** difficulty usa Inicial (fundamentos e amplitude introdutória), Intermediária (prática em um papel técnico) e Avançada (arquitetura, múltiplos sistemas ou operações profundas). AI-300 é Avançada pela combinação de ML, GenAI, IaC e operações; Specialty não implica automaticamente dificuldade maior. Priority usa Base (entrada), Evolução (núcleo de AI/Cloud/Security/Data Engineering) e Especialização (caminho dependente do contexto, como SAP, desktops, analytics, bancos específicos ou agentes empresariais). Tracks, dificuldade, prioridade, relevância profissional e ordem prática são classificações editoriais; nomes, tópicos e requisitos técnicos são resumidos das fontes oficiais.

**Transições e divergências relevantes:**

- AI-900, AI-102, DP-100, AZ-204, AZ-500 e AZ-800/AZ-801 já estão aposentadas. Seus códigos não aparecem no catálogo ativo. O exame atual de Windows Server é AZ-802; a página atual usa Windows Server Administrator Associate. [Aposentadorias](https://learn.microsoft.com/en-us/credentials/support/retired-certification-exams), [AZ-802](https://learn.microsoft.com/en-us/credentials/certifications/exams/az-802/).
- DP-203 também está aposentado; Fabric/Databricks são caminhos atuais distintos, sem declarar equivalência automática. [Guia oficial DP-203](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-203).
- DP-420 usa **Azure Cosmos DB AI Developer Associate**, conforme sua página específica e os objetivos vigentes desde 06/10/2026. A URL e algumas listagens mantêm Specialty; elas não definem o tier usado no catálogo. [Credencial DP-420](https://learn.microsoft.com/en-us/credentials/certifications/azure-cosmos-db-developer-specialty/), [guia DP-420](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-420).
- AI-500 tem página de credencial e exame agendável, mas a listagem geral ainda sinaliza **beta**, enquanto páginas específicas omitem o sufixo. O card e a ramificação mantêm essa sinalização e os detalhes explicam a divergência; não se presume uma data de disponibilidade geral. [Listagem oficial](https://learn.microsoft.com/en-us/credentials/browse/?credential_types=certification&products=azure), [credencial AI-500](https://learn.microsoft.com/en-us/credentials/certifications/multi-agent-ai-solutions-expert/), [exame AI-500](https://learn.microsoft.com/en-us/credentials/certifications/exams/ai-500/).
- AZ-400 ainda lista Azure Developer Associate (AZ-204) como alternativa legada de pré-requisito. O texto mantém essa informação com aviso de aposentadoria; não a oferece como nova certificação nem substitui silenciosamente por AI-200. AZ-104 é a opção ativa no recorte. [Pré-requisitos oficiais](https://learn.microsoft.com/en-us/credentials/certifications/devops-engineer/).

O validador `src/catalog/validation.ts`, executado por `npm run validate:catalog`, verifica IDs/códigos, providers, tracks, campos editoriais, ranks, ordens, hosts oficiais e referências de roadmaps. Testes são determinísticos e não usam rede; eles não garantem que uma fonte continue ativa ou que metadados oficiais não mudem. Novas revisões devem conferir as páginas específicas, preservar identidades e registrar mudanças relevantes aqui.

## Roadmap

Modelo de dados de cada caminho: `id`, `provider`, `track`, `description`, `certificationCodes` (base comum) e `branches` opcional. Cada ramificação contém `id`, `name` e `certificationCodes`, com identidades canônicas. Roadmaps lineares anteriores continuam válidos.

As ramificações representam escolhas independentes, e sua ordem visual não cria dependências obrigatórias. Pré-requisitos oficiais continuam descritos na certificação: por exemplo, AZ-305 exige AZ-104; AI-500 exige AI-103; SC-100 aceita uma das Associates indicadas na fonte; AB-100 também aceita alternativas. Métricas contam a união das identidades da base e das ramificações, uma vez por roadmap, como cobertura das opções exibidas. Roadmaps são caminhos curados; não precisam repetir todas as associações secundárias retornadas pelo filtro de track.

### Identidade entre providers

Como códigos de providers distintos podem coincidir, a referência persistida é composta por provider e código normalizados em lowercase: por exemplo, `microsoft:ai-103`. `code` preserva o código de exibição (`AI-103`); `certificationCode` local e `certification_id` SQL usam a identidade qualificada. As partes aceitam letras ASCII, números, ponto, hífen e underscore, começando por letra ou número; `:` fica reservado como separador. A identidade permanece estável após alterações de nome ou metadados. Importações exigem chaves já canônicas.

## CertificationProgress

| Campo | Conceito |
| --- | --- |
| `certificationCode` | Identidade qualificada da certificação. |
| `status` | `todo`, `planned`, `studying` ou `done`. |
| `updatedAt` | Timestamp UTC da última alteração, para reconciliação futura. |

`todo`: ainda não iniciado; `planned`: pretende fazer; `studying`: em estudo; `done`: concluído. Ausência de registro equivale a `todo` na leitura; alterações explícitas para `todo` são persistidas e também sincronizadas no P5.

Este modelo nunca integra o objeto estático `Certification`. No modo local, pertence ao visitante do navegador. No modo cloud, o proprietário é identificado por `user_id`. Haverá no máximo um registro por identidade de certificação e proprietário.

Referências que não existam na versão atual do catálogo não devem ser descartadas silenciosamente durante leitura/importação. A UI deve tratá-las como indisponíveis, sem contá-las como certificações visíveis.

## Schema Supabase preparado no P2

Migration: `supabase/migrations/20261008000000_create_user_data.sql`. Depende de `auth.users`, fornecida pelo Supabase. Nenhum projeto remoto foi criado/configurado. O banco contém somente dados associados ao usuário; catálogo, providers e tracks continuam estáticos no frontend.

### Identidade Auth no P4

`AuthUser` em `src/auth/authService.ts` contém `id` (UUID de `auth.users`), `email` opcional e `displayName` opcional vindo dos metadados Auth. Esses campos servem apenas à apresentação; não são catálogo, progresso ou autorização. Tokens e persistência/renovação de sessão ficam com o SDK Supabase. Nenhum JWT próprio é emitido ou verificado pela aplicação.

No P4, progresso era exclusivamente v1/local e Auth não acessava tabelas. O profile SQL permanece distinto da identidade/sessão Auth; não há leitura/criação automática de profile no P5.

No P5, a mesma identidade seleciona o namespace local; o repositório remoto confere novamente a sessão e deriva o dono dela. Não há API da UI para escolher `user_id`. Profiles permanecem fora do fluxo.

### Cache local v2 no P5

`src/persistence/progressCache.ts` gerencia a chave `roadmap-certificacoes.progress` com envelope `{ version: 2, visitor, accounts, visibleOwner }`:

| Campo | Conceito |
| --- | --- |
| `visitor` | `ProgressMap` do visitante original, separado de contas. |
| `accounts[uuid].progress` | Cache/progresso temporário daquela conta, incluindo identidades desconhecidas. |
| `accounts[uuid].pending` | IDs com alterações que ainda precisam de confirmação/reconciliação. |
| `accounts[uuid].lastSyncedAt` | Instante estimado do último ciclo concluído, ou null. |
| `accounts[uuid].serverOffsetMs` | Estimativa persistida da diferença entre relógio do servidor/dispositivo, ou null. |
| `accounts[uuid].visitorImport` | `undecided`, `accepted` ou `declined`, para não repetir prompts. |
| `visibleOwner` | UUID do último cache exibido, ou null para visitante. Logout conserva esse marcador. |

Migração explícita de v1: valida o formato antigo e copia integralmente para `visitor`; contas começam vazias. Uma única gravação troca o envelope. Falha preserva o v1 original; dados inválidos permanecem protegidos contra sobrescrita. JSON portátil permanece v1 com apenas o progresso exibido, sem namespaces/metadados/sessões. CSV continua catálogo completo + progresso exibido.

Namespaces são lógicos dentro do envelope; cache A nunca é convertido em visitante ou enviado automaticamente a B. Após logout, o último estado continua editável localmente em seu namespace e só será reconciliado com a mesma conta. Nova conta usa seu próprio cache/remoto, sem seed de visitante automático.

`SyncSnapshot` modela `local`, `syncing`, `synced`, `pending` e `error`, além de falha de storage, último sucesso e oferta de importação. Pending/erro não equivalem a gravação cloud confirmada. Importação de visitante exige consentimento; merge independente por certificação preserva o mais recente, com empate para cloud. Valores iguais adotam a data remota sem escrita.

### profiles

| Campo | Constraint/conceito |
| --- | --- |
| `id` | UUID, chave primária e FK para `auth.users(id)`, com `ON DELETE CASCADE`. |
| `display_name` | Texto opcional. |
| `avatar_url` | URL opcional. |
| `created_at` | Timestamp UTC obrigatório, preenchido na criação. |
| `updated_at` | Timestamp UTC obrigatório, mantido nas alterações. |

Um perfil por usuário, sem trigger de criação automática. Migration P3: `supabase/migrations/20261010000000_create_rls_policies.sql`. RLS restringe SELECT, INSERT, UPDATE e DELETE a `profiles.id = auth.uid()`, com policies exclusivas para `authenticated`. UPDATE valida a linha atual e a nova; o usuário não pode trocar o dono. Excluir o próprio profile é permitido e não remove conta ou progresso. `anon` não tem acesso.

### user_cert_progress

| Campo | Constraint/conceito |
| --- | --- |
| `user_id` | UUID obrigatório, FK para `auth.users(id)`, com `ON DELETE CASCADE`. |
| `certification_id` | Texto obrigatório, identidade qualificada lowercase `provider:code`. |
| `status` | Obrigatório, limitado aos quatro status previstos. |
| `created_at` | Timestamp UTC obrigatório, preenchido na criação. |
| `updated_at` | Timestamp obrigatório da última gravação no banco, definido pelo servidor. |

Chave primária composta: **`(user_id, certification_id)`**. Impede duplicação por usuário e certificação. CHECK de identidade: `^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$`, com collation `C`. Rejeita espaços, uppercase e separadores extras, sem lista fixa de providers ou códigos. CHECK de status aceita exclusivamente `todo`, `planned`, `studying` e `done`. Não existe FK para catálogo; uma identidade canônica desconhecida pode ser armazenada.

RLS está habilitada com policies P3 para `authenticated`, exigindo **`user_cert_progress.user_id = auth.uid()`** em SELECT, INSERT, UPDATE e DELETE. `USING` filtra linhas existentes e `WITH CHECK` valida inserções e o novo proprietário em UPDATE. Acesso cruzado e troca de dono são bloqueados. `anon` não tem grants nem policies; SELECT/INSERT/UPDATE/DELETE falham com `42501`. `authenticated` recebe somente essas quatro operações, sem privilégios fora de RLS como TRUNCATE. Donos e papéis com bypass continuam administrativos; grants diretos de service_role não mudam. P2 permanece intacto, sem policies retroativas.

### Timestamps e índices

Ambas as tabelas usam `timestamptz NOT NULL DEFAULT now()` em `created_at` e `updated_at`. PostgreSQL armazena instantes; a exibição depende do timezone da sessão (UTC nos testes). A função reutilizável `public.set_updated_at()` é executada por triggers BEFORE UPDATE e substitui `updated_at` por `now()`, inclusive quando o cliente fornece outro valor. `now()` é o início da transação; alterações dentro da mesma transação podem ter timestamps iguais. `created_at` não é modificado pelo trigger.

Somente índices das PKs foram criados. O índice composto atende todas as certificações de um usuário e a busca por usuário/certificação. Sincronização incremental e filtro de status ainda não têm consultas implementadas; índices adicionais serão avaliados no P5 conforme necessidade, evitando redundância.

`updated_at` SQL continua sendo a gravação no servidor; schema/triggers não mudam no P5. Antes de confirmação, `updatedAt` local representa a edição pendente, usando estimativa de offset quando disponível. Merge compara esse instante com remoto antes de enviar; após upsert, o `updated_at` retornado é normalizado para ISO UTC/milissegundos e passa a ser canônico no cache. Não se envia timestamp do cliente ao banco. A data original pendente não vira antecipadamente data de upload durante falhas.

HTTP Date, quando exposto, ou timestamp da escrita confirmada com a janela da request estimam o relógio do servidor. O offset é persistido para offline; variações de até um segundo são ignoradas. Uma edição nova é posterior ao último estado conhecido do mesmo ID, e edição durante upsert fica posterior à sua própria escrita anterior. Datas de servidor confirmadas não são recalibradas. Microssegundos PostgreSQL são normalizados para milissegundos; empates favorecem cloud.

Estimativa não elimina latência, mudança de relógio ou incerteza de timestamps históricos importados. Antes de calibração usa-se UTC do dispositivo; SELECT/UPSERT não são uma transação global e não garantem ordem física de edições simultâneas. Mesmo com relógios diferentes, igualdade de status e normalização do ack evitam loops. A exclusão do usuário remove perfil/progresso via cascade; remoção de conta continua futura.
