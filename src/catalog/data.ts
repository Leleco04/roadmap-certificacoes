import type { Certification, CertificationProvider, Track } from '../domain/models'

export const providers: readonly CertificationProvider[] = [
  { id: 'microsoft', name: 'Microsoft', slug: 'microsoft', website: 'https://learn.microsoft.com/credentials/' },
]

export const tracks: readonly Track[] = [
  { id: 'ai', name: 'Artificial Intelligence', slug: 'ai' },
  { id: 'cloud', name: 'Cloud', slug: 'cloud' },
  { id: 'cybersecurity', name: 'Cybersecurity', slug: 'cybersecurity' },
  { id: 'data', name: 'Data', slug: 'data' },
  { id: 'devops', name: 'DevOps', slug: 'devops' },
  { id: 'development', name: 'Development', slug: 'development' },
]

// Visual metadata belongs to catalog presentation, not to domain rules.
export const trackPresentation: Readonly<Record<string, { color: string; background: string; symbol: string; label: string }>> = {
  ai: { color: '#7044b3', background: '#f2ecfb', symbol: '✧', label: 'Inteligência artificial' },
  cloud: { color: '#285fb1', background: '#eaf1fd', symbol: '☁', label: 'Cloud' },
  cybersecurity: { color: '#a14d15', background: '#fff0e5', symbol: '◇', label: 'Cybersecurity' },
  data: { color: '#28724b', background: '#eaf5ee', symbol: '▤', label: 'Dados' },
}

export const defaultTrackPresentation = { color: '#536474', background: '#edf1f4', symbol: '↗', label: 'Trilha' }

const fundamentals = {
  provider: 'microsoft', level: 'Fundamentals', levelRank: 10,
  validity: 'Não expira', renewal: 'Não requer renovação.', difficulty: 'Inicial', priority: 'Base',
}
const associate = {
  provider: 'microsoft', level: 'Associate', levelRank: 20,
  validity: '12 meses', renewal: 'Avaliação gratuita no Microsoft Learn nos 6 meses anteriores ao vencimento, quando a credencial estiver elegível para renovação.',
  difficulty: 'Intermediária', priority: 'Evolução',
}

const expert = { ...associate, level: 'Expert', levelRank: 40, difficulty: 'Avançada' }
const specialty = { ...associate, level: 'Specialty', levelRank: 50, priority: 'Especialização' }

export const difficultyScale = ['Inicial', 'Intermediária', 'Avançada'] as const
export const priorityScale = ['Base', 'Evolução', 'Especialização'] as const
export const catalogReviewedAt = '2026-10-08'

