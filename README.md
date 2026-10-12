# Roadmap de Certificações

Nome provisório de uma aplicação web para organizar certificações profissionais e acompanhar o que o usuário pretende fazer, está estudando ou já concluiu. O objetivo é tornar claros o progresso e os próximos passos em diferentes trilhas.

**Estado atual:** P0–P3 concluídos nos critérios locais; aceite P3 via API Supabase real pendente. P4 implementado, ainda sem validação OAuth real. P5 e P6 concluídos nos critérios internos: sincronização local/cloud e qualidade. P7 preparado para Vercel; deploy e smoke tests de produção pendentes, assim como os aceites externos P3/P4/P5.

O catálogo inicial será focado em Microsoft. O domínio permitirá futuramente AWS, Anthropic, GitHub, Google Cloud e outros providers, sem depender de nomenclaturas específicas de níveis. Provider identifica a organização; track identifica a área de conhecimento.

## Funcionalidades disponíveis

- Catálogo de 29 certificações Microsoft, revisado em 08/10/2026: IA (12), Cloud (13), Cybersecurity (7) e Dados (10). As contagens se sobrepõem por múltiplas tracks; DevOps (2) e Development (3) são associações secundárias já previstas no domínio.
- Cards com detalhes/fontes oficiais, dashboard, quatro roadmaps com ramificações opcionais, busca e filtros combinados por provider, track, nível e status.
- Progresso individual: `todo`, `planned`, `studying` e `done`.
- Uso como visitante, persistência local versionada, importação/exportação JSON e exportação CSV do catálogo completo com progresso.
- Login opcional com Google/GitHub quando Supabase estiver configurado; restauração da sessão após reload, logout e estados de carregamento/visitante/autenticado.
- Sincronização de progresso da conta com cache/offline, merge por certificação, confirmação para importar visitante e retry global discreto.
- Interface responsiva, acessibilidade básica e progressão visual clara.

No primeiro uso como visitante, AI-901 e AI-103 começam concluídas; contas sem dados não recebem essa amostra automaticamente. Identidades e progresso do P0 são preservados pela migration local v1 → v2. As métricas gerais contam certificações únicas de todo o catálogo e não mudam com filtros; cada roadmap conta a união de sua base e ramificações, sem tornar todas as opções obrigatórias. A importação JSON requer confirmação; registros fora do catálogo são preservados, sem entrar nas métricas.

