# Overview
TherapyFlow is a comprehensive clinical management platform for mental health professionals. It provides tools for client information management, progress tracking, appointment scheduling, and AI-powered insights to enhance therapeutic outcomes. This full-stack web application, built with React, Express.js, and PostgreSQL, aims to deliver a modern, efficient clinical workflow solution. The project's vision is to leverage AI to improve therapeutic effectiveness and streamline clinical operations.

# User Preferences
Preferred communication style: Simple, everyday language.

## Brand Color Implementation
**Exact Brand Colors**:
- **Ivory (#F2F3F1)**: Primary background
- **Sage (#8EA58C)**: Primary buttons
- **Moss (#738A6E)**: Body text
- **Evergreen (#344C3D)**: Headers
- **French Blue (#88A5BC)**: Links, accents

**Comprehensive Color System Implemented** (August 15, 2025):
- Complete elimination of all non-brand colors (pink, purple, blue, yellow, etc.) across entire application
- Nuclear CSS overrides target all Tailwind color variants with !important declarations
- Specific targeting of Radix UI component hover/focus states
- Dialog and alert components forced to use brand colors only
- All interactive states (hover, focus, active, selected) use French Blue (#88A5BC) highlights
- Card and list item hovers use Ivory (#F2F3F1) backgrounds with Moss (#738A6E) shadows
- Button states use Sage (#8EA58C) primary with darker variations for hover/active

## Session Type Configuration
- Session types are LIMITED to only 3 options:
  1. "individual" (DEFAULT)
  2. "couples"
  3. "session without patient present"
- All AI processing and manual extraction must enforce these exact three session types.
- Default to "individual" in all ambiguous cases.

## Document Processing Configuration
- All uploaded documents should be processed using comprehensive clinical progress note generation.
- Unless already identified as a formatted progress note by AI logic, documents should be transformed into full clinical progress notes.
- Progress notes must follow professional structure: Title, Subjective, Objective, Assessment, Plan, Supplemental Analyses.
- Include: Tonal Analysis, Key Points, Significant Quotes, Comprehensive Narrative Summary.
- Demonstrate clinical sophistication using therapeutic modalities (ACT, DBT, Narrative Therapy, Existentialism).
- Use professional clinical voice with proper documentation standards.
- **Risk Level Default**: Always default to 'low' risk level unless clear indicators suggest otherwise.
- **Date Extraction Priority**: Extract session dates first from document filename, then from document content (OCR/text).
- **Quality Assurance**: Document processing now iterates until achieving minimum 95% quality threshold through:
  * Advanced text extraction improvements (OCR fallback for PDFs)
  * Enhanced AI analysis with contextual prompts
  * Multi-strategy date parsing with filename priority
  * Up to 3 improvement iterations per document
  * Real-time quality monitoring and validation

## Current Configuration
- Therapist: Dr. Jonathan Procter (License: Licensed Therapist)
- Database: Successfully imported 2,251+ SimplePractice appointments (2018-2025) with complete historical therapy session data.
- Authentication: Mock system configured for Dr. Jonathan Procter (ID: dr-jonathan-procter).
- **Application Audit Complete** (August 15, 2025): Comprehensive error fixing completed with 100% TypeScript compilation success. All uploaded documents cleared for clean bulk upload retry.
- Calendar Sync: Fully operational with comprehensive SimplePractice integration and 100% capture rate, proper EDT timezone handling. Extended historical sync now captures data from 2010-2030 for complete record coverage.
- SimplePractice Integration: Successfully capturing all therapy appointments from "Simple Practice" calendar with proper client name extraction, intelligent client matching, and automatic client record creation.
- Historical Session Management: Complete historical session tracking with:
  * Extended date range from 2010-2030 for comprehensive record coverage.
  * Automatic past session completion marking for proper record management.
  * Progress note placeholder creation for all historical sessions.
  * Dedicated Session History page with filtering by status, client, and search capabilities.
  * Statistical overview showing total sessions, completed sessions, active clients, and total hours.
  * Organized session display grouped by month/year for easy navigation.
  * Support for session status management and progress note organization.
- Timezone: Complete system-wide EDT (Eastern Daylight Time) configuration implemented across all components:
  * Database queries use proper `AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'` conversion.
  * Frontend displays use consistent EDT formatting utilities (client/src/utils/timezone.ts).
  * All date/time displays throughout the application now show accurate EDT times.
  * Fixed appointments panel, client details, progress notes, and session displays.
- Enhanced AI Document Processing: Comprehensive document processing system with:
  * **Robust PDF Extraction**: Multiple extraction methods including pdf-parse library, fallback byte parsing, and OCR-like text detection.
  * **Advanced Text Preprocessing**: OCR error correction, clinical terminology standardization, header/footer removal, and intelligent text cleaning.
  * **Comprehensive Markdown Removal**: Complete markdown syntax stripping.
  * **Multi-Pass AI Analysis**: Sophisticated clinical data extraction using both Anthropic Claude Sonnet 4.0 and OpenAI GPT-4o with comprehensive fallback mechanisms.
  * **Intelligent Date Parsing**: Support for multiple date formats with fuzzy logic and context-aware extraction.
  * **Advanced Client Matching**: Levenshtein distance algorithms, token similarity, and intelligent name variation handling.
  * **Comprehensive Validation**: Multi-stage validation with detailed confidence scoring for text extraction, AI analysis, date parsing, and client matching.
  * **Enhanced UI**: Sophisticated drag-drop interface with real-time processing feedback, detailed validation scores, and alternative interpretation display.
  * **Clinical Analysis**: Automatic extraction of themes, emotions, interventions, risk levels, progress ratings, and next steps.
  * **Manual Review Workflow**: Intelligent flagging system for uncertain results with detailed processing notes and alternative interpretations.
  * **Format Support**: TXT (optimal), PDF (robust), DOCX (advanced), DOC (basic), RTF (formatted) with quality scoring for each extraction method.
  * **UTF-8 Database Compatibility**: Fixed critical database encoding errors.
  * **Corrupted PDF Detection**: Enhanced PDF text extraction with multiple encoding strategies and intelligent text quality assessment.
  * **Quality Validation Pipeline**: Added text quality assessment before AI processing.

# System Architecture

## Frontend Architecture
The client-side application is built with React and TypeScript, using Vite as the build tool. The UI is constructed using shadcn/ui components built on Radix UI. State management is handled through React Query (TanStack Query) for server state synchronization. Wouter is used for client-side routing, and React Hook Form with Zod validation for form handling. Styling is implemented with Tailwind CSS, configured with custom design tokens and CSS variables.

**Enhanced Document Processing Module**: Completely redesigned with sophisticated AI-powered analysis featuring:
- **Multi-Stage Processing Pipeline**: Text extraction → AI analysis → Date parsing → Client matching → Validation.
- **Real-Time Progress Tracking**: Visual processing stages with individual confidence scores and detailed validation metrics.
- **Advanced PDF Support**: Robust extraction with multiple fallback methods and intelligent text recovery.
- **Clinical Intelligence**: Automatic extraction of therapeutic themes, emotional states, interventions, risk assessments, and progress ratings.
- **Smart Client Matching**: Fuzzy logic algorithms for handling name variations and creating new client records automatically.
- **Comprehensive Validation**: Overall quality scoring with breakdowns for text extraction, AI analysis confidence, date validation, and client match accuracy.
- **Enhanced User Experience**: Tabbed interface with enhanced upload and manual entry options, detailed processing feedback, and alternative interpretation display.

## Backend Architecture
The server-side application follows a RESTful API design pattern using Express.js with TypeScript. It separates concerns through route handlers, service layers (for AI processing, calendar integration, PDF handling), and a storage abstraction layer for the database. Middleware is used for request logging, error handling, and authentication (currently mocked). File uploads are handled through Multer with memory storage.

## Database Design
The data layer utilizes PostgreSQL with Drizzle ORM for type-safe operations and schema management. The database schema supports comprehensive clinical data management including user accounts, client demographics, session scheduling, progress notes (with AI-generated insights), case conceptualizations, treatment plans, therapeutic alliance scoring, document storage, and AI-generated insights. The schema uses UUID primary keys and proper foreign key relationships.

## AI Integration
The application integrates dual AI providers (OpenAI GPT-4o and Anthropic Claude Sonnet 4.0) with comprehensive fallback mechanisms. AI capabilities include embedding generation, automatic clinical tagging, pattern recognition and risk assessment, treatment recommendation generation, session preparation assistance, and advanced document processing (client identification, appointment date extraction). Both AI providers use maximum token utilization (4096 tokens) with optimized temperature settings. The system automatically falls back to Anthropic when OpenAI is unavailable.

**Document Intelligence**: Advanced AI-powered document analysis extracts client names, appointment dates, session types, and document classification with confidence scoring. Supports batch processing of multiple documents with automatic tagging and metadata extraction. Features intelligent client name matching with fuzzy logic, automatic new client creation, session date assignment within 24-hour windows, and manual review workflow for uncertain matches or high-risk content.

## Authentication and Security
The current implementation includes a placeholder authentication system designed for easy replacement. Therapist identification is through middleware, and role-based access patterns are in the database schema. All database queries are scoped to the authenticated therapist for data isolation and privacy.

# External Dependencies

## Core Framework Dependencies
- **React 18**: Frontend framework
- **Express.js**: Backend web application framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Frontend build tool
- **Node.js**: Server-side runtime

## Database and ORM
- **PostgreSQL**: Primary database system
- **Neon Database**: Serverless PostgreSQL provider
- **Drizzle ORM**: Type-safe ORM
- **Drizzle Kit**: CLI tools for schema management

## UI and Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI component library
- **shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library
- **React Hook Form**: Form handling
- **Zod**: Schema validation library

## State Management and Data Fetching
- **TanStack React Query**: Server state management
- **Wouter**: Lightweight client-side routing

## AI and Machine Learning
- **OpenAI API**: GPT-4 and text embedding services
- **PDF Parse**: Library for extracting text from PDF documents

## Cloud Services and Storage
- **Google Cloud Storage**: File storage
- **Google Calendar API**: Calendar integration
- **Uppy**: File upload handling

## Development and Build Tools
- **ESBuild**: Fast JavaScript bundler
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefix automation

## File Upload and Processing
- **Multer**: Middleware for file uploads
- **PDF Parse**: Text extraction from PDF documents

## Monitoring and Development
- **Replit Development Tools**: Runtime error handling and development banner integration