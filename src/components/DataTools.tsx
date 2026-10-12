import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ProgressMap } from '../domain/models'
import { downloadText } from '../utilities/export'
import { Icon } from './Icon'

interface Props {
  onExportJson: () => string
  onExportCsv: () => string
  onValidateImport: (text: string) => ProgressMap
  onImport: (text: string) => void
  knownIdentities: ReadonlySet<string>
}

function ImportConfirmation({ progress, unknownCount, onCancel, onConfirm }: { progress: ProgressMap; unknownCount: number; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="import-dialog" aria-labelledby="import-title" aria-describedby="import-description" onCancel={onCancel} onKeyDown={(event) => {
    if (event.key !== 'Tab') return
    const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button')
    const first = buttons?.[0]
    const last = buttons?.[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}>
    <span className="eyebrow">IMPORTAR PROGRESSO</span><h2 id="import-title">Substituir o progresso atual?</h2>
    <p id="import-description">O arquivo é válido e contém <strong>{Object.keys(progress).length} registros</strong>. A importação substituirá todo o progresso atual, preservando as datas do arquivo.</p>
    {unknownCount > 0 && <p>{unknownCount} registros fora do catálogo atual serão preservados, sem aparecer nas métricas.</p>}
    <p>Você pode cancelar e exportar seu progresso antes de continuar.</p>
    <div className="dialog-actions"><button onClick={onCancel} autoFocus>Cancelar</button><button className="primary-button" onClick={onConfirm}>Substituir e importar</button></div>
  </dialog>
}

export function DataTools({ onExportJson, onExportCsv, onValidateImport, onImport, knownIdentities }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const importButton = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const [preview, setPreview] = useState<{ text: string; progress: ProgressMap } | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!preview && restoreFocus.current) {
      importButton.current?.focus()
      restoreFocus.current = false
    }
  }, [preview])

  function closeImport() {
    restoreFocus.current = true
    setPreview(null)
  }

  function exportFile(format: 'json' | 'csv') {
    try {
      downloadText(format === 'json' ? 'progresso.json' : 'certificacoes.csv', format === 'json' ? onExportJson() : onExportCsv(), format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8')
      setMessage(format === 'json' ? 'Progresso exportado em JSON.' : 'Catálogo completo com progresso exportado em CSV.')
    } catch { setMessage('Não foi possível exportar o arquivo. Tente novamente.') }
  }

  async function readImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > 1024 * 1024) throw new Error('O arquivo deve ter no máximo 1 MB.')
      const text = await file.text()
      const progress = onValidateImport(text)
      setMessage('')
      setPreview({ text, progress })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.') }
  }

  function confirmImport() {
    if (!preview) return
    try {
      onImport(preview.text)
      closeImport()
      setMessage('Progresso importado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Importação não realizada.') }
  }

  return <div className="data-tools">
    <div className="toolbar"><button onClick={() => exportFile('json')}><Icon name="download" size={16} />Exportar JSON</button><button ref={importButton} onClick={() => fileInput.current?.click()}><Icon name="upload" size={16} />Importar JSON</button><button onClick={() => exportFile('csv')}><Icon name="grid" size={16} />Exportar CSV</button></div>
    <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Arquivo JSON de progresso" hidden onChange={(event) => { void readImport(event) }} />
    <p className="tool-message" role="status">{message}</p>
    {preview && <ImportConfirmation progress={preview.progress} unknownCount={Object.keys(preview.progress).filter((identity) => !knownIdentities.has(identity)).length} onCancel={closeImport} onConfirm={confirmImport} />}
  </div>
}
