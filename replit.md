# Overview

TherapyFlow is a comprehensive clinical management platform designed for mental health professionals. The application provides therapists with tools to manage client information, track progress notes, schedule appointments, and leverage AI-powered insights to enhance therapeutic outcomes. Built as a full-stack web application, it combines a React frontend with an Express.js backend and PostgreSQL database to deliver a modern, efficient clinical workflow solution.

# User Preferences

Preferred communication style: Simple, everyday language.

## Session Type Configuration
- Session types are LIMITED to only 3 options:
  1. "individual" (DEFAULT - used for all sessions unless specifically identified otherwise)
  2. "couples" (for relationship/marital therapy sessions)  
  3. "session without patient present" (for consultations, family meetings without the patient)
- All AI processing and manual extraction must enforce these exact three session types
- Default to "individual" in all ambiguous cases

## Document Processing Configuration
- All uploaded documents should be processed using comprehensive clinical progress note generation
- Unless already identified as a formatted progress note by AI logic, documents should be transformed into full clinical progress notes
- Progress notes must follow professional structure: Title, Subjective, Objective, Assessment, Plan, Supplemental Analyses
- Include: Tonal Analysis, Key Points, Significant Quotes, Comprehensive Narrative Summary
- Demonstrate clinical sophistication using therapeutic modalities (ACT, DBT, Narrative Therapy, Existentialism)
- Use professional clinical voice with proper documentation standards
- **Risk Level Default**: Always default to 'low' risk level unless clear indicators suggest otherwise
- **Date Extraction Priority**: Extract session dates first from document filename, then from document content (OCR/text)

## Current Configuration
- Therapist: Dr. Jonathan Procter (License: Licensed Therapist)
- Database: Successfully imported 2,251+ SimplePractice appointments (2018-2025) with complete historical therapy session data
- Authentication: Mock system configured for Dr. Jonathan Procter (ID: dr-jonathan-procter)
- Calendar Sync: Fully operational with comprehensive SimplePractice integration and 100% capture rate, proper EDT timezone handling. Extended historical sync now captures data from 2010-2030 for complete record coverage.
- SimplePractice Integration: Successfully capturing all therapy appointments from "Simple Practice" calendar with proper client name extraction, intelligent client matching, and automatic client record creation
- Historical Session Management: Complete historical session tracking with:
  * Extended date range from 2010-2030 for comprehensive record coverage
  * Automatic past session completion marking for proper record management
  * Progress note placeholder creation for all historical sessions
  * Dedicated Session History page with filtering by status, client, and search capabilities
  * Statistical overview showing total sessions, completed sessions, active clients, and total hours
  * Organized session display grouped by month/year for easy navigation
  * Support for session status management and progress note organization
- Timezone: Complete system-wide EDT (Eastern Daylight Time) configuration implemented across all components:
  * Database queries use proper `AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'` conversion
  * Frontend displays use consistent EDT formatting utilities (client/src/utils/timezone.ts)
  * All date/time displays throughout the application now show accurate EDT times
  * Fixed appointments panel, client details, progress notes, and session displays
- Enhanced AI Document Processing: **MASSIVELY IMPROVED** comprehensive document processing system with:
  * **Robust PDF Extraction**: Multiple extraction methods including pdf-parse library, fallback byte parsing, and OCR-like text detection
  * **Advanced Text Preprocessing**: OCR error correction, clinical terminology standardization, header/footer removal, and intelligent text cleaning
  * **Multi-Pass AI Analysis**: Sophisticated clinical data extraction using both Anthropic Claude Sonnet 4.0 and OpenAI GPT-4o with comprehensive fallback mechanisms
  * **Intelligent Date Parsing**: Support for multiple date formats with fuzzy logic and context-aware extraction
  * **Advanced Client Matching**: Levenshtein distance algorithms, token similarity, and intelligent name variation handling (Chris/Christopher, etc.)
  * **Comprehensive Validation**: Multi-stage validation with detailed confidence scoring for text extraction, AI analysis, date parsing, and client matching
  * **Enhanced UI**: Sophisticated drag-drop interface with real-time processing feedback, detailed validation scores, and alternative interpretation display
  * **Clinical Analysis**: Automatic extraction of themes, emotions, interventions, risk levels, progress ratings, and next steps
  * **Manual Review Workflow**: Intelligent flagging system for uncertain results with detailed processing notes and alternative interpretations
  * **Format Support**: TXT (optimal), PDF (robust), DOCX (advanced), DOC (basic), RTF (formatted) with quality scoring for each extraction method

# System Architecture

## Frontend Architecture
The client-side application is built with React and TypeScript, utilizing modern development patterns and component libraries. The frontend employs Vite as the build tool for fast development and optimized production builds. The UI is constructed using shadcn/ui components built on top of Radix UI primitives, providing accessible and customizable interface elements. State management is handled through React Query (TanStack Query) for server state synchronization and caching. The application uses Wouter for lightweight client-side routing and React Hook Form with Zod validation for robust form handling. Styling is implemented with Tailwind CSS, configured with custom design tokens and CSS variables for consistent theming.

