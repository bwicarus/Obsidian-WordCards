import { clipboard } from 'electron';
import { Plugin, WorkspaceLeaf, FileSystemAdapter, MarkdownView, TFile, Notice, App, Setting, PluginSettingTab, addIcon } from 'obsidian';
import * as path from 'path';

// We no longer use Node's native fs for writing, so removed import fs from 'fs';
// Instead, use the Vault API to manipulate files

interface WordCardSettings {
  targetFolderPath: string;
  apiKey: string;
  clientId: string;
  targetLanguage: string;
  sourceLanguage: string;
  openMode: string;
  active: boolean;
  exist: boolean;
  prompt: string;
  model: string;
}

const DEFAULT_SETTINGS: Partial<WordCardSettings> = {
  targetFolderPath: '',
  apiKey: '',
  clientId: '',
  targetLanguage: 'Chinese',
  sourceLanguage: 'English',
  openMode: 'right',
  active: true,
  exist: false,
  model: 'gpt-4o',
  prompt: "## Translation\nThe inflection and translation of the word\n## Phonetics\nPhonetic transcription of the word\n## Example Sentences\nTwo to three example sentences and their translations\n## Roots and Affixes\nInformation about roots and affixes"
};

export default class WordCards extends Plugin {
  settings: WordCardSettings;
  private targetFolderPath: string = ''; // Used to store "vault internal relative path"

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Added a helper method to create the folder if it doesn't exist
  private async createFolderIfNotExists(folderPath: string): Promise<void> {
    // Note that folderPath is also a relative path, e.g., "Library/English/words/en"
    try {
      // First check if folderPath exists
      const folderExists = await this.app.vault.adapter.exists(folderPath);
      if (!folderExists) {
        await this.app.vault.createFolder(folderPath);
      }
    } catch (error) {
      // If the folder already exists or cannot be created, an exception is thrown. We simply ignore it here.
      console.log(`createFolderIfNotExists: Folder already exists or cannot be created: ${folderPath}`, error);
    }
  }

