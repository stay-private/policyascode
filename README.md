# Policy as Code

**Transform complex policy documents into clear, actionable rules automatically.**

Policy as Code is an AI-powered web application that helps organizations extract atomic, testable rules from their policy documents and validate compliance against those rules. Perfect for compliance teams, HR departments, legal teams, and auditors who need to ensure consistent policy enforcement across their organizations.

## 🚀 Live Demo

Visit **[https://sanand0.github.io/policyascode/](https://sanand0.github.io/policyascode/)** to try it now!

## ✨ What It Does

- **Extract Rules**: Upload policy documents (.txt, .md, .pdf) and automatically extract specific, testable rules
- **Consolidate**: Remove duplicate rules and merge similar ones for cleaner governance
- **Validate**: Check any document against your extracted rules to ensure compliance
- **Privacy First**: Everything runs client-side in your browser - no data leaves your machine

## 🎯 Use Cases

- **Employee Handbooks**: Extract actionable guidelines from HR policies
- **Regulatory Compliance**: Break down complex regulations into checkable rules
- **Quality Standards**: Convert quality documentation into testable requirements
- **Governance Documentation**: Transform any policy into enforceable rules

## 🔧 How to Use

1. Click the **"Config"** button in the Advanced settings and enter your OpenAI API base URL and API key (stored in browser, not sent anywhere). Select your preferred model (defaults to gpt-4.1-mini).
2. **Upload** your policy documents using the file input or URL textarea
3. **Click "Ingest"** to extract atomic rules from each document
4. **Click "Consolidate"** to remove duplicates and merge similar rules
5. **Validate** any document against your extracted rules instantly

All extracted rules persist in your browser's local storage for future use.

## Setup

```
/
├── index.html        # Main application interface
├── script.js         # Application logic
├── components.js     # UI components
```

Clone the repository and run a HTTP server:

```bash
git clone https://github.com/sanand0/policyascode.git
cd policyascode
npx serve .   # Access via http://localhost:3000
```

### Key Features Implementation

File Processing:

- **PDF**: Uses browser's built-in PDF.js or external libraries
- **Text/Markdown**: Direct text processing
- **URLs**: Fetch and process remote documents

AI Integration:

- **Streaming Responses**: Real-time rule extraction with visual feedback
- **Prompt Engineering**: Configurable prompts for extraction, consolidation, and validation
- **Model Selection**: Support for various OpenAI models

Data Persistence:

- **Local Storage**: All rules and settings persist browser-side
- **Export/Import**: Rules can be exported as JSON
- **Privacy**: No server-side data storage

Edit the textarea fields in the Advanced settings to customize:

- **Extraction Prompt**: How rules are extracted from documents
- **Consolidation Prompt**: How duplicate rules are merged
- **Validation Prompt**: How documents are validated against rules

Styling:

- Modify CSS in `<style>` section of `index.html`
- Bootstrap variables can be overridden
- Dark/light theme support included

Update the `#model-list` datalist to add new AI models:

```html
<datalist id="model-list">
  <option value="your-new-model"></option>
</datalist>
```

The application auto-deploys to GitHub Pages from the main branch.

Security Considerations:

- API keys stored in localStorage (consider security implications)
- No server-side processing (reduces attack surface)
- CORS considerations for URL-based document fetching
- Content Security Policy recommended for production

### License

[MIT](LICENSE)
