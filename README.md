# Jaeger WhatsApp Outreach Queue

A premium automated outreach management system for WhatsApp with AI personalization, safety pacing, and strategic business planning.

## 🚀 Overview

Jaeger is designed for high-performance outreach, helping businesses manage their WhatsApp lead pipeline with automated queuing, AI-generated message personalization using Google Gemini, and a structured 6-month strategic roadmap for growth.

## ✨ Key Features

- **Strategic Roadmap**: A tracked, 6-month progression plan from Month 1 (May) to Month 6 (October) to reach $15k/mo revenue.
- **Outreach Queue**: Automated pacing for WhatsApp outreach to stay within safety limits and maximize response rates.
- **AI Personalization**: Deeply personalized message drafting powered by Gemini AI, tailored to specific lead niches and business types.
- **Business CRM**: Lead management system to track contacts from "New" to "Closed".
- **Daily Performance Tracking**: Integrated XP system and daily metrics for WhatsApp outreach and personal habits (Reading, Workout, Bible).
- **Multi-Sector Access**: Specialized access for different tactical sectors (Ronan, Mikey, Guest).

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Motion (framer-motion)
- **Database/Auth**: Firebase (Firestore, Auth)
- **AI**: Google Gemini Pro (via @google/genai)
- **Icons**: Lucide React

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/jaeger-outreach-queue.git
   cd jaeger-outreach-queue
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Firebase Setup**:
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
   - Enable Firestore and Google Authentication.
   - Download your `firebase-applet-config.json` and place it in the root directory.
   - Deploy the rules found in `firestore.rules`.

4. **Environment Variables**:
   - Rename `.env.example` to `.env`.
   - Add your `GEMINI_API_KEY` for AI features.

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

## 🔐 Security Rules

The project includes a robust `firestore.rules` file that enforces:
- Identity isolation between tactical sectors.
- Strict schema validation for all collections.
- Ownership-based access control.

## 📄 License

MIT
