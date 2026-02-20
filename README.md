# Blurred - WhatsApp Web Privacy Extension

**Blurred** is a lightweight browser extension designed to enhance your privacy on WhatsApp Web. It allows you to selectively blur or conceal chat messages based on contact names, specific keywords, or simply blur all chats to prevent shoulder-surfing.

## ✨ Features

- **Target Specific Contacts:** Blur messages only from specific people or groups.
- **Keyword Filtering:** Automatically conceal messages that contain specific keywords.
- **Blur All Chats:** A master switch to blur all messages on the screen.
- **Adjustable Intensity:** Customize the blur intensity (in pixels) to your preference.
- **Conceal Modes:** Choose between a standard "Blur" effect or an "Opaque" mode that completely hides the text with a solid color.
- **Click to Reveal:** Temporarily reveal any blurred message simply by clicking on it.
- **Seamless Integration:** Works directly within the WhatsApp Web interface without disrupting your workflow.

## 🚀 Installation

Currently, this extension can be installed manually as an "Unpacked Extension" in Chrome or Chromium-based browsers.

1. Clone or download this repository to your local machine.
2. Open your browser and navigate to the Extensions page (`chrome://extensions/`).
3. Enable **Developer mode** (usually a toggle in the top right corner).
4. Click on **Load unpacked**.
5. Select the directory containing the extension files.
6. The extension is now installed and ready to use!

## 🛠️ Usage

1. Open [WhatsApp Web](https://web.whatsapp.com/).
2. Click on the **Blurred** extension icon in your browser toolbar.
3. Configure your settings:
   - **Enable/Disable:** Toggle the extension on or off.
   - **Blur All:** Check this to blur every message.
   - **Target Person:** Enter the exact name of a contact or group to blur their messages.
   - **Keywords:** Enter comma-separated keywords to blur messages containing them.
   - **Blur Intensity:** Use the slider to adjust how blurry the text appears.
   - **Conceal Mode:** Choose between "Blur" or "Opaque".
4. Click **Save**. The changes will apply immediately to your active WhatsApp Web tab.

## 📁 Project Structure

- `manifest.json`: The extension's configuration and permissions.
- `content.js`: The main script that runs on WhatsApp Web to observe DOM changes and apply the blur/opaque effects.
- `popup.html` & `popup.css`: The user interface for the extension's settings menu.
- `popup.js`: Handles saving and loading user preferences using Chrome's storage API.

## 🔒 Privacy

This extension runs entirely locally in your browser. It does not collect, store, or transmit any of your chat data or personal information. All settings are saved locally using Chrome Sync Storage.

## 👥 Contributors

- [@rif-x43](https://github.com/rif-x43)
- [@Adiba0308](https://github.com/Adiba0308)
