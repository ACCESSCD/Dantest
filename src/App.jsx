import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { UploadCloud, AlertCircle, FileSpreadsheet, RefreshCw } from 'lucide-react'
import './index.css'

function App() {
  const [flaggedResidents, setFlaggedResidents] = useState(null)
  const [fileName, setFileName] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Auto-load data on component mount
  useEffect(() => {
    fetch('./data.json')
      .then(res => {
        if (!res.ok) throw new Error("No data.json found");
        return res.json();
      })
      .then(data => {
        // The python script already processed the data!
        setFlaggedResidents(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.log("No automated data found. Falling back to manual upload mode.");
        setIsLoading(false);
      });
  }, []);

  // Manual fallback logic
  const processData = (data) => {
    const flagged = []
    const cutoffDate = new Date('2026-05-01T00:00:00')
    
    data.forEach(row => {
      const tsKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'timestamp' || k.trim() === 'חותמת זמן')
      let isValidDateAndRecent = false;
      
      if (tsKey && row[tsKey]) {
        let rowDate = new Date(row[tsKey]);
        if (isNaN(rowDate.getTime()) && typeof row[tsKey] === 'string') {
          const parts = row[tsKey].split(/[\/\-\s]/); 
          if (parts.length >= 3) {
            if (parts[2].length === 4) {
              rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
            }
          }
        }
        if (!isNaN(rowDate.getTime()) && rowDate >= cutoffDate) {
          isValidDateAndRecent = true;
        }
      }

      if (!isValidDateAndRecent) {
        return; 
      }

      const targetKey = Object.keys(row).find(k => k.trim() === 'ידע תיאורטי')
      if (targetKey) {
        const score = row[targetKey]
        // Check if score is a valid number and <= 2
        if (score !== undefined && score !== null && !isNaN(score) && Number(score) <= 2) {
          let displayDate = 'Unknown Date';
          if (tsKey && row[tsKey]) {
            const rawDate = new Date(row[tsKey]);
            if (!isNaN(rawDate.getTime())) {
              displayDate = rawDate.toLocaleDateString();
            } else if (typeof row[tsKey] === 'string') {
              displayDate = row[tsKey].split(' ')[0];
            }
          }

          flagged.push({
            name: row['שם המתמחה'] || 'Unknown',
            score: Number(score),
            date: displayDate,
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

  if (isLoading) {
    return (
      <div className="dashboard-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <RefreshCw size={48} className="upload-icon-wrapper" style={{ animation: 'spin 1s linear infinite' }} />
        <h2>Loading your automated data...</h2>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>Resident Evaluation Dashboard</h1>
        <p>Your dashboard automatically flags scores of 2 or below in Theoretical Knowledge.</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Strictly showing evaluations from May 1st, 2026 onwards.</p>
      </header>

      {/* Only show upload card if automated data failed or wasn't found */}
      {!flaggedResidents && (
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
      )}

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
