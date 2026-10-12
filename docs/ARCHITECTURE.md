# Arquitetura

## Visão geral e estado atual

P0 e P1 implementados: frontend React com TypeScript estrito e Vite, utilizável sem login, com testes unitários Vitest e catálogo Microsoft do recorte inicial. P2/P3 preparam schema/RLS; aceite P3 via API real pendente. P4 adiciona Auth e segue pendente de OAuth real. P5/P6 concluem critérios internos de sincronização e qualidade, com aceite externo multi-dispositivo pendente. P7 preparado para Vercel; deploy e smoke tests de produção pendentes.

Fluxo: **UI → hooks/estado → serviço/repositório → persistência**. Componentes de UI não acessarão diretamente localStorage, Supabase ou APIs externas. Uma fronteira simples para leitura e gravação de progresso permitirá adicionar persistência cloud sem reestruturar o domínio; não exige agora frameworks de estado, classes ou infraestrutura adicional.

## Princípios

- Simplicidade, baixo custo e baixa manutenção; poucas dependências.
- Baixo acoplamento entre domínio, UI e persistência.
- Domínio agnóstico de provider, com providers, tracks e níveis extensíveis.
- Segurança proporcional ao risco, com isolamento correto entre usuários.
- Evolução incremental, sem servidor próprio, microserviços, Redis, filas ou Kubernetes sem necessidade demonstrada.

## Camadas e responsabilidades

| Camada | Responsabilidade |
| --- | --- |
| Catálogo | Dados compartilhados das certificações, inicialmente tipados no frontend. |
| Provider | Identidade e metadados da organização emissora. |
| Track | Área de conhecimento, reutilizável entre providers; certificação pode ter várias. |
| Domínio | Tipos, identidade, validação, ordenação e regras genéricas de progresso. |
| UI | Exibição, navegação e interação; recebe dados e ações da camada intermediária. |
| Estado/progresso | Hooks ou estado que coordenam carregamento, alterações e indicadores. |
| Serviço/repositório | Operações de progresso e fronteira com a implementação de persistência. |
| Persistência | Leitura, gravação, validação e versionamento no armazenamento escolhido. |
| Autenticação | Identidade e sessão gerenciadas por Supabase Auth no P4, independentes do progresso. |
| Sincronização | Store de progresso coordena merge, importação consentida e retry local/cloud no P5. |

Integrações externas futuras ficam atrás de serviços, sem dependência direta dos componentes. Os [modelos](DATA_MODEL.md) definem os dados; o [roadmap](ROADMAP.md) define quando cada responsabilidade será implementada.

### Organização implementada no P0

- `src/domain/`: modelos, identidade lowercase, métricas, filtros, busca e ordenação.
- `src/catalog/`: providers, tracks, catálogo, metadados visuais, roadmaps e progresso inicial separados; validação automatizada de dados e referências.
- `src/components/`: dashboard, cards, filtros, roadmaps e ferramentas de importação/exportação; composição em `src/App.tsx`.
- `src/progress/`: merge puro, serviço/store de sincronização, hook `useSyncExternalStore` e feedback global. UI não chama Supabase.
- `src/persistence/`: contrato de repositório, implementação local e serialização/validação. Somente esta camada acessa o localStorage de progresso; o SDK Auth gerencia sua própria sessão separadamente.
- `src/auth/`: serviço de estado, adapter Supabase Auth e hook `useAuth`; a UI recebe estado/ações sem acessar o SDK. `main.tsx` compõe Auth, store, cache local e repositório remoto usando o mesmo cliente Supabase.
- `src/utilities/`: CSV, downloads e apresentação; testes próximos das regras exercitadas.

