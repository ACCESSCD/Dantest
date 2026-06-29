import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { UploadCloud, AlertCircle, FileSpreadsheet, RefreshCw, MessageSquareWarning } from 'lucide-react'
import './index.css'

function App() {
  const [flaggedResidents, setFlaggedResidents] = useState(null)
  const [fileName, setFileName] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Auto-load data on component mount
  useEffect(() => {
    fetch('./data.json?t=' + new Date().getTime())
      .then(res => {
        if (!res.ok) throw new Error("No data.json found");
        return res.json();
      })
      .then(data => {
        setFlaggedResidents(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.log("No automated data found. Falling back to manual upload mode.");
        setIsLoading(false);
      });
  }, []);

  const processData = (data) => {
    const flagged = []
    const cutoffDate = new Date('2026-05-01T00:00:00')
    const negativeWords = ['ידע', 'עדיין', 'ללמוד', 'צריך', 'יותר']
    
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

      if (!isValidDateAndRecent) return; 

      const targetKey = Object.keys(row).find(k => k.trim() === 'ידע תיאורטי')
      const textKey = Object.keys(row).find(k => k.trim() === 'הערכה מילולית')
      
      const score = targetKey ? row[targetKey] : null
      const textVal = textKey && row[textKey] ? String(row[textKey]) : ''
      
      // Find words ignoring punctuation
      const cleanText = textVal.replace(/[^\w\sא-ת]/g, '')
      const wordsInText = cleanText.split(/\s+/)
      const foundWords = negativeWords.filter(w => wordsInText.includes(w))
      
      let isFlagged = false;
      
      if (score !== undefined && score !== null && !isNaN(score) && Number(score) <= 2) {
        isFlagged = true;
      }
      if (foundWords.length > 0) {
        isFlagged = true;
      }

      if (isFlagged) {
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
          score: score !== null && !isNaN(score) ? Number(score) : 'N/A',
          flagged_words: foundWords,
          full_text: textVal,
          date: displayDate,
          evaluator: row['שם המעריך'] || 'Unknown'
        })
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
        <p>Flags residents with Theoretical Knowledge ≤ 2 OR concerning keywords in verbal evaluation.</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Strictly showing evaluations from May 1st, 2026 onwards.</p>
      </header>

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
              <p>Great news! No residents met the flagging criteria (since May 1st, 2026).</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="resident-table">
                <thead>
                  <tr>
                    <th>Resident</th>
                    <th>Theoretical Knowledge Score</th>
                    <th>Flagged Keywords</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedResidents.map((resident, index) => (
                    <tr key={index}>
                      <td>
                        <div className="resident-info">
                          <h3>{resident.name}</h3>
                          <p className="meta-info">{resident.date} by {resident.evaluator}</p>
                        </div>
                      </td>
                      <td>
                        <div className={`score-badge ${resident.score <= 2 ? 'is-flagged' : 'is-ok'}`}>
                          {resident.score}
                        </div>
                      </td>
                      <td>
                        {resident.flagged_words && resident.flagged_words.length > 0 ? (
                          <div className="keywords-cell">
                            <MessageSquareWarning size={18} className="warning-icon" />
                            <div className="keywords-list">
                              {resident.flagged_words.map((w, i) => (
                                <span key={i} className="keyword-tag">{w}</span>
                              ))}
                            </div>
                            {resident.full_text && (
                                <p className="full-text-preview" title={resident.full_text}>
                                  "{resident.full_text.length > 50 ? resident.full_text.substring(0, 50) + '...' : resident.full_text}"
                                </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
