# Obsidian WordCards 📒

English [中文](./others/README-ZH.md)  [日本語](./others/README-JP.md)

**WordCards** is a plugin designed for Obsidian to enhance your vocabulary learning, language acquisition, and note-taking experience by directly generating detailed flashcards. Utilizing OpenAI's API and Imgur's API, WordCards efficiently creates comprehensive word entries, helping you easily manage and expand your vocabulary.

## 🌐 Multi-Language Support: Create personalized language learning flashcards in any language you wish to learn.
<img src="./others/演示markdown3.gif" alt="Generating in Markdown file" width="60%">

## 📄 Generate Flashcards from PDF++ (Bi-directional Linking)
<img src="./others/演示markdown2.gif" alt="Generating in PDF++" width="60%">

## 📸 Generate Flashcards from Screenshots (Add Image Links at the End)
<img src="./others/演示markdown4.gif" alt="Generating from screenshot" width="60%">

## 🚀 Features

- **Automatic Flashcard Creation**: Generate detailed flashcards from text or image content in your clipboard.
- **Customizable Prompts**: Tailor the flashcard templates to your specific needs.
- **Flexible Opening Modes**: Choose different locations within the Obsidian workspace to open newly created flashcards (left pane, right pane, new window, etc.).
- **Image Support**: Upload images to Imgur and include them in your flashcards.
- **Seamless Integration**: Easily integrate into your existing Obsidian workflow via toolbar icons and commands.
- **Settings Panel**: Comprehensive configuration options for languages, API keys, folder paths, and flashcard behaviors.

## 📚 Table of Contents