React gerencia o estado sem biblioteca adicional. As métricas gerais usam todo o catálogo, contando cada identidade uma vez; filtros afetam somente os cards. Os roadmaps usam listas explícitas de base comum e ramificações opcionais, independentes dos filtros e da ordenação visual. A extensão do P1 é aditiva: roadmaps lineares continuam válidos. As métricas do roadmap contam a união de seus caminhos, sem tornar todas as especializações obrigatórias. Regras e revisão de catálogo estão em [DATA_MODEL.md](DATA_MODEL.md#revisão-microsoft-do-p1).

## Catálogo x progresso

`Certification` é dado compartilhado sobre a certificação. `CertificationProgress` representa o estado dessa certificação para um visitante ou usuário. O status nunca fará parte do catálogo estático.

Inicialmente, o catálogo poderá ser dados tipados no frontend. Carregá-lo de arquivo, mantê-lo estático, movê-lo para banco ou administrá-lo por painel são possibilidades futuras. Não há decisão de criar tabelas para catálogo, providers ou tracks agora.

## Persistência local

Na primeira versão, localStorage armazenará somente o progresso do visitante em um formato com versão de schema e registros de progresso. Dados lidos serão tratados como entrada não confiável: validar formato, status, identidade e timestamps antes de usá-los.

O P0 usa a chave `roadmap-certificacoes.progress` e o formato JSON `{ version: 1, progress: { "provider:code": { status, updatedAt } } }`. P5 migra explicitamente essa chave para v2: visitante, namespaces de contas e identificação do último estado exibido. IDs/datas e progresso vazio já salvo são preservados; seed é apenas de visitante novo. JSON portátil de import/export permanece v1; detalhes do cache estão no [modelo de dados](DATA_MODEL.md#cache-local-v2-no-p5).

JSON inválido, versões desconhecidas ou qualquer registro inválido rejeitam o conjunto inteiro. Falhas de leitura e dados não reconhecidos bloqueiam sobrescrita automática; a UI informa a falha e permite progresso em memória/exportação JSON. Falhas de gravação também são informadas. Uma importação válida explicitamente confirmada pode substituir o estado protegido. O upgrade v1 → v2 é atômico: se falhar a gravação, o v1 original permanece no storage e os dados ficam recuperáveis em memória.

Importação JSON valida todos os registros antes de oferecer confirmação. Como visitante, substitui o conjunto e preserva datas/identidades desconhecidas. Na conta, é uma nova edição explícita: entradas conhecidas omitidas recebem `todo`, evitando delete+insert; entradas remotas desconhecidas do cache são preservadas no merge. Arquivos acima de 1 MB são rejeitados. Registros fora da amostra são exportáveis e não contam nas métricas. CSV exporta o catálogo completo com progresso, independentemente dos filtros. Não há service worker/cache offline da aplicação inteira.

## Supabase: Auth e progresso da conta

O schema P2 contém `profiles` e `user_cert_progress`, com FK para `auth.users`, cascade, constraints e timestamps automáticos; o catálogo continua fora do banco. P5 acrescenta somente acesso SELECT/UPSERT a `user_cert_progress`; não altera schema/triggers/RLS nem acessa profiles. `supabaseProgressRepository.ts` confere a sessão atual antes de cada operação/lote, deriva `user_id` dela e valida respostas da própria conta. RLS é autoritativa; filtros são complementares. SELECT paginado e lotes de upsert preservam importações maiores que o limite usual de respostas PostgREST.

RLS está habilitada nas duas tabelas. O P3 adiciona quatro policies explícitas por tabela, voltadas apenas a `authenticated`: SELECT/DELETE usam `USING`, INSERT usa `WITH CHECK` e UPDATE usa ambos. As condições são `profiles.id = auth.uid()` e `user_cert_progress.user_id = auth.uid()`, impedindo acesso cruzado e troca de dono. `anon` e PUBLIC não recebem privilégios; `authenticated` recebe somente SELECT, INSERT, UPDATE e DELETE, sem TRUNCATE (que não é protegido por RLS). Grants diretos de service_role não são alterados; donos/bypass administrativos não estão sujeitos às policies. Essa decisão segue a [documentação Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security). Não há trigger automático de criação de profile. Excluir o próprio profile não remove conta ou progresso.

Testes SQL reais cobrem A/B nas duas direções, ausência de identidade, anon e troca de proprietário. A validação usa PostgreSQL 18 isolado, roles sem bypass e claims de sessão consumidos pela implementação Supabase de `auth.uid()`, com helpers invoker. Não exercita HTTP, validação JWT ou fluxo Auth completo; reprodução e comandos estão no [README](../README.md#validação-do-schema-e-isolamento-p2p3).

Supabase Auth gerencia usuários e sessões. Para contas, Supabase é a persistência autoritativa e localStorage é cache/recuperação temporária. Visitante continua exclusivamente local. Falhas cloud são visíveis: salvar localmente não significa confirmar sincronização. Profiles continuam fora da implementação.

Cache separado por usuário e visitante no envelope v2. Enquanto a sessão está sendo recuperada, um cache de conta anterior não é exibido como progresso autenticado e edições/importações aguardam a identidade. Login seleciona apenas o namespace correto. Logout mantém o último namespace para uso local, sem convertê-lo em visitante; login B não envia cache A.

## Autenticação

P4 implementa Google OAuth e GitHub OAuth via `signInWithOAuth`, com PKCE, `persistSession`, `autoRefreshToken` e `detectSessionInUrl`. O SDK processa o retorno na própria página. Redirecionamento usa origem + pathname, sem parâmetros de entrada; a allowlist/configuração externa está no [README](../README.md#configuração-de-autenticação-p4). Nenhum secret de provider/service role é usado no frontend.

`supabaseAuth.ts` valida configuração pública e adapta somente métodos Auth. `authService.ts` expõe snapshot estável e assinatura; `useAuth` usa `useSyncExternalStore`, com cancelamento de inscrição ao desmontar e descarte de leituras iniciais atrasadas. Eventos de sessão prevalecem sobre leitura inicial para não restaurar usuário após logout. Falhas de inicialização/callback, login e logout são mostradas; configuração ausente permite visitante sem cliente ou rede. O logout usa escopo local; não encerra intencionalmente sessões em outros dispositivos.

A sessão é persistida pelo SDK em chave própria. P5 observa Auth para selecionar o cache, interromper requests desde o início do logout e ignorar respostas tardias. Evento de renovação durante logout não remove essa pausa. `AuthUser` expõe apenas ID, email e nome de exibição, sem tokens na UI. Metadados/sessão local não autorizam dados: essa proteção é RLS. Senha, recuperação de senha e MFA ficam fora do escopo.

Testes exercitam estado, corridas de montagem/eventos, SDK real com transporte controlado e UI. Validação em navegador cobre callbacks PKCE simulados dos dois providers, reload, logout, erro OAuth, preservação do progresso e larguras 1440/390/320. OAuth/consentimento e JWT reais ainda dependem de configuração externa; essa limitação impede declarar o aceite completo do P4.

## Sincronização

`ProgressService` é o store único: UI → `useProgress` → serviço → `ProgressCacheRepository`/`RemoteProgressRepository`. Ele mantém snapshots estáveis, pendências, último sucesso e confirmação de importação. A composição principal injeta as dependências; componentes só recebem ações/estado. Nenhuma dependência foi adicionada no P5.

Login/reload autenticado carrega o namespace da própria conta e remoto; `mergeProgress` compara cada identidade em UTC/milissegundos, com cloud vencendo empates. Estados iguais adotam data cloud sem nova escrita. Uploads necessários são upserts; sucesso normaliza `updatedAt` com `updated_at` retornado. Enquanto há erro, a data da alteração e a pendência permanecem no cache. Edição durante request não é sobrescrita por ack anterior; recebe prioridade causal sobre a própria escrita anterior e uma reconciliação adicional.

Importação de visitante é explícita, preserva o estado original e registra aceite/recusa por conta; não há prompts repetidos. A/B têm namespaces distintos. O cache A mantido após logout não é tratado como visitante ao entrar em B. Edições após logout continuam locais nesse namespace; só podem sincronizar quando a mesma conta retornar.

Relógio local é estimado pelo HTTP Date, quando exposto; após escrita, pode usar a data gerada pelo banco e a janela da request quando CORS não expõe Date. Offset persistido auxilia offline, pequenas mudanças de até um segundo são ignoradas e novas edições são posteriores ao último estado conhecido da certificação. Timestamps de servidor já confirmados nunca são deslocados. Antes de calibração e em dados históricos importados, o relógio de origem permanece uma limitação; não há garantia de ordem física para edições simultâneas e a dupla SELECT/UPSERT não é atômica entre dispositivos. A normalização e o teste de igualdade evitam loops; detalhes estão no [README](../README.md#sincronização-p5).

Requests usam AbortSignal e contextos por conta. Logout/desmontagem/troca cancelam requests e invalidam resultados; uma operação já confirmada pelo servidor não pode ser desfeita pelo abort. Erro interrompe o ciclo sem retry infinito. Retentativas ocorrem em login/reload, edição, `online` ou ação global; não há polling/worker/realtime. Pending persistido permite retomada após reload. A UI exibe indicador global junto da conta; cards não ganham estados de sync.

O fetch compartilhado acrescenta timeout de 15 segundos preservando o sinal do chamador. PostgREST usa `retry(false)` para não duplicar as tentativas que o serviço coordena; falhas continuam conservando cache/pending. Metadados de cache com offset incapaz de produzir uma data são rejeitados sem sobrescrever o arquivo original.

## Validação de qualidade

Vitest cobre domínio, serialização, cache e contratos do serviço/adapter, com transporte controlado e sem serviços externos. Playwright em `e2e/` atravessa UI, hooks, Auth, serviço, cache, merge, relógio e SDK até a fronteira HTTP simulada. Cada teste tem contexto/cache próprio; um cenário usa dois contextos da mesma conta com backend compartilhado. Fixtures conferem proprietário e chave de upsert, mas não verificam assinaturas JWT ou substituem RLS SQL.

Axe e verificações de teclado/foco acompanham os E2E; cinco larguras verificam overflow, filtros, cards, roadmaps e identidade longa. O modal usa dialog nativo, contenção de Tab e devolução de foco após desmontagem. Nenhuma ferramenta de teste é importada pelo frontend. O comando `npm run validate` executa as validações locais; o [README](../README.md#qualidade-e-aceite-p6) mantém resultados, limites e checklist externo. Testes SQL usam o bootstrap P2/P3 existente em PostgreSQL isolado, separadamente do agregador Node.

## Hospedagem estática P7

GitHub → Vercel → frontend React estático → Supabase Auth/PostgreSQL. `npm run build` executa TypeScript e Vite; saída padrão `dist`, sem SSR/backend/functions. O preset Vite detecta build/output, sem overrides. A aplicação usa `/`, e o retorno PKCE vai à própria página com query; não há router nem rota de callback que exija SPA rewrite.

`vercel.json` existe somente para headers `nosniff`, `strict-origin-when-cross-origin` e `X-Frame-Options: DENY`; o app não usa frames e OAuth navega na mesma aba. Não há CSP adicional. Compatibilidade dos headers com providers reais depende do smoke test externo.

As duas variáveis públicas Supabase existentes entram no bundle em build time; mudança exige novo deploy. Production usa ambas, Development usa configuração local opcional e Preview funciona como visitante sem ambas. Site URL e redirects exatos autorizam produção/localhost; providers retornam primeiro ao callback Supabase e depois à origem/path do app, mantendo PKCE. Nenhum secret OAuth/admin pertence ao frontend. Instruções e [checklist P7](../README.md#deploy-na-vercel--p7) mantêm aceites externos P3/P4/P5 separados da regressão determinística; produção ainda não foi publicada/validada.

## Segurança

Não se prevê armazenamento de informações altamente sensíveis; haverá dados básicos de perfil e progresso. A segurança será simples, mas correta: nenhuma credencial sensível no código e nenhuma service role key no frontend.

RLS já protege os dados por usuário no schema P3. `auth.uid()` é a base de isolamento: cada usuário só pode ler e alterar seus próprios registros, incluindo validação do proprietário em inserções e atualizações. `anon` não acessa tabelas privadas; o visitante não inicia requests de progresso. Sessão é gerenciada pelo Supabase Auth; não há JWT próprio, service role ou acesso administrativo no frontend. P5 usa apenas progresso da conta.

## Providers e extensibilidade

Regras de domínio não assumirão Microsoft. Provider e track são entidades diferentes: por exemplo, Microsoft e AWS podem compartilhar Cloud e Data; GitHub pode usar Development e DevOps. As tracks inicialmente previstas são Artificial Intelligence, Cloud, Cybersecurity, Data, DevOps e Development, como dados extensíveis, não uma lista fechada no domínio.

Adicionar AWS, Anthropic, GitHub, Google Cloud ou outro provider deverá exigir novos metadados e certificações, preservando contratos genéricos. Novas tracks serão adicionadas como dados e referenciadas pelo catálogo. `level` aceita nomenclaturas próprias de cada provider; `levelRank` ordena sem expressar dificuldade absoluta. Nenhuma dessas extensões deverá exigir mudanças estruturais relevantes na UI ou na persistência de progresso.
