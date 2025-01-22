import { requestUrl, Plugin, WorkspaceLeaf, MarkdownView, TFile, Notice, App, Setting, PluginSettingTab, addIcon } from 'obsidian';

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
  private targetFolderPath: string = '';

  /* 
   * ============ 1. Web API 读取文本的方法 =============
   */
  private async readClipboardTextWebApi(): Promise<string> {
    try {
      const text = await navigator.clipboard.readText();
      return text;
    } catch (error) {
      console.error("Failed to read text from navigator.clipboard:", error);
      return "";
    }
  }

  /*
   * ============ 2. Web API 读取图片(base64)的方法 =============
   *   1) navigator.clipboard.read() 拿到 ClipboardItem[]
   *   2) item.getType("image/png") => Blob
   *   3) FileReader 读 Blob => dataURL => base64
   */
  private async readClipboardImageBase64WebApi(): Promise<string | null> {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            return await this.blobToBase64(blob);
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to read image from clipboard (Web API):", error);
      return null;
    }
  }

  // Blob 转为 base64 (不含 "data:image/png;base64," 前缀，只返回纯base64主体)
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result 形如: "data:image/png;base64,iVBOR..."
        const dataUrl = reader.result as string;
        // 拆掉 data:xxx;base64, 前缀，只取后面纯base64
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ============= 工具方法：获取文件夹路径 ==============
  private getFolderPath(filePath: string): string {
    const parts = filePath.split('/');
    if (parts.length <= 1) {
      return ''; 
    }
    parts.pop(); 
    return parts.join('/');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async createFolderIfNotExists(folderPath: string): Promise<void> {
    if (!folderPath) return; 
    try {
      const folderExists = await this.app.vault.adapter.exists(folderPath);
      if (!folderExists) {
        await this.app.vault.createFolder(folderPath);
      }
    } catch (error) {
      console.log(`createFolderIfNotExists: ${folderPath} 创建异常或已存在`, error);
    }
  }

  async onload() {
    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    await this.loadSettings();

    addIcon('gpt', `
      <path d="M31.7,36.9h12.1l4.6,8c0.3,0.5,0.9,0.9,1.5,0.9c0.6,0,1.2-0.3,1.5-0.9l4.6-8h12.1c7.9,0,14.3-6.4,14.3-14.3c0-7.9-6.4-14.3-14.3-14.3H31.7c-7.9,0-14.3,6.4-14.3,14.3C17.4,30.5,23.8,36.9,31.7,36.9z M31.7,11.8h36.5c6,0,10.8,4.8,10.8,10.8s-4.8,10.8-10.8,10.8H55.1c-0.6,0-1.2,0.3-1.5,0.9L50,40.5l-3.6-6.2c-0.3-0.5-0.9-0.9-1.5-0.9H31.7c-6,0-10.8-4.8-10.8-10.8S25.8,11.8,31.7,11.8z"/>
      <circle cx="36.6" cy="22.9" r="3.6"/>
      <circle cx="50" cy="22.9" r="3.6"/>
      <circle cx="63.4" cy="22.9" r="3.6"/>
      <path d="M73.5,61.7l2.3-5.8c0.3,0.1,0.7,0.1,1,0.1c3.7,0,6.7-3,6.7-6.7s-3-6.7-6.7-6.7s-6.7,3-6.7,6.7c0,2.1,1,4,2.5,5.2l-2,5c-5.9-4.2-13-6.7-20.7-6.7c-7.6,0-14.8,2.4-20.7,6.7l-2-5c1.5-1.2,2.5-3.1,2.5-5.2c0-3.7-3-6.7-6.7-6.7s-6.7,3-6.7,6.7s3,6.7,6.7,6.7c0.3,0,0.7,0,1-0.1l2.3,5.8C20.4,67,16,74.5,14.4,83c-0.4,2.2,0.2,4.4,1.6,6.1c1.4,1.7,3.5,2.6,5.7,2.6h56.7c2.2,0,4.3-1,5.7-2.6c1.4-1.7,2-3.9,1.6-6.1C84,74.5,79.6,67.1,73.5,61.7z M76.9,46c1.8,0,3.2,1.4,3.2,3.2s-1.4,3.2-3.2,3.2c-1.8,0-3.2-1.4-3.2-3.2S75.1,46,76.9,46z M19.9,49.2c0-1.8,1.4-3.2,3.2-3.2s3.2,1.4,3.2,3.2s-1.4,3.2-3.2,3.2S19.9,51,19.9,49.2z M81.3,86.8c-0.7,0.9-1.8,1.4-2.9,1.4H21.7c-1.1,0-2.2-0.5-2.9-1.4c-0.7-0.9-1-2-0.8-3.2C20.8,67.8,34.3,56.3,50,56.3c15.7,0,29.2,11.5,32.1,27.4C82.3,84.8,82,86,81.3,86.8z"/>
      <path d="M37.6,67.6c-3.2,0-5.7,2.6-5.7,5.7c0,3.2,2.6,5.7,5.7,5.7c3.2,0,5.7-2.6,5.7-5.7C43.3,70.2,40.8,67.6,37.6,67.6z M37.6,75.6c-1.2,0-2.2-1-2.2-2.2c0-1.2,1-2.2,2.2-2.2c1.2,0,2.2,1,2.2,2.2C39.8,74.6,38.8,75.6,37.6,75.6z"/>
      <path d="M62.4,67.6c-3.2,0-5.7,2.6-5.7,5.7c0,3.2,2.6,5.7,5.7,5.7c3.2,0,5.7-2.6,5.7-5.7C68.2,70.2,65.6,67.6,62.4,67.6z M62.4,75.6c-1.2,0-2.2-1-2.2-2.2c0-1.2,1-2.2,2.2-2.2c1.2,0,2.2,1,2.2,2.2C64.6,74.6,63.6,75.6,62.4,75.6z"/>
    `);

    this.addRibbonIcon("gpt", "Create a new note", async () => {
      await this.WordCardMain();
    });

    this.addCommand({
      id: 'get-clipboard-content',
      name: 'Get clipboard content, query GPT, and create a new note',
      callback: async () => { await this.WordCardMain(); },
    });

    this.addSettingTab(new WordCardSettingTab(this.app, this));
  }

  // =============================================
  // =========== 主逻辑：创建/处理WordCard ==========
  // =============================================
  private async WordCardMain() {
    this.targetFolderPath = this.settings.targetFolderPath;

    // 先尝试读取文本
    const textClip = await this.readClipboardTextWebApi(); 

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      // 如果没有当前打开文件
      if (!textClip) {
        // 如果连文本都没有，则尝试图片
        const imageUrl = await this.getimgurl(); 
        if (!imageUrl) {
          new Notice("剪贴板里没有图片或图片读取失败");
          return;
        }
        const result = await this.analyzeImageLink(imageUrl);
        if (!result) return;

        const wordName = result.split("|")[0].toUpperCase().trim();
        const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
        const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

        await this.createFolderIfNotExists(this.getFolderPath(vaultPath));
        const imgurl = "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;

        await this.createOrAppendFile(vaultPath, wordName, imgurl);
      } else {
        // 有文本 => 直接新建文件
        await this.createNewNotefromtext(textClip);
      }
      return;
    }

    // 有激活文件
    const fileExt = this.getFileExt(activeFile);
    if (fileExt === 'pdf') {
      await this.processPdfFile(textClip);
    } else if (fileExt === 'md') {
      await this.processMarkdownFile(activeFile, textClip);
    } else {
      console.warn('不支持此类型文件，将直接根据剪贴板创建新文档。');
      if (!textClip) {
        // 再试试图片
        const imageUrl = await this.getimgurl(); 
        if (!imageUrl) {
          new Notice("剪贴板里没有文本或图片");
          return;
        }
        const result = await this.analyzeImageLink(imageUrl);
        if (!result) return;

        const wordName = result.split("|")[0].toUpperCase().trim();
        const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
        const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

        await this.createFolderIfNotExists(this.getFolderPath(vaultPath));
        const imgurl = "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;
        await this.createOrAppendFile(vaultPath, wordName, imgurl);
      } else {
        // 有文本
        await this.createNewNotefromtext(textClip);
      }
    }
  }

  private getFileExt(activeFile: TFile): string {
    const fileName = activeFile?.name || '';
    const segments = fileName.split('.');
    return segments.length > 1 ? segments[segments.length - 1].toLowerCase() : '';
  }

  // ================ 打开文件到特定面板 ================
  private async openFile(filePath: string, mode: string = 'right'): Promise<void> {
    if (!this.settings.exist) {
      // 不覆盖
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file && file instanceof TFile) {
        if (mode === 'left') {
          const leaf = this.app.workspace.getLeftLeaf(true);
          await leaf.openFile(file);
          if (this.settings.active) await this.app.workspace.revealLeaf(leaf);
        } else if (mode === 'right') {
          const leaf = this.app.workspace.getRightLeaf(true);
          await leaf.openFile(file);
          if (this.settings.active) await this.app.workspace.revealLeaf(leaf);
        } else if (mode === 'window') {
          const leaf = this.app.workspace.getLeaf("split");
          await leaf.openFile(file);
          if (this.settings.active) await this.app.workspace.revealLeaf(leaf);
        } else if (mode === 'none') {
          return;
        } else if (mode === 'active') {
          const leaf = this.app.workspace.getLeaf();
          await leaf.openFile(file);
          if (this.settings.active) await this.app.workspace.revealLeaf(leaf);
        } else if (mode === 'tab') {
          const leaf = this.app.workspace.getLeaf("tab");
          await leaf.openFile(file);
          if (this.settings.active) await this.app.workspace.revealLeaf(leaf);
        }

        new Notice(`Opened file: ${filePath}`);
      } else {
        new Notice(`File not found: ${filePath}`);
      }
    } else {
      // 允许“覆盖”模式 => 找已存在的 word- 打头卡片
      mode = mode.trim();
      const file = this.app.vault.getAbstractFileByPath(filePath);

      if (file && file instanceof TFile) {
        let targetLeaf: WorkspaceLeaf | null = null;
        this.app.workspace.iterateAllLeaves(leaf => {
          const view = leaf.view;
          if (view instanceof MarkdownView) {
            const currentFile = view.file;
            if (currentFile && currentFile.basename.startsWith('word-')) {
              if (!targetLeaf) targetLeaf = leaf;
            }
          }
        });

        if (!targetLeaf) {
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
              return;
            default:
              new Notice(`Unknown mode: ${mode}`);
              return;
          }
        }

        if (targetLeaf) {
          try {
            await targetLeaf.openFile(file);
            if (this.settings.active) {
              await this.app.workspace.revealLeaf(targetLeaf);
            }
            new Notice(`Opened file: ${filePath}`);
          } catch (error) {
            console.error(`Cannot open file in leaf: ${filePath}`, error);
            new Notice(`Cannot open file: ${filePath}`);
          }
        } else {
          new Notice(`Cannot open file: ${filePath}`);
        }
      } else {
        new Notice(`File not found: ${filePath}`);
      }
    }
  }

  // ================== 处理 PDF 文件 ==================
  private async processPdfFile(clipboardText: string) {
    try {
      if (!clipboardText) {
        // 没有文本 => 当作图片
        const imageUrl = await this.getimgurl();
        if (!imageUrl) {
          new Notice("没有文本，也没有读取到图片");
          return;
        }
        const result = await this.analyzeImageLink(imageUrl);
        if (!result) return;

        const wordName = result.split("|")[0].toUpperCase().trim();
        const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
        const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

        await this.createFolderIfNotExists(this.getFolderPath(vaultPath));
        const imgurl = "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;
        await this.createOrAppendFile(vaultPath, wordName, imgurl);
        return;
      }

      // 如果有文本，假设格式: xxx>xxx>[someText|wordName]
      const sections = clipboardText.split('>');
      if (sections.length < 3) {
        console.error('Clipboard content format incorrect.');
        return;
      }
      const regex = /\[([^\|\]]+)\|([^\]]+)\]/;
      const match = regex.exec(sections[2]);
      if (!match || match.length < 3) {
        console.error('Did not match [xxx|word] format.');
        return;
      }

      const wordName = match[2].toUpperCase().trim();
      const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
      const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

      await this.createFolderIfNotExists(this.getFolderPath(vaultPath));
      const newContent = `\n\n---\n\n${clipboardText.split("|")[0]}|${clipboardText.split("|")[1]}|${match[1].split("#")[0]}]]`;
      await this.createOrAppendFile(vaultPath, wordName, newContent);
    } catch (err) {
      console.error('Error processing PDF file:', err);
      new Notice('Error processing PDF file, please check the console.');
    }
  }

  // ============= 处理 Markdown 文件 ==============
  private async processMarkdownFile(activeFile: TFile, textClip: string) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !activeFile) {
      console.error('Cannot get Markdown view or active file.');
      return;
    }

    const editor = view.editor;
    const selectedText = editor.getSelection().trim();
    if (!selectedText) {
      // 选区为空 => 当作图片
      const imageUrl = await this.getimgurl();
      if (!imageUrl) {
        new Notice("没有选中文本，也没有读取到图片");
        return;
      }
      const result = await this.analyzeImageLink(imageUrl);
      if (!result) return;

      const wordName = result.split("|")[0].toUpperCase().trim();
      const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
      const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

      await this.createFolderIfNotExists(this.getFolderPath(vaultPath));
      const imgurl = "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;
      await this.createOrAppendFile(vaultPath, wordName, imgurl);
      return;
    }

    // 如果有选中文本 => [[word-xxx|xxx]]
    await editor.replaceSelection(`[[word-${this.settings.sourceLanguage}-${selectedText}|${editor.getSelection()}]]`);
    const wordName = selectedText.toUpperCase().trim();

    const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
    const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

    await this.createFolderIfNotExists(this.getFolderPath(vaultPath));

    const existingFile = this.app.vault.getAbstractFileByPath(vaultPath);
    if (!existingFile) {
      const gptResult = await this.queryGPTAboutWord(wordName);
      await this.app.vault.create(vaultPath, gptResult);
    }
    await this.openFile(vaultPath, this.settings.openMode);
  }

  // ================== 调用GPT生成内容 ==================
  private async queryGPTAboutWord(word: string): Promise<string> {
    new Notice(`Generating card content for ${word}, please wait...`, 5000);
    try {
      const apiUrl = 'https://api.openai.com/v1/chat/completions';
      const promptMessages = [
        {
          role: 'system',
          content: `You are a dictionary that provides comprehensive and authoritative word information. Avoid small talk and unnecessary replies, Respond in ${this.settings.targetLanguage}`
        },
        {
          role: 'user',
          content: `Please analyze the word ${word} and output in the following format. Output format: ${this.settings.prompt}`
        }
      ];

      const response = await requestUrl({
        url: apiUrl,
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

      if (!response.json) {
        const errorText = await response.text;
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const jsonData = await response.json;
      const gptAnswer: string = jsonData.choices?.[0]?.message?.content?.trim() || 'No response';
      new Notice(`Card content for ${word} has been generated.`);
      return gptAnswer;
    } catch (error) {
      console.error('Failed to call GPT API:', error);
      new Notice(`Generation failed: ${error.message}`);
      return 'Error retrieving information from GPT.';
    }
  }

  // ================== 调用GPT分析图片 ==================
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
      const response = await requestUrl({
        url: url,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
      if (!response.json) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json;
      return data.choices[0].message.content;
    } catch (error) {
      console.error("Error fetching response:", error);
      new Notice(`Generation failed: ${error.message}`);
    }
  }

  // ================== 新建或追加内容 ==================
  private async createOrAppendFile(filePath: string, wordName: string, appendContent?: string) {
    const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
    if (abstractFile && abstractFile instanceof TFile) {
      const oldContent = await this.app.vault.read(abstractFile);
      const newContent = oldContent + (appendContent || '');
      await this.app.vault.modify(abstractFile, newContent);
      new Notice(`File updated: ${filePath}`);
    } else {
      const gptResult = await this.queryGPTAboutWord(wordName);
      const content = gptResult + (appendContent || '');
      await this.app.vault.create(filePath, content);
      new Notice(`File created: ${filePath}`);
    }
    await this.openFile(filePath, this.settings.openMode);
  }

  // =============== 用“Web API”读剪贴板做笔记 (文字) ===============
  private async createNewNotefromtext(textClip: string) {
    const wordName = textClip.toUpperCase().trim();
    const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
    const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

    await this.createFolderIfNotExists(this.getFolderPath(vaultPath));

    const existingFile = this.app.vault.getAbstractFileByPath(vaultPath);
    if (!existingFile) {
      const gptResult = await this.queryGPTAboutWord(wordName);
      await this.app.vault.create(vaultPath, gptResult);
      new Notice(`New file created: ${vaultPath}`);
    }
    await this.openFile(vaultPath, this.settings.openMode);
    return;
  }

  // =============== 用“Web API”读剪贴板做笔记 (图片) ===============
  private async getimgurl(): Promise<string | null> {
    // 原先用 electron.clipboard 读图 => 改成 Web API
    console.error('Trying to read image from navigator.clipboard ...');
    const base64 = await this.readClipboardImageBase64WebApi();
    if (!base64) {
      return null;
    }

    // 上传到 Imgur
    try {
      const response = await requestUrl({
        url: 'https://api.imgur.com/3/image',
        method: 'POST',
        headers: {
          Authorization: `Client-ID ${this.settings.clientId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64, // Base64 数据
          type: 'base64',
        }),
      });
      const data = await response.json;
      const imageUrl = data.data.link;
      new Notice(`Image uploaded to Imgur: ${imageUrl}`, 5000);
      return imageUrl;
    } catch (error) {
      console.error("Error uploading to Imgur:", error);
      return null;
    }
  }
}

// ================ 设置页 ================
export class WordCardSettingTab extends PluginSettingTab {
  plugin: WordCards;

  constructor(app: App, plugin: WordCards) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

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
      .setDesc('基于当前 Vault 的相对路径，例如: Library/English/words')
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
      .setDesc('用于调用 GPT 接口')
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
      .setDesc('模型名称')
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
      .setDesc('用于调用 Imgur API')
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
      .setDesc('新建文件后在哪里打开')
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
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Set as Active')
      .setDesc('创建卡片后是否在工作区里激活它')
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
      .setDesc('如果已存在 word- 开头的卡片，是否覆盖打开还是单独新建')
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
      .setDesc('设置自定义 Prompt')
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
        