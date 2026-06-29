import pandas as pd
import json
import os
import subprocess
import datetime
import re
from collections import defaultdict

# 1. Read the Excel file
excel_path = r"C:\Users\carol\PycharmProjects\Dan Arad\משוב מתמחה (Responses).xlsx"
print(f"Reading data from {excel_path}...")
df = pd.read_excel(excel_path)

cutoff_date = pd.to_datetime('2026-05-01')

negative_words = ['ידע', 'עדיין', 'ללמוד', 'צריך', 'יותר']

# Dictionary to group evaluations by resident name
# name -> list of eval dicts
resident_evals = defaultdict(list)

# 2. Extract all evaluations with score <= 2
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
    
    if pd.notna(score) and isinstance(score, (int, float)) and score <= 2:
        # Check text for negative words
        text_val = str(row.get('הערכה מילולית', ''))
        if pd.isna(row.get('הערכה מילולית')):
            text_val = ''
            
        clean_text = re.sub(r'[^\w\sא-ת]', '', text_val)
        words_in_text = clean_text.split()
        found_words = list(set([w for w in negative_words if w in words_in_text]))
        
        name = row.get('שם המתמחה', 'Unknown')
        evaluator = row.get('שם המעריך', 'Unknown')
        
        resident_evals[str(name) if pd.notna(name) else 'Unknown'].append({
            'dt': dt,
            'score': float(score),
            'flagged_words': found_words,
            'full_text': text_val,
            'date_str': dt.strftime('%Y-%m-%d'),
            'evaluator': str(evaluator) if pd.notna(evaluator) else 'Unknown'
        })

flagged = []

# 3. Filter for residents with 2 or more instances within 14 days
for name, evals in resident_evals.items():
    # Sort by date
    evals.sort(key=lambda x: x['dt'])
    
    valid_indices = set()
    for i in range(len(evals)):
        for j in range(i+1, len(evals)):
            diff_days = (evals[j]['dt'] - evals[i]['dt']).days
            if diff_days <= 14:
                valid_indices.add(i)
                valid_indices.add(j)
                
    # Add the valid clustered evaluations to the final list
    for idx in sorted(list(valid_indices)):
        e = evals[idx]
        flagged.append({
            'name': name,
            'score': e['score'],
            'flagged_words': e['flagged_words'],
            'full_text': e['full_text'],
            'date': e['date_str'],
            'evaluator': e['evaluator']
        })

# 4. Save to public/data.json
output_dir = os.path.join(os.path.dirname(__file__), 'public')
if not os.path.exists(output_dir):
    os.makedirs(output_dir)
    
output_path = os.path.join(output_dir, 'data.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(flagged, f, ensure_ascii=False, indent=2)

print(f"Successfully filtered and saved {len(flagged)} clustered records to {output_path}")

# 5. Deploy to GitHub Pages
print("\nDeploying to GitHub Pages...")
try:
    subprocess.run("npm run deploy", shell=True, check=True)
    print("\n✅ Done! Your dashboard is now updated and live on GitHub Pages.")
except subprocess.CalledProcessError as e:
    print(f"\n❌ Error during deployment: {e}")
