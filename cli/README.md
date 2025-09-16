# Policy as Code CLI

A command-line tool to extract, consolidate, and validate policy rules from documents using AI.

## Installation

```bash
pip install -r requirements.txt
chmod +x policyascode.py
```

## Usage

### Configure API
```bash
python policyascode.py config --api-key sk-... --base-url https://api.openai.com/v1
```

### Extract rules from documents
```bash
python policyascode.py extract -o rules.json policy.md contract.pdf
```

### Consolidate duplicates
```bash
python policyascode.py consolidate -i rules.json -o consolidated.json
```

### Validate compliance
```bash
python policyascode.py validate -r consolidated.json document.md
```

## Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `extract` | Extract atomic rules from documents | `python policyascode.py extract -o rules.json policy.md` |
| `consolidate` | Remove duplicates and merge similar rules | `python policyascode.py consolidate -i rules.json -o clean.json` |
| `validate` | Check document compliance against rules | `python policyascode.py validate -r rules.json doc.md` |
| `config` | Set API credentials and preferences | `python policyascode.py config --api-key sk-...` |

## Supported Formats

- **Input**: Markdown (.md), Text (.txt), PDF (.pdf)
- **Output**: JSON with structured rule data

## Rule Structure

```json
{
  "id": "rule-1",
  "title": "Brief rule summary",
  "body": "Detailed rule description", 
  "priority": "high|medium|low",
  "rationale": "Why this rule exists",
  "source_file": "policy.md",
  "sources": [{"quote": "Original text"}]
}
```