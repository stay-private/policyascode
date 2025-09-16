#!/usr/bin/env python3
"""Policy as Code CLI - Extract, consolidate, and validate policy rules."""

import argparse, json, os, sys, base64, mimetypes
from pathlib import Path
from typing import Dict, List, Any, Optional
import requests
from dataclasses import dataclass, asdict

@dataclass
class Rule:
    id: str
    title: str
    body: str
    priority: str
    rationale: str
    source_file: str
    sources: List[Dict[str, str]]

@dataclass
class Validation:
    id: str
    result: str
    reason: str

class PolicyAsCode:
    def __init__(self):
        self.config_file = Path.home() / '.policyascode.json'
        self.config = self.load_config()
        
    def load_config(self) -> Dict[str, str]:
        if self.config_file.exists():
            return json.loads(self.config_file.read_text())
        return {"api_key": "", "base_url": "https://api.openai.com/v1"}
    
    def save_config(self):
        self.config_file.write_text(json.dumps(self.config, indent=2))
    
    def read_file(self, filepath: str) -> Dict[str, Any]:
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")
        
        mime_type, _ = mimetypes.guess_type(filepath)
        
        if mime_type == 'application/pdf':
            with open(filepath, 'rb') as f:
                data = base64.b64encode(f.read()).decode()
            return {
                "type": "input_file",
                "filename": path.name,
                "file_data": f"data:application/pdf;base64,{data}"
            }
        else:
            content = path.read_text(encoding='utf-8')
            return {
                "type": "input_text", 
                "text": f"# {path.name}\n\n{content}"
            }
    
    def call_openai(self, instructions: str, content: Any, schema: Dict) -> Dict:
        if not self.config.get('api_key'):
            raise ValueError("API key not configured. Run: policyascode config --api-key YOUR_KEY")
        
        headers = {
            "Authorization": f"Bearer {self.config['api_key']}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": instructions},
                {"role": "user", "content": [content] if isinstance(content, dict) else content}
            ],
            "response_format": {"type": "json_schema", "json_schema": {"name": "response", "schema": schema}}
        }
        
        response = requests.post(f"{self.config['base_url']}/chat/completions", 
                               headers=headers, json=payload, timeout=60)
        
        if response.status_code != 200:
            raise Exception(f"API Error {response.status_code}: {response.text}")
        
        return json.loads(response.json()['choices'][0]['message']['content'])
    
    def extract_rules(self, files: List[str], output: str):
        print(f"Extracting rules from {len(files)} files...")
        
        all_rules = []
        rule_counter = 0
        
        extraction_prompt = """Extract atomic, testable rules from ONE policy document.
Keep each rule minimal.
Write for an LLM to apply it unambiguously.
Always include concise rationale and quotes."""
        
        schema = {
            "type": "object",
            "properties": {
                "rules": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "body": {"type": "string"},
                            "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                            "rationale": {"type": "string"},
                            "sources": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {"quote": {"type": "string"}},
                                    "required": ["quote"]
                                }
                            }
                        },
                        "required": ["title", "body", "priority", "rationale", "sources"]
                    }
                }
            },
            "required": ["rules"]
        }
        
        for filepath in files:
            try:
                print(f"Processing {filepath}...")
                content = self.read_file(filepath)
                result = self.call_openai(extraction_prompt, content, schema)
                
                for rule_data in result.get('rules', []):
                    rule = Rule(
                        id=f"rule-{rule_counter}",
                        title=rule_data['title'],
                        body=rule_data['body'],
                        priority=rule_data['priority'],
                        rationale=rule_data['rationale'],
                        source_file=Path(filepath).name,
                        sources=rule_data['sources']
                    )
                    all_rules.append(asdict(rule))
                    rule_counter += 1
                    
            except Exception as e:
                print(f"Error processing {filepath}: {e}")
        
        Path(output).write_text(json.dumps({"rules": all_rules}, indent=2))
        print(f"Extracted {len(all_rules)} rules to {output}")
    
    def consolidate_rules(self, input_file: str, output_file: str):
        print(f"Consolidating rules from {input_file}...")
        
        data = json.loads(Path(input_file).read_text())
        rules = data.get('rules', [])
        
        consolidation_prompt = """Suggest deletes and merges to remove duplicates and generalize rules where appropriate."""
        
        schema = {
            "type": "object",
            "properties": {
                "edits": {
                    "type": "array",
                    "items": {
                        "anyOf": [
                            {
                                "type": "object",
                                "properties": {
                                    "edit": {"type": "string", "const": "delete"},
                                    "ids": {"type": "array", "items": {"type": "string"}},
                                    "reason": {"type": "string"}
                                },
                                "required": ["edit", "ids", "reason"]
                            },
                            {
                                "type": "object",
                                "properties": {
                                    "edit": {"type": "string", "const": "merge"},
                                    "ids": {"type": "array", "items": {"type": "string"}},
                                    "title": {"type": "string"},
                                    "body": {"type": "string"},
                                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                                    "rationale": {"type": "string"},
                                    "reason": {"type": "string"}
                                },
                                "required": ["edit", "ids", "title", "body", "priority", "rationale", "reason"]
                            }
                        ]
                    }
                }
            },
            "required": ["edits"]
        }
        
        result = self.call_openai(consolidation_prompt, json.dumps(rules), schema)
        edits = result.get('edits', [])
        
        # Apply edits
        rule_lookup = {rule['id']: rule for rule in rules}
        to_delete = set()
        new_rules = []
        
        for edit in edits:
            if edit['edit'] == 'delete':
                to_delete.update(edit['ids'])
            elif edit['edit'] == 'merge':
                to_delete.update(edit['ids'])
                # Merge sources from all rules
                merged_sources = []
                for rule_id in edit['ids']:
                    if rule_id in rule_lookup:
                        merged_sources.extend(rule_lookup[rule_id].get('sources', []))
                
                new_rule = {
                    'id': f"merged-{len(new_rules)}",
                    'title': edit['title'],
                    'body': edit['body'],
                    'priority': edit['priority'],
                    'rationale': edit['rationale'],
                    'source_file': 'consolidated',
                    'sources': merged_sources
                }
                new_rules.append(new_rule)
        
        # Keep rules not marked for deletion and add new merged rules
        final_rules = [rule for rule in rules if rule['id'] not in to_delete] + new_rules
        
        Path(output_file).write_text(json.dumps({"rules": final_rules}, indent=2))
        print(f"Consolidated {len(rules)} rules to {len(final_rules)} rules in {output_file}")
    
    def validate_document(self, rules_file: str, document: str):
        print(f"Validating {document} against rules in {rules_file}...")
        
        rules_data = json.loads(Path(rules_file).read_text())
        rules = rules_data.get('rules', [])
        content = self.read_file(document)
        
        validation_prompt = f"""Validate the provided document against each rule. For each rule, determine if the document passes, fails, or if it's unknown/unclear.

Return a validation result for each rule with:
- id: the rule identifier  
- result: "pass" if compliant, "fail" if violates rule, "unknown" if unclear, "n/a" if not applicable
- reason: brief explanation citing specific parts of the document

Rules to validate against:
{json.dumps(rules)}"""
        
        schema = {
            "type": "object",
            "properties": {
                "validations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "result": {"type": "string", "enum": ["pass", "fail", "n/a", "unknown"]},
                            "reason": {"type": "string"}
                        },
                        "required": ["id", "result", "reason"]
                    }
                }
            },
            "required": ["validations"]
        }
        
        result = self.call_openai(validation_prompt, content, schema)
        validations = result.get('validations', [])
        
        # Print results
        print(f"\nValidation Results for {Path(document).name}:")
        print("-" * 50)
        
        for validation in validations:
            rule = next((r for r in rules if r['id'] == validation['id']), None)
            if rule:
                status_color = {'pass': '✅', 'fail': '❌', 'n/a': '⚪', 'unknown': '❓'}
                print(f"{status_color.get(validation['result'], '?')} {rule['title']}")
                print(f"   Result: {validation['result'].upper()}")
                print(f"   Reason: {validation['reason']}")
                print()

