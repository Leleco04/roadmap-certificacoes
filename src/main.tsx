import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initialProgress } from './catalog/initialProgress'
import { browserAuthContext } from './auth/supabaseAuth'
import { browserProgressCacheRepository } from './persistence/progressCache'
import { createSupabaseProgressRepository } from './persistence/supabaseProgressRepository'
import { createProgressService } from './progress/progressService'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Elemento raiz não encontrado.')
const { authService, client, clock } = browserAuthContext(import.meta.env)
const local = browserProgressCacheRepository(initialProgress)
const remote = client ? createSupabaseProgressRepository(client, clock) : null
const progressService = createProgressService(local, authService, remote)

createRoot(root).render(<StrictMode><App progressService={progressService} authService={authService} /></StrictMode>)
