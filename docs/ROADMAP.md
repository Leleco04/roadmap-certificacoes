# Roadmap incremental

**Estado atual:** P0–P3 concluídos nos critérios locais; aceite P3 via API real pendente. P4 implementado, sem aceite OAuth real. P5/P6 concluídos nos critérios internos; aceite externo de Auth e sincronização multi-dispositivo pendente. P7 preparado para Vercel, com deploy e smoke tests de produção pendentes. Cada fase depende de solicitação explícita; concluir uma fase não autoriza iniciar a seguinte. Os modelos estão em [DATA_MODEL.md](DATA_MODEL.md) e as decisões em [ARCHITECTURE.md](ARCHITECTURE.md).

## P0 — Frontend local

**Status:** concluído. Amostra com as 12 certificações solicitadas, quatro roadmaps e progresso local. Testes unitários, lint, typecheck e build executados; verificações em navegador cobrem fluxos locais, teclado e larguras desktop/tablet/mobile. Autenticação, cloud e deploy permanecem fora desta implementação.

- **Objetivo:** permitir acompanhar certificações como visitante, sem conta ou banco.
- **Entregáveis:** React + TypeScript estrito + Vite; domínio, providers e tracks extensíveis; catálogo inicial tipado com amostra Microsoft; UI, dashboard, busca, filtros, roadmap, alteração de status e cálculo de progresso; persistência localStorage versionada; importação/exportação JSON e exportação CSV; layout responsivo, acessibilidade básica e testes unitários com Vitest.
- **Critérios de aceite:** fluxo de visitante funciona; progresso persiste após recarregar; catálogo não contém status; UI não acessa persistência diretamente; ordenação e filtros não assumem Microsoft; JSON inválido/versão incompatível e falhas de storage têm tratamento; import/export preserva identidades e timestamps; indicadores consideram cada certificação uma única vez mesmo com várias tracks, com denominador e efeito dos filtros explícitos; navegação por teclado e uso mobile funcionam; testes de regras, persistência e importação passam, assim como lint, typecheck e build configurados.
- **Dependências:** documentação desta etapa; definir amostra e fontes oficiais na implementação. Não é necessário cadastrar todas as certificações.
- **Fora do escopo:** Supabase, autenticação, sincronização cloud, deploy e catálogo completo.

## P1 — Catálogo completo inicial

