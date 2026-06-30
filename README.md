# 📄 ConvertSync

<div align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Styled-06B6D4?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-blue)

**A modern full-stack document conversion platform for Word, PDF, and office documents.**

Fast • Secure • Reliable • Privacy First

</div>

---

## ✨ Overview

ConvertSync is a modern web application that enables users to convert Microsoft Office documents with a clean, responsive interface and real-time conversion tracking.

The platform supports **Word ↔ PDF conversion** while preserving document formatting, fonts, layouts, and embedded images. It also includes a growing suite of PDF utilities such as merging, splitting, OCR, compression, password protection, and conversion history.

Designed with scalability and user experience in mind, ConvertSync demonstrates modern full-stack development using React, Node.js, Express, and MongoDB.

---

# 🚀 Features

## 📄 Document Conversion

- Word (.doc/.docx) → PDF
- PDF → Word (.docx)
- High-quality formatting preservation
- Automatic file validation
- Secure processing

---

## 📤 Upload System

- Drag & Drop Upload
- Click-to-upload
- Multiple file support
- File type validation
- Maximum file size validation

---

## 📥 Download

- Instant download after conversion
- Automatic filename generation
- Secure file delivery

---

## 📊 Conversion History

Track every conversion with:

- File name
- Conversion type
- Date & Time
- Processing status
- File size
- Download history
- Success/Failure tracking

---

## 📈 Dashboard Statistics

The history dashboard provides:

- Total conversions
- Success rate
- Data processed
- Failed conversions

---

## 🔒 Security

- Privacy-first design
- Automatic temporary file deletion
- Secure uploads
- Server-side validation
- Protected document processing

---

# 🛠 PDF Tools

ConvertSync also includes an expandable collection of PDF utilities.

### Organize

- Merge PDFs
- Split PDF
- Rotate PDF

### Convert

- PDF → JPG
- Images → PDF
- PDF → PowerPoint
- PowerPoint → PDF
- PDF → Excel
- Excel → PDF

### Optimize

- Compress PDF
- OCR PDF

### Security

- Protect PDF
- Unlock PDF
- Watermark PDF
---

# 🖥 Tech Stack

## Frontend

- React.js
- Tailwind CSS
- TypeScript
- React Router
- Axios
- React Dropzone
- Lucide Icons

---

## Backend

- Node.js
- Express.js
- Multer
- LibreOffice Conversion Engine
- File System API

---

## Database

- MongoDB

---

## Deployment

- Replit
- MongoDB Atlas

---

# 📂 Project Structure

```text
ConvertSync/

├── client/
│
│── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── lib/
│   └── App.tsx
│
├── server/
│   ├── routes/
│   ├── middleware/
│   ├── controllers/
│   ├── services/
│   ├── uploads/
│   ├── converted/
│   └── server.ts
│
├── shared/
│
├── package.json
└── README.md
```

---

# ⚙️ Installation

Clone the repository

```bash
git clone https://github.com/Yashash-2006/ConvertSync.git

cd ConvertSync
```

Install dependencies

```bash
npm install
```

Run development server

```bash
npm run dev
```

---

# 🔑 Environment Variables

Create a `.env` file.

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

NODE_ENV=development
```

---

# 📡 API Endpoints

## Upload

```http
POST /api/upload
```

Uploads a document.

---

## Convert

```http
POST /api/convert
```

Converts the uploaded document.

---

## Download

```http
GET /api/download/:filename
```

Downloads converted document.

---

## History

```http
GET /api/history
```

Returns previous conversions.

---

## Delete History

```http
DELETE /api/history/:id
```

Deletes a conversion record.

---

# 🧠 Application Workflow

```text
Upload File
      │
      ▼
Validate File
      │
      ▼
Store Temporarily
      │
      ▼
Convert Document
      │
      ▼
Save History
      │
      ▼
Generate Download
      │
      ▼
Automatic Cleanup
```

---

# 📸 Screenshots

## Home Page

> Add `screenshots/home.png`

## PDF Tools

> Add `screenshots/pdf-tools.png`

## Conversion History

> Add `screenshots/history.png`

---

# 🔮 Future Enhancements

- AI Document Summarization
- Digital Signature Support
- Cloud Storage Integration
- Batch Conversion Queue
- Email Converted Files
- Watermark PDFs
- Document Preview
- OCR Improvements
- Multi-language Support
- User Authentication
- Conversion Analytics

---

# 🎯 Learning Outcomes

This project demonstrates experience with:

- Full Stack Web Development
- File Upload Handling
- Backend Document Processing
- REST API Development
- MongoDB Integration
- Responsive UI Design
- Error Handling
- Document Conversion Workflows
- Secure File Management
- Modern React Development

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create your feature branch

```bash
git checkout -b feature/new-feature
```

3. Commit your changes

```bash
git commit -m "Added new feature"
```

4. Push your branch

```bash
git push origin feature/new-feature
```

5. Open a Pull Request

---

# 👨‍💻 Author

### **Yashash Chandra Yellampalli**

Computer Science Engineering Student

Interested in

- Artificial Intelligence
- Machine Learning
- Full Stack Development
- Cloud Computing

GitHub:
https://github.com/Yashash-2006

---

## ⭐ Show your support

If you found this project useful, consider giving it a ⭐ on GitHub!
