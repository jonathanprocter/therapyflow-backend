# Overview
TherapyFlow is a comprehensive clinical management platform for mental health professionals, integrating client management, progress tracking, appointment scheduling, and AI-powered insights. It includes Clinical Second Brain functionality for knowledge graph visualization, proactive therapeutic insights, and contextual memory recall. The platform aims to streamline clinical operations and improve therapeutic effectiveness through intelligent pattern recognition and proactive clinical recommendations.

# User Preferences
Preferred communication style: Simple, everyday language.

## Brand Color Implementation
**Exact Brand Colors** (Applied System-Wide):
- **Ivory (#F2F3F1)**: Primary background
- **Sage (#8EA58C)**: Primary buttons, status indicators
- **Moss (#738A6E)**: Body text, secondary information
- **Evergreen (#344C3D)**: Headers, primary text
- **French Blue (#88A5BC)**: Links, accents, action buttons

**Recent Updates**:
- Calendar page completely redesigned with professional TherapyFlow branding
- Consistent color scheme applied to all UI components
- Enhanced Google Calendar integration display with proper status indicators
- Improved session cards with brand-consistent styling and action buttons
- Fixed all console error issues with proper error handling using toast notifications
- Replaced console.error statements with user-friendly error messages

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
- **Bulk Transcript Processing**: Complete implementation of real AI-powered bulk document processing system:
  * Replaced mock AI processing with EnhancedDocumentProcessor for authentic clinical analysis
  * Real-time transcript processing with comprehensive client matching and date extraction
  * Automatic progress note generation using professional clinical framework
  * Quality-based confidence scoring and manual review flagging
  * Complete database clearing of inconsistent/corrupted processing states
  * Full integration with existing document processing pipeline
  * Comprehensive error handling and processing status tracking
- **Clinical Second Brain**: Complete implementation of advanced therapeutic intelligence system:
  * Knowledge Graph Panel with entity visualization and connection analysis
  * Proactive Insights Panel with session preparation suggestions and therapeutic opportunities
  * Contextual Memory Panel with relevant history patterns and intervention effectiveness tracking
  * Full integration into AI Dashboard with 6-tab navigation system
  * API routes for all Clinical Second Brain functionality with comprehensive mock data
  * Real-time pattern recognition and therapeutic recommendation engine
  * Advanced contextual recall based on current therapeutic activities

## Current Configuration
- Therapist: Dr. Jonathan Procter (License: Licensed Therapist)
- Database: Successfully imported 2,251+ SimplePractice appointments (2018-2025) with complete historical therapy session data.
- **Client Database**: Complete comprehensive client list imported with 66 total clients including full contact information (names, phone numbers, emails). Database now contains structured storage for all counseling practice clients with dedicated spaces for progress notes, documents, and treatment records for each individual.
- Authentication: Mock system configured for Dr. Jonathan Procter (ID: dr-jonathan-procter).
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
- Timezone: Complete system-wide EDT (Eastern Daylight Time) configuration implemented across all components.
- Enhanced AI Document Processing: Comprehensive document processing system with:
  * **Robust PDF Extraction**: Multiple extraction methods including pdf-parse library, fallback byte parsing, and OCR-like text detection.
  * **Advanced Text Preprocessing**: OCR error correction, clinical terminology standardization, header/footer removal, and intelligent text cleaning.
  * **Comprehensive Markdown Removal**: Complete markdown syntax stripping.
  * **Multi-Pass AI Analysis**: Sophisticated clinical data extraction using both Anthropic Claude Sonnet 4.0 and OpenAI GPT-4o with comprehensive fallback mechanisms.
  * **Intelligent Date Parsing**: Support for multiple date formats with fuzzy logic and context-aware extraction.
  * **Advanced Client Matching**: Levenshtein distance algorithms, token similarity, and intelligent name variation handling.
  * **Comprehensive Validation**: Multi-stage validation with detailed confidence scoring for text extraction, AI analysis, date parsing, and client match accuracy.
  * **Enhanced UI**: Sophisticated drag-drop interface with real-time processing feedback, detailed validation scores, and alternative interpretation display.
  * **Clinical Analysis**: Automatic extraction of themes, emotions, interventions, risk levels, progress ratings, and next steps.
  * **Manual Review Workflow**: Intelligent flagging system for uncertain results with detailed processing notes and alternative interpretations.
  * **Format Support**: TXT (optimal), PDF (robust), DOCX (advanced), DOC (basic), RTF (formatted) with quality scoring for each extraction method.
  * **UTF-8 Database Compatibility**: Fixed critical database encoding errors.
  * **Corrupted PDF Detection**: Enhanced PDF text extraction with multiple encoding strategies and intelligent text quality assessment.
  * **Quality Validation Pipeline**: Added text quality assessment before AI processing.

# System Architecture

## Frontend Architecture
The client-side application is built with React and TypeScript, using Vite. UI is constructed using shadcn/ui components built on Radix UI. State management uses React Query, routing uses Wouter, and form handling uses React Hook Form with Zod validation. Styling is with Tailwind CSS, configured with custom design tokens and CSS variables. The Enhanced Document Processing Module features a multi-stage pipeline (text extraction → AI analysis → date parsing → client matching → validation), real-time progress tracking, advanced PDF support, clinical intelligence for automatic extraction, smart client matching, comprehensive validation, and an enhanced user experience with tabbed interface and detailed feedback.

## Backend Architecture
The server-side application follows a RESTful API design pattern using Express.js with TypeScript. It uses route handlers, service layers (for AI processing, calendar integration, PDF handling), and a storage abstraction layer for the database. Middleware handles logging, error handling, and authentication. File uploads are handled through Multer with memory storage.

## Database Design
The data layer uses PostgreSQL with Drizzle ORM for type-safe operations and schema management. The schema supports comprehensive clinical data management including user accounts, client demographics, session scheduling, progress notes (with AI-generated insights), case conceptualizations, treatment plans, therapeutic alliance scoring, document storage, and AI-generated insights, using UUID primary keys and proper foreign key relationships.

## AI Integration
The application integrates dual AI providers (OpenAI GPT-4o and Anthropic Claude Sonnet 4.0) with comprehensive fallback mechanisms. AI capabilities include embedding generation, automatic clinical tagging, pattern recognition and risk assessment, treatment recommendation generation, session preparation assistance, and advanced document processing (client identification, appointment date extraction). Both AI providers use maximum token utilization (4096 tokens) with optimized temperature settings. The system automatically falls back to Anthropic when OpenAI is unavailable. Advanced AI-powered document analysis extracts client names, appointment dates, session types, and document classification with confidence scoring. It supports batch processing, intelligent client name matching, automatic new client creation, session date assignment, and manual review workflow.

## Authentication and Security
Security features include client ownership verification middleware (`verifyClientOwnership`) protecting all client data routes, AES-256-GCM encryption for all sensitive PHI data (notes, contact details, emergency contacts, insurance information), atomic database transactions for clinical data modifications, and secure query helpers (`SecureClientQueries`) for ownership-verified database queries. All progress note operations include client ownership verification and content encryption. Security breach attempts are logged. Therapist identification is through middleware, and role-based access patterns are in the database schema. All database queries are scoped to the authenticated therapist for data isolation and privacy.

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
- **Anthropic Claude Sonnet 4.0**: AI services
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

## Monitoring and Development
- **Replit Development Tools**: Runtime error handling and development banner integration