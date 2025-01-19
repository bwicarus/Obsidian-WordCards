import { clipboard } from 'electron';
import { Plugin, WorkspaceLeaf,FileSystemAdapter, MarkdownView, TFile, Notice, App, Setting, PluginSettingTab, addIcon } from 'obsidian';
import * as path from 'path';

// 我们不再使用 node 原生的 fs 写入，所以去掉 import fs from 'fs';
// 改为用 Vault API 来操作文件

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

}
const DEFAULT_SETTINGS: Partial<WordCardSettings> = {
  targetFolderPath: '',
  apiKey: '',
  clientId: '',
  targetLanguage: '中文',
  sourceLanguage: '英文',
  openMode: 'right',
  active: true,
  exist: false,
  prompt:"## 翻译\n该单字的词形及其翻译\n## 音标\n该单字音标\n## 例句\n两到三个例句以及其翻译\n## 词根词缀\n词根词缀等信息"
};

export default class WordCards extends Plugin {
  settings: WordCardSettings;
  private targetFolderPath: string = ''; // 这里依旧是用于存储“vault 内相对路径”

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // 新增一个辅助方法，用来创建（如果不存在）文件所在的文件夹
  private async createFolderIfNotExists(folderPath: string): Promise<void> {
    // 注意这里 folderPath 也是相对路径，比如 "Library/English/words/en"
    try {
      // 先判断一下 folderPath 是否存在
      const folderExists = await this.app.vault.adapter.exists(folderPath);
      if (!folderExists) {
        await this.app.vault.createFolder(folderPath);
      }
    } catch (error) {
      // 如果文件夹已存在，会抛出异常，这里简单忽略即可
      console.log(`createFolderIfNotExists: 文件夹已存在或无法创建: ${folderPath}`, error);
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
    this.addRibbonIcon("gpt", "create a new note", async () => {
      await this.WordCardMain();
    });

    // 添加命令
    this.addCommand({
      id: 'get-clipboard-content',
      name: 'Get clipboard content, query GPT, and create a new note',
      callback: async () => { await this.WordCardMain(); },
    });

    // 添加设置页面
    this.addSettingTab(new WordCardSettingTab(this.app, this));
  }

  private async WordCardMain() {
    // 获取 Obsidian 的 Vault 根目录（如果你需要物理硬盘路径可以这样），
    // 但后面操作文件要用相对路径
    const fsAdapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultRoot = fsAdapter.getBasePath();

    // 将本地设置的 targetFolderPath 当作“相对路径”使用
    this.targetFolderPath = this.settings.targetFolderPath;

    // 获取当前活动文件
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      // 当前没有打开任何文件
      console.warn('当前没有打开任何文件。');
      // 检查剪贴板是否有文本
      if (!clipboard.readText()) {
        // 如果没有文本，则尝试当成图片处理
        const imageUrl = await this.getimgurl();
        const result = await this.analyzeImageLink(imageUrl);
        console.log(result);

        const wordName = result.split("|")[0].toUpperCase().trim();
        const contentPart = result.split("|")[1] + "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;

        // 构造相对路径：this.targetFolderPath + sourceLanguage + 文件名
        const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
        const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

        // 先确保文件夹存在
        await this.createFolderIfNotExists(path.dirname(vaultPath));

        // 创建/追加 文件
        await this.createOrAppendFile(vaultPath, wordName, contentPart);
        return;
      } else {
        // 如果没有活动文件，但剪贴板有文本，就直接创建
        await this.createNewNotefromtext();
      }
      return;
    }

    // 如果有活动文件
    const fileExt = this.getFileExt(activeFile);
    if (fileExt === 'pdf') {
      console.log(`当前活动文件: ${activeFile.name} 为 pdf 文件`);
      await this.processPdfFile();
    } else if (fileExt === 'md') {
      console.log(`当前活动文件: ${activeFile.name} 为 md 文件`);
      await this.processMarkdownFile(activeFile);
    } else {
      console.warn('当前活动文件类型不受支持。');
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
          // 如果不重叠卡片
       
          console.log(`尝试打开: ${filePath}`);
          const file = this.app.vault.getAbstractFileByPath(filePath);
          if (file && file instanceof TFile) {
            if (mode === 'left') {
              const leaf = this.app.workspace.getLeftLeaf(true);
              await leaf.openFile(file);
              if (this.settings.active) {await this.app.workspace.revealLeaf(leaf);}
            await this.app.workspace.revealLeaf(leaf);
            } else if (mode === 'right') {
              const leaf = this.app.workspace.getRightLeaf(true);
              await leaf.openFile(file);
              if (this.settings.active) {await this.app.workspace.revealLeaf(leaf);}
      
            } else if (mode === 'window') {
              const leaf = this.app.workspace.getLeaf("split");
              await leaf.openFile(file);
              if (this.settings.active) {await this.app.workspace.revealLeaf(leaf);}
          
            } else if (mode === 'none ') {
              return;
            } else if (mode === 'active') {
              await this.app.workspace.getLeaf();
              await leaf.openFile(file);
              if (this.settings.active) {await this.app.workspace.revealLeaf(leaf);}
            } else if (mode === 'tab') {
              const leaf = this.app.workspace.getLeaf("tab");
              await leaf.openFile(file);
              if (this.settings.active) {await this.app.workspace.revealLeaf(leaf);}
            }
            
      
            new Notice(`Opened file: ${filePath}`);
            
          } else {
            new Notice(`File not found: ${filePath}`);
          }   

      }else{
      // 确保 mode 参数没有前后空格
      mode = mode.trim();
  
      // 打印尝试打开的文件路径和模式
      console.log(`尝试打开: ${filePath}，模式: ${mode}`);
  
      // 获取文件对象
      const file = this.app.vault.getAbstractFileByPath(filePath);
  
      if (file && file instanceof TFile) {
          let targetLeaf: WorkspaceLeaf | null = null;
  
          // 使用 iterateAllLeaves 遍历所有 leaves
          this.app.workspace.iterateAllLeaves(leaf => {
              const view = leaf.view;
  
              // 检查当前 leaf 的 view 是否是 MarkdownView
              if (view instanceof MarkdownView) {
                  const currentFile = view.file;
  
                  if (currentFile && currentFile.basename.startsWith('word-')) {
                      if (!targetLeaf) { // 只设置第一个匹配的 leaf
                          targetLeaf = leaf;
                          console.log(`找到已有的 'word-' leaf: ${currentFile.path}`);
                          // 由于 iterateAllLeaves 不能中断迭代，这里只能记录找到的第一个 leaf
                      }
                  }
              } else {
                  // 如果使用了自定义的 view 类型，可以在这里添加更多的检查
                  // 例如：
                  // if (view.getViewType() === 'your-custom-view-type') {
                  //     // 进一步检查
                  // }
              }
          });
  
          // 如果未找到已有的 'word-' leaf，则根据 mode 创建新的 leaf
          if (!targetLeaf) {
              console.log(`未找到已有的 'word-' leaf，将根据 mode "${mode}" 创建新的 leaf`);
  
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
                      console.warn(`无效的模式: ${mode}`);
                      return;
                  default:
                      new Notice(`未知的 mode: ${mode}`);
                      console.warn(`未知的模式: ${mode}`);
                      return;
              }
          }
  
          // 打开文件到选定的 leaf
          if (targetLeaf) {
              try {
                  await targetLeaf.openFile(file);
                  if (this.settings.active) {
                      await this.app.workspace.revealLeaf(targetLeaf);
                  }
                  new Notice(`Opened file: ${filePath}`);
                  console.log(`文件已在 leaf 中打开: ${filePath}`);
              } catch (error) {
                  console.error(`无法在 leaf 中打开文件: ${filePath}`, error);
                  new Notice(`无法打开文件: ${filePath}`);
              }
          } else {
              new Notice(`无法打开文件: ${filePath}`);
              console.warn(`无法找到或创建目标 leaf 来打开文件: ${filePath}`);
          }
      } else {
          new Notice(`File not found: ${filePath}`);
          console.warn(`文件未找到: ${filePath}`);
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
        await this.createOrAppendFile(vaultPath, wordName, contentPart);
        return;
      }

      // 如果剪贴板有文本，假设格式：xxx>xxx>[someText|wordName]
      const sections = clipboardContent.split('>');
      if (sections.length < 3) {
        console.error('剪贴板内容格式不正确，无法找到第三段。');
        return;
      }
      // 正则匹配格式 [xxx|word]
      const regex = /\[([^\|\]]+)\|([^\]]+)\]/;
      const match = regex.exec(sections[2]);
      if (!match || match.length < 3) {
        console.error('未匹配到 [xxx|word] 格式，请检查剪贴板内容。');
        console.error('剪贴板内容:', clipboardContent);
        return;
      }

      const wordName = match[2].toUpperCase().trim();
      const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
      const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

      await this.createFolderIfNotExists(path.dirname(vaultPath));
      // 构造要追加的内容
      const newContent = `\n\n---\n\n${clipboardContent.split("|")[0]}|${clipboardContent.split("|")[1]}|${match[1].split("#")[0]}]]`;

      await this.createOrAppendFile(vaultPath, wordName, newContent);
    } catch (err) {
      console.error('处理 PDF 文件过程中出现错误:', err);
      new Notice('处理 PDF 文件过程中出现错误，请查看控制台。');
    }
  }

  private async processMarkdownFile(activeFile: TFile): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !activeFile) {
      console.error('无法获取 Markdown 编辑视图或活动文件。');
      return;
    }

    // 获取当前选中文本
    const editor = view.editor;
    const selectedText = editor.getSelection().trim();
    if (!selectedText) {
      // 如果没有选中文本，当成图片处理
      const imageUrl = await this.getimgurl();
      const result = await this.analyzeImageLink(imageUrl);
      console.log(result);

      const wordName = result.split("|")[0].toUpperCase().trim();
      const contentPart = result.split("|")[1] + "\n\n---\n\n" + `![${result.split("|")[0]}](${imageUrl})`;
      const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
      const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

      await this.createFolderIfNotExists(path.dirname(vaultPath));
      await this.createOrAppendFile(vaultPath, wordName, contentPart);
      return;
    }

    // 如果有选中文本，则在原文中替换为 [[word-xx-...|...]]
    await editor.replaceSelection(`[[word-${this.settings.sourceLanguage}-${selectedText}|${selectedText}]]`);
    const wordName = selectedText.toUpperCase().trim();

    const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
    const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

    await this.createFolderIfNotExists(path.dirname(vaultPath));

    // 如果文件不存在就创建，否则什么都不做（或者也可以在里面追加）
    const existingFile = this.app.vault.getAbstractFileByPath(vaultPath);
    if (!existingFile) {
      const gptResult = await this.queryGPTAboutWord(wordName);
      await this.app.vault.create(vaultPath, gptResult);
      console.log(`文件已创建: ${vaultPath}`);
    } else {
      console.log(`文件已存在: ${vaultPath}`);
    }

    await this.openFile(vaultPath, this.settings.openMode);
  }

  private async queryGPTAboutWord(word: string): Promise<string> {
    new Notice(`正在生成关于 ${word} 的卡片内容，请稍等...`, 5000);
    try {
      const apiUrl = 'https://api.openai.com/v1/chat/completions';
      const promptMessages = [
        { role: 'system', content: "你是一个字典,可以给出全面且权威的英文单词信息,避免寒暄和多余回复" },
        {
          role: 'user',
          content: `请分析该单词 ${word} 输出格式如下:${this.settings.prompt}回复时使用${this.settings.sourceLanguage}。`
        }
      ];

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
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
      new Notice(`已生成关于 ${word} 的卡片内容。`);
      return gptAnswer;
    } catch (error) {
      console.error('调用 GPT API 失败:', error);
      new Notice(`生成失败：${error.message}`);
      return 'Error retrieving information from GPT.';
    }
  }

  private async analyzeImageLink(img: string) {
    new Notice(`正在分析图片内容，请稍等...`, 5000);
    const url = "https://api.openai.com/v1/chat/completions";
    const apiKey = this.settings.apiKey;

    const body = {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `将图片中的主体或者文字用${this.settings.sourceLanguage}进行描述。输出格式为：单词本身|${this.settings.prompt},回复时使用${this.settings.sourceLanguage}`
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
      new Notice(`生成失败：${error.message}`);
    }
  }

  private async createOrAppendFile(filePath: string, wordName: string, appendContent?: string) {
    // 先检查文件是否存在
    const abstractFile = this.app.vault.getAbstractFileByPath(filePath);

    if (abstractFile && abstractFile instanceof TFile) {
      // 如果文件已存在，则读取后追加
      const oldContent = await this.app.vault.read(abstractFile);
      const newContent = oldContent + (appendContent || '');
      await this.app.vault.modify(abstractFile, newContent);
      console.log(`文件已更新: ${filePath}`);
      new Notice(`文件已更新: ${filePath}`);
    } else {
      // 如果文件不存在，创建新文件
      const gptResult = await this.queryGPTAboutWord(wordName);
      const content = gptResult + (appendContent || '');
      await this.app.vault.create(filePath, content);
      console.log(`文件已创建: ${filePath}`);
      new Notice(`文件已创建: ${filePath}`);
    }

    // 打开文件
    await this.openFile(filePath, this.settings.openMode);
  }

  private async getimgurl() {
    console.error('剪贴板为空或无法读取文本内容，尝试当图片处理。');
    const img = clipboard.readImage().toDataURL().split(",")[1];
    console.log(img);

    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${this.settings.clientId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: img, // Base64 数据
        type: 'base64', // 声明数据类型
      }),
    });
    const data = await response.json();
    console.log(data);
    const imageUrl = data.data.link;
    new Notice(`已上传图片到 Imgur, 图片链接: ${imageUrl}`, 5000);
    return imageUrl;
  }

  private async createNewNotefromtext() {
    const wordName = clipboard.readText().toUpperCase().trim();
    const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
    const vaultPath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

    await this.createFolderIfNotExists(path.dirname(vaultPath));

    // 检查文件是否存在
    const existingFile = this.app.vault.getAbstractFileByPath(vaultPath);
    if (!existingFile) {
      const gptResult = await this.queryGPTAboutWord(wordName);
      await this.app.vault.create(vaultPath, gptResult);
      console.log(`文件已创建: ${vaultPath}`);
      new Notice(`新文件已创建: ${vaultPath}`);
    } else {
      console.log(`文件已存在: ${vaultPath}`);
    }
    await this.openFile(vaultPath, this.settings.openMode);
    return;
  }
}
// 设置页面
export class WordCardSettingTab extends PluginSettingTab {
  plugin: WordCards;

