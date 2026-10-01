# AegisQR - Universal Encrypted QR Data Vault & Transfer Engine

AegisQR is an industrial-grade, client-side web application designed to securely encode, encrypt, transfer, scan, decrypt, preview, and download **any type of data** (text, files, images, audio, documents, contacts, Wi-Fi, code) across devices via high-density QR codes.

The application features a proprietary authenticated cryptographic envelope (**AES-256-GCM** with Web Crypto API), ensuring that standard third-party QR scanners cannot expose the contents—**only this website can decrypt and render the data**. It also provides direct web-vault link encapsulation, live camera scanning with animated multi-part QR stream reception, audio/haptic feedback, rich interactive file previewers, and multi-format export/sharing (PNG, SVG, PDF, Web Share API).

---

## User Review Required

> [!IMPORTANT]
> **Encryption & Interoperability Strategy**:
> To satisfy *"Make sure the QR code encryption is only decrypt by this website"*, we implement a dual-mode envelope:
> 1. **Direct Web-Vault Link Mode (Default & Cross-Device Frictionless)**: The QR encodes `https://[website-url]/#vault=[ENCRYPTED_PAYLOAD]`.
>    - When scanned with an iPhone/Android default camera, it opens this website directly in the user's browser, which automatically verifies the envelope, authenticates the ciphertext, decrypts it, and displays the file/data with download buttons.
>    - Third-party scanners or attackers only see an encrypted opaque token—the raw data is completely unreadable without this web app's decryptor.
> 2. **Air-Gapped Raw CipherQR Mode (In-App Scanner Only)**: The QR encodes `AQR1:[BASE64_CIPHERTEXT]`.
>    - Generic cameras or barcode apps will see raw unparseable gibberish and fail.
>    - Only this web application's built-in camera/image scanner will recognize the `AQR1` header and decrypt it.
>
> Users can toggle between both modes freely, with optional user PIN/password protection for extra zero-knowledge defense!

> [!NOTE]
> **Handling "Any Type of Data" Beyond QR Code Capacity (~1.5KB - 2.5KB)**:
> Standard QR codes have a physical maximum capacity (~2.9KB). To support *any file* (e.g. 5KB, 20KB, 50KB+ images, documents, or long text):
> - **Pre-Compression**: We compress all payloads with DEFLATE (`pako`) before encryption, shrinking data by 50–80%.
> - **Animated Multi-Frame QR Stream (Air-Drop via Camera)**: For files exceeding single QR density, AegisQR automatically generates a synchronized sequence of QR codes (e.g., Keystone/AirGap wallet standard: `1/N, 2/N...`).
> - The built-in scanner detects animated frames in real time with a live progress bar (`Receiving: 60% (3/5)`) and merges/decrypts the entire file as soon as all frames pass through the camera viewfinder!
> - Pager & Printable Card modes are also provided for static multi-page export.

---

## Open Questions

None currently; the design covers all specified requirements, including full offline operation, zero-knowledge privacy, and all data formats.

---

## Proposed Architecture & Changes

```
f:\Project QR Code\
├── index.html                   # Master single-page application shell (responsive, accessible, semantic HTML5)
├── css/
│   ├── main.css                 # Design system tokens, Cyber-Slate & Alpine-Light themes, layout, glassmorphism
│   ├── components.css           # Data type tabs, input widgets, reticle scanner overlay, preview modal, buttons
│   └── responsive.css           # Mobile navigation, adaptive layouts, high-DPI print styles
├── js/
│   ├── app.js                   # Application coordinator, tab controller, history manager, event routing
│   ├── crypto/
│   │   ├── cipher.js            # AES-256-GCM encryption/decryption engine, key derivation, AQR1 envelope parser
│   │   └── compressor.js        # Deflate/Inflate stream compression engine via pako
│   ├── qr/
│   │   ├── generator.js         # QR rendering engine with gradients, custom dots, eye styling, center logos
│   │   ├── animated-stream.js   # Multi-part chunker & sequential frame animator for large files
│   │   └── exporter.js          # Export to PNG (1x, 2x, 4x), SVG, printable PDF/card, clipboard, Web Share
│   ├── scanner/
│   │   ├── camera-scanner.js    # Camera stream manager (rear/front toggle, torch/flashlight, jsQR canvas loop)
│   │   ├── chunk-collector.js   # Live multi-frame assembler with progress tracking
│   │   ├── file-scanner.js      # Image file drag-and-drop & clipboard paste scanner
│   │   └── feedback.js          # AudioContext synth sound effects & haptic feedback
│   ├── viewers/
│   │   └── data-viewer.js       # Dynamic data type renderer (image lightbox, audio player, code viewer, vCard, Wi-Fi, universal file downloader)
│   └── vendor/
│       ├── jsqr.min.js          # High-performance QR detector & decoder
│       ├── easy.qrcode.min.js   # Styled QR code generator
│       └── pako.min.js          # Deflate/Inflate compression
├── assets/
│   ├── icons/                   # Crisp SVG icons
│   └── sample/                  # Sample test assets
└── README.md                    # Documentation, security architecture, and launch instructions
```