// Names, credential tiers and topic summaries checked against Microsoft Learn.
// Difficulty, priority, tracks and ordering are editorial suggestions.
export const certifications: readonly Certification[] = [
  {
    ...fundamentals, code: 'AI-901', name: 'Azure AI Fundamentals', tracks: ['ai'], recommendedOrder: { ai: 10 },
    mainContent: ['Conceitos e recursos de IA', 'Implementação de soluções com Microsoft Foundry', 'Fundamentos de desenvolvimento de IA no Azure'],
    prerequisites: 'A Microsoft espera conhecimento de sintaxe Python, técnicas de programação e recursos Azure; familiaridade com APIs REST, SDKs e CLIs.',
    relevance: 'Base para começar a desenvolver soluções de inteligência artificial no Azure.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-fundamentals/',
  },
  {
    ...associate, code: 'AI-103', name: 'Azure AI Apps and Agents Developer Associate', tracks: ['ai', 'development'], recommendedOrder: { ai: 20, development: 10 },
    mainContent: ['Aplicações e agentes com Microsoft Foundry', 'IA generativa, RAG e avaliação', 'Visão computacional e análise de texto'],
    prerequisites: 'Experiência com Python, IA generativa e serviços Azure recomendada.',
    relevance: 'Desenvolvimento e operação de aplicações e agentes de IA.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-apps-and-agents-developer-associate/',
  },
  {
    ...associate, code: 'AI-200', name: 'Azure AI Cloud Developer Associate', tracks: ['ai', 'cloud', 'development'], recommendedOrder: { ai: 30, cloud: 30, development: 20 },
    mainContent: ['Aplicações em contêineres', 'Serviços de dados para IA', 'Integração, segurança e monitoramento'],
    prerequisites: 'Experiência com Python, SDKs Azure e desenvolvimento de serviços recomendada.',
    relevance: 'Construção de serviços de backend escaláveis para soluções de IA na nuvem.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-cloud-developer-associate/',
  },
  {
    ...fundamentals, code: 'AZ-900', name: 'Azure Fundamentals', tracks: ['cloud'], recommendedOrder: { cloud: 10 },
    mainContent: ['Conceitos de computação em nuvem', 'Arquitetura e serviços Azure', 'Governança e gerenciamento'],
    prerequisites: 'A Microsoft recomenda experiência em uma área de TI, como infraestrutura, bancos de dados ou desenvolvimento.', relevance: 'Visão geral da plataforma Azure e de seus serviços.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/',
  },
  {
    ...associate, code: 'AZ-104', name: 'Azure Administrator Associate', tracks: ['cloud'], recommendedOrder: { cloud: 20 },
    mainContent: ['Identidade e governança', 'Compute, redes e armazenamento', 'Monitoramento de recursos Azure'],
    prerequisites: 'A Microsoft espera familiaridade com sistemas, redes, servidores e virtualização; experiência com PowerShell, Azure CLI, portal Azure, ARM/Bicep e Entra ID.',
    relevance: 'Administração e operação diária de ambientes Azure.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/',
  },
  {
    ...expert, code: 'AZ-305', name: 'Azure Solutions Architect Expert', tracks: ['cloud'], recommendedOrder: { cloud: 80 },
    mainContent: ['Design de infraestrutura', 'Continuidade de negócio', 'Identidade, governança e soluções de dados'],
    prerequisites: 'A certificação Azure Administrator Associate (AZ-104) é obrigatória para obter esta credencial.',
    relevance: 'Arquitetura de soluções cloud e híbridas alinhadas a requisitos de negócio.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-solutions-architect/',
  },
  {
    ...fundamentals, code: 'SC-900', name: 'Security, Compliance, and Identity Fundamentals', tracks: ['cybersecurity'], recommendedOrder: { cybersecurity: 10 },
    mainContent: ['Segurança, conformidade e identidade', 'Microsoft Entra', 'Microsoft Defender e Purview'],
    prerequisites: 'Familiaridade com Azure e Microsoft 365 recomendada.', relevance: 'Fundamentos de proteção de identidades, recursos e informações.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/security-compliance-and-identity-fundamentals/',
  },
  {
    ...associate, code: 'SC-500', name: 'Cloud and AI Security Engineer Associate', tracks: ['cybersecurity', 'ai', 'cloud'], recommendedOrder: { cybersecurity: 40, ai: 70, cloud: 50 },
    mainContent: ['Proteção de ambientes cloud e IA', 'Segurança de redes, dados e compute', 'Postura de segurança e governança'],
    prerequisites: 'Experiência prática com Azure, ambientes híbridos e Microsoft Entra ID recomendada.',
    relevance: 'Engenharia de segurança para ambientes cloud e cargas de trabalho de IA.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/cloud-and-ai-security-engineer-associate/',
  },
  {
    ...associate, code: 'SC-300', name: 'Identity and Access Administrator Associate', tracks: ['cybersecurity'], recommendedOrder: { cybersecurity: 20 },
    mainContent: ['Identidades com Microsoft Entra ID', 'Autenticação e acesso', 'Governança de identidades'],
    prerequisites: 'A Microsoft espera familiaridade com Azure, Microsoft 365, AD DS, PowerShell e KQL.',
    relevance: 'Administração do ciclo de vida de identidades e políticas de acesso.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/identity-and-access-administrator/',
  },
  {
    ...fundamentals, code: 'DP-900', name: 'Azure Data Fundamentals', tracks: ['data'], recommendedOrder: { data: 10 },
    mainContent: ['Dados relacionais e não relacionais', 'Serviços de dados Azure', 'Cargas transacionais e analíticas'],
    prerequisites: 'A Microsoft espera familiaridade com dados relacionais e não relacionais e cargas transacionais/analíticas. DP-900 não é pré-requisito obrigatório das demais certificações de dados.', relevance: 'Base para trabalhar com dados e análises na nuvem.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-data-fundamentals/',
  },
  {
    ...associate, code: 'DP-700', name: 'Fabric Data Engineer Associate', tracks: ['data'], recommendedOrder: { data: 20 },
    mainContent: ['Ingestão e transformação de dados', 'Gerenciamento e segurança de soluções analíticas no Fabric', 'Monitoramento e otimização'],
    prerequisites: 'Experiência com SQL, PySpark e KQL recomendada.', relevance: 'Engenharia de dados e operação de soluções analíticas no Fabric.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/',
  },
  {
    ...associate, code: 'DP-800', name: 'SQL AI Developer Associate', tracks: ['data', 'ai'], recommendedOrder: { data: 50, ai: 50 },
    mainContent: ['Desenvolvimento de bancos de dados SQL', 'Segurança, otimização e deploy', 'Busca inteligente, vetores e IA'],
    prerequisites: 'Experiência com T-SQL, desenvolvimento de bancos e conceitos de IA recomendada.',
    relevance: 'Desenvolvimento de soluções de banco de dados com recursos de inteligência artificial.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/developing-ai-enabled-database-solutions/',
  },
  {
    ...associate, code: 'AI-300', name: 'Machine Learning Operations Engineer Associate', difficulty: 'Avançada',
    tracks: ['ai', 'data', 'cloud', 'devops'], recommendedOrder: { ai: 40, data: 90, cloud: 60, devops: 10 },
    mainContent: ['Infraestrutura e ciclo de vida de MLOps', 'Infraestrutura de GenAIOps com Microsoft Foundry', 'Qualidade, observabilidade e otimização de modelos'],
    prerequisites: 'Experiência com ciência de dados, Python, treinamento e operação de modelos, Azure Machine Learning, Foundry, GitHub Actions e IaC esperada pela Microsoft.',
    relevance: 'Operação de modelos e aplicações de IA com automação, monitoramento e controle de qualidade.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/operationalizing-machine-learning-and-generative-ai-solutions/',
  },
  {
    ...expert, code: 'AI-500', name: 'Multi-Agent AI Solutions Expert (beta)', tracks: ['ai'], recommendedOrder: { ai: 90 },
    mainContent: ['Arquitetura e desenvolvimento de sistemas multiagente', 'Avaliação, otimização e monitoramento', 'Segurança, governança e deploy de agentes'],
    prerequisites: 'Exige Azure AI Apps and Agents Developer Associate (AI-103). A Microsoft espera experiência com Python, Foundry, agentes em produção e serviços Azure.',
    relevance: 'Sistemas multiagente em produção. A listagem geral Microsoft Learn ainda sinaliza beta; a página específica e o exame estão publicados sem esse sufixo. Consulte as condições oficiais antes de agendar.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/multi-agent-ai-solutions-expert/',
  },
  {
    ...associate, code: 'AB-620', name: 'AI Agent Builder Associate', priority: 'Especialização',
    tracks: ['ai', 'development'], recommendedOrder: { ai: 80, development: 30 },
    mainContent: ['Planejamento de soluções com agentes', 'Integração e extensão no Copilot Studio', 'Testes e gerenciamento de agentes com APIs, MCP e Foundry'],
    prerequisites: 'A Microsoft espera familiaridade com Power Fx, Dataverse, Power Platform, Foundry, IA generativa, RAG, MCP, A2A e APIs REST.',
    relevance: 'Caminho opcional para desenvolvimento e integração de agentes empresariais com Copilot Studio.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/ai-agent-builder-associate/',
  },
  {
    ...expert, code: 'AB-100', name: 'Agentic AI Business Solutions Architect Expert', priority: 'Especialização',
    tracks: ['ai'], recommendedOrder: { ai: 100 },
    mainContent: ['Planejamento de soluções empresariais com IA', 'Arquitetura de soluções agentic e multiagente', 'Deploy, governança e ciclo de vida de soluções com IA'],
    prerequisites: 'Exige ao menos uma Associate da lista oficial; AI-103, AI-300 e AB-620 são opções incluídas neste catálogo. A lista completa está na fonte oficial.',
    relevance: 'Arquitetura de IA agentic aplicada a processos empresariais, com Foundry, Copilot Studio e business applications; caminho opcional, distinto de engenharia Azure pura.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/agentic-ai-business-solutions-architect/',
  },
  {
    ...associate, code: 'AZ-700', name: 'Azure Network Engineer Associate',
    tracks: ['cloud', 'cybersecurity'], recommendedOrder: { cloud: 40, cybersecurity: 60 },
    mainContent: ['Infraestrutura de rede e conectividade híbrida', 'Entrega de aplicações e acesso privado', 'Serviços de segurança de rede Azure'],
    prerequisites: 'A Microsoft espera experiência com redes empresariais, protocolos, resolução de nomes e gerenciamento de endereços.',
    relevance: 'Redes cloud resilientes, conectividade híbrida e proteção de tráfego e aplicações.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-network-engineer-associate/',
  },
  {
    ...expert, code: 'AZ-400', name: 'DevOps Engineer Expert', tracks: ['cloud', 'devops'], recommendedOrder: { cloud: 90, devops: 20 },
    mainContent: ['Processos, comunicação e controle de versão', 'Pipelines de build e release', 'Segurança, conformidade e instrumentação'],
    prerequisites: 'Exige Azure Administrator Associate (AZ-104) ou Azure Developer Associate já obtida (AZ-204, aposentada). A página oficial ainda lista essa opção legada. Experiência com Azure, GitHub e Azure DevOps esperada.',
    relevance: 'Entrega contínua de software e infraestrutura com segurança, automação e observabilidade.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/devops-engineer/',
  },
  {
    ...specialty, code: 'AZ-140', name: 'Azure Virtual Desktop Specialty', tracks: ['cloud'], recommendedOrder: { cloud: 100 },
    mainContent: ['Infraestrutura Azure Virtual Desktop', 'Identidade, segurança e aplicações', 'Monitoramento e manutenção de desktops virtuais'],
    prerequisites: 'A Microsoft espera experiência com compute, redes, identidade, armazenamento, resiliência Azure e ambientes de desktop.',
    relevance: 'Especialização opcional em desktops virtuais e aplicações remotas no Azure.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-virtual-desktop-specialty/',
  },
  {
    ...specialty, code: 'AZ-120', name: 'Azure for SAP Workloads Specialty', difficulty: 'Avançada',
    tracks: ['cloud'], recommendedOrder: { cloud: 110 },
    mainContent: ['Migração de workloads SAP para Azure', 'Design de infraestrutura SAP', 'Alta disponibilidade, recuperação de desastres e manutenção'],
    prerequisites: 'A Microsoft recomenda Azure Administrator Associate e experiência extensa com SAP, virtualização, infraestrutura cloud, armazenamento, disponibilidade e redes; AZ-104 é recomendação, não requisito formal.',
    relevance: 'Especialização opcional em infraestrutura Azure para SAP; não representa formação funcional em business applications.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-for-sap-workloads-specialty/',
  },
  {
    ...associate, code: 'AZ-802', name: 'Windows Server Administrator Associate', priority: 'Especialização',
    tracks: ['cloud'], recommendedOrder: { cloud: 70 },
    mainContent: ['AD DS e administração de workloads híbridos', 'Máquinas virtuais, redes, armazenamento e segurança', 'Monitoramento com PowerShell, Azure Arc e serviços Azure'],
    prerequisites: 'A Microsoft espera experiência com Windows Server, Windows Admin Center, Hyper-V, PowerShell, Azure Arc e AD DS.',
    relevance: 'Administração de Windows Server em ambientes locais, cloud e híbridos. AZ-802 é o exame atual; AZ-800/AZ-801 não integram o catálogo ativo.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/windows-server-hybrid-administrator/',
  },
  {
    ...associate, code: 'SC-200', name: 'Security Operations Analyst Associate', tracks: ['cybersecurity'], recommendedOrder: { cybersecurity: 30 },
    mainContent: ['Gerenciamento de operações de segurança', 'Resposta a incidentes com Defender XDR e Sentinel', 'Threat hunting e automação com KQL'],
    prerequisites: 'A Microsoft espera familiaridade com soluções de segurança e identidade, Azure, Microsoft 365, agentes/Copilots e sistemas Windows e Linux.',
    relevance: 'Detecção, investigação e mitigação de ameaças em ambientes cloud e locais.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/security-operations-analyst/',
  },
  {
    ...associate, code: 'SC-401', name: 'Information Security Administrator Associate', priority: 'Especialização',
    tracks: ['cybersecurity', 'data', 'ai'], recommendedOrder: { cybersecurity: 50, data: 100, ai: 110 },
    mainContent: ['Proteção de informações com Microsoft Purview', 'Prevenção de perda de dados e retenção', 'Riscos internos, alertas e proteção de dados usados por IA'],
    prerequisites: 'A Microsoft espera familiaridade com Microsoft 365, PowerShell, Entra, portal Defender e Defender for Cloud Apps.',
    relevance: 'Proteção e governança de informações, inclusive dados usados por serviços de IA; especialização técnica de segurança, não Microsoft 365 funcional.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/information-security-administrator/',
  },
  {
    ...expert, code: 'SC-100', name: 'Cybersecurity Architect Expert',
    tracks: ['cybersecurity', 'cloud', 'ai'], recommendedOrder: { cybersecurity: 80, cloud: 120, ai: 120 },
    mainContent: ['Arquitetura Zero Trust e estratégia de segurança', 'Operações, identidade e conformidade', 'Segurança de infraestrutura, aplicações, dados e IA'],
    prerequisites: 'Exige ao menos uma destas credenciais: Identity and Access Administrator Associate (SC-300), Security Operations Analyst Associate (SC-200) ou Cloud and AI Security Engineer Associate (SC-500).',
    relevance: 'Arquitetura de segurança para ambientes híbridos e multicloud, incluindo proteção de dados e IA.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/cybersecurity-architect-expert/',
  },
  {
    ...associate, code: 'DP-600', name: 'Fabric Analytics Engineer Associate', tracks: ['data'], recommendedOrder: { data: 40 },
    mainContent: ['Preparação de dados para análise', 'Manutenção e segurança de ativos analíticos', 'Modelos semânticos, warehouses e lakehouses'],
    prerequisites: 'A Microsoft espera conhecimento de SQL, KQL e DAX para consultar e analisar dados.',
    relevance: 'Criação e gerenciamento de soluções analíticas em escala empresarial com Microsoft Fabric.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/fabric-analytics-engineer-associate/',
  },
  {
    ...associate, code: 'DP-750', name: 'Azure Databricks Data Engineer Associate', tracks: ['data'], recommendedOrder: { data: 30 },
    mainContent: ['Configuração de ambientes Azure Databricks', 'Segurança e governança com Unity Catalog', 'Processamento de dados e manutenção de pipelines'],
    prerequisites: 'A Microsoft espera SQL, Python, práticas de desenvolvimento com Git e familiaridade com Entra, Azure Data Factory e Azure Monitor.',
    relevance: 'Engenharia de dados, pipelines e governança no Azure Databricks.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/implementing-data-engineering-solutions-using-azure-databricks/',
  },
  {
    ...associate, code: 'DP-300', name: 'Azure Database Administrator Associate', priority: 'Especialização',
    tracks: ['data', 'cloud'], recommendedOrder: { data: 60, cloud: 75 },
    mainContent: ['Administração de Azure SQL e SQL Server', 'Segurança, automação e otimização de recursos', 'Alta disponibilidade e recuperação de desastres'],
    prerequisites: 'A Microsoft espera conhecimento e experiência com Azure SQL Database, SQL Managed Instance e SQL Server em VMs ou ambientes locais.',
    relevance: 'Operação de plataformas de dados SQL cloud e híbridas com disponibilidade e desempenho.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-database-administrator-associate/',
  },
  {
    ...associate, code: 'DP-420', name: 'Azure Cosmos DB AI Developer Associate', priority: 'Especialização',
    tracks: ['data', 'ai'], recommendedOrder: { data: 70, ai: 60 },
    mainContent: ['Modelagem e distribuição de dados com Cosmos DB', 'Consultas, segurança e otimização de aplicações', 'RAG, memória de agentes e integração com Fabric'],
    prerequisites: 'A Microsoft espera experiência com C# ou Python e familiaridade com Azure, IA generativa e sistemas de recuperação de informações.',
    relevance: 'Bancos de dados para aplicações escaláveis e sistemas de IA. A página oficial atual usa Associate, embora a URL e algumas listagens ainda mencionem Specialty.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-cosmos-db-developer-specialty/',
  },
  {
    ...associate, code: 'PL-300', name: 'Power BI Data Analyst Associate', priority: 'Especialização',
    tracks: ['data'], recommendedOrder: { data: 80 },
    mainContent: ['Preparação e modelagem de dados', 'Visualização e análise com Power BI', 'Gerenciamento e segurança de soluções analíticas'],
    prerequisites: 'A Microsoft espera proficiência em Power Query e Data Analysis Expressions (DAX).',
    relevance: 'Caminho opcional de analytics e entrega de insights, complementar à engenharia de dados; não é Power Platform funcional.',
    sourceUrl: 'https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/',
  },
]
