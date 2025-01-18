import { clipboard } from 'electron';
import { Plugin,FileSystemAdapter, MarkdownView, TFile,Notice ,App,Setting, PluginSettingTab, addIcon} from 'obsidian';
import * as fs from 'fs';

interface WordCardSettings {
  targetFolderPath: string;
  apiKey: string;
  clientId: string;

}
const DEFAULT_SETTINGS: Partial<WordCardSettings>= {
  targetFolderPath: '',
  apiKey: '',
  clientId: ''
};

// 示例：在此处放置你的 OpenAI API Key

export default class ExamplePlugin extends Plugin {
  settings: WordCardSettings;
  async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

  private targetFolderPath: string = '';
  async onload() {
    await this.loadSettings();
    addIcon('gpt',`<circle cx="50" cy="50" r="50" fill="currentColor" />`);
    this.addRibbonIcon("gpt", "Get clipboard content, query GPT, and create a new note", async () => {
      await this.WordCardMain();
      
    });
    // 加载设置
    this.addCommand({
      id: 'get-clipboard-content',
      name: 'Get clipboard content, query GPT, and create a new note',
      callback: async () => {await this.WordCardMain();},
      });
    this.addSettingTab(new WordCardSettingTab(this.app, this));
  }

  
private  async WordCardMain(){
  // 获取 Obsidian 的 Vault 根目录
  var fsAdapter = this.app.vault.adapter as FileSystemAdapter;
  var vaultRoot = fsAdapter.getBasePath();
  // 目标文件夹路径（示例）
  this.targetFolderPath = `${vaultRoot}/${this.settings.targetFolderPath}`;
  // 获取当前活动文件
  const activeFile = this.app.workspace.getActiveFile();
  if (!activeFile) {
    console.warn('当前没有打开任何文件。');
    if (!clipboard.readText()) {
      const imageUrl = await this.getimgurl();
      const result = await this.analyzeImageLink(imageUrl);
      console.log(result);
      const wordName = result.split("|")[0].toUpperCase().trim();
      const fileName = `word-en-${wordName}.md`;
      const filePath = `${this.targetFolderPath}/${fileName}`;
      fs.mkdirSync(this.targetFolderPath, { recursive: true });
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, result.split("|")[1]+"\n\n---\n\n"+`![${result.split("|")[0]}](${imageUrl})`);
        console.log(`新文件已创建: ${filePath}`);
        new Notice(`新文件已创建: ${filePath}`);
      } else {
        console.log(`文件已存在: ${filePath}`);
        const now = new Date();
        const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        fs.appendFileSync(filePath, "\n\n---\n\n"+`${formatted}\n![${result.split("|")[0]}](${imageUrl})`);
        new Notice(`已添加新内容`);
  }
    return;

  }else{await this.createNewNotefromtext(clipboard.readText());}
  return;
  //如果没有打开任何界面但剪切板有内容就创建新文件
}
  if (activeFile){
  const fileExt = this.getFileExt(activeFile);
  if (fileExt === 'pdf') {
    console.log(`当前活动文件: ${activeFile.name} 为 pdf 文件`);
    await this.processPdfFile(this.targetFolderPath);
  } else if (fileExt === 'md') {
    console.log(`当前活动文件: ${activeFile.name} 为 md 文件`);
    await this.processMarkdownFile(this.targetFolderPath, activeFile);
  } else {
    console.warn('当前活动文件类型不受支持。');
    await this.createNewNotefromtext(clipboard.readText());}  } 
  }

  private getFileExt(activeFile: TFile): string {
    const fileName = activeFile?.name || '';
    const segments = fileName.split('.');
    return segments.length > 1 ? segments[segments.length - 1].toLowerCase() : '';
  }
  private async processPdfFile(targetFolderPath: string): Promise<void> {
    try {
      // 从剪贴板获取文本
      const clipboardContent: string = clipboard.readText();
      console.log(clipboardContent);
      if (!clipboardContent) {
            const imageUrl = await this.getimgurl();
            const result = await this.analyzeImageLink(imageUrl);
            console.log(result);
            const wordName = result.split("|")[0].toUpperCase().trim();
            const fileName = `word-en-${wordName}.md`;
            const filePath = `${targetFolderPath}/${fileName}`;
            fs.mkdirSync(targetFolderPath, { recursive: true });
            if (!fs.existsSync(filePath)) {
              fs.writeFileSync(filePath, result.split("|")[1]+"\n\n---\n\n"+`![${result.split("|")[0]}](${imageUrl})`);
              console.log(`新文件已创建: ${filePath}`);
              new Notice(`新文件已创建: ${filePath}`);
            } else {
              console.log(`文件已存在: ${filePath}`);
              const now = new Date();
              const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              fs.appendFileSync(filePath, "\n\n---\n\n"+`${formatted}\n![${result.split("|")[0]}](${imageUrl})`);
              new Notice(`已添加新内容`);
        }
          return;
        
        
      }

      // 假设剪贴板格式类似：xxx>xxx>[someText|wordName]
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
        return;
      }

      // match[1]、match[2] 分别取到 [xxx|word] 中的 “xxx” 和 “word”
      const originalPart = match[1]; 
      const wordName = match[2].toUpperCase().trim();

      // 调用 GPT 接口查询该单词信息
      const gptResult = await this.queryGPTAboutWord(wordName); 

      // 构造文件名与路径
      const fileName = `word-en-${wordName}.md`;
      const filePath = `${targetFolderPath}/${fileName}`;

      // 创建文件夹（如果不存在）
      fs.mkdirSync(targetFolderPath, { recursive: true });

      // 构造要追加的内容
      // 这里演示把剪贴板的前两段与匹配段再处理一下写入
      const newContent = `\n\n---\n\n${clipboardContent.split("|")[0]}|${clipboardContent.split("|")[1]}|${match[1].split("#")[0]}]]`;

      // 创建或追加到文件
      this.createOrAppendFile(filePath, gptResult, newContent);
    } catch (err) {
      console.error('处理 PDF 文件过程中出现错误:', err);
      new Notice('处理 PDF 文件过程中出现错误，请查看控制台。');
    }
  }
  private async processMarkdownFile(targetFolderPath: string, activeFile: TFile): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !activeFile) {
      console.error('无法获取 Markdown 编辑视图或活动文件。');
      return;
    }

    // 获取当前选中文本
    const editor = view.editor;
    const selectedText = editor.getSelection().trim();
    if (!selectedText) {
            const imageUrl = await this.getimgurl();
            const result = await this.analyzeImageLink(imageUrl);
            console.log(result);
            const wordName = result.split("|")[0].toUpperCase().trim();
            const fileName = `word-en-${wordName}.md`;
            const filePath = `${targetFolderPath}/${fileName}`;
            fs.mkdirSync(targetFolderPath, { recursive: true });
            if (!fs.existsSync(filePath)) {
              fs.writeFileSync(filePath, result.split("|")[1]+"\n\n---\n\n"+`![${result.split("|")[0]}](${imageUrl})`);
              console.log(`新文件已创建: ${filePath}`);
            } else {
              console.log(`文件已存在: ${filePath}`);
              const now = new Date();
              const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              fs.appendFileSync(filePath, "\n\n---\n\n"+`${formatted}\n![${result.split("|")[0]}](${imageUrl})`);
        }
          return;
  }
    await editor.replaceSelection(`[[word-en-${selectedText}|${selectedText}]]`);
    const wordName = selectedText.toUpperCase().trim();
    const gptResult = await this.queryGPTAboutWord(wordName);

    // 构造文件名与路径
    const fileName = `word-en-${wordName}.md`;
    const filePath = `${targetFolderPath}/${fileName}`;

    // 创建文件夹（如果不存在）
    fs.mkdirSync(targetFolderPath, { recursive: true });

    // 如果文件不存在就创建
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, gptResult);
      console.log(`文件已创建: ${filePath}`);
    } else {
      console.log(`文件已存在: ${filePath}`);
    }

    // 将选中文本替换为相应的 [[链接]]
    
  }
  private async queryGPTAboutWord(word: string): Promise<string> {
    try {
      // ChatGPT/Completions API 端点
      const apiUrl = 'https://api.openai.com/v1/chat/completions';
      const promptMessages = [
        { role: 'system', content: "你是一个字典,可以给出全面且权威的英文单词信息,避免寒暄和多余回复" },
        {
          role: 'user',
          content: `请分析该英文单词 ${word} 输出格式如下:## 翻译\\n该单字的词形及其翻译\\n## 音标\\n## 音标\\该单字音标\\n## 例句\\n两到三个例句以及其翻译\\n## 词根词缀\\n词根词缀等信息`
        }
      ];

      // 发起请求
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
      // 从返回中取出 GPT 的回答
      const gptAnswer: string = jsonData.choices?.[0]?.message?.content?.trim() || 'No response';
      return gptAnswer;
    } catch (error) {
      console.error('调用 GPT API 失败:', error);
      return 'Error retrieving information from GPT.';
    }
  }
  private async analyzeImageLink(img: string) {
    const url = "https://api.openai.com/v1/chat/completions";
    const apiKey = this.settings.apiKey; // 替换为你的 OpenAI API 密钥
  
    // 根据你的业务需求，content 里的 text 与 image_url 均可调整
    const body = {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "将图片中的主体或者文字用英文单字进行描述。输出格式为：英文单字本身|## 翻译\\n该单字的词性及其翻译\\n## 音标\\n## 音标\\该单字音标\\n## 例句\\n两到三个例句以及其翻译\\n## 词根词缀\\n词根词缀等信息,"
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
    }
  }
  private async createOrAppendFile(filePath: string, initialContent: string, appendContent?: string) {
    if (fs.existsSync(filePath)) {
      // 如果文件存在，追加新内容
      fs.appendFileSync(filePath, appendContent || '');
      console.log(`文件已更新: ${filePath}`);
      new Notice(`文件已更新: ${filePath}`);
    } else {
      // 如果文件不存在，创建新文件并写入内容
      const content = appendContent ? (initialContent + appendContent) : initialContent;
      fs.writeFileSync(filePath, content);
      console.log(`文件已创建: ${filePath}`);
      new Notice(`文件已创建: ${filePath}`);
    }
  }
  private async getimgurl() {
    console.error('剪贴板为空或无法读取文本内容。');
            const img=clipboard.readImage().toDataURL().split(",")[1];
            console.log(img);
            const response= await  fetch('https://api.imgur.com/3/image', {
              method: 'POST',
              headers: {
                Authorization: `Client-ID ${this.settings.clientId}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                image: img, // Base64 数据
                type: 'base64',    // 声明数据类型
              }),
            });
            const data = await response.json();
            console.log(data);
            const imageUrl = data.data.link;
            return imageUrl;
  }
  private async createNewNotefromtext(text: string) {
    const wordName = clipboard.readText().toUpperCase().trim();
          const fileName = `word-en-${wordName}.md`;
          const filePath = `${this.targetFolderPath}/${fileName}`;
          fs.mkdirSync(this.targetFolderPath, { recursive: true });

          // 如果文件不存在就创建
          if (!fs.existsSync(filePath)) {
            const gptResult = await this.queryGPTAboutWord(wordName);
            fs.writeFileSync(filePath, gptResult);
            console.log(`文件已创建: ${filePath}`);
            new Notice(`新文件已创建: ${filePath}`);
          } else {
            console.log(`文件已存在: ${filePath}`);
      }

      return;
  }
}

export class WordCardSettingTab extends PluginSettingTab {
  plugin: ExamplePlugin;

  constructor(app: App, plugin: ExamplePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName('单词文件目标文件夹路径')
      .setDesc('将新文件保存到此文件夹中,基于 Obsidian Vault 根目录。例如：Library/English/words')
      .addText(text => text
        .setPlaceholder('输入目标文件夹路径')
        .setValue(this.plugin.settings.targetFolderPath)
        .onChange(async (value) => {
          this.plugin.settings.targetFolderPath = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('用于调用 OpenAI API。')
      .addText(text => text
        .setPlaceholder('输入 OpenAI API Key')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Client ID')
      .setDesc('用于调用 Imgur API。')
      .addText(text => text
        .setPlaceholder('输入 Client ID')
        .setValue(this.plugin.settings.clientId)
        .onChange(async (value) => {
          this.plugin.settings.clientId = value;
          await this.plugin.saveSettings();
        }));
 
      }
}