  constructor(app: App, plugin: WordCards) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty(); // 清空设置页面
    
    new Setting(containerEl)
      .setName('源语言')
      .setDesc('设置您需要翻译的语言。')
      .addDropdown(dropdown =>
        dropdown
          .addOption('jp', '日语')
          .addOption('en', '英语')
          .addOption('zh', '中文')
          .addOption('fr', '法语')
          .addOption('de', '德语')
          .addOption('ko', '韩语')
          .addOption('es', '西班牙语')
          .addOption('ru', '俄语')
          .addOption('it', '意大利语')
          .addOption('pt', '葡萄牙语')
          .addOption('nl', '荷兰语')
          .addOption('pl', '波兰语')
          .addOption('tr', '土耳其语')

          .setValue(this.plugin.settings.sourceLanguage)
          .onChange(async (value) => {
            this.plugin.settings.sourceLanguage = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("目标语言")
      .setDesc("设置您想要创建的单词卡片的语言。")
      .addDropdown(dropdown =>
        dropdown
          .addOption('中文', '中文')
          .addOption('english', '英文')
          .setValue(this.plugin.settings.targetLanguage)
          .onChange(async (value) => {
            this.plugin.settings.targetLanguage = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('单词文件目标文件夹路径')
      .setDesc('将新文件保存到此文件夹中,基于 Obsidian Vault 根目录。例如：Library/English/words')
      .addText(text => text
        .setPlaceholder('输入目标文件夹路径')
        .setValue(this.plugin.settings.targetFolderPath)
        .onChange(async (value) => {
          this.plugin.settings.targetFolderPath = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('用于调用 OpenAI API。')
      .addText(text => text
        .setPlaceholder('输入 OpenAI API Key')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Client ID')
      .setDesc('用于调用 Imgur API。')
      .addText(text => text
        .setPlaceholder('输入 Client ID')
        .setValue(this.plugin.settings.clientId)
        .onChange(async (value) => {
          this.plugin.settings.clientId = value;
          await this.plugin.saveSettings();
        })
      );

      new Setting(containerEl)
      .setName('打开模式')
      .setDesc('选择打开新文件的位置')
      .addDropdown(dropdown =>
        dropdown
          .addOption('left', '左侧')
          .addOption('right', '右侧')
          .addOption('window', '新窗口')
          .addOption('active', '活动')
          .addOption('tab', '标签')
          .addOption('none', '不打开')
          .setValue(this.plugin.settings.openMode)
          .onChange(async (value) => {
            this.plugin.settings.openMode = value;
            await this.plugin.saveSettings();})
      );

      new Setting(containerEl)
      .setName('是否设置为活动状态')
      .setDesc('选择创建卡片后是否显示为活动状态')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.active)
          .onChange(async (value) => {
            this.plugin.settings.active = value;
            await this.plugin.saveSettings();
          })
      );

      new Setting(containerEl)
      .setName('是否重叠卡片')
      .setDesc('选择创建卡片是否重叠在旧卡片上(如果存在)')
      
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.exist)
          .onChange(async (value) => {
            this.plugin.settings.exist = value;
            await this.plugin.saveSettings();
          })
      );

      new Setting(containerEl)
      .setName('prompt')
      .setDesc('设置您的prompt')
      .addTextArea(textarea =>
        textarea
          .setPlaceholder('输入prompt')
          .setValue(this.plugin.settings.prompt)
          .onChange(async (value) => {
            this.plugin.settings.prompt = value;
            await this.plugin.saveSettings();
          })
      );



  }
}