---

### Key Components

#### 1. Core Cryptographic Engine (`cipher.js` & `compressor.js`)
- **Algorithm**: AES-256-GCM authenticated encryption using native `window.crypto.subtle`.
- **Key Derivation**: PBKDF2 / HKDF using application master seed combined with cryptographically generated 16-byte random salt.
- **Envelope Serialization**:
  - Encodes payload type (`file`, `text`, `url`, `image`, `audio`, `vcard`, `wifi`, `json`, `code`), original filename, exact MIME type, creation timestamp, and file size.
  - Verifies data integrity with GCM authentication tag before decoding.
  - Optional user-defined password layer: if specified, recipient must enter the PIN/password to decrypt.

#### 2. Input Handlers for ANY Data Type
- **Generic File / Media Mode**:
  - Drag-and-drop zone or file browser for any file (PDF, DOCX, ZIP, MP3, PNG, etc.).
  - Automatic MIME detection and Base64/Uint8Array streaming.
- **Text & Notes Mode**: Rich text area with character/word count.
- **URL Mode**: Link with protocol validation and target display.
- **Contact Card (vCard 3.0)**: Name, phone, email, organization, website.
- **Wi-Fi Network**: SSID, encryption (WPA2/WPA3/WEP/None), password, hidden toggle.
- **Developer / Code / JSON Mode**: Formatted JSON or code with validation.

#### 3. QR Generation & Styling Engine (`generator.js`)
- Custom dot styles (rounded, dot, circle, standard square).
- Gradient fills (linear neon cyan-to-violet, radial, solid dark).
- Custom corner eye colors and shapes.
- Embedded center shield or lock logo.
- Real-time generation as user types.
- High-res PNG scaling (1024px, 2048px), vector SVG output, and printable PDF cards.

#### 4. QR Scanner Engine (`camera-scanner.js` & `file-scanner.js`)
- Live camera viewport with custom sci-fi/cyberpunk scan reticle and animated laser line.
- Back / Front camera switcher (`facingMode: "environment"`).
- Flashlight / Torch toggle button for low-light scanning.
- Drag-and-drop QR image scanner or paste (`Ctrl+V`) from clipboard.
- Synthetic Web Audio scanner chime + haptic vibration on detection.
- Frame collector: Handles single QR codes AND multi-part animated QR streams with live progress HUD.

#### 5. Data Viewer & Downloader (`data-viewer.js`)
- Once decrypted, dynamically displays:
  - **Images**: In-app zoomable lightbox preview + instant download.
  - **Audio**: Inline HTML5 audio player + download.
  - **PDF / Documents**: File metadata card with icon, size, and 1-click download with preserved filename and MIME type.
  - **Links**: Safe URL preview + "Open in New Tab".
  - **Contacts**: Contact badge + "Save .vcf contact".
  - **Wi-Fi**: One-click copy password & network details.
  - **Any other file type**: Blob URL trigger for native instant download.

---

## Verification Plan

### Automated & Unit Tests
1. **Cryptographic Roundtrip Test**:
   - Encrypt plain text, JSON, and binary file buffers -> Decrypt with matching key -> Assert bit-for-bit equality.
   - Decrypt with corrupted ciphertext / wrong key -> Verify GCM authentication failure is cleanly caught.
2. **Compression Integrity Test**:
   - Deflate arbitrary data with `pako` -> Inflate -> Assert match.
3. **Chunking & Multi-Frame Reassembly Test**:
   - Split a 10KB payload into 8 chunks -> Feed chunks in random order -> Verify `ChunkCollector` correctly reassembles and reconstructs original data.
4. **QR Encoding & Decoding Test**:
   - Render QR code to offscreen canvas -> Decode with `jsQR` -> Assert payload matches.

### Manual Verification
1. Launch local Python HTTP server on port 8000 (`python -m http.server 8000`).
2. Test generating QR codes for:
   - Plain text
   - Safe URL
   - Image file (PNG/JPG)
   - PDF document
   - Wi-Fi credentials
   - vCard contact
3. Test downloading QR as PNG (1x, 2x, 4x) and SVG.
4. Test scanning generated QR via:
   - Drag-and-drop file upload.
   - Clipboard paste (`Ctrl+V`).
   - Camera scan (if camera is available).
5. Verify that external standard scanners cannot read the payload (or open the secure web decryptor link).
6. Verify file download creates the exact file with original name, extension, and content.