**Enhanced Document Processing Module**: Completely redesigned with sophisticated AI-powered analysis featuring:
- **Multi-Stage Processing Pipeline**: Text extraction → AI analysis → Date parsing → Client matching → Validation
- **Real-Time Progress Tracking**: Visual processing stages with individual confidence scores and detailed validation metrics
- **Advanced PDF Support**: Robust extraction with multiple fallback methods and intelligent text recovery
- **Clinical Intelligence**: Automatic extraction of therapeutic themes, emotional states, interventions, risk assessments, and progress ratings
- **Smart Client Matching**: Fuzzy logic algorithms for handling name variations and creating new client records automatically
- **Comprehensive Validation**: Overall quality scoring with breakdowns for text extraction (0-100%), AI analysis confidence, date validation, and client match accuracy
- **Enhanced User Experience**: Tabbed interface with enhanced upload and manual entry options, detailed processing feedback, and alternative interpretation display

## Backend Architecture
The server-side application follows a RESTful API design pattern using Express.js with TypeScript. The architecture separates concerns through distinct modules: route handlers manage HTTP requests and responses, service layers encapsulate business logic for AI processing, calendar integration, and PDF document handling, and a storage abstraction layer provides a clean interface to the database. The server implements middleware for request logging, error handling, and authentication (currently mocked for development). File uploads are handled through Multer with memory storage, supporting document processing workflows.

## Database Design
The data layer utilizes PostgreSQL with Drizzle ORM for type-safe database operations and schema management. The database schema supports comprehensive clinical data management including user accounts for therapists, client demographics and contact information, session scheduling and tracking, progress notes with AI-generated tags and insights, case conceptualizations following evidence-based frameworks, treatment plans with measurable objectives, therapeutic alliance scoring, document storage with metadata, and AI-generated insights with cross-referencing capabilities. The schema uses UUID primary keys for enhanced security and includes proper foreign key relationships to maintain data integrity.

## AI Integration
The application integrates dual AI providers (OpenAI GPT-4o and Anthropic Claude Sonnet 4.0) with comprehensive fallback mechanisms for maximum reliability. AI capabilities include embedding generation for semantic search across clinical documents, automatic clinical tagging of progress notes, pattern recognition and risk assessment analysis, treatment recommendation generation, session preparation assistance, and advanced document processing with client identification and appointment date extraction. Both AI providers use maximum token utilization (4096 tokens) with optimized temperature settings for clinical consistency. The system automatically falls back to Anthropic when OpenAI is unavailable, ensuring continuous AI-powered functionality.

**Document Intelligence**: Advanced AI-powered document analysis extracts client names, appointment dates, session types, and document classification with confidence scoring. Supports batch processing of multiple documents with automatic tagging and metadata extraction. Features intelligent client name matching with fuzzy logic (Chris/Christopher variations), automatic new client creation, session date assignment within 24-hour windows, and manual review workflow for uncertain matches or high-risk content.

## Authentication and Security
The current implementation includes a placeholder authentication system designed for easy replacement with production-grade solutions. The system assumes therapist identification through middleware and includes role-based access patterns in the database schema. All database queries are scoped to the authenticated therapist to ensure data isolation and privacy compliance.

# External Dependencies

## Core Framework Dependencies
- **React 18**: Frontend framework for building the user interface
- **Express.js**: Backend web application framework for Node.js
- **TypeScript**: Type-safe JavaScript for both frontend and backend
- **Vite**: Frontend build tool and development server
- **Node.js**: Server-side JavaScript runtime environment

## Database and ORM
- **PostgreSQL**: Primary database system (configured for but may be added later)
- **Neon Database**: Serverless PostgreSQL provider (@neondatabase/serverless)
- **Drizzle ORM**: Type-safe ORM for database operations and migrations
- **Drizzle Kit**: CLI tools for database schema management and migrations

## UI and Styling
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Radix UI**: Headless UI component library for accessibility
- **shadcn/ui**: Pre-built component library built on Radix UI
- **Lucide React**: Icon library for consistent iconography
- **React Hook Form**: Form handling and validation library
- **Zod**: Schema validation library for TypeScript

## State Management and Data Fetching
- **TanStack React Query**: Server state management and caching
- **Wouter**: Lightweight client-side routing library

## AI and Machine Learning
- **OpenAI API**: GPT-4 and text embedding services for clinical AI features
- **PDF Parse**: Library for extracting text content from PDF documents

## Cloud Services and Storage
- **Google Cloud Storage**: File storage and document management
- **Google Calendar API**: Calendar integration for appointment scheduling
- **Uppy**: File upload handling with cloud storage support

## Development and Build Tools
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing and optimization
- **Autoprefixer**: CSS vendor prefix automation

## File Upload and Processing
- **Multer**: Middleware for handling multipart/form-data and file uploads
- **PDF Parse**: Text extraction from PDF documents for clinical document processing

## Monitoring and Development
- **Replit Development Tools**: Runtime error handling and development banner integration for the Replit environment