**Status:** concluído em 08/10/2026 para o recorte técnico acordado: 29 certificações (17 adicionadas), incluindo AI-500 sinalizada como beta na listagem oficial. Fontes, tiers e políticas revisados; divergências documentadas no [modelo de dados](DATA_MODEL.md#revisão-microsoft-do-p1). Quatro roadmaps com ramificações opcionais; validação automatizada de catálogo; 135 testes, lint, typecheck e build passaram. UI validada em 1440/768/390/320 px, sem scroll horizontal e sem violações detectadas pela auditoria automatizada WCAG A/AA. As 12 identidades e timestamps de progresso P0 foram preservados, sem migration. Nenhum item P2+ implementado.

- **Objetivo:** completar o conjunto Microsoft inicialmente desejado, preservando o domínio genérico.
- **Entregáveis:** catálogo Microsoft estruturado; providers/tracks validados; todas as certificações do recorte acordado; dados independentes da UI; testes de ordenação e filtros.
- **Critérios de aceite:** recorte confirmado antes da inclusão; identidades únicas; fontes oficiais conferidas; metadados desconhecidos explicitados como ausentes; níveis flexíveis; referências de provider/tracks válidas; testes passam e UI usa o catálogo sem regras exclusivas de Microsoft.
- **Dependências:** P0 e definição das certificações Microsoft desejadas.
- **Fora do escopo:** cadastrar novos providers, painel administrativo e migração do catálogo para banco.

## P2 — Supabase Database

**Status:** concluído. Migration e testes SQL executados em PostgreSQL 18 local isolado, com fixture mínima de `auth.users` (sem testar Supabase Auth). Schema reproduzido em banco vazio; PKs, FKs/cascade, constraints, defaults e triggers validados. RLS habilitada sem policies como proteção estrutural; políticas e isolamento ficam no P3. Nenhum projeto remoto ou integração frontend criado. Catálogo de 29 certificações, IDs e persistência local preservados; testes existentes, lint, typecheck e build passaram.

- **Objetivo:** preparar o schema de persistência futura.
- **Entregáveis:** estrutura Supabase local versionada; migrations de `profiles` e `user_cert_progress`; constraints, chave composta, índices necessários, timestamps e validação SQL reproduzível. Não exige criar projeto remoto.
- **Critérios de aceite:** migrations reproduzem o schema; status inválidos e duplicações são rejeitados; referências ao usuário autenticado estão definidas; sem acesso multiusuário pelo frontend antes do P3. Referenciar `auth.users` no schema não implica implementar login ou configurar OAuth nesta fase.
- **Dependências:** P1 e PostgreSQL ou Supabase local para validar o schema; configuração remota requer solicitação própria.
- **Fora do escopo:** implementar autenticação, configurar OAuth, conectar progresso da UI ao banco e criar tabelas de catálogo sem necessidade.

## P3 — Segurança e RLS

**Status:** concluído. Nova migration com oito policies para `authenticated`, isolando `profiles.id = auth.uid()` e `user_cert_progress.user_id = auth.uid()`. SELECT/DELETE usam USING, INSERT usa WITH CHECK e UPDATE usa ambos. CRUD próprio permitido, incluindo exclusão de profile sem remover conta/progresso; acesso cruzado e troca de dono bloqueados. `anon` sem grants/policies: todas as operações falham com `42501`. Grants de service_role preservados. Testes reais A/B nas duas direções, anon, ausência de sub e upsert cruzado passaram em PostgreSQL 18 isolado, com roles sem bypass, `request.jwt.claims` e implementação Supabase de `auth.uid()`; não validam JWT/HTTP/OAuth. Schema P2 também validado após P3. Frontend, 29 certificações, IDs, roadmaps e localStorage preservados, sem SDK Supabase, criação automática de profile ou funcionalidades P4+. Reprodução no [README](../README.md#validação-do-schema-e-isolamento-p2p3).

Validação: bootstrap completo em banco vazio, 132 verificações SQL explícitas aprovadas (além das constraints testadas pela suíte P2), 135 testes existentes e 49 testes de catálogo aprovados; lint, typecheck e build passaram. Stack Supabase completa não executada: CLI indisponível e Docker parado. **Aceite externo pendente:** isolamento A/B e tentativas cross-user via API Supabase com sessões reais, conforme [roteiro P7](../README.md#roteiro-rls-via-api-real); validação SQL local não conclui esse aceite.

- **Objetivo:** assegurar isolamento antes do uso cloud.
- **Entregáveis:** manter RLS habilitada no P2; implementar políticas SELECT, INSERT, UPDATE e DELETE; validação com `auth.uid()`; testes de segurança e isolamento. Habilitar RLS sem policies no P2 não conclui esta fase.
- **Critérios de aceite:** duas identidades de teste não conseguem ler, inserir, alterar ou excluir registros da outra; acesso anônimo ao progresso cloud é negado; troca de proprietário é bloqueada; perfil também isolado; nenhuma service role key no frontend. Testes podem usar identidades controladas sem implementar a UI de login.
- **Dependências:** P2.
- **Fora do escopo:** UI de autenticação, sincronização e mecanismos próprios de credenciais/JWT.

## P4 — Autenticação

**Status:** implementação local entregue; aceite externo pendente. SDK Supabase 2.117.3, Google/GitHub OAuth com PKCE, sessão persistente/renovação pelo SDK, restauração após reload, logout local e UI carregando/visitante/autenticado. Configuração pública em `.env.example`, fallback visitante sem variáveis e erros visíveis. Camada Auth separada de UI/progresso; nenhum acesso a profiles/progresso SQL, criação automática de profile ou mudança de migrations. Catálogo, IDs, roadmaps e persistência local v1 preservados; nenhuma sincronização/P5+ implementada.

Testes automatizados de estado/adapter/UI e SDK real com transporte Auth controlado; navegador validou callbacks simulados dos dois providers, reload, logout/reload, OAuth negado, ausência de chamadas às tabelas e preservação do progresso. Consentimento Google/GitHub e sessões/JWT reais não foram testados: configuração do projeto/providers não disponível. Configure e valide ambos os providers conforme [README](../README.md#configuração-de-autenticação-p4) antes de marcar P4 concluído.

Validação local: 174 testes (135 anteriores + 39 de Auth/UI), 49 testes de catálogo, lint, typecheck e build aprovados. Navegador sem erros de página/overflow em 1440/390/320 px; build sem variáveis continua visitante, grava/recarrega progresso local e não faz chamadas remotas.

- **Objetivo:** permitir acesso à conta com praticidade.
- **Entregáveis:** Google OAuth e GitHub OAuth via Supabase Auth; sessão, login, logout, carregamento do usuário e estados de UI autenticado/não autenticado.
- **Critérios de aceite:** ambos os providers de login funcionam; sessão é restaurada e encerrada corretamente; falhas são tratadas; visitante continua usando funções básicas; logout não expõe cache de outra conta.
- **Dependências:** P3 e configurações OAuth/redirects do ambiente de desenvolvimento.
- **Fora do escopo:** email/senha, recuperação de senha, MFA e sincronização do progresso.

## P5 — Sincronização

**Status:** concluído nos critérios internos. Store/serviço de progresso separado da UI, cache local v2 com migração v1, repositório Supabase exclusivo de `user_cert_progress` e cliente Auth compartilhado. Visitante permanece local; conta usa cloud como persistência autoritativa com cache/pending para offline. Merge por certificação, empate cloud, estados iguais sem upsert, datas normalizadas pelo servidor, calibração aproximada e tratamento de edições durante request. Importação de visitante consentida, aceite/recusa persistidos; logout preserva cache/dono, aborta requests e não transfere A para B. Erros/retry global, retomada em login/reload, edição e `online`, sem polling/realtime/workers. Schema, RLS, catálogo e dependências preservados; profiles e P6+ não implementados.

Validação: 229 testes passaram, incluindo upgrade local, merge, pending/retry, corridas de requests/logout, isolamento A/B e SDK Supabase real com transporte PostgREST controlado. 49 testes de catálogo, lint, typecheck e build passaram. Navegador com Auth/PostgREST simulados validou Google/GitHub PKCE, importação explícita, timestamp do banco, convergência em dois contextos da mesma conta, offline/retry, logout/troca A/B, exportação JSON/CSV e larguras 1440/390/320 sem overflow/erros de página.

Build sem variáveis Supabase também validado em navegador: visitante salva/recarrega cache v2 sem requests remotos. As 29 certificações, IDs e roadmaps permanecem preservados.

**Aceite externo pendente:** P4 não foi marcado aceito sem validação real. Configuração/projeto/usuário de teste não disponíveis; consentimento OAuth, JWT/RLS via API real e convergência física entre dispositivos não foram executados. Após aceite real do P4, executar roteiro multi-dispositivo do [README](../README.md#sincronização-p5). Limites de relógio e concorrência SELECT/UPSERT estão documentados na arquitetura/modelo de dados.

- **Objetivo:** persistir progresso da conta e reconciliar dispositivos.
- **Entregáveis:** Supabase como fonte principal para autenticados; localStorage como cache/fallback por conta; oferta de importação do progresso de visitante após login; `updatedAt`, last-write-wins por certificação e empate favorecendo cloud; sincronização entre dispositivos e tratamento de falhas.
- **Critérios de aceite:** importação requer escolha do usuário; conflitos seguem regra documentada; alterações para `todo` sincronizam; distinguir `updated_at` de gravação do servidor (P2) e o timestamp da alteração original, que não deve ser substituído pelo momento do upload; relógios divergentes são considerados; cache é isolado; falhas e alterações pendentes são visíveis e reconciliadas ao reconectar; dispositivos convergem após sincronização.
- **Dependências:** P4, repositório local do P0 e políticas do P3.
- **Fora do escopo:** colaboração em tempo real, histórico de progresso e infraestrutura de filas.

## P6 — Qualidade

**Status:** concluído nos critérios internos. Suíte auditada e preservada; 237 unitários/integração, 16 E2E Playwright e 49 testes de catálogo (subconjunto) aprovados, assim como lint, typecheck e build. E2E usa SDK real com HTTP controlado e cobre visitante/JSON/CSV, callbacks simulados Google/GitHub, sessão/reload/logout/expiração, importação consentida, conflitos/empate, cache cloud, offline/reload/reconexão, erro/retry, duas edições durante request, logout/troca A/B e convergência em contextos separados. Retry concorrente e timeout testados; sem loop ou transferência de cache entre contas.

Axe sem violações nos estados avaliados; teclado/foco/modal verificados; larguras 320/390/768/1024/1440 sem scroll horizontal e inspeção visual em 320/1440. Corrigidos foco/retorno do modal, offset impossível e requests sem limite de duração; retries de progresso coordenados pelo serviço. Segurança frontend revisada, catálogo/IDs/roadmaps e migrations preservados. PostgreSQL 18 isolado reproduziu P2/P3 com 135 mensagens PASS; stack Supabase completa indisponível. Build JS 496,01 kB/141,31 kB gzip, CSS 17,13 kB/4,20 kB gzip.

**Aceite externo permanece pendente:** OAuth Google/GitHub real, sessão/JWT/RLS via API Supabase real e sincronização entre dispositivos físicos/contas reais. Checklist no [README](../README.md#aceite-externo-pendente). Offline testado para indisponibilidade cloud; carregar o shell inteiro sem rede segue dependendo do cache do navegador. Nenhum deploy/P7 implementado.

- **Objetivo:** validar os fluxos completos antes de publicar.
- **Entregáveis:** testes de integração e E2E; cobertura dos fluxos visitante e autenticado, login/logout, sincronização, offline e falhas; revisão de acessibilidade e responsividade.
- **Critérios de aceite:** cenários essenciais passam, incluindo conflito, importação e isolamento de contas; falhas não indicam falsamente sincronização concluída; navegação por teclado, foco, rótulos e telas mobile são verificados; lint, typecheck e build passam; erros ligados ao escopo são corrigidos.
- **Dependências:** P5 e ambiente de teste controlado.
- **Fora do escopo:** novas funcionalidades e expansão do catálogo.

## P7 — Deploy

**Status:** preparação local entregue; deploy e validação de produção pendentes. Build Vite estático existente (`npm run build` → `dist`), variáveis públicas preservadas e `vercel.json` somente com três headers básicos, sem overrides de framework/build/output ou backend. Redirect PKCE permanece na própria página `/`, sem rewrite adicional. README documenta importação GitHub/Vercel, migrations Supabase, Site URL/allowlist exata, providers, Preview visitante e checklist de produção/API RLS/multi-dispositivo.

Não há acesso/configuração real Vercel/Supabase/providers ou domínio de produção disponível nesta sessão. Não houve commit/push, deploy nem aceite OAuth/API/RLS/sync real. P3/P4/P5 mantêm aceites externos pendentes; P6 permanece concluído nos critérios internos. P7 só será concluído após publicação HTTPS e execução real do [checklist](../README.md#checklist-de-produção-p7), incluindo Google/GitHub, cloud, RLS e convergência/isolamento.

Validação local P7 em 11/10/2026: `npm run validate` aprovado, com 237 unitários/integração, 49 testes de catálogo (subconjunto), 16 E2E, lint, typecheck e build. JS 496,01 kB/141,31 kB gzip e CSS 17,13 kB/4,20 kB gzip, sem crescimento. Smoke do build estático em preview local aprovado para visitante, busca/filtro, persistência/reload, JSON/CSV e 320/390/1440 px, sem logs/erros/requests cloud; não valida headers Vercel ou serviços externos.

- **Objetivo:** publicar e validar a aplicação em produção.
- **Entregáveis:** deploy na Vercel; variáveis de ambiente adequadas; Supabase production URLs; OAuth redirects e configuração Google/GitHub para produção; HTTPS, validação de produção e smoke tests.
- **Critérios de aceite:** visitante e login pelos dois providers funcionam na URL final; progresso persiste e sincroniza; RLS permanece ativa; redirects são restritos às URLs necessárias; secrets/service role não entram no bundle; HTTPS e smoke tests passam.
- **Dependências:** P6 e solicitação explícita de publicação/configuração de produção.
- **Fora do escopo:** servidor próprio, Kubernetes e funcionalidades pós-MVP.

## UX esperada

Priorizar praticidade, pouca poluição visual, navegação rápida, responsividade, mobile, filtros fáceis e progressão visual clara. Certificações poderão ser agrupadas por provider, track, level e status. O usuário deverá identificar rapidamente o que concluiu, o que estuda, o que pretende fazer e qual certificação vem depois.

## Pós-MVP — possibilidades, sem compromisso de implementação

### Novos providers

AWS, Anthropic, GitHub, Google Cloud e outros, conforme disponibilidade e validação de catálogos oficiais. Suporte arquitetural não implica que todos já possuam ofertas confirmadas no produto.

### Novas funcionalidades

Roadmap personalizado; metas; datas planejadas de provas; datas de vencimento; lembrete de renovação; histórico de progresso; badges; recomendações; favoritos; notas pessoais; dashboard avançado; analytics pessoais; painel administrativo; atualização do catálogo sem novo deploy; compartilhamento opcional de perfil; comparação entre trilhas.

Magic Link e email/senha poderão ser avaliados se houver necessidade real. Essas possibilidades não ampliam o escopo das fases atuais.