def main():
    parser = argparse.ArgumentParser(description="Policy as Code CLI")
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Config command
    config_parser = subparsers.add_parser('config', help='Configure API settings')
    config_parser.add_argument('--api-key', help='OpenAI API key')
    config_parser.add_argument('--base-url', help='API base URL')
    
    # Extract command
    extract_parser = subparsers.add_parser('extract', help='Extract rules from documents')
    extract_parser.add_argument('-o', '--output', required=True, help='Output JSON file')
    extract_parser.add_argument('files', nargs='+', help='Input documents')
    
    # Consolidate command
    consolidate_parser = subparsers.add_parser('consolidate', help='Consolidate rules')
    consolidate_parser.add_argument('-i', '--input', required=True, help='Input rules JSON file')
    consolidate_parser.add_argument('-o', '--output', required=True, help='Output consolidated JSON file')
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate document against rules')
    validate_parser.add_argument('-r', '--rules', required=True, help='Rules JSON file')
    validate_parser.add_argument('document', help='Document to validate')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    pac = PolicyAsCode()
    
    try:
        if args.command == 'config':
            if args.api_key:
                pac.config['api_key'] = args.api_key
            if args.base_url:
                pac.config['base_url'] = args.base_url
            pac.save_config()
            print("Configuration saved!")
            
        elif args.command == 'extract':
            pac.extract_rules(args.files, args.output)
            
        elif args.command == 'consolidate':
            pac.consolidate_rules(args.input, args.output)
            
        elif args.command == 'validate':
            pac.validate_document(args.rules, args.document)
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()