  async onload() {
    await this.loadSettings();

    addIcon('gpt', `
      <path d="M31.7,36.9h12.1l4.6,8c0.3,0.5,0.9,0.9,1.5,0.9c0.6,0,1.2-0.3,1.5-0.9l4.6-8h12.1c7.9,0,14.3-6.4,14.3-14.3c0-7.9-6.4-14.3-14.3-14.3H31.7c-7.9,0-14.3,6.4-14.3,14.3C17.4,30.5,23.8,36.9,31.7,36.9z M31.7,11.8h36.5c6,0,10.8,4.8,10.8,10.8s-4.8,10.8-10.8,10.8H55.1c-0.6,0-1.2,0.3-1.5,0.9L50,40.5l-3.6-6.2c-0.3-0.5-0.9-0.9-1.5-0.9H31.7c-6,0-10.8-4.8-10.8-10.8S25.8,11.8,31.7,11.8z"/>
     <circle cx="36.6" cy="22.9" r="3.6"/>
     <circle cx="50" cy="22.9" r="3.6"/>
     <circle cx="63.4" cy="22.9" r="3.6"/>
     <path d="M73.5,61.7l2.3-5.8c0.3,0.1,0.7,0.1,1,0.1c3.7,0,6.7-3,6.7-6.7s-3-6.7-6.7-6.7s-6.7,3-6.7,6.7c0,2.1,1,4,2.5,5.2l-2,5c-5.9-4.2-13-6.7-20.7-6.7c-7.6,0-14.8,2.4-20.7,6.7l-2-5c1.5-1.2,2.5-3.1,2.5-5.2c0-3.7-3-6.7-6.7-6.7s-6.7,3-6.7,6.7s3,6.7,6.7,6.7c0.3,0,0.7,0,1-0.1l2.3,5.8C20.4,67,16,74.5,14.4,83c-0.4,2.2,0.2,4.4,1.6,6.1c1.4,1.7,3.5,2.6,5.7,2.6h56.7c2.2,0,4.3-1,5.7-2.6c1.4-1.7,2-3.9,1.6-6.1C84,74.5,79.6,67.1,73.5,61.7z M76.9,46c1.8,0,3.2,1.4,3.2,3.2s-1.4,3.2-3.2,3.2c-1.8,0-3.2-1.4-3.2-3.2S75.1,46,76.9,46z M19.9,49.2c0-1.8,1.4-3.2,3.2-3.2s3.2,1.4,3.2,3.2s-1.4,3.2-3.2,3.2S19.9,51,19.9,49.2z M81.3,86.8c-0.7,0.9-1.8,1.4-2.9,1.4H21.7c-1.1,0-2.2-0.5-2.9-1.4c-0.7-0.9-1-2-0.8-3.2C20.8,67.8,34.3,56.3,50,56.3c15.7,0,29.2,11.5,32.1,27.4C82.3,84.8,82,86,81.3,86.8z"/>
     <path d="M37.6,67.6c-3.2,0-5.7,2.6-5.7,5.7c0,3.2,2.6,5.7,5.7,5.7c3.2,0,5.7-2.6,5.7-5.7C43.3,70.2,40.8,67.6,37.6,67.6z M37.6,75.6c-1.2,0-2.2-1-2.2-2.2c0-1.2,1-2.2,2.2-2.2c1.2,0,2.2,1,2.2,2.2C39.8,74.6,38.8,75.6,37.6,75.6z"/>
     <path d="M62.4,67.6c-3.2,0-5.7,2.6-5.7,5.7c0,3.2,2.6,5.7,5.7,5.7c3.2,0,5.7-2.6,5.7-5.7C68.2,70.2,65.6,67.6,62.4,67.6z M62.4,75.6c-1.2,0-2.2-1-2.2-2.2c0-1.2,1-2.2,2.2-2.2c1.2,0,2.2,1,2.2,2.2C64.6,74.6,63.6,75.6,62.4,75.6z"/>
     
     
     `
     );

    this.addRibbonIcon("gpt", "Create a new note", async () => {
      await this.WordCardMain();
    });

    // Add command
    this.addCommand({
      id: 'get-clipboard-content',
      name: 'Get clipboard content, query GPT, and create a new note',
      callback: async () => { await this.WordCardMain(); },
    });

    // Add settings page
    this.addSettingTab(new WordCardSettingTab(this.app, this));
  }

  private async WordCardMain() {
    // Get Obsidian's Vault root directory (useful if you need the physical disk path),
    // but use relative paths for file operations
    const fsAdapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultRoot = fsAdapter.getBasePath();

    // Use the user-defined targetFolderPath as a "relative path"
    this.targetFolderPath = this.settings.targetFolderPath;

    // Get the currently active file
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      // No file is currently open
      console.warn('No file is currently open.');
      // Check if the clipboard has text
      if (!clipboard.readText()) {
        // If there's no text, attempt to handle it as an image
        const imageUrl = await this.getimgurl();
        const result = await this.analyzeImageLink(imageUrl);
        console.log(result);

        const wordName = result.split("|")[0].toUpperCase().trim();
        const contentPart = result.split("|")[1] + "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;

        // Construct relative path: this.targetFolderPath + sourceLanguage + filename
        const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
        const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

        // Ensure the folder exists
        await this.createFolderIfNotExists(path.dirname(vaultPath));
        const imgurl = "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;
        // Create or append to the file
        await this.createOrAppendFile(vaultPath, wordName, imgurl);
        return;
      } else {
        // If there's no active file but the clipboard has text, create directly
        await this.createNewNotefromtext();
      }
      return;
    }