Certificações aposentadas estão excluídas. AI-500 mantém sinalização de beta da listagem oficial; DP-420 usa o nome/tier atual da página específica. Divergências, políticas e critérios editoriais estão no [modelo de dados](docs/DATA_MODEL.md#revisão-microsoft-do-p1).

**Stack atual:** React, TypeScript estrito, Vite, ESLint e Vitest; localStorage e `@supabase/supabase-js` 2.117.3 para Auth/progresso da conta. Migrations PostgreSQL e policies RLS preservadas; qualidade P6 validada localmente e preparação Vercel P7 disponível.

**Autenticação:** Google OAuth e GitHub OAuth com PKCE, sessão persistida/renovada pelo SDK Supabase Auth e logout neste navegador (`scope: local`). Senha, recuperação de senha e MFA ficam fora do escopo. Visitantes continuam usando todas as funções locais. Login carrega apenas o cache da conta correspondente; progresso de visitante só é importado mediante confirmação.

**Arquitetura:** UI → hooks/store → serviço de progresso → repositórios local/remoto. Catálogo compartilhado é independente do progresso individual. Supabase é a persistência autoritativa da conta; localStorage é fonte de verdade do visitante e cache/recuperação temporária para contas.

## Validação do schema e isolamento P2/P3

Não é necessário banco para executar a aplicação. Para validar SQL separadamente, use PostgreSQL local e um **banco descartável vazio**, substituindo usuário/banco abaixo. Não execute o bootstrap em banco existente ou produção:

```sh
psql -h 127.0.0.1 -U USUARIO_TESTE -d BANCO_DESCARTAVEL -X -v ON_ERROR_STOP=1 -f supabase/tests/standalone_rls.sql
```

O bootstrap exige administrador em um cluster descartável sem as roles Supabase. Cria uma fixture mínima de `auth.users`, roles `anon`/`authenticated` sem superuser ou bypass, `service_role` com bypass e a implementação SQL de `auth.uid()` do Supabase. Simula grants padrão antigos, aplica P2/P3 e valida schema antes/depois, preservação dos grants de service_role e isolamento A/B em operações reais. `SET LOCAL ROLE` e `request.jwt.claims` (`sub`, `role`) reproduzem o contexto de banco do PostgREST após validação do JWT; cada identidade é conferida por `auth.uid()`. Nenhuma operação funcional de usuário usa service_role. Não testa emissão/validação de JWT, OAuth, HTTP/PostgREST ou Supabase Auth completo. Fixtures de dados e helpers são revertidas.

Em Supabase local, aplique ambas as migrations e execute como administrador, em banco isolado:

```sh
psql -h 127.0.0.1 -U USUARIO_TESTE -d BANCO_TESTE -X -v ON_ERROR_STOP=1 -v expected_policy_count=8 -f supabase/tests/schema.sql
psql -h 127.0.0.1 -U USUARIO_TESTE -d BANCO_TESTE -X -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

`standalone.sql` continua disponível para testar somente P2 em banco vazio. A validação P3 foi executada em PostgreSQL 18 isolado; CLI Supabase indisponível e Docker sem daemon ativo.

O schema armazena apenas perfis/progresso; catálogo fica no frontend. O P3 habilita SELECT, INSERT, UPDATE e DELETE para `authenticated` apenas quando `profiles.id = auth.uid()` ou `user_cert_progress.user_id = auth.uid()`. UPDATE verifica o dono atual e o novo, impedindo troca de proprietário. `anon` não possui grants nem policies: as quatro operações falham com SQLSTATE `42501`. Privilégios de service_role permanecem inalterados. P5 acessa somente `user_cert_progress` via SELECT/UPSERT, derivando `user_id` da sessão e conferindo a conta esperada; RLS permanece autoritativa. Não há acesso/criação de profiles, migrations novas ou alteração de RLS/triggers.

## Configuração de autenticação P4

Sem variáveis, a aplicação funciona como visitante e não cria cliente Supabase. Para habilitar login, copie `.env.example` para `.env.local`, preencha e reinicie Vite:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

Use a chave pública legacy `anon` ou `sb_publishable_...`. Nunca use `service_role`, `sb_secret_...` ou client secrets em variáveis `VITE_` (elas entram no frontend). Configuração incompleta/inválida mantém modo visitante e mostra erro. `.env.local` é ignorado pelo Git.

No projeto Supabase, habilite os providers Google e GitHub em Authentication → Sign In / Providers. Cadastre aplicações OAuth nos dois providers usando o callback informado pelo Supabase, normalmente `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`, e salve Client ID/Client Secret somente na configuração do provider no Supabase. Siga os guias oficiais de [Google](https://supabase.com/docs/guides/auth/social-login/auth-google) e [GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github).

Em Authentication → URL Configuration, configure Site URL e autorize exatamente a URL da aplicação, por exemplo `http://localhost:5173/`. Se usar `127.0.0.1`, outra porta ou subdiretório, autorize também essa URL exata. O app envia origem + pathname em `redirectTo`, sem query/hash. O callback retorna à própria página; `detectSessionInUrl` do SDK troca automaticamente o código PKCE, sem servidor/rota de callback adicional. Retorne no mesmo navegador/origem que iniciou o login, onde o SDK guardou o verifier.

Sessão Auth usa armazenamento próprio do SDK (`sb-<project-ref>-auth-token`), separado da chave de progresso `roadmap-certificacoes.progress`. O logout remove a sessão Auth, preservando progresso e exportações locais. A UI mostra identidade básica de Auth; não consulta nem cria `profiles`.

Validação de Auth executada no P4: SDK real com transporte controlado e callbacks Google/GitHub simulados, reload, logout e OAuth negado. Esses testes não validam consentimento OAuth nem JWT reais. A configuração remota não foi fornecida nem seu aceite confirmado: P4 permanece pendente de validação real antes do aceite externo de P5. Confira os dois logins, reload autenticado e logout/reload visitante; após P5, login pode trocar o progresso exibido pelo da conta, preservando o visitante em namespace separado.

## Sincronização P5

- Visitante: localStorage é a fonte de verdade, sem requests de progresso. Autenticado: carrega Supabase, reconcilia o cache da própria conta, envia somente estados necessários e persiste o resultado local.
- Cache local v2: mesma chave de progresso, com `visitor`, `accounts[uuid]` e `visibleOwner`. O upgrade de v1 copia todos os registros/timestamps para visitante em uma gravação atômica. Dados inválidos não são sobrescritos; exportação/importação JSON continuam no formato portátil v1, sem sessões/metadados de contas.
- Primeiro login: oferece confirmação para importar o visitante e registra aceite/recusa por conta. Não mistura automaticamente outro cache. Se o último estado exibido pertence a A, login em B carrega somente B e não oferece os dados de A como visitante.
- Merge last-write-wins por certificação: timestamps UTC em milissegundos, mais recente vence, empate favorece cloud. Estados iguais adotam o registro cloud sem upsert, evitando loops por datas diferentes. Identidades fora do catálogo também são mantidas.
- Edição autenticada: UI/cache mudam imediatamente; pendência fica persistida. Upsert usa `(user_id, certification_id)` e envia somente identidade, status e dono derivado da sessão. O `updated_at` retornado substitui a data local após sucesso; resposta atrasada não desfaz edição posterior.
- Offline/erro: conserva UI, cache e pendências; sinaliza não sincronizado. Tenta novamente em login/reload autenticado, nova edição, evento `online` e botão global. Não há polling, worker, realtime ou promessa de reabrir a aplicação inteira offline sem cache do navegador.
- Logout: aborta operações pendentes, ignora respostas antigas e não inicia requests de progresso; mantém o último estado em seu namespace original, agora de uso local. Editar esse estado não o torna dado de visitante nem o transfere para outra conta. Ao retornar à mesma conta, ele pode ser reconciliado novamente.

Datas de edições pendentes permanecem disponíveis para comparação até o sucesso remoto. Para novas edições, estima-se o relógio do servidor pelo cabeçalho HTTP Date quando exposto; se indisponível por CORS, usa-se o `updated_at` de uma escrita confirmada e o tempo da request. A estimativa é guardada no cache para offline; pequenas variações de até um segundo não deslocam pendências. Uma edição posterior ao estado conhecido recebe data estritamente maior, mesmo com relógio local atrasado. Após sucesso, a data do banco é canônica.

Essa estimativa tem limites de latência/precisão; antes da primeira calibração, usa-se UTC do dispositivo. Datas históricas de visitante/importação não podem ser corrigidas com certeza sem conhecer seu relógio de origem. LWW não garante ordem física absoluta entre edições quase simultâneas/relógios alterados, e SELECT/UPSERT não formam uma transação de reconciliação entre dispositivos. Estados iguais e normalização após sucesso impedem reenvios constantes; uma nova leitura/retry reconcilia o estado observado.

JSON visitante continua substituindo o conjunto e preservando datas. Na conta, a substituição confirmada representa novas edições: entradas conhecidas omitidas viram `todo` via upsert, sem delete+insert; registros cloud ainda não conhecidos localmente são preservados pela reconciliação. CSV continua exportando as 29 certificações com o progresso atualmente exibido.

Aceite interno validado com testes determinísticos e dois contextos de navegador/SDK real com backend controlado. Validação real multi-dispositivo pendente: depois do aceite real do P4, altere uma certificação em A, confira no banco, carregue/altere em B com a mesma conta e recarregue A; confira convergência e uso local após logout. Não houve deploy/configuração remota.

## Uso local

Requer Node.js 22 (a partir de 22.13), 24 ou 26+ e npm.

```sh
npm ci
npm run dev
```

Abra a URL informada pelo Vite. Dados ficam neste navegador e nesta origem; exporte JSON para guardar uma cópia ou transferir o progresso. Erros de armazenamento são informados e não impedem uso em memória. Não há garantia de funcionamento offline após fechar/reabrir a aplicação.

```sh
npm test
npm run validate:catalog
npx playwright install chromium
npm run test:e2e
npm run lint
npm run typecheck
npm run build
npm run preview
```

`preview` serve o build local. Dificuldade, prioridade e sequência são sugestões editoriais; confira a fonte oficial antes de planejar uma prova.

`validate:catalog` verifica identidades, referências, escalas, URLs e roadmaps sem depender de rede. Disponibilidade, conteúdo e aposentadoria precisam de nova conferência oficial ao atualizar os dados.

## Qualidade e aceite P6

`npm run validate` executa unitários/integração, catálogo, E2E, lint, typecheck e build, sem depender de OAuth ou Supabase externos. Instale Chromium com o comando acima antes da primeira execução E2E. Os dois servidores de teste usam portas 5180/5181 e configuração própria, substituindo as variáveis públicas locais; não reutilizam o servidor de desenvolvimento. Relatórios/traces e screenshots ficam em `test-results/`, ignorado pelo Git.

A auditoria preservou os testes úteis: regras puras continuam unitárias; cache legado mantém o contrato de migração; serviço e adapter verificam contratos de integração. A sobreposição de casos de merge é intencional entre regra e persistência. As lacunas eram navegação real, foco do modal, sessão expirada, falhas de storage, retries concorrentes e conexão sem resposta; foram cobertas sem duplicar a matriz unitária de validação JSON.

Resultado local: 237 testes unitários/de integração e 16 E2E (253 no total; os 49 testes de catálogo são um subconjunto). Navegador usa SDK Supabase real com HTTP Auth/PostgREST controlado: visitante, ambos os callbacks PKCE simulados, sessão/reload/logout, importação consentida, merge independente/empate, timestamp retornado, erros/retry, múltiplas edições offline, reload pendente, evento online, respostas antigas, troca A/B e convergência entre dois contextos com caches separados. A expiração simulada volta a visitante sem perder o último cache.

Offline aqui significa Supabase indisponível com a aplicação acessível: esse cenário suporta edição, reload e retomada. Reabrir a aplicação inteira sem rede depende do cache do navegador; não há service worker nem garantia de carregar o shell offline.

Axe não encontrou violações nos estados avaliados (visitante, conta, erro de sync e modal), incluindo WCAG A/AA nas larguras 320/390/768/1024/1440 px. Navegação por teclado verificou skip link, foco inicial, Tab/Shift+Tab, ESC/retorno do modal, select e detalhes; inspeção visual de conta com nome longo e card em 320/1440 px. Sem overflow da página. Auditoria automatizada não substitui avaliação com tecnologias assistivas reais.

Correções limitadas: retorno/contenção de foco do modal, rejeição de offset que não representa uma data válida e timeout HTTP de 15 segundos compartilhado por Auth/progresso. Requests PostgREST não fazem retries implícitos do SDK; o serviço preserva pending e controla a próxima tentativa. Nenhum polling, mudança de catálogo/schema ou funcionalidade nova. Build: JS 496,01 kB (141,31 kB gzip), CSS 17,13 kB (4,20 kB gzip), HTML 0,65 kB. Revisão frontend: metadados são texto, links oficiais abrem com `noreferrer`, erros públicos não mostram detalhes/token, nenhuma credencial administrativa/privada nem HTML arbitrário foi introduzido.

P2/P3 foram novamente reproduzidos em PostgreSQL 18 isolado: 135 mensagens PASS, com fixture mínima de `auth.users`, roles e claims PostgREST na implementação de `auth.uid()`. Migrations permanecem inalteradas. Isso não valida a stack completa Supabase, indisponível neste ambiente.

### Aceite externo pendente

Todos os aceites externos continuam pendentes até execução real; os mocks não os concluem. O [checklist de produção P7](#checklist-de-produção-p7) reúne os testes de OAuth (P4), API/RLS (P3) e sincronização (P5), sem incorporá-los à suíte determinística.

## Deploy na Vercel — P7

Fluxo: GitHub → Vercel (arquivos estáticos React) → Supabase Auth/PostgreSQL. O build existente é `npm run build`, com saída `dist`; o preset Vite detecta o projeto. Não há servidor próprio. Consulte a [documentação Vercel/Vite](https://vercel.com/docs/frameworks/frontend/vite).

1. Disponibilize esta versão no repositório GitHub e, na Vercel, escolha Add New → Project → Import Git Repository. Commit/push não foram executados nesta preparação.
2. Use a raiz do projeto, confirme Framework Preset **Vite** e Node.js **22.x** compatível com `package.json`. Confira `npm run build` e `dist` nos valores detectados, sem overrides quando corretos.
3. Em Environment Variables, preencha **somente** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL do projeto Supabase e sua chave pública `anon`/publishable. **Production** precisa das duas para login/cloud; **Development** só precisa delas para OAuth local (ou use `.env.local`). **Preview** fica sem ambas, funcionando como visitante. Não herde variáveis Production em Preview.
4. Clique Deploy e obtenha o domínio estável de produção `*.vercel.app` em Domains; use esse domínio nos redirects, não a URL temporária de uma versão. Variáveis `VITE_` são incorporadas no build: após alterá-las, faça um novo deploy.
5. Configure Supabase e os providers abaixo; execute o checklist na URL HTTPS final. Registre URL, data, versão publicada e resultados antes de concluir P7.

Nunca adicione service role, `sb_secret_...`, senha do banco, credenciais administrativas ou client secrets OAuth às variáveis frontend/Vercel. `.env` e `.env.*` reais são ignorados; `.env.example` contém apenas nomes vazios.

`vercel.json` configura somente `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `X-Frame-Options: DENY`, conforme o suporte de [headers da Vercel](https://vercel.com/docs/project-configuration/vercel-json#headers). O app não usa frames; OAuth navega na mesma aba. A compatibilidade com OAuth real ainda precisa do smoke test. Não há CSP, override de build, functions nem rewrite: o app usa apenas `/`, sem router ou callback em outro path. Query `?code=...` retorna ao mesmo HTML; não requer SPA fallback.

**Validação local desta preparação (11/10/2026):** `npm run validate` aprovado: 237 unitários/integração, 49 testes de catálogo (subconjunto), 16 E2E, lint, typecheck e build. JS 496,01 kB/141,31 kB gzip; CSS 17,13 kB/4,20 kB gzip; HTML 0,65 kB/0,39 kB gzip, sem crescimento em relação ao P6. Smoke adicional do build via `npm run preview`: HTTP 200 em `/` com query, 29 certificações, visitante sem OAuth/cloud, busca/filtro, alteração/reload, exportações JSON/CSV e larguras 320/390/1440 sem overflow, logs ou erros de página. Sem credenciais privadas encontradas nos arquivos revisados; `.env` reais ignorados. Preview local não aplica os headers `vercel.json` nem comprova produção/OAuth real.

### Supabase e providers em produção

No projeto Supabase escolhido, aplique em ordem as migrations versionadas `20261008000000_create_user_data.sql` e `20261010000000_create_rls_policies.sql`, usando o processo de migrations Supabase. Em um projeto remoto novo, a CLI permite `supabase login`, `supabase link --project-ref PROJECT_REF_REAL`, `supabase migration list` e `supabase db push`: confirme o projeto e as migrations pendentes antes de aplicar. Não execute bootstrap/fixtures de `supabase/tests/` em produção. Se migrations já estiverem aplicadas, não as reaplique. Confira ambas as tabelas com RLS ativa e as oito policies; essa inspeção não substitui o teste de API com sessão de usuário.

Em Authentication → URL Configuration:

- **Site URL:** URL HTTPS estável final de produção, com `/` no final.
- **Redirect URLs:** a mesma URL exata e `http://localhost:5173/`, usado pelo desenvolvimento. Autorize `http://127.0.0.1:5173/` ou outra porta apenas se realmente utilizada. Confira a porta mostrada pelo Vite.
- O callback da aplicação é `/`: `redirectTo` continua origem + pathname, sem query/hash. Não cadastre `/auth/callback` na Vercel; essa rota não existe. Não use wildcard. PKCE permanece gerenciado pelo SDK; conclua o login no mesmo navegador/origem.

Use URLs reais no Dashboard; os exemplos de P4 não são valores de produção. A allowlist precisa coincidir com `redirectTo`; veja [redirects Supabase](https://supabase.com/docs/guides/auth/redirect-urls).

**Google:** no Google Auth Platform/Cloud Console, configure Branding/Audience e uma aplicação OAuth do tipo **Web application**. Cadastre a origem HTTPS final em Authorized JavaScript origins e o callback copiado de Supabase → Authentication → Sign In / Providers → Google em Authorized redirect URIs. O callback é do Supabase (`/auth/v1/callback`), não da Vercel. Se Audience estiver em Testing, adicione as contas de teste; para acesso público, publique o consentimento e conclua verificações que o Google exigir. Habilite Google no Supabase, salve Client ID/Client Secret ali e teste o fluxo abaixo. [Guia Google/Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).

**GitHub:** em Settings → Developer settings → OAuth Apps → New OAuth App, informe nome, Homepage URL = produção e Authorization callback URL = callback copiado do provider GitHub no Supabase. Deixe Device Flow desabilitado. Registre a aplicação, gere o client secret e salve Client ID/Client Secret em Supabase → Authentication → Sign In / Providers → GitHub; habilite e salve. [Guia GitHub/Supabase](https://supabase.com/docs/guides/auth/social-login/auth-github).

Os secrets permanecem nos providers/Supabase. Localhost pode usar o mesmo Supabase remoto com seu redirect exato; ele continua usando o callback remoto do provider.

### Preview Deploys

Previews sem as duas variáveis ficam no modo visitante, com catálogo/progresso local/exportação; login não é oferecido. Isso evita iniciar PKCE em uma origem não autorizada e retornar incorretamente à produção. OAuth real é priorizado em localhost + production. Confirme esse comportamento no primeiro Preview real.

Se for necessário testar Auth em um Preview específico, configure ambas as variáveis apenas nesse ambiente/branch e autorize **a URL exata** do Preview no Supabase antes de iniciar login. Faça novo deploy, teste na mesma origem e remova o redirect ao encerrar. Não use `*.vercel.app` nem allowlist abrangente. URLs dinâmicas futuras não recebem suporte OAuth automaticamente.

### Checklist de produção P7

**Execução externa pendente:** não há URL publicada nem acesso Vercel/Supabase/providers configurado nesta sessão. Marque cada item somente após executá-lo em produção, registrando data, URL, versão, navegador/dispositivo e resultado sem tokens, sessões, secrets ou HAR bruto. Use contas controladas e dados de teste.

- [ ] **Deploy/HTTPS/headers:** página `/` e assets respondem com sucesso por HTTPS; confirme os três headers em DevTools → Network. O retorno OAuth `/?code=...` abre o app e troca o código PKCE, sem 404. Confira build Vercel e ausência de credenciais privadas no código/build publicado.
- [ ] **Visitante:** em contexto novo, página abre com 29 certificações; busca, filtros combinados e quatro roadmaps funcionam. Altere status e recarregue: progresso permanece. Exporte/reimporte JSON com confirmação e confira CSV com 29 certificações e status. Não há requests de progresso ao Supabase.
- [ ] **Google real (P4):** Continuar com Google → consentimento → retorno à produção → identidade correta → reload com sessão mantida → logout → visitante → reload ainda visitante. Logout preserva o último progresso para uso local no namespace original e não envia requests de progresso.
- [ ] **GitHub real (P4):** repita login/consentimento/callback, identidade, reload/sessão e logout/reload visitante. Somente os dois providers aprovados concluem o aceite externo P4.
- [ ] **Cloud real:** autenticado, altere uma certificação e aguarde sincronização. Em Network confira POST/UPSERT bem-sucedido com representação retornada; em `user_cert_progress` confirme `user_id` da sessão, `certification_id` qualificado, `status` e `updated_at` UTC retornado pelo servidor. A escrita usa a sessão normal e chave pública, nunca service role; observar a linha no Dashboard não comprova RLS.
- [ ] **RLS real (P3):** execute o roteiro de API abaixo com A/B nas duas direções, além da leitura/escrita próprias. Registre o aceite externo P3 separadamente dos testes SQL locais.
- [ ] **Mesma conta/multi-dispositivo (P5):** em navegador A, faça login, altere status e aguarde sync; em navegador B ou celular, entre na mesma conta e confirme leitura. Altere em B, aguarde sync e recarregue/reconecte A: ambos convergem, incluindo alteração para `todo`. Não há realtime; nova leitura/reconexão é necessária.
- [ ] **Isolamento/cache:** A e B em contextos separados com contas distintas leem/gravam somente os próprios dados. No mesmo contexto, faça logout A → login B → logout → login A; o cache de A não aparece como dados de B nem é enviado para B.
- [ ] **Importação aceita:** contexto visitante novo → alterar progresso → reload → login numa conta sem decisão de importação → oferta aparece → aceitar → aguardar sync → confirmar registros e leitura em outro contexto.
- [ ] **Importação recusada:** use outro contexto/conta sem decisão anterior; recuse a oferta e confirme que progresso visitante não é enviado, cloud permanece próprio e reload não repete a oferta. Não limpe storage de uma conta com pendências para preparar esse teste.
- [ ] **Offline/retry:** carregue online, vá offline, altere progresso; reload somente se shell/assets estiverem em cache. Confirme pendência local, reconecte e confira sync/linha cloud. Teste também indisponibilidade temporária apenas do Supabase com shell acessível; restaure acesso e use Tentar novamente. Falha não deve indicar sucesso nem perder edições. Sem PWA/service worker, carregamento inicial/reabertura sem cache não é garantido.
- [ ] **UI/logs:** desktop e mobile (incluindo 320/390 px), sem overflow; console sem erros de página, tokens, sessões completas, secrets ou payloads sensíveis. Confira mensagens seguras de sync. O fonte da aplicação não possui chamadas `console.*`/debugger; execução real ainda precisa desta inspeção.
- [ ] **Preview:** domínio Preview real abre como visitante, sem botões OAuth/requests cloud quando sem variáveis; produção continua com autenticação habilitada.

#### Roteiro RLS via API real

1. Abra dois contextos com contas controladas A/B. Cada conta altera uma certificação pela UI e confirma a escrita/leitura própria; anote os dois UUIDs e registros, sem copiar tokens para documentação.
2. Em DevTools → Network, copie a request GET a `/rest/v1/user_cert_progress` como fetch e execute no próprio contexto, mantendo `apikey` pública e `Authorization: Bearer` da **sessão normal daquele usuário**. Remova apenas o filtro `user_id` da URL: A recebe só A, B só B. Depois filtre explicitamente pelo UUID da outra conta: resultado deve ser `[]` com HTTP 200, pois RLS filtra leitura; sucesso HTTP sozinho não prova acesso.
3. Copie o POST legítimo como fetch. Mantenha headers/sessão de A, troque `user_id` no body para B e use uma identidade canônica de teste **ainda inexistente**, como `microsoft:p7-rls-probe`. O POST/UPSERT cruzado deve retornar HTTP 403/código `42501`, sem inserir linha. Repita B → A. Não use uma chave existente: erro de duplicidade não comprova RLS.
4. Com a mesma sessão, envie PATCH à linha **própria de teste**, filtrando dono/identidade, tentando trocar `user_id` para o outro UUID: deve falhar por RLS (`42501`), preservando o dono original. Para PATCH/DELETE filtrados por linha da outra conta, peça `Prefer: return=representation`: esperado `[]`/nenhuma linha afetada; a outra conta confirma seu registro inalterado. Repita nas duas direções.
5. Confira ausência do probe com a sessão de seu suposto dono. Se qualquer acesso cruzado funcionar, interrompa o aceite, registre falha e remova eventual probe usando a sessão normal do dono; corrija RLS antes de concluir P3/P7. Não use service role, SQL Editor ou token administrativo como identidade dos testes. O fonte versionado não recebe tokens nem essas requests copiadas.

**Conclusão das fases:** P3 mantém aceite local, mas API/RLS real pendente; P4 exige Google e GitHub reais; P5 exige cloud/convergência/isolamento reais; P6 permanece concluído nos critérios internos. P7 só é concluído após deploy e todos os smoke tests aplicáveis aprovados. Até lá, preparação local não equivale a produção validada.

## Documentação

- [Arquitetura e decisões](docs/ARCHITECTURE.md)
- [Modelos conceituais](docs/DATA_MODEL.md)
- [Roadmap incremental e critérios de aceite](docs/ROADMAP.md)
