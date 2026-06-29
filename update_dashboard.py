import pandas as pd
import json
import os
import subprocess
import datetime
import re

# 1. Read the Excel file
excel_path = r"C:\Users\carol\PycharmProjects\Dan Arad\משוב מתמחה (Responses).xlsx"
print(f"Reading data from {excel_path}...")
df = pd.read_excel(excel_path)

cutoff_date = pd.to_datetime('2026-05-01')
flagged = []

negative_words = ['ידע', 'עדיין', 'ללמוד', 'צריך', 'יותר']

# 2. Filter the data securely locally
for index, row in df.iterrows():
    # Check date
    date_val = row.get('Timestamp')
    if pd.isna(date_val):
        date_val = row.get('חותמת זמן')
        
    if pd.isna(date_val):
        continue
        
    try:
        dt = pd.to_datetime(date_val)
        if dt < cutoff_date:
            continue
    except Exception as e:
        continue
        
    # Find the theoretical knowledge column
    score_col = None
    for col in df.columns:
        if 'ידע תיאורטי' in str(col):
            score_col = col
            break
            
    score = row[score_col] if score_col else None
    
    # Check text for negative words
    text_val = str(row.get('הערכה מילולית', ''))
    if pd.isna(row.get('הערכה מילולית')):
        text_val = ''
        
    # extract words removing punctuation for accurate matching
    clean_text = re.sub(r'[^\w\sא-ת]', '', text_val)
    words_in_text = clean_text.split()
    found_words = list(set([w for w in negative_words if w in words_in_text]))
    
    is_flagged = False
    
    # Condition 1: Score <= 2
    is_score_flagged = False
    if pd.notna(score) and isinstance(score, (int, float)) and score <= 2:
        is_score_flagged = True
        is_flagged = True
        
    # Condition 2: Negative words found
    if len(found_words) > 0:
        is_flagged = True
        
    if is_flagged:
        name = row.get('שם המתמחה', 'Unknown')
        evaluator = row.get('שם המעריך', 'Unknown')
        
        flagged.append({
            'name': str(name) if pd.notna(name) else 'Unknown',
            'score': float(score) if pd.notna(score) and isinstance(score, (int, float)) else 'N/A',
            'flagged_words': found_words,
            'full_text': text_val,
            'date': dt.strftime('%Y-%m-%d'),
            'evaluator': str(evaluator) if pd.notna(evaluator) else 'Unknown'
        })

# 3. Save to public/data.json
output_dir = os.path.join(os.path.dirname(__file__), 'public')
if not os.path.exists(output_dir):
    os.makedirs(output_dir)
    
output_path = os.path.join(output_dir, 'data.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(flagged, f, ensure_ascii=False, indent=2)

print(f"Successfully filtered and saved {len(flagged)} records to {output_path}")

# 4. Deploy to GitHub Pages
print("\nDeploying to GitHub Pages...")
try:
    subprocess.run("npm run deploy", shell=True, check=True)
    print("\n✅ Done! Your dashboard is now updated and live on GitHub Pages.")
except subprocess.CalledProcessError as e:
    print(f"\n❌ Error during deployment: {e}")
