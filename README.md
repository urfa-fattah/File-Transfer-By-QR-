# AegisQR™ — Universal Encrypted QR Data Vault & Air-Gap Transfer Engine

> **Zero-Knowledge Encrypted QR Transmission for Any Data, Any File, Any Device.**  
> Built with modern Web Cryptography standards (AES-256-GCM), proprietary envelope encapsulation, high-ratio compression, multi-frame optical streaming, and rich in-browser file previewers & downloaders.

---

## 🚀 Key Features

### 1. Universal Data Support (Any Type of Data)
AegisQR seamlessly ingests, compresses, encrypts, transfers, and recovers **any data format**:
- **Any Arbitrary File**: Images (PNG, JPG, WebP, GIF, SVG), Audio clips (MP3, WAV, OGG), PDF documents, Office files, ZIP archives, executables, and raw binary blobs.
- **Rich & Plain Text**: Long notes, passwords, credentials, markdown snippets.
- **Direct URLs**: Safe website link previews with instant launch button.
- **vCard Contacts (v3.0)**: Name, phone, email, organization with 1-click **Add to Contacts (.vcf)** download.
- **Wi-Fi Credentials**: SSID, WPA2/WPA3 security, password with show/hide toggle and 1-click copy.
- **Code & Structured JSON**: Syntax formatted code blocks with line count and file export.

### 2. Proprietary Exclusive Decryption
> *"Make sure the QR code encryption is only decrypt by this website"*

- **AES-256-GCM Authenticated Encryption**: Implemented natively via `window.crypto.subtle`. Every payload includes a 128-bit cryptographic authentication tag preventing tampering.
- **Proprietary `AQR1` Envelope**: Bound to AegisQR's internal key derivation seeds with unique 16-byte random salts. Generic barcode scanners, camera apps, or third-party QR tools cannot read or expose the contents.
- **Dual Interoperability Modes**:
  1. **Direct Web-Vault Link (Default)**: `https://[domain]/#vault=[ENCRYPTED_PAYLOAD]`.  
     Scanning with any standard smartphone camera automatically prompts to open the website, which verifies the envelope and immediately decrypts and renders the file with instant download buttons.
  2. **Air-Gapped Raw CipherQR**: `AQR1:[BASE64_CIPHERTEXT]`.  
     Completely offline. Standard scanners see opaque gibberish; only AegisQR's in-app camera or file scanner can read and decrypt it.
- **Optional Zero-Knowledge PIN / Passphrase**: Users can add an optional recipient password for military-grade dual-layer protection.

### 3. Overcoming Physical QR Capacity: Air-Gap Stream Sequencer
Standard QR codes have a physical limit (~2.9KB). AegisQR bypasses this barrier through:
1. **DEFLATE Pre-Compression (`pako`)**: Shrinks text, JSON, and files by 50–80% before encryption.
2. **Animated Multi-Frame QR Streaming**: For payloads exceeding single QR density, AegisQR splits data into synchronized frames cycled at 4–10 FPS (Keystone/AirGap hardware wallet standard).
3. **Live Stream Receiver**: The scanner tracks frames in real time with a progress HUD (`Receiving 4 of 5 frames - 80%`) and automatically reassembles and decrypts the file the moment all frames are captured!

### 4. Advanced QR Scanner
- **Live Camera Feed**: Back/Front camera switcher, flashlight/torch toggle for low-light scanning, holographic targeting reticle with animated laser scan line.
- **Image Upload & Clipboard Scanner**: Drag-and-drop QR screenshots or press `Ctrl+V` anywhere on the scan tab to scan directly from the system clipboard.
- **Audio & Haptic Feedback**: Web Audio API synthetic futuristic chimes and tactile vibration patterns.

### 5. Multi-Format Exporter & Sharing
- **Multi-Scale PNG**: Download in 1x (320px), 2x HD (640px), or 4x Ultra-Print (1280px).
- **Vector SVG**: Scalable vector format for publication.
- **Printable Air-Gap Transfer Card**: Generates a clean A4/card layout with decryption instructions, metadata table, and QR code.
- **System Clipboard**: One-click copy QR image to clipboard as a PNG blob.
- **Native Device Share**: Web Share API integration to share directly via AirDrop, Bluetooth, WhatsApp, Email, or Slack.

---

## 🛠️ Project Structure

```
f:\Project QR Code\
├── index.html                   # Master single-page application shell
├── css/
│   ├── main.css                 # Design tokens, themes (Obsidian Cyber & Alpine Light), glassmorphism
│   ├── components.css           # Forms, dropzones, QR frame, scanner reticle, data viewers, toasts
│   └── responsive.css           # Adaptive tablet/mobile layouts, high-DPI print styles
├── js/
│   ├── app.js                   # Application state, tab controller, history vault, event router
│   ├── crypto/
│   │   ├── cipher.js            # AES-256-GCM Web Crypto engine & AQR1 envelope parser
│   │   └── compressor.js        # DEFLATE / INFLATE compression wrapper (Pako)
│   ├── qr/
│   │   ├── generator.js         # Styled QR engine (themes, dot shapes, eyes, center logos)
│   │   ├── animated-stream.js   # Multi-part chunker & frame player for large files
│   │   └── exporter.js          # PNG (1x, 2x, 4x), SVG, Print Card, Clipboard, Web Share
│   ├── scanner/
│   │   ├── camera-scanner.js    # Camera stream, torch, camera switch, jsQR frame loop
│   │   ├── chunk-collector.js   # Live multi-frame stream assembler & progress HUD
│   │   ├── file-scanner.js      # Image drag-and-drop & clipboard paste scanner
│   │   └── feedback.js          # Web Audio synth chimes & haptic vibration
│   ├── viewers/
│   │   └── data-viewer.js       # Dynamic viewers (images, audio, PDF, vCard, Wi-Fi, code, files)
│   └── vendor/
│       ├── jsqr.min.js          # QR detector & decoder
│       ├── easy.qrcode.min.js   # Canvas & SVG QR renderer
│       └── pako.min.js          # Compression engine
└── README.md                    # Project documentation
```

---

## ⚡ How to Run Locally

You can launch and use AegisQR with zero installation using Python's built-in HTTP server:

```powershell
# Navigate to the project directory
cd "f:\Project QR Code"

# Start the local server
python -m http.server 8000
```

Then open your browser and navigate to:
**`http://localhost:8000`**

### Running Completely Offline
Because all dependencies (`pako.min.js`, `easy.qrcode.min.js`, `jsqr.min.js`) are self-contained in the `vendor/` folder, AegisQR works 100% offline without any internet connection. You can also open `index.html` directly in modern Chrome or Edge.

---

## 🔒 Security Architecture

| Security Layer | Specification |
|---|---|
| **Cipher Algorithm** | AES-256-GCM (Authenticated Encryption with Associated Data) |
| **Key Derivation** | PBKDF2 with SHA-256, 75,000 iterations, 16-byte random salt |
| **Integrity Check** | 128-bit Galois/Counter Mode authentication tag |
| **Initialization Vector** | 12-byte cryptographically secure random IV per encryption |
| **Envelope Signature** | Proprietary `AQR1` protocol header with metadata structure |
| **Privacy Guarantee** | 100% client-side execution; zero data is ever sent to any server |

---

## 📜 License
MIT License — Free to use, deploy, and customize.