- ⛓️[Installation](#⛓️installation)
- [🔧 Configuration](#🔧-configuration)
- [🕹️ Usage](#🕹️-usage)
- [⚙️ Detailed Settings](#⚙️-detailed-settings)
- [🙌 Contributing](#🙌-contributing)
- [🙃 About Me](#🙃-about-me)

## ⛓️ Installation

### Install via Obsidian Community Plugins

1. **Open Obsidian**.
2. Go to `Settings` > `Community Plugins`.
3. Ensure that `Safe Mode` is **turned off**.
4. Click `Browse`, search for `WordCards`.
5. Click `Install`, then click `Enable`.

### Manual Installation

1. **Download the Plugin**:
   - Clone or download the plugin from the [GitHub repository](https://github.com/bwicarus/Obsidian-WordCards.git).
2. **Copy the Plugin Folder**:
   - Copy the plugin folder (`WordCards`) to your Obsidian Vault’s plugins directory: `.obsidian/plugins/`.
3. **Restart Obsidian or Reload the Plugins**.
4. **Enable the Plugin**:
   - Go to `Settings` > `Community Plugins`, find `WordCards`, and enable it.

## 🔧 Configuration

Before using WordCards, you need to set up your API keys and other configuration options.

### Required API Keys

1. **OpenAI API Key**:
   - Visit [OpenAI](https://platform.openai.com/) to register or log in.
   - Navigate to the API section and generate a new API key.
   - Keep this key secure and do not share it publicly.

2. **Imgur Client ID**:
   - Register an application on [Imgur](https://api.imgur.com/oauth2/addclient).
   - Choose the appropriate application type and obtain your `Client ID`.

### Setup Steps

1. **Open Obsidian Settings**:
   - Go to `Settings` > `Plugin Options` > `WordCards`.
2. **Configure Languages**:
   - **Source Language**: Select the language of the words you are inputting (e.g., English, Japanese).
   - **Target Language**: Select the language for the flashcard translations (e.g., Chinese, French).
3. **Set Target Folder Path**:
   - Specify the relative path within your Vault where flashcards will be saved (e.g., `Library/English/words`).
4. **Enter API Keys**:
   - **OpenAI API Key**: Paste your OpenAI API key.
   - **Client ID**: Paste your Imgur Client ID.
5. **Choose Opening Mode**:
   - Select where the new flashcard will open within the Obsidian workspace:
     - `left`: Left pane.
     - `right`: Right pane.
     - `window`: New window.
     - `active`: Active pane.
     - `tab`: New tab.
     - `none`: Do not open automatically.
6. **Toggle Settings Options**:
   - **Set as Active**: Choose whether the flashcard becomes the active pane after creation.
   - **Allow Overlapping Flashcards**: Decide whether new flashcards overwrite existing ones or create new entries.
7. **Customize Prompts**:
   - Modify GPT’s prompt content to customize the information included in the flashcards.

### Additional Settings
If you want to integrate with PDF++ to generate elegant links and display highlights in PDFs, configure the following sections in PDF++:

<img src="./others/pdf++设置2.png" alt="command settings" width="60%">

```
{{text}}
```

<img src="./others/pdf++设置2.png" alt="command settings" width="60%">

```
>[!{{calloutType}}|{{color}}]

>{{linkWithDisplay}}
```

## 🕹️ Usage

### Creating Flashcards

#### Via Toolbar Icon

1. Select a string of text or take a screenshot.
2. Click the **WordCards icon** in the Obsidian toolbar to generate a new flashcard from the clipboard content.

#### Via Command Palette

1. Select text or take a screenshot.
2. Press `Ctrl+P` (or `Cmd+P` on macOS) to open the command palette.
3. Search for `Get clipboard content, query GPT, and create a new note` and execute the command.

#### Using the Commander Plugin
[[Plugin Link]](https://github.com/phibr0/obsidian-commander)
This plugin allows you to use commands in various ways and even combine multiple commands.

You can even configure it to create flashcards with a single click in PDF++ (yes, I’m that lazy).

<img src="./others/commander设置1.png" alt="command settings" width="60%">

Add a command to include PDF++’s copy link command, then add a short delay followed by our flashcard command.

Once this command is created, you can place it anywhere using the Commander plugin.

### Workflow Scenarios

- **Clipboard Contains Text**:
  - If the clipboard contains word text, activating WordCards will create a flashcard with translations, definitions, example sentences, and other detailed information based on the configured prompts.

- **Clipboard Contains Image**:
  - If the clipboard contains an image, WordCards will upload the image to Imgur, use GPT-4 to analyze the image content, and create a flashcard that includes the extracted information and the image.

- **Processing Active File**:
  - Depending on the type of the current active file (e.g., Markdown or PDF), WordCards will process the content accordingly, creating new flashcards or appending to existing ones.

## ⚙️ Detailed Settings

You can access the settings panel by navigating to `Settings` > `Plugin Options` > `WordCards`. Below are detailed descriptions of the available settings:

- **Source Language**:
  - Dropdown menu to select the language of the input words.

- **Target Language**:
  - Dropdown menu to select the translation language for the flashcards.

- **Flashcard Target Folder Path**:
  - Text input to specify where flashcards will be saved within the Vault (e.g., `Library/English/words`).

- **OpenAI API Key**:
  - Text input to enter your OpenAI API key.

- **Client ID**:
  - Text input to enter your Imgur Client ID.

- **Opening Mode**:
  - Dropdown menu to choose where new flashcards will open (left pane, right pane, new window, active pane, tab, or none).

- **Set as Active**:
  - Toggle switch to decide whether the flashcard becomes the active pane after creation (i.e., whether it pops up; if set to no, it will remain collapsed without popping up).

- **Allow Overlapping Flashcards**:
  - Toggle switch to decide whether new flashcards overwrite existing ones or create new entries.

- **Prompt**:
  - Text area to customize GPT’s prompt content, allowing you to adjust the information included in the flashcard generation.

## 🙌 Contributing

This project started as an introductory exercise in JavaScript, so there are many areas that need improvement. Contributions and feedback are welcome! I’m eager to collaborate and develop a plugin that is convenient for everyone to use. If you have any questions, issues, or feature suggestions, please submit an Issue on the [GitHub Issues Page](https://github.com/bwicarus/Obsidian-WordCards/issues).

## 🙃 About Me

I’m just an international student living in Japan (currently working), with my Japanese skills at a basic level. However, I realized I still need to continue learning English (probably because I dislike English, I chose Japan ORZ). In my spare time, I teach myself programming and develop various small software projects (mostly in Python).

If you’d like to get in touch, feel free to email me. If you prefer to communicate via WeChat, please specify the purpose (e.g., issues related to the Obsidian plugin).

Email: bwicarus@gmail.com

WeChat ID: Mf12189115

Of course, if you’d like to support me, you can buy me a coffee:

[<img style="float:left" src="https://user-images.githubusercontent.com/14358394/115450238-f39e8100-a21b-11eb-89d0-fa4b82cdbce8.png" width="200">](https://ko-fi.com/linhao)



Wishing you a pleasant experience!