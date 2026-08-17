import json
with open(r'C:\Users\Ghada\.gemini\antigravity-ide\brain\5e3ce0a6-2e4f-49e5-9c23-55d0d18e9cd8\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if 'content' in data and 'analyst-matching.component.html' in data['content']:
            print(f"Found in step {data.get('step_index')}")

