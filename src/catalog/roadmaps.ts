import type { Roadmap } from '../domain/models'

export const roadmaps: readonly Roadmap[] = [
  {
    id: 'microsoft-ai', provider: 'microsoft', track: 'ai',
    description: 'Fundamentos e aplicações; escolha depois backend, operações, multiagentes ou soluções empresariais.',
    certificationCodes: ['microsoft:ai-901', 'microsoft:ai-103'],
    branches: [
      { id: 'backend', name: 'Backend e aplicações cloud', certificationCodes: ['microsoft:ai-200'] },
      { id: 'operations', name: 'MLOps e GenAIOps', certificationCodes: ['microsoft:ai-300'] },
      { id: 'multi-agent', name: 'Sistemas multiagente (beta na listagem oficial)', certificationCodes: ['microsoft:ai-500'] },
      { id: 'business-agents', name: 'Agentes e arquitetura empresarial', certificationCodes: ['microsoft:ab-620', 'microsoft:ab-100'] },
      { id: 'sql', name: 'Dados SQL para IA', certificationCodes: ['microsoft:dp-800'] },
      { id: 'cosmos', name: 'RAG e memória de agentes', certificationCodes: ['microsoft:dp-420'] },
      { id: 'security', name: 'Segurança aplicada a Cloud e IA', certificationCodes: ['microsoft:sc-500'] },
    ],
  },
  {
    id: 'microsoft-cloud', provider: 'microsoft', track: 'cloud',
    description: 'Comece com Azure; arquitetura, redes, entrega e workloads especializados são caminhos opcionais.',
    certificationCodes: ['microsoft:az-900', 'microsoft:az-104'],
    branches: [
      { id: 'architecture', name: 'Arquitetura de soluções', certificationCodes: ['microsoft:az-305'] },
      { id: 'networking', name: 'Engenharia de redes', certificationCodes: ['microsoft:az-700'] },
      { id: 'devops', name: 'DevOps e entrega contínua', certificationCodes: ['microsoft:az-400'] },
      { id: 'security', name: 'Segurança de Cloud e IA', certificationCodes: ['microsoft:sc-500'] },
      { id: 'hybrid', name: 'Windows Server e ambientes híbridos', certificationCodes: ['microsoft:az-802'] },
      { id: 'desktop', name: 'Especialização: desktops virtuais', certificationCodes: ['microsoft:az-140'] },
      { id: 'sap', name: 'Especialização: infraestrutura SAP', certificationCodes: ['microsoft:az-120'] },
    ],
  },
  {
    id: 'microsoft-cybersecurity', provider: 'microsoft', track: 'cybersecurity',
    description: 'Escolha identidade, operações ou proteção. Arquitetura exige uma Associate aceita pela Microsoft.',
    certificationCodes: ['microsoft:sc-900'],
    branches: [
      { id: 'identity', name: 'Identidade e acesso', certificationCodes: ['microsoft:sc-300'] },
      { id: 'operations', name: 'Operações e resposta a incidentes', certificationCodes: ['microsoft:sc-200'] },
      { id: 'cloud-ai', name: 'Segurança de Cloud e IA', certificationCodes: ['microsoft:sc-500'] },
      { id: 'information', name: 'Proteção e governança de informações', certificationCodes: ['microsoft:sc-401'] },
      { id: 'architecture', name: 'Arquitetura de cybersecurity', certificationCodes: ['microsoft:sc-100'] },
    ],
  },
  {
    id: 'microsoft-data', provider: 'microsoft', track: 'data',
    description: 'Uma base em dados; Fabric, Databricks, SQL e analytics são especializações independentes.',
    certificationCodes: ['microsoft:dp-900'],
    branches: [
      { id: 'fabric-engineering', name: 'Engenharia de dados no Fabric', certificationCodes: ['microsoft:dp-700'] },
      { id: 'databricks', name: 'Engenharia de dados no Databricks', certificationCodes: ['microsoft:dp-750'] },
      { id: 'fabric-analytics', name: 'Engenharia analítica no Fabric', certificationCodes: ['microsoft:dp-600'] },
      { id: 'sql-development', name: 'Desenvolvimento SQL com IA', certificationCodes: ['microsoft:dp-800'] },
      { id: 'sql-administration', name: 'Administração de bancos SQL', certificationCodes: ['microsoft:dp-300'] },
      { id: 'cosmos', name: 'Cosmos DB para aplicações e IA', certificationCodes: ['microsoft:dp-420'] },
      { id: 'analytics', name: 'Analytics com Power BI', certificationCodes: ['microsoft:pl-300'] },
    ],
  },
]
