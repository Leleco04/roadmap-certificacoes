# Instruções do projeto

## Contexto e escopo

- Leia este `AGENTS.md` antes de qualquer tarefa.
- Use o [README](README.md) como mapa e leia apenas os documentos de `docs/` relevantes: [arquitetura](docs/ARCHITECTURE.md), [modelo de dados](docs/DATA_MODEL.md) e [roadmap](docs/ROADMAP.md).
- Priorize arquivos de contexto e buscas direcionadas antes de ler código. Não explore todo o repositório sem necessidade.
- Implemente apenas a etapa explicitamente solicitada. Não avance automaticamente no roadmap, invente requisitos ou acrescente funcionalidades não solicitadas.
- Mantenha alterações pequenas e focadas; preserve mudanças existentes do usuário.
- Estado atual: P0 implementado como frontend local. Não avance para P1+, adicione dependências ou configure infraestrutura sem solicitação explícita.

## Implementação futura

- Priorize simplicidade, baixa manutenção e poucas dependências. Não adicione dependências sem necessidade nem abstrações prematuras.
- Preserve TypeScript estrito e evite `any`.
- Separe catálogo, domínio, UI, progresso e persistência. A UI deve usar hooks/estado e serviços/repositórios, sem acessar diretamente localStorage, Supabase ou APIs externas.
- Mantenha providers e tracks extensíveis e separados. Não crie lógica específica para Microsoft quando a regra puder ser genérica.
- Mantenha `level` flexível; `levelRank` serve para ordenação, não para dificuldade absoluta.
- Nunca inclua status do usuário no catálogo estático. Progresso pertence ao visitante ou usuário correspondente.
- Funcionalidades básicas devem funcionar sem banco e sem autenticação.
- Atualize a documentação quando uma decisão arquitetural mudar.

## Segurança e validação

- Mantenha segurança básica correta. Nunca exponha secrets, credenciais sensíveis ou a Supabase service role key no frontend ou no código versionado.
- Quando banco for introduzido, use migrations. Quando dados multiusuário forem introduzidos, exija RLS e isolamento por usuário antes de disponibilizar acesso pelo cliente.
- Use Supabase Auth para gerenciar sessões futuras; não implemente autenticação ou JWT próprios.
- Execute testes, lint, typecheck e build quando disponíveis e aplicáveis, começando pela menor validação relevante.
- Corrija erros relacionados à tarefa antes de encerrar. Informe limitações e não declare validações que não foram executadas.

## Git e conclusão

- Consulte o estado do Git antes de alterações significativas, quando houver repositório.
- Não faça commit, push ou outras alterações no Git sem solicitação explícita; isso inclui inicialização, branches e histórico.
- Ao concluir tarefas futuras, responda resumidamente com arquivos alterados, decisões relevantes, validações executadas, resultado dos testes, pendências e próximo item do roadmap, sem implementá-lo.
