import { clipboard } from 'electron';
import { Plugin,FileSystemAdapter, MarkdownView, TFile,Notice ,App,Setting, PluginSettingTab, addIcon} from 'obsidian';
import * as fs from 'fs';
import * as path from 'path'

interface WordCardSettings {
  // 设置项的属性定义,如string,number,boolean等
  targetFolderPath: string;
  apiKey: string;
  clientId: string;
  targetLanguage: string;
  sourceLanguage: string;
}
const DEFAULT_SETTINGS: Partial<WordCardSettings>= {
  //默认项的属性值被定义为和wordCardSettings一样的类型,但是使用Partial使得这些属性变为可选,并设置默认值为''
  targetFolderPath: '',
  apiKey: '',
  clientId: '',
  targetLanguage: '中文',
  sourceLanguage: '英文',
};
export default class WordCards extends Plugin {
  //使用default class将这个类作为文件的默认导出,这样就可以在其他文件中使用import导入这个类
  //这个类继承了Plugin类,这个类是obsidian提供的一个基础类,提供了一些常用的方法和属性
  settings: WordCardSettings;
  //settings 这个属性本身是一个该类的对象，它有三个内部的键值对属性
  async loadSettings() {
    //Object.assign 按顺序从左到右将源对象（sources）的属性复制到目标对象（target）。
    //如果多个源对象中存在相同的键，后面对象的值会覆盖前面对象的值。
    //https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    //将现有设置保存到数据文件中
    await this.saveData(this.settings);
  }

  private targetFolderPath: string = '';//初始化目标文件夹路径
  async onload() {
    await this.loadSettings();//加载设置

    addIcon('gpt',`<circle cx="50" cy="50" r="50" fill="currentColor" />`);//添加一个icon
    this.addRibbonIcon("gpt", "create a new note", async () => {//添加这个按钮到侧面工具栏
      await this.WordCardMain();
    });
    //添加命令
    this.addCommand({
      id: 'get-clipboard-content',
      name: 'Get clipboard content, query GPT, and create a new note',
      callback: async () => {await this.WordCardMain();},
    });
    //添加设置页面
    this.addSettingTab(new WordCardSettingTab(this.app, this));//创建一个实例并添加到设置页面
  }

private async WordCardMain(){
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
      const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
      const filePath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

      // 仅保留对 filePath 父目录的创建
      fs.mkdirSync(path.dirname(filePath), { recursive: true });

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
    } else {
      await this.createNewNotefromtext(clipboard.readText());
    }
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
      await this.createNewNotefromtext(clipboard.readText());
    }
  }
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
      const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
      const filePath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

      // 仅保留对 filePath 父目录的创建
      fs.mkdirSync(path.dirname(filePath), { recursive: true });

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
      console.error('剪贴板内容:', clipboardContent);
      return;
    }

    // match[1]、match[2] 分别取到 [xxx|word] 中的 “xxx” 和 “word”
    const wordName = match[2].toUpperCase().trim();

    // 构造文件名与路径
    const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
    const filePath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

    // 仅保留对 filePath 父目录的创建
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // 构造要追加的内容
    // 这里演示把剪贴板的前两段与匹配段再处理一下写入
    const newContent = `\n\n---\n\n${clipboardContent.split("|")[0]}|${clipboardContent.split("|")[1]}|${match[1].split("#")[0]}]]`;

    // 创建或追加到文件
    this.createOrAppendFile(filePath, wordName, newContent);
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
    const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
    const filePath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

    // 仅保留对 filePath 父目录的创建
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

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
  await editor.replaceSelection(`[[word-${this.settings.sourceLanguage}-${selectedText}|${selectedText}]]`);
  const wordName = selectedText.toUpperCase().trim();
  

  // 构造文件名与路径
  const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
  const filePath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

  // 仅保留对 filePath 父目录的创建
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  // 如果文件不存在就创建
  if (!fs.existsSync(filePath)) {
    const gptResult = await this.queryGPTAboutWord(wordName);
    fs.writeFileSync(filePath, gptResult);
    console.log(`文件已创建: ${filePath}`);
  } else {
    console.log(`文件已存在: ${filePath}`);
  }

  // 将选中文本替换为相应的 [[链接]]
}

private async queryGPTAboutWord(word: string): Promise<string> {
  new Notice(`正在生成关于 ${word} 的卡片内容，请稍等...`, 5000);
  try {
    // ChatGPT/Completions API 端点
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    const promptMessages = [
      { role: 'system', content: "你是一个字典,可以给出全面且权威的英文单词信息,避免寒暄和多余回复" },
      {
        role: 'user',
        content: `请分析该${this.settings.sourceLanguage}单词 ${word} 输出格式如下:## 翻译\\n该单字的词形及其翻译\\n## 音标\\n## 音标\\该单字音标\\n## 例句\\n两到三个例句以及其翻译\\n## 词根词缀\\n词根词缀等信息`
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
            text: `将图片中的主体或者文字用${this.settings.sourceLanguage}进行描述。输出格式为：${this.settings.sourceLanguage}本身|## 翻译\\n该单字的词性及其翻译\\n## 音标\\n## 音标\\该单字音标\\n## 例句\\n两到三个例句以及其翻译\\n## 词根词缀\\n词根词缀等信息,`
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
  if (fs.existsSync(filePath)) {
    // 如果文件存在，追加新内容
    fs.appendFileSync(filePath, appendContent || '');
    console.log(`文件已更新: ${filePath}`);
    new Notice(`文件已更新: ${filePath}`);
  } else {
    // 如果文件不存在，创建新文件并写入内容
    const gptResult = await this.queryGPTAboutWord(wordName); 
    const content = appendContent ? (gptResult + appendContent) : gptResult;
    fs.writeFileSync(filePath, content);
    console.log(`文件已创建: ${filePath}`);
    new Notice(`文件已创建: ${filePath}`);
  }
}

private async getimgurl() {
  console.error('剪贴板为空或无法读取文本内容。');
  const img = clipboard.readImage().toDataURL().split(",")[1];
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
  new Notice(`已上传图片到 Imgur, 图片链接: ${imageUrl}`, 5000);
  return imageUrl;
}




private async createNewNotefromtext(text: string) {
  const wordName = clipboard.readText().toUpperCase().trim();
  const fileName = `word-${this.settings.sourceLanguage}-${wordName}.md`;
  const filePath = `${this.targetFolderPath}/${this.settings.sourceLanguage}/${fileName}`;

  // 仅保留对 filePath 父目录的创建
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  console.log("最终 filePath 为：", filePath);

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
//设置页面
export class WordCardSettingTab extends PluginSettingTab {
  plugin: WordCards;

  constructor(app: App, plugin: WordCards) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();//清空设置页面
    new Setting(containerEl)
      .setName('源语言')
      .setDesc('设置您需要翻译的语言。')
      .addDropdown(dropdown =>
        dropdown
          .addOption('jp', '日语')
          .addOption('en', '英语')
          .setValue(this.plugin.settings.sourceLanguage)
          .onChange(async (value) => {
            this.plugin.settings.sourceLanguage = value;
            await this.plugin.saveSettings();
          }));

    new Setting(containerEl)
      .setName("目标语言")
      .setDesc("设置您想要创建的单词卡片的语言。")
      .addDropdown(dropdown =>
        dropdown
          .addOption('zh', '中文')
          .addOption('en', '英文')
          .setValue(this.plugin.settings.targetLanguage)
          .onChange(async (value) => {
            this.plugin.settings.targetLanguage = value;
            await this.plugin.saveSettings();
          }));

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
