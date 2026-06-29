import { useState } from 'react'
import * as XLSX from 'xlsx'
import { UploadCloud, AlertCircle, FileSpreadsheet } from 'lucide-react'
import './index.css'

function App() {
  const [flaggedResidents, setFlaggedResidents] = useState(null)
  const [fileName, setFileName] = useState("")

  const processData = (data) => {
    const flagged = []
    const cutoffDate = new Date('2026-05-01T00:00:00')
    
    data.forEach(row => {
      // Check the date first
      if (row['Timestamp']) {
        const rowDate = new Date(row['Timestamp'])
        if (rowDate < cutoffDate) {
          return // Skip this row if it's before May 1st, 2026
        }
      }

      // Find the key that corresponds to 'ידע תיאורטי' (Theoretical Knowledge)
      // We trim keys because sometimes excel headers have trailing spaces e.g. 'ידע תיאורטי '
      const targetKey = Object.keys(row).find(k => k.trim() === 'ידע תיאורטי')
      
      if (targetKey) {
        const score = row[targetKey]
        
        // Check if score is a valid number and <= 2
        if (score !== undefined && score !== null && !isNaN(score) && Number(score) <= 2) {
          flagged.push({
            name: row['שם המתמחה'] || 'Unknown',
            score: Number(score),
            date: row['Timestamp'] ? new Date(row['Timestamp']).toLocaleDateString() : 'Unknown Date',
            evaluator: row['שם המעריך'] || 'Unknown'
          })
        }
      }
    })
    
    setFlaggedResidents(flagged)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const data = XLSX.utils.sheet_to_json(ws, { cellDates: true })
      processData(data)
    }
    reader.readAsBinaryString(file)
  }

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  }

  const onDragOver = (e) => {
    e.preventDefault();
  }

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>Resident Evaluation Dashboard</h1>
        <p>Upload your evaluation responses to immediately flag scores of 2 or below in Theoretical Knowledge.</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Only showing evaluations from May 1st, 2026 onwards.</p>
      </header>

      <div 
        className="upload-card"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div className="upload-icon-wrapper">
          <UploadCloud size={48} />
        </div>
        <h2>Upload Data</h2>
        <p>Drag and drop your Excel (.xlsx) file here</p>
        <p className="or-text">or</p>
        <label className="upload-btn">
          Browse Files
          <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
        </label>
        {fileName && <div className="file-name"><FileSpreadsheet size={16}/> {fileName}</div>}
      </div>

      {flaggedResidents && (
        <div className="results-container">
          <div className="results-header">
            <h2><AlertCircle size={24}/> Flagged Residents</h2>
            <span className="badge">{flaggedResidents.length} found</span>
          </div>
          
          {flaggedResidents.length === 0 ? (
            <div className="no-flags">
              <p>Great news! No residents scored 2 or below in Theoretical Knowledge (since May 1st, 2026).</p>
            </div>
          ) : (
            <ul className="resident-list">
              {flaggedResidents.map((resident, index) => (
                <li key={index} className="resident-item">
                  <div className="resident-info">
                    <h3>{resident.name}</h3>
                    <p className="meta-info">Evaluated on {resident.date} by {resident.evaluator}</p>
                  </div>
                  <div className="score-badge">
                    {resident.score}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default App