    // If there is an active file
    const fileExt = this.getFileExt(activeFile);
    if (fileExt === 'pdf') {
      console.log(`Current active file: ${activeFile.name} is a PDF file`);
      await this.processPdfFile();
    } else if (fileExt === 'md') {
      console.log(`Current active file: ${activeFile.name} is a Markdown file`);
      await this.processMarkdownFile(activeFile);
    } else {
      console.warn('The current active file type is not supported.');
      await this.createNewNotefromtext();
    }
  }

  private getFileExt(activeFile: TFile): string {
    const fileName = activeFile?.name || '';
    const segments = fileName.split('.');
    return segments.length > 1 ? segments[segments.length - 1].toLowerCase() : '';
  }

  private async openFile(filePath: string, mode: string = 'right'): Promise<void> {
    if (!this.settings.exist) {
      // If not overlapping cards

      console.log(`Attempting to open: ${filePath}`);
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file && file instanceof TFile) {
        if (mode === 'left') {
          const leaf = this.app.workspace.getLeftLeaf(true);
          await leaf.openFile(file);
          if (this.settings.active) { await this.app.workspace.revealLeaf(leaf); }
        } else if (mode === 'right') {
          const leaf = this.app.workspace.getRightLeaf(true);
          await leaf.openFile(file);
          if (this.settings.active) { await this.app.workspace.revealLeaf(leaf); }

        } else if (mode === 'window') {
          const leaf = this.app.workspace.getLeaf("split");
          await leaf.openFile(file);
          if (this.settings.active) { await this.app.workspace.revealLeaf(leaf); }

        } else if (mode === 'none') {
          return;
        } else if (mode === 'active') {
          const leaf = this.app.workspace.getLeaf();
          await leaf.openFile(file);
          if (this.settings.active) { await this.app.workspace.revealLeaf(leaf); }
        } else if (mode === 'tab') {
          const leaf = this.app.workspace.getLeaf("tab");
          await leaf.openFile(file);
          if (this.settings.active) { await this.app.workspace.revealLeaf(leaf); }
        }

        new Notice(`Opened file: ${filePath}`);

      } else {
        new Notice(`File not found: ${filePath}`);
      }

    } else {
      // Ensure the mode parameter has no leading or trailing spaces
      mode = mode.trim();

      // Log the file path and mode being attempted to open
      console.log(`Attempting to open: ${filePath}, Mode: ${mode}`);

      // Get the file object
      const file = this.app.vault.getAbstractFileByPath(filePath);

      if (file && file instanceof TFile) {
        let targetLeaf: WorkspaceLeaf | null = null;

        // Use iterateAllLeaves to traverse all leaves
        this.app.workspace.iterateAllLeaves(leaf => {
          const view = leaf.view;

          // Check if the current leaf's view is MarkdownView
          if (view instanceof MarkdownView) {
            const currentFile = view.file;

            if (currentFile && currentFile.basename.startsWith('word-')) {
              if (!targetLeaf) { // Only set the first matching leaf
                targetLeaf = leaf;
                console.log(`Found existing 'word-' leaf: ${currentFile.path}`);
                // Since iterateAllLeaves cannot break, we can only record the first leaf found
              }
            }
          } else {
            // If using a custom view type, you can add more checks here
            // For example:
            // if (view.getViewType() === 'your-custom-view-type') {
            //     // Further checks
            // }
          }
        });

        // If no existing 'word-' leaf was found, create a new leaf based on mode
        if (!targetLeaf) {
          console.log(`No existing 'word-' leaf found, creating a new leaf based on mode "${mode}"`);

          switch (mode) {
            case 'left':
              targetLeaf = this.app.workspace.getLeftLeaf(true);
              break;
            case 'right':
              targetLeaf = this.app.workspace.getRightLeaf(true);
              break;
            case 'window':
              targetLeaf = this.app.workspace.getLeaf("split");
              break;
            case 'active':
              targetLeaf = this.app.workspace.getLeaf();
              break;
            case 'tab':
              targetLeaf = this.app.workspace.getLeaf("tab");
              break;
            case 'none':
              new Notice(`Invalid mode: ${mode}`);
              console.warn(`Invalid mode: ${mode}`);
              return;
            default:
              new Notice(`Unknown mode: ${mode}`);
              console.warn(`Unknown mode: ${mode}`);
              return;
          }
        }

        // Open the file in the selected leaf
        if (targetLeaf) {
          try {
            await targetLeaf.openFile(file);
            if (this.settings.active) {
              await this.app.workspace.revealLeaf(targetLeaf);
            }
            new Notice(`Opened file: ${filePath}`);
            console.log(`File opened in leaf: ${filePath}`);
          } catch (error) {
            console.error(`Cannot open file in leaf: ${filePath}`, error);
            new Notice(`Cannot open file: ${filePath}`);
          }
        } else {
          new Notice(`Cannot open file: ${filePath}`);
          console.warn(`Cannot find or create target leaf to open file: ${filePath}`);
        }
      } else {
        new Notice(`File not found: ${filePath}`);
        console.warn(`File not found: ${filePath}`);
      }
    }
  }

  private async processPdfFile(): Promise<void> {
    try {
      const clipboardContent: string = clipboard.readText();
      console.log(clipboardContent);
      if (!clipboardContent) {
        const imageUrl = await this.getimgurl();
        const result = await this.analyzeImageLink(imageUrl);
        console.log(result);

        const wordName = result.split("|")[0].toUpperCase().trim();
        const contentPart = result.split("|")[1] + "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;
        const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
        const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

        await this.createFolderIfNotExists(path.dirname(vaultPath));
        const imgurl = "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;
        await this.createOrAppendFile(vaultPath, wordName, imgurl);
        return;
      }

      // If clipboard has text, assume format: xxx>xxx>[someText|wordName]
      const sections = clipboardContent.split('>');
      if (sections.length < 3) {
        console.error('Clipboard content format is incorrect, unable to find the third section.');
        return;
      }
      // Regex to match format [xxx|word]
      const regex = /\[([^\|\]]+)\|([^\]]+)\]/;
      const match = regex.exec(sections[2]);
      if (!match || match.length < 3) {
        console.error('Did not match [xxx|word] format, please check clipboard content.');
        console.error('Clipboard content:', clipboardContent);
        return;
      }

      const wordName = match[2].toUpperCase().trim();
      const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
      const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

      await this.createFolderIfNotExists(path.dirname(vaultPath));
      // Construct content to append
      const newContent = `\n\n---\n\n${clipboardContent.split("|")[0]}|${clipboardContent.split("|")[1]}|${match[1].split("#")[0]}]]`;

      await this.createOrAppendFile(vaultPath, wordName, newContent);
    } catch (err) {
      console.error('Error processing PDF file:', err);
      new Notice('Error processing PDF file, please check the console.');
    }
  }

  private async processMarkdownFile(activeFile: TFile): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !activeFile) {
      console.error('Cannot get Markdown view or active file.');
      return;
    }

    // Get the currently selected text
    const editor = view.editor;
    const selectedText = editor.getSelection().trim();
    if (!selectedText) {
      // If no text is selected, handle as image
      const imageUrl = await this.getimgurl();
      const result = await this.analyzeImageLink(imageUrl);
      console.log(result);

      const wordName = result.split("|")[0].toUpperCase().trim();
      const contentPart = result.split("|")[1] + "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;
      const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
      const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

      await this.createFolderIfNotExists(path.dirname(vaultPath));
      const imgurl = "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;
      await this.createOrAppendFile(vaultPath, wordName, imgurl);
      return;
    }

    // If text is selected, replace it in the original text with [[word-xx-...|...]]
    await editor.replaceSelection(`[[word-${this.settings.sourceLanguage}-${selectedText}|${selectedText}]]`);
    const wordName = selectedText.toUpperCase().trim();

    const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
    const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

    await this.createFolderIfNotExists(path.dirname(vaultPath));

    // If the file does not exist, create it; otherwise, do nothing (or you can append inside)
    const existingFile = this.app.vault.getAbstractFileByPath(vaultPath);
    if (!existingFile) {
      const gptResult = await this.queryGPTAboutWord(wordName);
      await this.app.vault.create(vaultPath, gptResult);
      console.log(`File created: ${vaultPath}`);
    } else {
      console.log(`File already exists: ${vaultPath}`);
    }

    await this.openFile(vaultPath, this.settings.openMode);
  }

  private async queryGPTAboutWord(word: string): Promise<string> {
    new Notice(`Generating card content for ${word}, please wait...`, 5000);
    try {
      const apiUrl = 'https://api.openai.com/v1/chat/completions';
      const promptMessages = [
        { role: 'system', content: `You are a dictionary that provides comprehensive and authoritative word information. Avoid small talk and unnecessary replies,Respond in ${this.settings.targetLanguage}` },
        {
          role: 'user',
          content: `Please analyze the word ${word} and output in the following format. Output format: ${this.settings.prompt}}`
        }
      ];

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify({
          model: this.settings.model,
          messages: promptMessages,
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const jsonData = await response.json();
      const gptAnswer: string = jsonData.choices?.[0]?.message?.content?.trim() || 'No response';
      new Notice(`Card content for ${word} has been generated.`);
      return gptAnswer;
    } catch (error) {
      console.error('Failed to call GPT API:', error);
      new Notice(`Generation failed: ${error.message}`);
      return 'Error retrieving information from GPT.';
    }
  }

  private async analyzeImageLink(img: string) {
    new Notice(`Analyzing image content, please wait...`, 5000);
    const url = "https://api.openai.com/v1/chat/completions";
    const apiKey = this.settings.apiKey;

    const body = {
      model: this.settings.model,
      messages: [
        { role: 'system', content: "You are a dictionary that provides comprehensive and authoritative word information. Avoid small talk and unnecessary replies." },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describe the main subject or text in the image using an ${this.settings.sourceLanguage} single word. Output format: ${this.settings.sourceLanguage} single word|${this.settings.prompt},Respond in ${this.settings.targetLanguage}`
            },
            {
              type: "image_url",
              image_url: {
                url: img
              }
            }
          ]
        }
      ],
      max_tokens: 300
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("Error fetching response:", error);
      new Notice(`Generation failed: ${error.message}`);
    }
  }

  private async createOrAppendFile(filePath: string, wordName: string, appendContent?: string) {
    // First check if the file exists
    const abstractFile = this.app.vault.getAbstractFileByPath(filePath);

    if (abstractFile && abstractFile instanceof TFile) {
      // If the file exists, read and append
      const oldContent = await this.app.vault.read(abstractFile);
      const newContent = oldContent + (appendContent || '');
      await this.app.vault.modify(abstractFile, newContent);
      console.log(`File updated: ${filePath}`);
      new Notice(`File updated: ${filePath}`);
    } else {
      // If the file does not exist, create a new one
      const gptResult = await this.queryGPTAboutWord(wordName);
      const content = gptResult + (appendContent || '');
      await this.app.vault.create(filePath, content);
      console.log(`File created: ${filePath}`);
      new Notice(`File created: ${filePath}`);
    }

    // Open the file
    await this.openFile(filePath, this.settings.openMode);
  }

  private async getimgurl() {
    console.error('Clipboard is empty or cannot read text content, attempting to handle as image.');
    const img = clipboard.readImage().toDataURL().split(",")[1];
    console.log(img);

    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${this.settings.clientId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: img, // Base64 data
        type: 'base64', // Declare data type
      }),
    });
    const data = await response.json();
    console.log(data);
    const imageUrl = data.data.link;
    new Notice(`Image uploaded to Imgur, image URL: ${imageUrl}`, 5000);
    return imageUrl;
  }

  private async createNewNotefromtext() {
    const wordName = clipboard.readText().toUpperCase().trim();
    const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
    const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

    await this.createFolderIfNotExists(path.dirname(vaultPath));

    // Check if the file exists
    const existingFile = this.app.vault.getAbstractFileByPath(vaultPath);
    if (!existingFile) {
      const gptResult = await this.queryGPTAboutWord(wordName);
      await this.app.vault.create(vaultPath, gptResult);
      console.log(`File created: ${vaultPath}`);
      new Notice(`New file created: ${vaultPath}`);
    } else {
      console.log(`File already exists: ${vaultPath}`);
    }
    await this.openFile(vaultPath, this.settings.openMode);
    return;
  }
}

// Settings page
export class WordCardSettingTab extends PluginSettingTab {
  plugin: WordCards;

  constructor(app: App, plugin: WordCards) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty(); // Clear the settings page

    new Setting(containerEl)
      .setName('Source Language')
      .setDesc('Set the language you need to translate.')
      .addDropdown(dropdown =>
        dropdown
        .addOption('Chinese', '中文')
        .addOption('English', 'English')
        .addOption('Japanese', '日本語')
        .addOption('Korean', '한국어')
        .addOption('Spanish', 'Español')
        .addOption('French', 'Français')
        .addOption('German', 'Deutsch')
        .addOption('Russian', 'Русский')
        .addOption('Arabic', 'العربية')
        .addOption('Hindi', 'हिन्दी')
        .addOption('Portuguese', 'Português')
        .addOption('Italian', 'Italiano')
        .addOption('Dutch', 'Nederlands')
        .addOption('Swedish', 'Svenska')
        .addOption('Thai', 'ไทย')
        .addOption('Turkish', 'Türkçe')
        .addOption('Greek', 'Ελληνικά')
        .addOption('Polish', 'Polski')

          .setValue(this.plugin.settings.sourceLanguage)
          .onChange(async (value) => {
            this.plugin.settings.sourceLanguage = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Target Language")
      .setDesc("Set the language for the word cards you want to create.")
      .addDropdown(dropdown =>
        dropdown
        .addOption('Chinese', '中文')
        .addOption('English', 'English')
        .addOption('Japanese', '日本語')
        .addOption('Korean', '한국어')
        .addOption('Spanish', 'Español')
        .addOption('French', 'Français')
        .addOption('German', 'Deutsch')
        .addOption('Russian', 'Русский')
        .addOption('Arabic', 'العربية')
        .addOption('Hindi', 'हिन्दी')
        .addOption('Portuguese', 'Português')
        .addOption('Italian', 'Italiano')
        .addOption('Dutch', 'Nederlands')
        .addOption('Swedish', 'Svenska')
        .addOption('Thai', 'ไทย')
        .addOption('Turkish', 'Türkçe')
        .addOption('Greek', 'Ελληνικά')
        .addOption('Polish', 'Polski')
          .setValue(this.plugin.settings.targetLanguage)
          .onChange(async (value) => {
            this.plugin.settings.targetLanguage = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Target Folder Path for Word Files')
      .setDesc('Save new files in this folder, based on the Obsidian Vault root directory. For example: Library/English/words')
      .addText(text => text
        .setPlaceholder('Enter target folder path')
        .setValue(this.plugin.settings.targetFolderPath)
        .onChange(async (value) => {
          this.plugin.settings.targetFolderPath = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('Used to call the OpenAI API.')
      .addText(text => text
        .setPlaceholder('Enter OpenAI API Key')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
    .setName('model name')
    .setDesc('model name')
    .addDropdown(dropdown =>
      dropdown
        .addOption('gpt-4o', 'gpt-4o')
        .addOption('gpt-4o-mini', 'gpt-4o-mini')
        .setValue(this.plugin.settings.model)
        .onChange(async (value) => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
        })
    );

    new Setting(containerEl)
      .setName('Client ID')
      .setDesc('Used to call the Imgur API.')
      .addText(text => text
        .setPlaceholder('Enter Client ID')
        .setValue(this.plugin.settings.clientId)
        .onChange(async (value) => {
          this.plugin.settings.clientId = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Open Mode')
      .setDesc('Choose where to open the new file')
      .addDropdown(dropdown =>
        dropdown
          .addOption('left', 'Left')
          .addOption('right', 'Right')
          .addOption('window', 'New Window')
          .addOption('active', 'Active')
          .addOption('tab', 'Tab')
          .addOption('none', 'Do Not Open')
          .setValue(this.plugin.settings.openMode)
          .onChange(async (value) => {
            this.plugin.settings.openMode = value;
            await this.plugin.saveSettings();})
      );

    new Setting(containerEl)
      .setName('Set as Active')
      .setDesc('Choose whether to display as active after creating a card')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.active)
          .onChange(async (value) => {
            this.plugin.settings.active = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Allow Overlapping Cards')
      .setDesc('Choose whether to overlap new cards on old ones (if they exist)')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.exist)
          .onChange(async (value) => {
            this.plugin.settings.exist = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Prompt')
      .setDesc('Set your prompt')
      .addTextArea(textarea =>
        textarea
          .setPlaceholder('Enter prompt')
          .setValue(this.plugin.settings.prompt)
          .onChange(async (value) => {
            this.plugin.settings.prompt = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
